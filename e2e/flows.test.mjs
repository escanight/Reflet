// Tests de bout en bout (Chromium, viewport mobile) avec Playwright.
// Utilise des visages SYNTHÉTIQUES dessinés (e2e/fixtures), jamais de vraies photos.
// Prérequis : `npm run build`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { chromium } from "playwright";
import { startServer } from "../scripts/serve.mjs";

const PORT = 4190;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const FIX = new URL("./fixtures/", import.meta.url).pathname;
const pts = JSON.parse(readFileSync(join(FIX, "points.json")));
const ORDER = ["eyeOuterL", "eyeInnerL", "eyeInnerR", "eyeOuterR", "alarL", "alarR", "subnasale", "mouthL", "mouthR", "stomion", "menton"];

let server, browser;
let parent;
before(async () => {
  process.env.FRAMEABLE = "1";
  server = await startServer(PORT);
  // Page hôte d'une autre origine qui intègre Reflet dans un cadre restreint,
  // comme le font les visionneuses d'artefacts et les aperçus intégrés.
  parent = http
    .createServer((q, r) => {
      r.writeHead(200, { "content-type": "text/html" });
      r.end(`<iframe id="f" src="${ORIGIN}/" sandbox="allow-scripts allow-same-origin allow-forms" style="width:390px;height:800px;border:0"></iframe>`);
    })
    .listen(PORT + 1);
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
  const external = [];
  const errors = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(ORIGIN) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, ctx, external, errors };
}

async function onboard(page, adult = true) {
  await page.goto(`${ORIGIN}/`);
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: "J'ai compris" }).click();
  await page.getByRole("button", { name: adult ? "Oui, 18 ans ou plus" : "Non, moins de 18 ans" }).click();
}

async function placePoints(page, k) {
  const c = page.locator(".landmark-canvas");
  await c.waitFor();
  for (const id of ORDER) {
    const box = await c.boundingBox();
    const W = await c.evaluate((el) => el.width);
    const s = box.width / W;
    const j = ((id.length * 7 + k * 3) % 5) - 2;
    await page.mouse.click(box.x + (pts[k][id].x + j) * s, box.y + (pts[k][id].y - j) * s);
  }
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
  const csp = res.headers["content-security-policy"];
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /default-src 'self'/);
  const html = res.body;
  assert.match(html, /http-equiv="Content-Security-Policy"/);
});

test("parcours complet en repérage manuel : 3 photos, résultats, programme, suivi, suppression", async () => {
  const { page, ctx, external, errors } = await newPage();
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByText("Repérage manuel").first().waitFor();
  await page.getByText("À environ 1 m ou plus").click();

  for (let k = 0; k < 3; k++) {
    await page.getByTestId("file-gallery").setInputFiles(join(FIX, `visage-synthetique-${k + 1}.jpg`));
    await placePoints(page, k);
    await page.getByRole("button", { name: "Valider les repères" }).click();
    await page.locator(".review-canvas").waitFor();
    if (k === 0) {
      // Même photo une seconde fois : refusée.
      await page.getByRole("button", { name: /Ajouter une autre photo/ }).click();
      await page.getByTestId("file-gallery").setInputFiles(join(FIX, "visage-synthetique-1.jpg"));
      await page.getByText("déjà été ajoutée").waitFor();
      continue;
    }
    if (k < 2) await page.getByRole("button", { name: /Ajouter une autre photo/ }).click();
  }
  await page.getByRole("button", { name: "Voir les résultats" }).click();
  await page.getByRole("heading", { name: "Vos observations" }).waitFor();

  const text = await page.locator("#view").innerText();
  assert.match(text, /3 photos retenues/);
  assert.match(text, /Symétrie apparente/);
  assert.match(text, /Ce que Reflet ne mesure pas/);
  for (const banned of [/\bscore\s*:/i, /\/10\b/, /\/100\b/, /\bPSL\s*:/]) assert.doesNotMatch(text, banned);
  const badges = await page.locator(".obs .badge").allInnerTexts();
  assert.equal(badges.length, 12);

  // Programme
  await page.goto(`${ORIGIN}/#programme`);
  await page.getByText("Je me rase de près").click();
  await page.getByText("J'ai souvent des boutons").click();
  await page.getByRole("button", { name: "Voir mon programme" }).click();
  await page.getByRole("heading", { name: "Mon programme" }).waitFor();
  assert.match(await page.locator("#view").innerText(), /Technique de rasage/);
  await page.getByRole("button", { name: /Suivre ces/ }).click();

  // Suivi
  await page.goto(`${ORIGIN}/#suivi`);
  const today = page.locator(".day.today").first();
  await today.click();
  await page.locator(".day.today.done").first().waitFor();

  // Les photos ne sont jamais stockées ; seul le profil, les habitudes et les réglages le sont.
  const stored = await page.evaluate(() => Object.keys(localStorage).sort());
  assert.deepEqual(stored, ["reflet:analysisLog", "reflet:habits", "reflet:profile", "reflet:profileSet", "reflet:settings"]);
  const blob = await page.evaluate(() => Object.values(localStorage).join(""));
  assert.ok(!/data:image|base64/.test(blob));
  assert.ok(!/eyeOuter|menton/.test(blob), "aucun repère facial stocké");

  // Tout supprimer
  await page.goto(`${ORIGIN}/#donnees`);
  assert.match(await page.locator("#view").innerText(), /Aucune requête vers un autre site/);
  await page.getByRole("button", { name: "Supprimer toutes mes données" }).click();
  await page.locator("#confirm-wipe").click();
  await page.getByRole("button", { name: "Commencer" }).waitFor();
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("reflet:"))), []);

  assert.deepEqual(external, [], "aucune requête vers un autre site");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("moins de 18 ans : pas de mesure du visage", async () => {
  const { page, ctx, errors } = await newPage();
  await onboard(page, false);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByText("réservées aux 18 ans et plus").waitFor();
  assert.equal(await page.getByTestId("file-gallery").count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("fichier non image refusé", async () => {
  const { page, ctx } = await newPage();
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByText("Je ne sais pas").click();
  const dir = mkdtempSync(join(tmpdir(), "reflet-"));
  const fake = join(dir, "faux.jpg");
  writeFileSync(fake, "<svg xmlns='http://www.w3.org/2000/svg'></svg>");
  await page.getByTestId("file-gallery").setInputFiles(fake);
  await page.getByText("n'est pas une image JPEG").waitFor();
  await ctx.close();
});

test("photo de face sur fond uni (aucun repère placé) : rien n'est inventé", async () => {
  const { page, ctx } = await newPage();
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.getByText("À bout de bras", { exact: true }).click();
  await page.getByTestId("file-gallery").setInputFiles(join(FIX, "visage-synthetique-1.jpg"));
  await page.locator(".landmark-canvas").waitFor();
  assert.equal(await page.getByRole("button", { name: "Valider les repères" }).isDisabled(), true);
  await page.goto(`${ORIGIN}/#resultats`);
  await page.getByText("Aucune analyse dans cette séance").waitFor();
  await ctx.close();
});

test("affichage ordinateur : navigation latérale, sans erreur", async () => {
  const { page, ctx, errors } = await newPage({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  await onboard(page);
  await page.locator(".brand").waitFor({ state: "visible" });
  for (const r of ["programme", "glossaire", "aide", "donnees"]) {
    await page.goto(`${ORIGIN}/#${r}`);
    await page.locator("#page-title").waitFor();
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("cadre restreint, stockage refusé, distance non renseignée : le sélecteur s'ouvre et la photo est traitée", async () => {
  const { page, ctx, errors } = await newPage({ viewport: { width: 400, height: 820 } });
  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
    } catch { /* ignoré */ }
  });
  await page.goto(`http://127.0.0.1:${PORT + 1}/`);
  const f = page.frameLocator("#f");
  await f.getByRole("button", { name: "Commencer" }).click();
  await f.getByRole("button", { name: "J'ai compris" }).click();
  await f.getByRole("button", { name: "Oui, 18 ans ou plus" }).click();
  await f.getByRole("link", { name: "Commencer une analyse" }).click();
  const chooserP = page.waitForEvent("filechooser", { timeout: 5000 });
  await f.locator("#photo-input").tap();
  const chooser = await chooserP;
  assert.equal(await chooser.element().getAttribute("accept"), "image/*");
  await chooser.setFiles(join(FIX, "visage-synthetique-2.jpg"));
  await f.locator(".landmark-canvas").waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("orientation EXIF respectée (photo de téléphone tournée)", async () => {
  const { page, ctx } = await newPage();
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  // Pixels stockés en paysage 1200×1000 avec l'étiquette EXIF « orientation 6 ».
  await page.getByTestId("file-gallery").setInputFiles(join(FIX, "exif-orientation-6.jpg"));
  const dims = await page.locator(".landmark-canvas").evaluate((c) => [c.width, c.height]);
  assert.deepEqual(dims, [1000, 1200]);
  await ctx.close();
});

test("toucher le bouton ouvre le sélecteur ; s'il ne s'ouvre pas, une aide apparaît ; le collage fonctionne", async () => {
  const { page, ctx, errors } = await newPage();
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  // 1. Le doigt touche directement le champ fichier transparent.
  const chooserP = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.locator("#photo-input").tap();
  const chooser = await chooserP;
  // 2. Sélecteur intercepté sans perte de focus (comme une visionneuse qui le bloque) : l'aide s'affiche.
  await page.getByText("La galerie ne s'est pas ouverte ?").waitFor({ timeout: 5000 });
  await chooser.setFiles([]);
  // 3. Méthode de secours : coller une image.
  await page.getByText("Autre méthode : coller une photo").click();
  const bytes = [...readFileSync(join(FIX, "visage-synthetique-3.jpg"))];
  await page.getByTestId("paste-zone").evaluate((el, data) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(data)], "photo.jpg", { type: "image/jpeg" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, bytes);
  await page.locator(".landmark-canvas").waitFor({ timeout: 10000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});
