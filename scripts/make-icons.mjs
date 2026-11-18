// Membuat ikon PWA dari SVG. Jalankan: node scripts/make-icons.mjs
import sharp from "sharp";

const glyph = (s) => `<g transform="translate(${(512 - 240 * s) / 2} ${(512 - 240 * s) / 2}) scale(${10 * s})" fill="none" stroke="#06130c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></g>`;
const icon = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0c1211"/>
  <circle cx="256" cy="256" r="${pad ? 150 : 200}" fill="#29d970"/>
  ${glyph(pad ? 0.85 : 1.1)}
</svg>`;

const out = "public/icons";
await sharp(Buffer.from(icon(false))).resize(192).png().toFile(`${out}/icon-192.png`);
await sharp(Buffer.from(icon(false))).resize(512).png().toFile(`${out}/icon-512.png`);
await sharp(Buffer.from(icon(true))).resize(512).png().toFile(`${out}/maskable-512.png`);
await sharp(Buffer.from(icon(false))).resize(180).png().toFile(`${out}/apple-touch-icon.png`);
console.log("ikon dibuat");
