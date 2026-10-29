// Tests du moteur de recommandations, de la note du scan, de la validation
// des fichiers et du chiffrement local.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADVICE, DEFAULT_PROFILE, WARNINGS } from "../site/js/recommendations/catalog.js";
import { buildProgram, selectAdvice } from "../site/js/recommendations/engine.js";
import { checkFile, sniffFormat, fitSize, pixelFingerprint, MAX_FILE_BYTES } from "../site/js/image/validate.js";
import { generateKey, seal, unseal } from "../site/js/storage/crypto.js";
import { GLOSSARY } from "../site/js/content/glossary.js";

const ids = (p) => selectAdvice(p).map((a) => a.id);

test("catalogue : chaque conseil a objectif, niveau de preuve, limites et sources", () => {
  for (const a of ADVICE) {
    assert.ok(a.objective && a.limits && a.how.length, a.id);
    assert.ok(["etabli", "plausible", "expert", "nonprouve"].includes(a.evidence), a.id);
    assert.ok(a.sources.length > 0, `${a.id} sans source`);
    for (const s of a.sources) assert.match(s.url, /^https:\/\//);
  }
  for (const w of WARNINGS) assert.match(w.source.url, /^https:\/\//);
});

test("catalogue : aucun conseil dangereux ni prescription", () => {
  const text = JSON.stringify(ADVICE.map((a) => [a.title, a.how])).toLowerCase();
  for (const banned of ["mewing", "bone smash", "finastéride", "minoxidil", "isotrétinoïne", "jeûne", "chewing-gum"]) {
    assert.ok(!text.includes(banned), banned);
  }
});

test("le socle est toujours présent", () => {
  const s = ids({ ...DEFAULT_PROFILE, goals: ["cheveux"] });
  for (const id of ["spf", "teeth", "sleep", "photo"]) assert.ok(s.includes(id), id);
});

test("règles de personnalisation : barbe, rasage, acné, tabac", () => {
  assert.ok(ids({ ...DEFAULT_PROFILE, facialHair: "rase", goals: ["sommeil"] }).includes("shave"), "la réponse sur la pilosité suffit");
  assert.ok(!ids({ ...DEFAULT_PROFILE, facialHair: "aucune", goals: ["rasage"] }).includes("shave"));
  assert.ok(!ids({ ...DEFAULT_PROFILE, facialHair: "longue", goals: ["rasage"] }).includes("shave"));
  assert.ok(ids({ ...DEFAULT_PROFILE, facialHair: "longue", goals: ["rasage"] }).includes("beard"));
  assert.ok(!ids({ ...DEFAULT_PROFILE, acne: false, goals: ["peau"] }).includes("acne"));
  assert.ok(ids({ ...DEFAULT_PROFILE, acne: true, goals: ["peau"] }).includes("acne"));
  assert.ok(!ids({ ...DEFAULT_PROFILE, smoker: false }).includes("tobacco"));
  assert.ok(ids({ ...DEFAULT_PROFILE, smoker: true }).includes("tobacco"));
});

test("mineurs : notes adaptées (sommeil, alcool, acné)", () => {
  const prog = buildProgram({ ...DEFAULT_PROFILE, adult: false, acne: true, goals: ["peau", "sommeil"] });
  const notes = prog.sections.flatMap((s) => s.items).flatMap((v) => v.notes).join(" ");
  assert.match(notes, /8 à 10 heures/);
  assert.match(notes, /zéro alcool/);
  assert.match(notes, /parent/);
});

test("budget temps : au-delà, les gestes deviennent optionnels", () => {
  const p = { ...DEFAULT_PROFILE, minutesPerDay: 5, facialHair: "courte", skin: "seche", goals: ["peau", "rasage", "dents"] };
  const prog = buildProgram(p);
  const all = prog.sections.flatMap((s) => s.items);
  assert.ok(all.some((v) => v.optional));
});

test("indices de l'analyse : le conseil photo est expliqué", () => {
  const prog = buildProgram(DEFAULT_PROFILE, { issueIds: ["distance"] });
  const photo = prog.sections.flatMap((s) => s.items).find((v) => v.advice.id === "photo");
  assert.ok(photo.reason);
});



test("validation des fichiers par signature binaire", () => {
  assert.equal(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
  assert.equal(sniffFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(sniffFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "webp");
  assert.equal(sniffFormat(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])), "heic");
  assert.equal(sniffFormat(new TextEncoder().encode("<svg xmlns=")), "unknown");
  assert.equal(checkFile(MAX_FILE_BYTES + 1, new Uint8Array([0xff, 0xd8, 0xff])).ok, false);
  assert.equal(checkFile(0, new Uint8Array()).ok, false);
  assert.equal(checkFile(1000, new TextEncoder().encode("%PDF-1.7")).ok, false);
  assert.equal(checkFile(1000, new Uint8Array([0xff, 0xd8, 0xff])).ok, true);
});

test("réduction de taille et empreinte", () => {
  assert.deepEqual(fitSize(4000, 3000, 1280), { width: 1280, height: 960 });
  assert.deepEqual(fitSize(800, 600, 1280), { width: 800, height: 600 });
  const a = new Uint8ClampedArray(64 * 64 * 4).fill(10);
  const b = new Uint8ClampedArray(64 * 64 * 4).fill(200);
  assert.notEqual(pixelFingerprint(a, 64, 64), pixelFingerprint(b, 64, 64));
  assert.equal(pixelFingerprint(a, 64, 64), pixelFingerprint(a.slice(), 64, 64));
});

test("chiffrement local AES-GCM : aller-retour et intégrité", async () => {
  const k = await generateKey();
  const sealed = await seal(k, { a: 1, s: "é" });
  assert.ok(!sealed.data.includes("é"));
  assert.deepEqual(await unseal(k, sealed), { a: 1, s: "é" });
  const tampered = { ...sealed, data: sealed.data.slice(0, -4) + "AAAA" };
  await assert.rejects(unseal(k, tampered));
  const other = await generateKey();
  await assert.rejects(unseal(other, sealed));
});

test("glossaire : chaque terme a un statut", () => {
  for (const t of GLOSSARY) assert.ok(t.status && t.text.length > 40, t.term);
});

import { symmetryIndex, qualityScore } from "../site/js/analysis/summary.js";


test("indice de symétrie : fourchette honnête, null si rien de mesurable", () => {
  assert.equal(symmetryIndex([]).value, null);
  const o = (id, est, low, high) => ({ id, level: "confirm", estimate: est, low, high, photosUsed: 3, influences: [], disagreement: false });
  const s = symmetryIndex([o("outerCanthusOffset", 2, -1, 5), o("mentonMidline", -4, -7, -1)]);
  assert.equal(s.value, 97);
  assert.equal(s.high, 100); // meilleur cas : écarts 0 et 1 → 99,5, arrondi à 100
  assert.ok(s.low <= s.value && s.value <= s.high);
  assert.equal(qualityScore([]).score, 0);
});

import { scanNote, tierFor, TIERS } from "../site/js/analysis/summary.js";

test("note du scan /20 = 5 critères /4, paliers sans insulte", () => {
  const photo = (issues) => ({ issues, blocked: issues.some((i) => i.severity === "block") });
  const perfect = scanNote(photo([]));
  assert.equal(perfect.total, 20);
  assert.equal(perfect.tier.name, "TROP BEAU WOLA 🗿🔥");
  const selfie = scanNote(photo([{ id: "distance", severity: "warn" }, { id: "expression", severity: "warn" }, { id: "lateralLight", severity: "warn" }]));
  assert.equal(selfie.total, 14);
  assert.equal(selfie.criteria.find((c) => c.id === "distance").points, 0);
  assert.equal(selfie.tier.name, "Ça passe tranquille 😂");
  const flou = scanNote(photo([{ id: "blur", severity: "block" }]));
  assert.equal(flou.criteria.find((c) => c.id === "nettete").points, 0);
  assert.equal(scanNote(undefined).total, 0);
  assert.equal(tierFor(4.5).name, "Aïe aïe aïe frérot 💀");
  assert.equal(tierFor(5).name, "Faut travailler ça mon reuf 😭");
  assert.equal(tierFor(15).name, "Propre de fou wola 🔥");
  assert.equal(tierFor(18).name, "TROP BEAU WOLA 🗿🔥");
  for (const t of TIERS) assert.doesNotMatch(t.name + t.line, /floco|zgeg|fdp/i);
});

import { zoneScores } from "../site/js/analysis/summary.js";

test("notes /10 des zones : symétrie mesurée, 10 = parfaitement symétrique", () => {
  const o = (id, est, level = "confirm") => ({ id, level, estimate: level === "uncertain" ? undefined : est, rawEstimate: est, low: est - 1, high: est + 1, photosUsed: 3, influences: [], disagreement: false });
  const z = zoneScores([o("outerCanthusOffset", 0), o("eyeWidthDiff", 0), o("alarOffset", 2.4), o("subnasaleMidline", 2.4), o("mentonMidline", 6, "uncertain")]);
  const by = Object.fromEntries(z.map((x) => [x.id, x]));
  assert.equal(by.yeux.score, 10);
  assert.equal(by.nez.score, 8);
  assert.equal(by.menton.score, 5);
  assert.equal(by.menton.precision, 1, "valeur indicative quand la marge d'erreur est large");
  assert.equal(by.bouche.score, null);
});
