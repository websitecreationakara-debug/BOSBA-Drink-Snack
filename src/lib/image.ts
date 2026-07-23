// Client-side image downscale + re-encode so large photos fit under the D1 BLOB
// limit (2 MB hard cap). Runs in the browser before upload. SVG/GIF pass through
// untouched (vector / animation would be ruined by canvas re-encoding).

type CompressOpts = { maxDim?: number; targetBytes?: number };

export async function compressImage(file: File, opts: CompressOpts = {}): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const maxDim = opts.maxDim ?? 1600;
  const targetBytes = opts.targetBytes ?? 1_200_000;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const encode = (type: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));

  let quality = 0.85;
  let blob = await encode("image/webp", quality);
  let ext = "webp";
  let type = "image/webp";

  // Some browsers can't encode webp from canvas — fall back to jpeg.
  if (!blob) {
    blob = await encode("image/jpeg", quality);
    ext = "jpg";
    type = "image/jpeg";
  }
  if (!blob) return file;

  while (blob.size > targetBytes && quality > 0.4) {
    quality -= 0.15;
    blob = (await encode(type, quality)) ?? blob;
  }

  // If re-encoding didn't actually shrink it (already-optimized small file), keep the original.
  if (blob.size >= file.size) return file;

  const base = file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name;
  return new File([blob], `${base}.${ext}`, { type });
}
