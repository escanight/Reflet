// Génère des visages SYNTHÉTIQUES (dessins vectoriels) pour les tests de bout en bout.
// Les repères sont placés aux coordonnées du modèle canonique MediaPipe.
// Ce ne sont pas des photos de personnes réelles.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const fx = JSON.parse(readFileSync(new URL("../tests/fixtures/canonical.json", import.meta.url)));
const P = fx.points;
function face(dx, dy, lightBias) {
  const t = (p) => ({ x: p.x + dx, y: p.y + dy });
  const q = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, t(v)]));
  const eye = (o, i) => `<path d="M${o.x} ${o.y} Q${(o.x + i.x) / 2} ${o.y - 26} ${i.x} ${i.y} Q${(o.x + i.x) / 2} ${o.y + 22} ${o.x} ${o.y}Z" fill="#f4efe8" stroke="#3a2a22" stroke-width="4"/><circle cx="${(o.x + i.x) / 2}" cy="${(o.y + i.y) / 2}" r="17" fill="#4a3426"/><circle cx="${(o.x + i.x) / 2}" cy="${(o.y + i.y) / 2}" r="7" fill="#111"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200">
  <defs><radialGradient id="g" cx="${0.5 + lightBias}" cy="0.4" r="0.7"><stop offset="0" stop-color="#d9a882"/><stop offset="1" stop-color="#a8775a"/></radialGradient>
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${Math.round(dx * 7 + dy * 3)}"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.18 0"/></filter></defs>
  <rect width="1000" height="1200" fill="#6d7a83"/>
  <ellipse cx="${500 + dx}" cy="${560 + dy}" rx="330" ry="420" fill="url(#g)"/>
  <path d="M${q.eyeOuterL.x - 20} ${q.eyeOuterL.y - 60} Q${q.eyeOuterL.x + 50} ${q.eyeOuterL.y - 95} ${q.eyeInnerL.x + 5} ${q.eyeInnerL.y - 62}" stroke="#3a2a22" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path d="M${q.eyeOuterR.x + 20} ${q.eyeOuterR.y - 60} Q${q.eyeOuterR.x - 50} ${q.eyeOuterR.y - 95} ${q.eyeInnerR.x - 5} ${q.eyeInnerR.y - 62}" stroke="#3a2a22" stroke-width="14" fill="none" stroke-linecap="round"/>
  ${eye(q.eyeOuterL, q.eyeInnerL)}${eye(q.eyeOuterR, q.eyeInnerR)}
  <path d="M${500 + dx} ${q.eyeInnerL.y + 10} L${q.alarL.x + 20} ${q.alarL.y - 10}" stroke="#8d5f45" stroke-width="5" fill="none"/>
  <path d="M${q.alarL.x} ${q.alarL.y} Q${q.alarL.x - 6} ${q.subnasale.y} ${q.subnasale.x} ${q.subnasale.y} Q${q.alarR.x + 6} ${q.subnasale.y} ${q.alarR.x} ${q.alarR.y}" stroke="#6e4734" stroke-width="6" fill="none"/>
  <path d="M${q.mouthL.x} ${q.mouthL.y} Q${q.stomion.x} ${q.stomion.y - 34} ${q.mouthR.x} ${q.mouthR.y} Q${q.stomion.x} ${q.stomion.y + 44} ${q.mouthL.x} ${q.mouthL.y}Z" fill="#b5615a"/>
  <path d="M${q.mouthL.x} ${q.mouthL.y} Q${q.stomion.x} ${q.stomion.y + 4} ${q.mouthR.x} ${q.mouthR.y}" stroke="#5a2a28" stroke-width="4" fill="none"/>
  <rect width="1000" height="1200" filter="url(#n)"/>
  </svg>`;
  return { svg, points: q };
}
const variants = [[0, 0, 0], [6, -4, 0.02], [-5, 5, -0.02]];
const out = [];
for (const [i, [dx, dy, lb]] of variants.entries()) {
  const { svg, points } = face(dx, dy, lb);
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(new URL(`../e2e/fixtures/visage-synthetique-${i + 1}.jpg`, import.meta.url).pathname);
  out.push(points);
}
writeFileSync(new URL("../e2e/fixtures/points.json", import.meta.url), JSON.stringify(out, null, 1));
// Photo « de téléphone » : pixels en paysage + étiquette EXIF orientation 6.
const rotated = await sharp(new URL("../e2e/fixtures/visage-synthetique-1.jpg", import.meta.url).pathname).rotate(-90).toBuffer();
await sharp(rotated).withMetadata({ orientation: 6 }).jpeg().toFile(new URL("../e2e/fixtures/exif-orientation-6.jpg", import.meta.url).pathname);
console.log("ok");
