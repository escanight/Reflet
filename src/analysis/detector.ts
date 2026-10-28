/**
 * Adaptateur MediaPipe Face Landmarker (mode IMAGE), entièrement local.
 *
 * Les fichiers sont auto-hébergés sur la même origine que l'application :
 *   vendor/mediapipe/vision_bundle.mjs          (paquet npm @mediapipe/tasks-vision@0.10.21)
 *   vendor/mediapipe/wasm/vision_wasm_internal.{js,wasm} (+ variantes _nosimd)
 *   vendor/mediapipe/face_landmarker.task       (modèle float16)
 * Ils sont installés par `npm run setup:vendor`. S'ils sont absents,
 * l'application le signale et propose le repérage manuel : aucune analyse
 * n'est jamais simulée.
 */
import { pointsFromMediapipe, MEDIAPIPE_EXTRA, type Point, type PointSet } from "./points.js";

const VENDOR = new URL("../../vendor/mediapipe/", import.meta.url);
const BUNDLE_URL = new URL("vision_bundle.mjs", VENDOR).href;
const WASM_BASE = new URL("wasm", VENDOR).href;
const MODEL_URL = new URL("face_landmarker.task", VENDOR).href;

export interface Detection {
  faceCount: number;
  points: PointSet | null;
  landmarksPx: Point[];
  pose: { yawDeg: number; pitchDeg: number; rollDeg: number } | null;
  expression: { blink: number; smile: number; jawOpen: number } | null;
}

interface NormalizedLandmark { x: number; y: number; z: number }
interface Category { categoryName: string; score: number }
interface FaceLandmarkerLike {
  detect(image: HTMLCanvasElement | ImageBitmap): {
    faceLandmarks: NormalizedLandmark[][];
    faceBlendshapes?: { categories: Category[] }[];
    facialTransformationMatrixes?: { rows: number; columns: number; data: number[] }[];
  };
  close(): void;
}

let instance: FaceLandmarkerLike | null = null;
let loading: Promise<FaceLandmarkerLike> | null = null;

export type Availability = { available: true } | { available: false; reason: string };

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} : délai dépassé`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Vérifie que les fichiers du modèle sont réellement présents. Certains
 * hébergeurs renvoient la page HTML (code 200) pour toute adresse inconnue :
 * on contrôle donc aussi le type et la taille, pas seulement le code HTTP.
 */
export async function checkAvailability(): Promise<Availability> {
  try {
    const [model, bundle] = await timeout(
      Promise.all([fetch(MODEL_URL, { method: "HEAD", cache: "no-store" }), fetch(BUNDLE_URL, { method: "HEAD", cache: "no-store" })]),
      5000,
      "vérification du modèle",
    );
    const isHtml = (r: Response) => (r.headers.get("content-type") ?? "").includes("text/html");
    const size = Number(model.headers.get("content-length") ?? "0");
    if (model.ok && bundle.ok && !isHtml(model) && !isHtml(bundle) && (size === 0 || size > 500_000)) return { available: true };
    return { available: false, reason: "Les fichiers du modèle MediaPipe ne sont pas installés sur ce serveur." };
  } catch {
    return { available: false, reason: "Les fichiers du modèle MediaPipe sont inaccessibles." };
  }
}

async function create(): Promise<FaceLandmarkerLike> {
  const vision = await import(/* @vite-ignore */ BUNDLE_URL);
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "IMAGE",
    numFaces: 2, // pour détecter (et refuser) les photos à plusieurs visages
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  try {
    return await vision.FaceLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return await vision.FaceLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

export async function loadDetector(): Promise<void> {
  if (instance) return;
  loading ??= timeout(create(), 45000, "chargement du modèle");
  try {
    instance = await loading;
  } catch (e) {
    loading = null;
    throw e;
  }
}

export function releaseDetector(): void {
  instance?.close();
  instance = null;
  loading = null;
}

const deg = (r: number) => (r * 180) / Math.PI;
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Pose depuis la matrice de transformation (stockage colonne par colonne). */
export function poseFromMatrix(data: readonly number[]): { yawDeg: number; pitchDeg: number; rollDeg: number } {
  const R = (r: number, c: number) => data[c * 4 + r];
  const yaw = Math.asin(clamp1(-R(2, 0)));
  const pitch = Math.atan2(R(2, 1), R(2, 2));
  const roll = Math.atan2(R(1, 0), R(0, 0));
  return { yawDeg: deg(yaw), pitchDeg: deg(pitch), rollDeg: deg(roll) };
}

/** Estimation indépendante à partir de la profondeur relative des repères. */
export function poseFromLandmarks(lm: readonly NormalizedLandmark[], w: number, h: number): { yawDeg: number; pitchDeg: number } {
  const L = lm[MEDIAPIPE_EXTRA.faceEdgeL], Rr = lm[MEDIAPIPE_EXTRA.faceEdgeR];
  const top = lm[MEDIAPIPE_EXTRA.forehead], chin = lm[152];
  // z utilise approximativement la même échelle que x (documentation MediaPipe).
  const yaw = Math.atan2((Rr.z - L.z) * w, (Rr.x - L.x) * w);
  const pitch = Math.atan2((chin.z - top.z) * w, (chin.y - top.y) * h);
  return { yawDeg: deg(yaw), pitchDeg: deg(pitch) };
}

export async function detect(canvas: HTMLCanvasElement): Promise<Detection> {
  await loadDetector();
  if (!instance) throw new Error("Détecteur indisponible.");
  const res = instance.detect(canvas);
  const faceCount = res.faceLandmarks.length;
  if (faceCount === 0) return { faceCount: 0, points: null, landmarksPx: [], pose: null, expression: null };
  const lm = res.faceLandmarks[0];
  const w = canvas.width, h = canvas.height;
  const landmarksPx = lm.map((p) => ({ x: p.x * w, y: p.y * h }));
  const points = pointsFromMediapipe(landmarksPx);

  let pose: Detection["pose"] = null;
  const lmPose = poseFromLandmarks(lm, w, h);
  const m = res.facialTransformationMatrixes?.[0];
  if (m && m.data.length >= 16) {
    const mp = poseFromMatrix(m.data);
    // Choix prudent : on retient l'estimation la plus défavorable.
    pose = {
      yawDeg: Math.max(Math.abs(mp.yawDeg), Math.abs(lmPose.yawDeg)),
      pitchDeg: Math.max(Math.abs(mp.pitchDeg), Math.abs(lmPose.pitchDeg)),
      rollDeg: mp.rollDeg,
    };
  } else {
    pose = { yawDeg: Math.abs(lmPose.yawDeg), pitchDeg: Math.abs(lmPose.pitchDeg), rollDeg: 0 };
  }

  let expression: Detection["expression"] = null;
  const cats = res.faceBlendshapes?.[0]?.categories;
  if (cats?.length) {
    const s = (n: string) => cats.find((c) => c.categoryName === n)?.score ?? 0;
    expression = {
      blink: Math.max(s("eyeBlinkLeft"), s("eyeBlinkRight")),
      smile: Math.max(s("mouthSmileLeft"), s("mouthSmileRight")),
      jawOpen: s("jawOpen"),
    };
  }
  return { faceCount, points, landmarksPx, pose, expression };
}
