// Parcours principaux (Chromium mobile). Visages SYNTHÉTIQUES, repérage manuel forcé.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { startServer } from "../scripts/serve.mjs";
import { FIX, onboard, placePoints, forceManual, shot } from "./helpers.mjs";

const PORT = 4190;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server, parent, browser;

before(async () => {
  process.env.FRAMEABLE = "1";
  server = await startServer(PORT);
  parent = http.createServer((q, r) => {
    r.writeHead(200, { "content-type": "text/html" });
    r.end(`<iframe id="f" src="${ORIGIN}/" sandbox="allow-scripts allow-same-origin allow-forms" style="width:390px;height:800px;border:0"></iframe>`);
  }).listen(PORT + 1);
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
  parent?.close();
});

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...opts });
  const page = await ctx.newPage();
  await page.addInitScript(forceManual);
  const external = [];
  const errors = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, ctx, external, errors };
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ headers: res.headers, body }));
    }).on("error", reject);
  });
}

test("en-têtes de sécurité : CSP qui interdit toute connexion externe", async () => {
  const res = await get(`${ORIGIN}/`);
  assert.match(res.headers["content-security-policy"], /connect-src 'self'/);
  assert.match(res.body, /http-equiv="Content-Security-Policy"/);
});

test("parcours complet : scan (galerie), résultat, programme, XP, suivi, suppression", async () => {
  const { page, ctx, external, errors } = await newPage();
  await page.goto(`${ORIGIN}/`);
  await shot(page, "01-accueil-onboarding");
  await onboard(page);
  await page.getByRole("heading", { name: "Reflet" }).waitFor();
  await shot(page, "02-accueil");

  await page.getByTestId("nav-analyse").click();
  // Sans caméra disponible : écran de choix de photo.
  await page.getByTestId("file-gallery").first().setInputFiles(join(FIX, "visage-synthetique-1.jpg"));
  await placePoints(page, 0);
  await page.getByRole("heading", { name: "Ton résultat" }).waitFor();
  await shot(page, "03-resultat-manuel");
  const text = await page.locator("#view").innerText();
  assert.match(text, /Symétrie/i);
  assert.match(text, /Qualité photo/i);
  for (const banned of [/\bsub ?[0-9]/i, /\bPSL\b/, /\bChad\b/i, /\/10\b/]) assert.doesNotMatch(text, banned);

  // Programme
  await page.getByTestId("nav-programme").click();
  await page.getByText("Je me rase de près").click();
  await page.getByText("J'ai souvent des boutons").click();
  await page.getByRole("button", { name: "Voir mon programme" }).click();
  await page.getByRole("heading", { name: "Programme" }).waitFor();
  assert.match(await page.locator("#view").innerText(), /Technique de rasage/);
  await page.getByRole("button", { name: /Suivre ces/ }).click();
  await shot(page, "04-programme");

  // Accueil : cocher une habitude donne de l'XP
  await page.getByTestId("nav-accueil").click();
  await page.locator(".today-item").first().click();
  await page.locator(".today-item.done").first().waitFor();
  assert.match(await page.locator(".rank-card").innerText(), /60 XP/); // 30 (programme) + 10 (habitude) + 20 (scan de qualité)
  await shot(page, "05-accueil-xp");

  // Profil
  await page.getByTestId("nav-profil").click();
  await page.getByRole("heading", { name: "Les rangs" }).waitFor();
  await shot(page, "06-profil");

  // Stockage : jamais de photo ni de repère
  const blob = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith("reflet:")).map(([, v]) => v).join(""));
  assert.ok(!/data:image|base64|eyeOuter|menton/.test(blob));

  await page.goto(`${ORIGIN}/#donnees`);
  assert.match(await page.locator("#view").innerText(), /Aucune requête vers un autre site/);
  await page.getByRole("button", { name: "Supprimer toutes mes données" }).click();
  await page.locator("#confirm-wipe").click();
  await page.getByRole("button", { name: "Commencer" }).waitFor();
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("reflet:"))), []);

  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("moins de 18 ans : pas de scan du visage", async () => {
  const { page, ctx, errors } = await newPage();
  await page.goto(`${ORIGIN}/`);
  await onboard(page, false);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByText("réservé aux 18 ans et plus").waitFor();
  assert.equal(await page.getByTestId("file-gallery").count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("fichier non image refusé", async () => {
  const { page, ctx } = await newPage();
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  const fake = join(mkdtempSync(join(tmpdir(), "reflet-")), "faux.jpg");
  writeFileSync(fake, "<svg xmlns='http://www.w3.org/2000/svg'></svg>");
  await page.getByTestId("file-gallery").first().setInputFiles(fake);
  await page.getByText("n'est pas une image JPEG").waitFor();
  await ctx.close();
});

test("quitter l'écran pendant l'analyse : rien ne revient s'afficher", async () => {
  const { page, ctx } = await newPage();
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByTestId("file-gallery").first().setInputFiles(join(FIX, "visage-synthetique-2.jpg"));
  await page.getByTestId("nav-profil").click();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator(".landmark-canvas").count(), 0);
  assert.match(await page.locator("#page-title").innerText(), /Profil/);
  await ctx.close();
});

test("affichage ordinateur : navigation latérale, sans erreur", async () => {
  const { page, ctx, errors } = await newPage({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.locator(".brand").waitFor({ state: "visible" });
  for (const r of ["programme", "suivi", "profil", "glossaire", "aide", "donnees"]) {
    await page.goto(`${ORIGIN}/#${r}`);
    await page.locator("#page-title").waitFor();
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("cadre restreint + stockage refusé : la galerie fonctionne", async () => {
  const { page, ctx, errors } = await newPage({ viewport: { width: 400, height: 820 } });
  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
    } catch { /* ignoré */ }
  });
  await page.goto(`http://127.0.0.1:${PORT + 1}/`);
  const f = page.frameLocator("#f");
  await onboard(f);
  await f.getByTestId("cta-scan").click();
  const chooserP = page.waitForEvent("filechooser", { timeout: 8000 });
  await f.getByTestId("file-gallery").first().tap();
  const chooser = await chooserP;
  assert.equal(await chooser.element().getAttribute("accept"), "image/*");
  await chooser.setFiles(join(FIX, "visage-synthetique-2.jpg"));
  await f.locator(".landmark-canvas").waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("orientation EXIF respectée (photo de téléphone tournée)", async () => {
  const { page, ctx } = await newPage();
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByTestId("file-gallery").first().setInputFiles(join(FIX, "exif-orientation-6.jpg"));
  const dims = await page.locator(".landmark-canvas").evaluate((c) => [c.width, c.height]);
  assert.deepEqual(dims, [1000, 1200]);
  await ctx.close();
});

test("sans modèle automatique : pas de bascule forcée vers les 11 points, seulement sur demande", { skip: existsSync(new URL("../site/vendor/mediapipe/face_landmarker.task", import.meta.url).pathname) && "modèle présent" }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByTestId("file-gallery").first().setInputFiles(join(FIX, "visage-synthetique-1.jpg"));
  await page.getByText("Le scan automatique n'est pas disponible").waitFor({ timeout: 10000 });
  assert.equal(await page.locator(".landmark-canvas").count(), 0);
  await page.getByRole("button", { name: "Placer les points moi-même" }).click();
  await page.locator(".landmark-canvas").waitFor();
  await ctx.close();
});

test("photo choisie pendant que la caméra démarre : l'erreur de caméra n'écrase pas l'analyse", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(forceManual);
  // Caméra qui échoue lentement (500 ms), après le choix de la photo.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise((_, rej) => setTimeout(() => rej(new DOMException("x", "NotAllowedError")), 500));
  });
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.getByTestId("cta-scan").click();
  await page.getByTestId("file-gallery").first().setInputFiles(join(FIX, "visage-synthetique-1.jpg"));
  await page.waitForTimeout(900);
  await page.locator(".landmark-canvas").waitFor({ timeout: 5000 });
  await ctx.close();
});
