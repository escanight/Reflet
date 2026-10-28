// Génère les icônes de l'application installable (PWA) à partir d'un SVG.
import sharp from "sharp";
const svg = (pad) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#111214"/>
<g transform="translate(256 256) scale(${1 - pad})">
<circle r="170" fill="none" stroke="#E8C98C" stroke-width="34"/>
<path d="M0 -170 A170 170 0 0 1 0 170 Z" fill="#E8C98C"/></g></svg>`);
for (const [name, size, pad] of [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["maskable-512.png", 512, 0.25], ["apple-touch-icon.png", 180, 0.1]]) {
  await sharp(svg(pad)).resize(size, size).png().toFile(new URL(`../public/icons/${name}`, import.meta.url).pathname);
}
console.log("icônes générées");
