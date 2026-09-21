// Server-only: pads/letterboxes an arbitrary product photo onto a
// 1080x1920 (9:16) white canvas before it's handed to TikTok. TikTok's photo
// Direct Post rejects square/landscape e-commerce product shots outright with
// "picture_size_check_failed" -- see the /api/social/tiktok-image middleware
// in src/start.ts, which fetches the original and runs it through this.
import {
  PhotonImage,
  Rgba,
  SamplingFilter,
  resize,
  padding_left,
  padding_right,
  padding_top,
  padding_bottom,
} from "@cf-wasm/photon/workerd";

const TARGET_W = 1080;
const TARGET_H = 1920;

function padSide(
  img: PhotonImage,
  amount: number,
  fn: (img: PhotonImage, padding: number, rgba: Rgba) => PhotonImage,
  color: Rgba,
): PhotonImage {
  if (amount <= 0) return img;
  const out = fn(img, amount, color);
  img.free();
  return out;
}

export function padForTiktok(bytes: Uint8Array): Uint8Array {
  const input = PhotonImage.new_from_byteslice(bytes);
  const srcW = input.get_width();
  const srcH = input.get_height();

  // Contain the source inside the target canvas, then letterbox the
  // remainder in white -- never crops, so the product photo stays intact.
  const scale = Math.min(TARGET_W / srcW, TARGET_H / srcH);
  const newW = Math.max(1, Math.round(srcW * scale));
  const newH = Math.max(1, Math.round(srcH * scale));

  let img = resize(input, newW, newH, SamplingFilter.Lanczos3);
  input.free();

  const padX = TARGET_W - newW;
  const padY = TARGET_H - newH;
  const white = new Rgba(255, 255, 255, 255);

  img = padSide(img, Math.floor(padX / 2), padding_left, white);
  img = padSide(img, padX - Math.floor(padX / 2), padding_right, white);
  img = padSide(img, Math.floor(padY / 2), padding_top, white);
  img = padSide(img, padY - Math.floor(padY / 2), padding_bottom, white);

  const out = img.get_bytes_jpeg(90);
  white.free();
  img.free();
  return out;
}
