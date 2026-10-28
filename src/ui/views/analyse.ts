/**
 * Écran de scan : caméra plein cadre → rafale de 3 images → animation de scan
 * pendant le traitement réel → résultats. Galerie disponible à tout moment.
 * Si le modèle automatique est indisponible, repli sur le repérage manuel.
 */
import { clear, h, announce } from "../dom.js";
import { button, icon, linkButton, notice } from "../components.js";
import { createLandmarker } from "../landmarker.js";
import { COLORS } from "../overlay.js";
import { createCamera, cameraSupported, CAMERA_ERROR_TEXT, galleryInput } from "../camera.js";
import { analysesInLast24h, endCapture, logAnalysis, rewardScan, saveDistancePref, state } from "../../app/state.js";
import { go } from "../../app/router.js";
import { weekKey } from "../../app/progress.js";
import { loadImageFile, ImageInputError, wipeImage, type LoadedImage } from "../../image/input.js";
import { checkAvailability, detect, loadDetector } from "../../analysis/detector.js";
import { analyzePhoto, buildSession, InvalidPointsError, type PhotoAnalysis } from "../../analysis/observations.js";
import { qualityScore } from "../../analysis/summary.js";
import type { CaptureContext } from "../../analysis/quality.js";
import type { Point, PointSet } from "../../analysis/points.js";

type Phase =
  | { kind: "camera"; error?: string }
  | { kind: "pick"; error?: string }
  | { kind: "scanning"; image: LoadedImage; step: string }
  | { kind: "manual"; image: LoadedImage };

let phase: Phase = { kind: cameraSupported() ? "camera" : "pick" };
let stopCamera: (() => void) | null = null;
/** Jeton d'exécution : une analyse lancée puis abandonnée (changement d'écran) ne doit plus rien afficher. */
let runId = 0;
/** XP gagnée au dernier scan, affichée sur l'écran des résultats. */
export let lastScanXp = 0;

const DECLARED = { facingCamera: true, mouthClosed: true, neutral: true, noGlasses: true };

function releaseCamera(): void {
  stopCamera?.();
  stopCamera = null;
}

export function resetAnalyse(): void {
  runId++;
  releaseCamera();
  phase = { kind: cameraSupported() ? "camera" : "pick" };
}

export function abandonCapture(): void {
  endCapture();
  resetAnalyse();
}

function host(): HTMLElement | null {
  return document.getElementById("view");
}

function setPhase(p: Phase): void {
  if (p.kind !== "camera") releaseCamera();
  phase = p;
  const root = host();
  if (root) renderAnalyse(root);
  window.scrollTo({ top: 0 });
}

export function renderAnalyse(root: HTMLElement): void {
  clear(root);
  root.classList.add("view-scan");
  if (state.settings.adult !== true) {
    root.append(
      h("header", { class: "page-header" }, h("h1", { id: "page-title", tabindex: "-1" }, "Scan")),
      h("div", { class: "card" }, h("p", null, "Le scan du visage est réservé aux 18 ans et plus. Ton programme d'habitudes t'attend."), h("div", { class: "button-row" }, linkButton("Mon programme", "#programme"))),
    );
    return;
  }
  switch (phase.kind) {
    case "camera": return renderCamera(root, phase.error);
    case "pick": return renderPick(root, phase.error);
    case "scanning": return renderScanning(root, phase.image, phase.step);
    case "manual": return renderManual(root, phase.image);
  }
}

function header(title: string, sub?: string): HTMLElement {
  return h("header", { class: "scan-header" }, h("h1", { id: "page-title", tabindex: "-1" }, title), sub ? h("p", { class: "muted" }, sub) : null);
}

function guardNotice(): HTMLElement | null {
  return analysesInLast24h() >= 3
    ? notice("info", h("p", null, "Plusieurs scans aujourd'hui. Ton visage ne change pas d'un jour à l'autre : les écarts viennent de la lumière et de l'angle. ", h("a", { href: "#aide" }, "Besoin d'en parler ?")))
    : null;
}

function renderCamera(root: HTMLElement, error?: string): void {
  releaseCamera();
  const cam = createCamera({
    distance: state.distancePref,
    onDistance: saveDistancePref,
    onCapture: (files) => {
      stopCamera = null;
      void processFiles(files, "camera");
    },
    onGallery: (f) => {
      stopCamera = null;
      void processFiles([f], "gallery");
    },
    onError: (e) => {
      stopCamera = null;
      setPhase({ kind: "pick", error: CAMERA_ERROR_TEXT[e] });
    },
  });
  stopCamera = cam.stop;
  root.append(header("Scan"), guardNotice() ?? "", error ? notice("block", h("p", null, error)) : "", cam.element);
}

function renderPick(root: HTMLElement, error?: string): void {
  const zone = h(
    "div",
    { class: "pick-zone" },
    h("div", { class: "pick-icon", "aria-hidden": "true" }, icon("image", 34)),
    h("p", { class: "pick-title" }, "Choisis une photo de face"),
    h("p", { class: "muted small" }, "Lumière de face · tête droite · sans lunettes"),
    h("div", { class: "btn btn-primary btn-wide picker-button" }, icon("image", 18), h("span", null, "Ouvrir la galerie"), galleryInput((f) => void processFiles([f], "gallery"))),
  );
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    const f = e.dataTransfer?.files?.[0];
    if (f) void processFiles([f], "gallery");
  });
  root.append(
    header("Scan"),
    guardNotice() ?? "",
    error ? notice("warn", h("p", null, error)) : "",
    zone,
    cameraSupported() ? h("div", { class: "button-row center" }, button("Réessayer la caméra", () => setPhase({ kind: "camera" }), { variant: "quiet", icon: "camera" })) : "",
  );
}

/* ---------------- Animation de scan ---------------- */

let scanCanvas: HTMLCanvasElement | null = null;
let scanStep: HTMLElement | null = null;

function renderScanning(root: HTMLElement, image: LoadedImage, step: string): void {
  scanCanvas = h("canvas", { class: "scan-canvas", role: "img", "aria-label": "Photo en cours d'analyse" });
  scanCanvas.width = image.width;
  scanCanvas.height = image.height;
  scanCanvas.getContext("2d")?.drawImage(image.canvas, 0, 0);
  scanStep = h("p", { class: "scan-step", "aria-live": "polite" }, step);
  root.append(
    header("Analyse"),
    h("div", { class: "scan-stage" }, scanCanvas, h("div", { class: "scan-line", "aria-hidden": "true" }), h("div", { class: "scan-grid", "aria-hidden": "true" })),
    scanStep,
    h("p", { class: "muted small center" }, icon("shield", 14), " Tout se passe sur ton téléphone."),
  );
}

function setStep(text: string): void {
  if (scanStep) scanStep.textContent = text;
}

/** Fait apparaître les points du maillage progressivement (effet visuel sur des points réels). */
async function revealMesh(points: Point[], image: LoadedImage): Promise<void> {
  const c = scanCanvas;
  const ctx = c?.getContext("2d");
  if (!c || !ctx || !points.length) return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const r = Math.max(1.2, image.width / 420);
  const batches = reduced ? 1 : 12;
  const per = Math.ceil(points.length / batches);
  for (let b = 0; b < batches; b++) {
    ctx.fillStyle = COLORS.active;
    for (const p of points.slice(b * per, (b + 1) * per)) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    await new Promise((res) => setTimeout(res, 45));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Traitement ---------------- */

async function processFiles(files: File[], source: "camera" | "gallery"): Promise<void> {
  const myRun = ++runId;
  const alive = () => myRun === runId && location.hash === "#analyse";
  endCapture();
  const started = performance.now();
  let images: LoadedImage[] = [];
  try {
    for (const f of files) images.push(await loadImageFile(f));
  } catch (e) {
    images.forEach(wipeImage);
    return setPhase({ kind: source === "camera" && cameraSupported() ? "camera" : "pick", error: e instanceof ImageInputError ? e.message : "Impossible de lire la photo." });
  }
  // Doublons exacts (même fichier) : on n'en garde qu'un.
  const seen = new Set<string>();
  images = images.filter((im) => (seen.has(im.fingerprint) ? (wipeImage(im), false) : (seen.add(im.fingerprint), true)));

  if (!alive()) return images.forEach(wipeImage);
  setPhase({ kind: "scanning", image: images[0], step: "Détection du visage…" });
  runId = myRun; // setPhase ne doit pas invalider cette exécution
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  if (state.detector === null) {
    const forced = (window as Window & { __REFLET_FORCE_MANUAL__?: boolean }).__REFLET_FORCE_MANUAL__ === true;
    state.detector = forced ? { available: false, reason: "forcé (tests)" } : await checkAvailability();
  }
  if (state.detector?.available !== true) {
    // Modèle absent : repérage manuel sur la première image.
    images.slice(1).forEach(wipeImage);
    await sleep(500);
    if (!alive()) return wipeImage(images[0]);
    return setPhase({ kind: "manual", image: images[0] });
  }

  const distance = state.distancePref;
  const photos: PhotoAnalysis[] = [];
  const kept: LoadedImage[] = [];
  let shownMesh = false;
  let faceless = 0;
  let lastError = "";
  try {
    await loadDetector();
    for (let i = 0; i < images.length; i++) {
      setStep(images.length > 1 ? `Repérage du visage · image ${i + 1}/${images.length}` : "Repérage du visage…");
      const img = images[i];
      const det = await detect(img.canvas);
      if (!alive()) return images.forEach(wipeImage);
      if (!det.points || det.faceCount === 0) {
        faceless++;
        wipeImage(img);
        continue;
      }
      if (!shownMesh) {
        await revealMesh(det.landmarksPx, img);
        shownMesh = true;
      }
      const ctx: CaptureContext = {
        mode: "auto", distance, imageShortSide: img.shortSideOriginal,
        pose: det.pose, expression: det.expression, faceCount: det.faceCount, declared: DECLARED,
      };
      try {
        const a = analyzePhoto(`photo-${i + 1}`, det.points, img.pixels, ctx);
        photos.push(a);
        kept.push(img);
      } catch (e) {
        lastError = e instanceof InvalidPointsError ? "Repères incohérents." : "Analyse impossible.";
        wipeImage(img);
      }
    }
  } catch (e) {
    console.error(e);
    state.detector = { available: false, reason: "Le module automatique n'a pas pu démarrer sur cet appareil." };
    images.slice(1).forEach(wipeImage);
    return setPhase({ kind: "manual", image: images[0] });
  }

  if (!alive()) return images.forEach(wipeImage);
  if (!photos.length) {
    kept.forEach(wipeImage);
    const msg = faceless ? "Aucun visage détecté. Place ton visage dans l'ovale, de face, bien éclairé." : lastError || "Analyse impossible.";
    return setPhase({ kind: cameraSupported() && source === "camera" ? "camera" : "pick", error: msg });
  }
  setStep("Mesure de la symétrie et des proportions…");
  await sleep(350);
  setStep("Contrôle de la qualité…");
  // Durée minimale pour que l'animation soit lisible (le calcul réel est déjà fini).
  const elapsed = performance.now() - started;
  if (elapsed < 1800) await sleep(1800 - elapsed);
  if (!alive()) return kept.forEach(wipeImage);
  finish(photos, kept, distance);
}

function finish(photos: PhotoAnalysis[], images: LoadedImage[], distance: CaptureContext["distance"]): void {
  const usable = photos.filter((p) => !p.blocked);
  state.capture = { distance, declared: DECLARED, photos: usable.length ? usable : photos, images, fingerprints: new Set(images.map((i) => i.fingerprint)), finished: true };
  state.result = buildSession(usable, distance);
  state.result.blockedReasons = photos.filter((p) => p.blocked).flatMap((p) => p.issues.filter((i) => i.severity === "block").map((i) => i.message));
  logAnalysis();
  const q = qualityScore(photos);
  lastScanXp = q.score >= 70 && usable.length && rewardScan(weekKey(new Date())) ? 20 : 0;
  announce("Analyse terminée.");
  phase = { kind: cameraSupported() ? "camera" : "pick" };
  go("resultats");
}

function renderManual(root: HTMLElement, image: LoadedImage): void {
  root.append(
    header("Place les repères", "Le scan automatique n'est pas disponible ici. Touche la photo aux endroits demandés."),
    createLandmarker({
      image: image.canvas,
      onDone: (points: PointSet) => {
        const ctx: CaptureContext = { mode: "manual", distance: state.distancePref, imageShortSide: image.shortSideOriginal, declared: DECLARED };
        try {
          const a = analyzePhoto("photo-1", points, image.pixels, ctx);
          finish([a], [image], state.distancePref);
        } catch (e) {
          setPhase({ kind: "pick", error: e instanceof InvalidPointsError ? `Repères incohérents : ${e.problems.join(" ")}` : "Analyse impossible." });
        }
      },
      onCancel: () => {
        wipeImage(image);
        setPhase({ kind: cameraSupported() ? "camera" : "pick" });
      },
    }),
  );
}
