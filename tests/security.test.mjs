// Tests de sécurité : données stockées corrompues, bombes de décompression.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeSettings, sanitizeProfile, sanitizeHabits, sanitizeLog } from "../site/js/storage/schema.js";
import { readDimensions, dimensionsAcceptable, sniffFormat } from "../site/js/image/validate.js";

test("réglages corrompus ou malveillants : valeurs par défaut, aucune clé inconnue", () => {
  assert.deepEqual(sanitizeSettings(null), { onboarded: false, adult: null, historyEnabled: false, noticeAcceptedAt: null });
  const evil = JSON.parse('{"__proto__":{"admin":true},"onboarded":"yes","adult":1,"extra":"<img onerror=x>"}');
  const s = sanitizeSettings(evil);
  assert.deepEqual(Object.keys(s).sort(), ["adult", "historyEnabled", "noticeAcceptedAt", "onboarded"]);
  assert.equal(s.onboarded, false);
  assert.equal(s.adult, null);
  assert.equal({}.admin, undefined);
});

test("profil : énumérations et bornes respectées", () => {
  const p = sanitizeProfile({ skin: "<script>", minutesPerDay: 999, goals: ["peau", "hack", "peau"], budget: "infini", adult: "true" });
  assert.equal(p.skin, "nsp");
  assert.equal(p.minutesPerDay, 10);
  assert.deepEqual(p.goals, ["peau"]);
  assert.equal(p.budget, "minimal");
  assert.equal(p.adult, true); // valeur par défaut, pas la chaîne
});

test("habitudes : entrées invalides ignorées, tailles bornées", () => {
  const h = sanitizeHabits([
    null, 42, { id: 1, label: "x" },
    { id: "a", label: "x".repeat(500), weeklyTarget: 99, cue: "y".repeat(900), done: ["2026-10-28", "pas une date", 5, "2026-10-28"], reserve: "nope" },
  ]);
  assert.equal(h.length, 1);
  assert.equal(h[0].label.length, 80);
  assert.equal(h[0].weeklyTarget, 5);
  assert.equal(h[0].cue.length, 200);
  assert.deepEqual(h[0].done, ["2026-10-28"]);
  assert.deepEqual(h[0].reserve, []);
  assert.deepEqual(sanitizeHabits("pas un tableau"), []);
  assert.equal(sanitizeHabits(Array.from({ length: 100 }, (_, i) => ({ id: `h${i}`, label: "a" }))).length, 20);
});

test("journal : seules des dates ISO sont gardées", () => {
  assert.deepEqual(sanitizeLog(["2026-10-28T01:00:00.000Z", "x", 3]), ["2026-10-28T01:00:00.000Z"]);
});

test("dimensions lues dans l'en-tête (JPEG, PNG)", () => {
  const jpg = new Uint8Array(readFileSync(new URL("../e2e/fixtures/visage-synthetique-1.jpg", import.meta.url)));
  assert.deepEqual(readDimensions(jpg, sniffFormat(jpg)), { width: 1000, height: 1200 });
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  png.set([0, 0, 0xc3, 0x50, 0, 0, 0xc3, 0x50], 16); // 50 000 × 50 000
  const d = readDimensions(png, "png");
  assert.deepEqual(d, { width: 50000, height: 50000 });
  assert.equal(dimensionsAcceptable(d), false, "bombe de décompression refusée");
  assert.equal(dimensionsAcceptable({ width: 4032, height: 3024 }), true);
});
