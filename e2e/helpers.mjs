// Outils partagés des tests de bout en bout.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";

export const FIX = new URL("./fixtures/", import.meta.url).pathname;
export const ORDER = ["eyeOuterL", "eyeInnerL", "eyeInnerR", "eyeOuterR", "alarL", "alarR", "subnasale", "mouthL", "mouthR", "stomion", "menton"];
export const synthPoints = JSON.parse(readFileSync(join(FIX, "points.json")));

const SHOTS = process.env.REFLET_SCREENSHOTS;
export async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

export async function onboard(p, adult = true) {
  await p.getByRole("button", { name: "Commencer" }).click();
  await p.getByRole("button", { name: adult ? "Oui, 18 ans ou plus" : "Non, moins de 18 ans" }).click();
}

/** Place les 11 repères sur un visage synthétique (mode manuel). */
export async function placePoints(page, k) {
  const c = page.locator(".landmark-canvas");
  await c.waitFor();
  for (const id of ORDER) {
    const box = await c.boundingBox();
    const W = await c.evaluate((el) => el.width);
    const s = box.width / W;
    const j = ((id.length * 7 + k * 3) % 5) - 2;
    await page.mouse.click(box.x + (synthPoints[k][id].x + j) * s, box.y + (synthPoints[k][id].y - j) * s);
  }
  await page.getByRole("button", { name: "Valider les repères" }).click();
}

export const forceManual = () => {
  window.__REFLET_FORCE_MANUAL__ = true;
};
