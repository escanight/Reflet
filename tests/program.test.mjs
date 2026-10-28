// Tests du moteur de recommandations, du suivi d'habitudes, de la validation
// des fichiers et du chiffrement local.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADVICE, DEFAULT_PROFILE, WARNINGS } from "../site/js/recommendations/catalog.js";
import { buildProgram, selectAdvice } from "../site/js/recommendations/engine.js";
import { createHabit, toggleDone, toggleReserve, weekDays, weekProgress, weekStart, reserveUsed, weeksReached } from "../site/js/habits/tracker.js";
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

test("budget temps : au-delà, les gestes deviennent optionnels ; 3 habitudes au plus", () => {
  const p = { ...DEFAULT_PROFILE, minutesPerDay: 5, facialHair: "courte", skin: "seche", goals: ["peau", "rasage", "dents"] };
  const prog = buildProgram(p);
  const all = prog.sections.flatMap((s) => s.items);
  assert.ok(all.some((v) => v.optional));
  assert.ok(prog.suggestedHabits.length <= 3);
  assert.equal(prog.suggestedHabits[0].adviceId, "spf");
});

test("indices de l'analyse : le conseil photo est expliqué", () => {
  const prog = buildProgram(DEFAULT_PROFILE, { issueIds: ["distance"] });
  const photo = prog.sections.flatMap((s) => s.items).find((v) => v.advice.id === "photo");
  assert.ok(photo.reason);
});

test("suivi : semaine du lundi, réserve limitée à 2, aucune série", () => {
  const wed = new Date(2026, 9, 28); // mercredi 28 octobre 2026
  assert.equal(weekStart(wed).getDay(), 1);
  const days = weekDays(wed);
  assert.equal(days[0], "2026-10-26");
  assert.equal(days[6], "2026-11-01");
  let h = createHabit("Test", 5, "Quand…", undefined, wed);
  h = toggleDone(h, days[0]);
  h = toggleDone(h, days[1]);
  h = toggleReserve(h, days[2], wed);
  h = toggleReserve(h, days[3], wed);
  h = toggleReserve(h, days[4], wed); // refusé : 2 maximum
  assert.equal(reserveUsed(h, wed), 2);
  assert.ok(!h.reserve.includes(days[4]));
  const p = weekProgress(h, wed);
  assert.equal(p.done, 2);
  assert.ok(!/série|échec|raté/i.test(p.message));
  h = toggleDone(h, days[0]);
  assert.equal(weekProgress(h, wed).done, 1);
  assert.equal(weeksReached(h, wed), 0);
});

test("createHabit borne les valeurs saisies", () => {
  const h = createHabit("x".repeat(200), 12, "y".repeat(500));
  assert.equal(h.weeklyTarget, 7);
  assert.equal(h.label.length, 80);
  assert.equal(h.cue.length, 200);
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
