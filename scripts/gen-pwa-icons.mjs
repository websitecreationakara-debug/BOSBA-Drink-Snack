import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = root + "public/logo.png";
const iconsDir = root + "public/icons";
await mkdir(iconsDir, { recursive: true });

const white = { r: 255, g: 255, b: 255, alpha: 1 };

// Transparent square icons (used as "any" purpose).
for (const size of [192, 512]) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`${iconsDir}/icon-${size}.png`);
}

// Maskable icon: logo at ~70% on an opaque background so the launcher's mask
// (circle/squircle) never clips the artwork.
const maskSize = 512;
const inner = Math.round(maskSize * 0.7);
const logo = await sharp(src).resize(inner, inner, { fit: "contain", background: white }).png().toBuffer();
await sharp({ create: { width: maskSize, height: maskSize, channels: 4, background: white } })
  .composite([{ input: logo, gravity: "center" }])
  .png()
  .toFile(`${iconsDir}/maskable-512.png`);

// Apple touch icon: 180px, opaque (iOS ignores transparency / adds black).
await sharp(src)
  .resize(180, 180, { fit: "contain", background: white })
  .flatten({ background: white })
  .png()
  .toFile(root + "public/apple-touch-icon.png");

console.log("PWA icons generated in public/icons and public/apple-touch-icon.png");
