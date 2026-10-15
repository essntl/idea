/** Renders every icon from branding/icon.svg: `node scripts/make-icons.mjs` */
import sharp from "sharp";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tile = readFileSync(`${root}/branding/icon.svg`, "utf8").trim();
// Full-bleed square (Apple and some launchers round the corners themselves).
const square = tile.replace('rx="18" ', "");
const png = (svg, size) => sharp(Buffer.from(svg), { density: Math.max(72, (size / 100) * 72 * 1.0) }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// ICO with embedded PNG images (supported by every current browser and Windows).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

const sizes = [16, 32, 48];
const icoImages = await Promise.all(sizes.map(async (size) => ({ size, data: await png(tile, size) })));
writeFileSync(`${root}/src/app/favicon.ico`, ico(icoImages));
writeFileSync(`${root}/src/app/apple-icon.png`, await png(square, 180));
writeFileSync(`${root}/public/icon-256.png`, await png(tile, 256));
writeFileSync(`${root}/branding/icon-512.png`, await png(tile, 512));
writeFileSync(`${root}/branding/icon-1024.png`, await png(tile, 1024));
writeFileSync(`${root}/branding/avatar-1024.png`, await png(square, 1024));
copyFileSync(`${root}/branding/icon.svg`, `${root}/src/app/icon.svg`);

// GitHub social preview, 1280×640.
const mark = tile.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640">
<rect width="1280" height="640" fill="#0a0a0a"/>
<g transform="translate(150 190) scale(2.6)">${mark.replace('fill="#0a0a0a"', 'fill="#0a0a0a" stroke="#2a2a2a" stroke-width="0.6"')}</g>
<text x="470" y="318" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="128" font-weight="600" letter-spacing="-4" fill="#f2f2f2">idea</text>
<text x="474" y="392" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="34" fill="#8a8a8a">Notes, articles and projects. Self-hosted.</text>
</svg>`;
writeFileSync(`${root}/branding/social-preview.png`, await sharp(Buffer.from(social)).png({ compressionLevel: 9 }).toBuffer());
console.log("done");
