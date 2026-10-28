// Scan AUTOMATIQUE avec le vrai modèle MediaPipe et une vraie photo de visage
// (jeu de test officiel MediaPipe). Exécuté par la CI GitHub ; ignoré en
// local si le modèle ou la photo ne sont pas présents.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { startServer } from "../scripts/serve.mjs";
import { onboard, shot } from "./helpers.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const MODEL = join(ROOT, "site/vendor/mediapipe/face_landmarker.task");
const PHOTO = join(ROOT, "e2e/fixtures/real/portrait.jpg");
const VIDEO = join(ROOT, "e2e/fixtures/real/portrait.y4m");
const ready = existsSync(MODEL) && existsSync(PHOTO);
const PORT = 4250;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server;

before(async () => {
  if (ready) server = await startServer(PORT);
});
after(() => server?.close());

test("modèle réel : photo de la galerie → détection automatique → résultat", { skip: !ready && "modèle ou photo de test absents" }, async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
  page.on("request", (r) => !r.url().startsWith(ORIGIN) && !r.url().startsWith("blob:") && !r.url().startsWith("data:") && external.push(r.url()));
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByTestId("file-gallery").first().setInputFiles(PHOTO);
  await page.locator(".scan-stage").waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
  await shot(page, "20-scan-animation-modele-reel");
  await page.getByRole("heading", { name: "Ton résultat" }).waitFor({ timeout: 60000 });
  const text = await page.locator("#view").innerText();
  console.log("RÉSULTAT (galerie) :\n" + text.slice(0, 900));
  assert.match(text, /scan automatique/);
  assert.equal(await page.locator(".landmark-canvas").count(), 0, "pas de repli manuel");
  const values = await page.locator(".stat-card-value").allInnerTexts();
  console.log("VALEURS DES CARTES :", values.join(" | "));
  assert.ok(values.slice(1).some((v) => v.trim() !== "—"), "au moins une mesure affichée sur une photo unique");
  await shot(page, "21-resultat-modele-reel");
  await page.locator(".stat-card").first().click();
  await shot(page, "22-resultat-detail");
  assert.deepEqual(external, [], "aucune requête externe, modèle compris");
  assert.deepEqual(errors, []);
  await browser.close();
});

test("modèle réel : caméra (vidéo simulée) → rafale de 3 images → résultat", { skip: !(ready && existsSync(VIDEO)) && "vidéo de test absente" }, async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${VIDEO}`] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ["camera"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.getByTestId("cta-scan").click();
  await page.waitForFunction(() => (document.querySelector("video")?.videoWidth ?? 0) > 0, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  await shot(page, "23-camera-modele-reel");
  await page.getByRole("button", { name: "Lancer le scan" }).click();
  await page.getByRole("heading", { name: "Ton résultat" }).waitFor({ timeout: 60000 });
  const text = await page.locator("#view").innerText();
  console.log("RÉSULTAT (caméra) :\n" + text.slice(0, 600));
  assert.match(text, /images? · scan automatique/);
  await shot(page, "24-resultat-camera-modele-reel");
  assert.deepEqual(errors, []);
  await browser.close();
});
