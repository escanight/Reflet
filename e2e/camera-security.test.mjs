// Caméra intégrée (périphérique simulé de Chromium), blocage par une visionneuse,
// image piégée et stockage corrompu.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { startServer } from "../scripts/serve.mjs";
import { forceManual, onboard as onboardH, shot } from "./helpers.mjs";

const PORT = 4230;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server, parent, browser;

before(async () => {
  process.env.FRAMEABLE = "1";
  server = await startServer(PORT);
  // Visionneuse qui intègre Reflet SANS autoriser la caméra (cas de l'app Claude).
  parent = http.createServer((q, r) => {
    r.writeHead(200, { "content-type": "text/html" });
    r.end(`<iframe id="f" src="${ORIGIN}/" sandbox="allow-scripts allow-same-origin" style="width:390px;height:800px;border:0"></iframe>`);
  }).listen(PORT + 1);
  browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
});
after(async () => {
  await browser?.close();
  server?.close();
  parent?.close();
});

const onboard = (p) => onboardH(p);

test("caméra intégrée : viseur, capture, caméra éteinte, passage au repérage", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
  const page = await ctx.newPage();
  await page.addInitScript(forceManual);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.getByTestId("cta-scan").tap();
  await page.waitForFunction(() => (document.querySelector("video")?.videoWidth ?? 0) > 0, null, { timeout: 10000 });
  await shot(page, "10-camera");
  await page.getByRole("button", { name: "Lancer le scan" }).tap();
  await page.locator(".landmark-canvas").waitFor({ timeout: 15000 });
  assert.equal(await page.locator("video").count(), 0, "plus aucun flux vidéo après la capture");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("caméra : quitter l'écran l'éteint", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera"] });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  await page.waitForFunction(() => (document.querySelector("video")?.videoWidth ?? 0) > 0, null, { timeout: 10000 });
  const trackRef = await page.evaluateHandle(() => document.querySelector("video").srcObject.getTracks()[0]);
  await page.goto(`${ORIGIN}/#programme`);
  assert.equal(await trackRef.evaluate((t) => t.readyState), "ended");
  await ctx.close();
});

test("visionneuse qui bloque la caméra : message clair, choix de photo toujours possible", async () => {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 820 }, permissions: ["camera"] });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT + 1}/`);
  const f = page.frameLocator("#f");
  await onboard(f);
  await f.getByTestId("cta-scan").click();
  await f.getByText(/bloque la caméra|Accès à la caméra refusé/).waitFor({ timeout: 10000 });
  assert.equal(await f.getByTestId("file-gallery").count(), 1);
  await ctx.close();
});

test("image piégée (en-tête 50 000 × 50 000) refusée avant décodage", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/`);
  await onboard(page);
  await page.goto(`${ORIGIN}/#analyse`);
  const png = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0xc3, 0x50, 0, 0, 0xc3, 0x50, 8, 6]).copy(png);
  const file = join(mkdtempSync(join(tmpdir(), "reflet-")), "bombe.png");
  writeFileSync(file, png);
  await page.getByTestId("file-gallery").first().setInputFiles(file);
  await page.getByText("dimensions de cette image sont démesurées").waitFor();
  await ctx.close();
});

test("stockage local corrompu ou modifié : l'application démarre quand même", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("reflet:settings", '{"onboarded":true,"adult":true,"__proto__":{"x":1}}');
    localStorage.setItem("reflet:analysisLog", '["<img src=x onerror=alert(1)>", 42]');
    localStorage.setItem("reflet:profile", "{pas du json");
  });
  await page.goto(`${ORIGIN}/#programme`);
  await page.locator("#page-title").waitFor();
  assert.equal(await page.locator("img[src=x]").count(), 0, "aucune injection HTML");
  assert.deepEqual(errors, []);
  await ctx.close();
});
