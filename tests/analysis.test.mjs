// Tests des calculs (géométrie, incertitude, qualité, observations).
// Fixture : modèle canonique MediaPipe projeté de face (tests/fixtures/canonical.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFrame, computeMetrics, sanityCheck } from "../site/js/analysis/geometry.js";
import { normalizePairs, pointsFromMediapipe, POINT_IDS } from "../site/js/analysis/points.js";
import { sampleMetrics, intervalOf, mulberry32 } from "../site/js/analysis/uncertainty.js";
import { sharpness, exposure, lateralLighting, evaluateQuality } from "../site/js/analysis/quality.js";
import { analyzePhoto, buildSession, observeMetric, InvalidPointsError, describe } from "../site/js/analysis/observations.js";
import { compareSessions, toStored } from "../site/js/analysis/history.js";
import { poseFromMatrix } from "../site/js/analysis/detector.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/canonical.json", import.meta.url)));
const P = fx.points;

const map = (pts, f) => Object.fromEntries(Object.entries(pts).map(([k, v]) => [k, f(v)]));
const rotate = (pts, deg, c = { x: 500, y: 500 }) => {
  const a = (deg * Math.PI) / 180;
  return map(pts, (p) => ({ x: c.x + (p.x - c.x) * Math.cos(a) - (p.y - c.y) * Math.sin(a), y: c.y + (p.x - c.x) * Math.sin(a) + (p.y - c.y) * Math.cos(a) }));
};
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

function texturedImage(w = 1000, h = 1000, fn = (x, y) => 128 + 60 * Math.sin(x / 3) * Math.cos(y / 4)) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = fn(i % w, (i / w) | 0);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

const goodCtx = (over = {}) => ({
  mode: "auto", distance: "far", imageShortSide: 1000,
  pose: { yawDeg: 1, pitchDeg: 1, rollDeg: 0 }, expression: { blink: 0.05, smile: 0.05, jawOpen: 0.01 }, faceCount: 1,
  declared: { facingCamera: true, mouthClosed: true, neutral: true, noGlasses: true }, ...over,
});

test("visage canonique : symétrie parfaite et rapports attendus", () => {
  const m = computeMetrics(P);
  for (const k of ["eyeWidthDiff", "outerCanthusOffset", "mouthCornerOffset", "alarOffset", "subnasaleMidline", "stomionMidline", "mentonMidline", "mouthLineAngle"]) {
    close(m[k], 0, 1e-9);
  }
  // Rapports calculés à la main depuis le modèle canonique.
  close(m.eyeWidthRatio, ((4.45 - 1.86) / (2 * 1.86)), 0.01);
  close(m.noseIntercanthalRatio, (2 * 1.79) / (2 * 1.86), 0.01);
  close(m.mouthNoseRatio, (2 * 2.46) / (2 * 1.79), 0.01);
  assert.ok(m.lowerFaceRatio > 0.38 && m.lowerFaceRatio < 0.46);
});

test("invariance au roulis, à la translation et à l'échelle", () => {
  const base = computeMetrics(P);
  const moved = map(rotate(P, 17), (p) => ({ x: p.x * 1.7 + 33, y: p.y * 1.7 - 12 }));
  const m = computeMetrics(moved);
  for (const k of Object.keys(base)) close(m[k], base[k], 1e-6);
  close(buildFrame(rotate(P, 17)).rollDeg, 17, 1e-6);
});

test("une asymétrie introduite est mesurée avec le bon signe", () => {
  const D = buildFrame(P).d;
  const q = { ...P, mouthL: { x: P.mouthL.x - 0.05 * D, y: P.mouthL.y }, menton: { x: P.menton.x + 0.1 * D, y: P.menton.y } };
  const m = computeMetrics(q);
  close(m.mouthCornerOffset, 5, 1e-6);
  close(m.mentonMidline, 10, 1e-6);
  const r = computeMetrics({ ...P, mouthR: { x: P.mouthR.x, y: P.mouthR.y + 0.05 * D } });
  assert.ok(r.mouthLineAngle < 0, "coin droit plus bas → angle négatif");
});

test("normalizePairs remet gauche/droite dans l'ordre de l'image", () => {
  const swapped = { ...P, eyeOuterL: P.eyeOuterR, eyeOuterR: P.eyeOuterL, mouthL: P.mouthR, mouthR: P.mouthL };
  const n = normalizePairs(swapped);
  assert.ok(n.eyeOuterL.x < n.eyeOuterR.x && n.mouthL.x < n.mouthR.x);
  assert.deepEqual(computeMetrics(n), computeMetrics(P));
});

test("correspondance des indices MediaPipe sur le maillage canonique", () => {
  const pts = pointsFromMediapipe(fx.mesh);
  for (const id of POINT_IDS) {
    close(pts[id].x, P[id].x, 0.01);
    close(pts[id].y, P[id].y, 0.01);
  }
  assert.throws(() => pointsFromMediapipe(fx.mesh.slice(0, 100)));
});

test("sanityCheck refuse des repères incohérents", () => {
  assert.deepEqual(sanityCheck(P), []);
  const bad = { ...P, menton: { x: 500, y: 300 } };
  assert.ok(sanityCheck(bad).length > 0);
});

test("Monte-Carlo : déterministe, contient la vraie valeur, s'élargit avec σ", () => {
  const a = sampleMetrics(P, 0.023, 300);
  const b = sampleMetrics(P, 0.023, 300);
  assert.deepEqual(a.eyeWidthRatio, b.eyeWidthRatio);
  const iv = intervalOf(a.eyeWidthRatio);
  const truth = computeMetrics(P).eyeWidthRatio;
  assert.ok(iv.low < truth && truth < iv.high);
  const wide = intervalOf(sampleMetrics(P, 0.05, 300).eyeWidthRatio);
  assert.ok(wide.high - wide.low > iv.high - iv.low);
  const r = mulberry32(1);
  const xs = Array.from({ length: 1000 }, r);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test("netteté : un flou fait baisser l'indicateur", () => {
  const w = 120, h = 120;
  const sharp = new Float32Array(w * h).map((_, i) => (((i % w) >> 2) + ((i / w) >> 2)) % 2);
  const blurred = new Float32Array(w * h);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    let s = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += sharp[(y + dy) * w + x + dx];
    blurred[y * w + x] = s / 25;
  }
  assert.ok(sharpness(sharp, w, h) > 3 * sharpness(blurred, w, h));
});

test("exposition et éclairage latéral", () => {
  const dark = new Float32Array(100).fill(0.01);
  assert.equal(exposure(dark).clippedLow, 1);
  const side = new Float32Array(100).map((_, i) => (i % 10 < 5 ? 0.2 : 0.8));
  assert.ok(lateralLighting(side, 10, 10) > 0.5);
});

test("contrôles : distance, lacet, plusieurs visages", () => {
  const px = { eyeDistancePx: 200, sharpness: 1, meanLuma: 0.5, clipped: 0, lateralLight: 0 };
  assert.deepEqual(evaluateQuality(px, goodCtx(), 0), []);
  const near = evaluateQuality(px, goodCtx({ distance: "near" }), 0);
  assert.ok(near.some((i) => i.id === "distance" && i.affects.includes("noseIntercanthalRatio")));
  const yaw = evaluateQuality(px, goodCtx({ pose: { yawDeg: 18, pitchDeg: 0, rollDeg: 0 } }), 0);
  assert.ok(yaw.some((i) => i.id === "yaw"));
  const two = evaluateQuality(px, goodCtx({ faceCount: 2 }), 0);
  assert.ok(two.some((i) => i.id === "faces" && i.severity === "block"));
  const tiny = evaluateQuality({ ...px, eyeDistancePx: 10 }, goodCtx(), 0);
  assert.ok(tiny.some((i) => i.severity === "block"));
});

test("une photo bloquée ne produit aucune mesure", () => {
  const flat = texturedImage(1000, 1000, () => 128); // aucune texture → flou
  const a = analyzePhoto("x", P, flat, goodCtx());
  assert.equal(a.blocked, true);
  assert.deepEqual(Object.keys(a.intervals), []);
  const s = buildSession([a], "far");
  assert.ok(s.observations.every((o) => o.level === "uncertain" && o.estimate === undefined));
});

test("analyzePhoto rejette des repères incohérents", () => {
  assert.throws(() => analyzePhoto("x", { ...P, menton: { x: 500, y: 200 } }, texturedImage(), goodCtx()), InvalidPointsError);
});

test("niveaux : une photo ne peut jamais être « fiable »", () => {
  const a = analyzePhoto("a", P, texturedImage(), goodCtx());
  const s = buildSession([a], "far");
  assert.ok(s.observations.every((o) => o.level !== "reliable"));
});

test("niveaux : 3 photos concordantes peuvent être « fiables » ; discordantes, non", () => {
  const img = texturedImage();
  const D = buildFrame(P).d;
  const jitter = (k) => map(P, (p) => ({ x: p.x + k * 0.002 * D, y: p.y - k * 0.001 * D }));
  const photos = [0, 1, 2].map((k) => analyzePhoto(`p${k}`, jitter(k), img, goodCtx()));
  const s = buildSession(photos, "far");
  assert.ok(s.observations.some((o) => o.level === "reliable"));
  const far = [0, 1, 2].map((k) => analyzePhoto(`q${k}`, { ...P, menton: { x: P.menton.x + (k - 1) * 0.25 * D, y: P.menton.y } }, img, goodCtx()));
  const o = observeMetric("mentonMidline", far);
  assert.notEqual(o.level, "reliable");
});

test("les mesures liées au nez sont masquées pour un selfie de près", () => {
  const img = texturedImage();
  const photos = [0, 1, 2].map((k) => analyzePhoto(`p${k}`, map(P, (p) => ({ x: p.x + k, y: p.y })), img, goodCtx({ distance: "near" })));
  const o = observeMetric("noseIntercanthalRatio", photos);
  assert.equal(o.level, "uncertain");
  assert.equal(o.estimate, undefined);
  assert.match(o.hiddenReason, /près/);
});

test("mode manuel : les mesures sensibles à l'orientation restent « à confirmer »", () => {
  const img = texturedImage();
  const ctx = { mode: "manual", distance: "far", imageShortSide: 1000, declared: { facingCamera: true, mouthClosed: true, neutral: true, noGlasses: true } };
  const photos = [0, 1, 2].map((k) => analyzePhoto(`p${k}`, map(P, (p) => ({ x: p.x + k * 0.3, y: p.y })), img, ctx));
  const o = observeMetric("subnasaleMidline", photos);
  assert.notEqual(o.level, "reliable");
});

test("describe : aucune formulation de jugement", () => {
  const img = texturedImage();
  const photos = [0, 1, 2].map((k) => analyzePhoto(`p${k}`, map(P, (p) => ({ x: p.x + k * 0.5, y: p.y })), img, goodCtx()));
  const s = buildSession(photos, "far");
  for (const o of s.observations) {
    const t = describe(o).toLowerCase();
    for (const banned of ["défaut", "imperfection", "idéal", "score", "note", "psl", "attirant"]) assert.ok(!t.includes(banned), `${o.id}: ${t}`);
  }
});

test("historique : comparaison seulement dans des conditions identiques", () => {
  const img = texturedImage();
  const photos = [0, 1, 2].map((k) => analyzePhoto(`p${k}`, map(P, (p) => ({ x: p.x + k * 0.5, y: p.y })), img, goodCtx()));
  const s1 = toStored(buildSession(photos, "far", new Date("2026-01-01")));
  const s2 = toStored(buildSession(photos, "far", new Date("2026-02-01")));
  const c = compareSessions(s1, s2);
  assert.equal(c.comparable, true);
  assert.ok(c.changes.every((x) => x.kind === "stable"));
  assert.equal(compareSessions(s1, { ...s2, distance: "near" }).comparable, false);
});

test("pose depuis la matrice (colonne par colonne)", () => {
  const a = (20 * Math.PI) / 180;
  // Rotation autour de Y (lacet), stockée colonne par colonne.
  const R = [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
  const p = poseFromMatrix(R);
  close(Math.abs(p.yawDeg), 20, 1e-6);
  close(p.pitchDeg, 0, 1e-6);
});

test("la séance conserve les problèmes de prise de vue (sans les photos)", () => {
  const img = texturedImage();
  const photos = [0, 1].map((k) => analyzePhoto(`p${k}`, map(P, (p) => ({ x: p.x + k, y: p.y })), img, goodCtx({ distance: "near" })));
  const s = buildSession(photos, "near");
  assert.ok(s.issueIds.includes("distance"));
  assert.ok(!("points" in s));
});

test("photo unique analysée sous 3 cadrages : jamais « fiable », valeurs affichées si stables", () => {
  const img = texturedImage();
  const variants = [0, 1, 2].map((k) => analyzePhoto(`v${k}`, map(P, (p) => ({ x: p.x + k * 0.4, y: p.y })), img, goodCtx()));
  const s = buildSession(variants, "far", new Date(), { sourcePhotos: 1 });
  assert.equal(s.photos, 1);
  assert.ok(s.observations.every((o) => o.level !== "reliable"));
  assert.ok(s.observations.some((o) => o.level === "confirm" && o.estimate !== undefined));
  assert.ok(s.observations.some((o) => o.influences.some((t) => /plusieurs cadrages/.test(t))));
});
