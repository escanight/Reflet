/**
 * Contrôles de qualité de la photo et des conditions de prise de vue.
 *
 * Fonctions pures sur des pixels RGBA (testables hors navigateur).
 * Les seuils sont des valeurs de départ PROVISOIRES : aucune source n'en
 * fixe pour l'anthropométrie sur selfie. Ils doivent être calibrés sur des
 * photos réelles (voir docs/VALIDATION.md). La norme ISO/IEC 29794-5 et
 * son implémentation OFIQ ont guidé le choix des composantes (netteté,
 * exposition, pose, éclairage), pas les valeurs.
 */
import type { MetricId } from "./geometry.js";
import type { PointSet } from "./points.js";
import { buildFrame } from "./geometry.js";

export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export type Severity = "block" | "warn";

export interface QualityIssue {
  id: string;
  severity: Severity;
  message: string;
  advice: string;
  /** Mesures rendues non fiables par ce problème ; "all" = toutes. */
  affects: MetricId[] | "all";
}

export const YAW_SENSITIVE: MetricId[] = [
  "eyeWidthDiff",
  "outerCanthusOffset",
  "mouthCornerOffset",
  "alarOffset",
  "subnasaleMidline",
  "stomionMidline",
  "mentonMidline",
];
export const PITCH_SENSITIVE: MetricId[] = ["lowerFaceRatio", "eyeWidthRatio"];
export const EXPRESSION_SENSITIVE: MetricId[] = [
  "mouthLineAngle",
  "mouthCornerOffset",
  "stomionMidline",
  "lowerFaceRatio",
  "mouthNoseRatio",
];
export const DISTANCE_SENSITIVE: MetricId[] = ["noseIntercanthalRatio", "mouthNoseRatio"];
export const BILATERAL: MetricId[] = [...YAW_SENSITIVE, "mouthLineAngle"];

export const THRESHOLDS = {
  // Distance entre les centres des yeux, en pixels : en dessous de 18 px, le modèle
  // ne distingue plus les coins des yeux ; entre 18 et 40 px, mesure moins précise.
  faceEyeDistancePx: { block: 18, warn: 40 },
  sharpness: { block: 0.008, warn: 0.05 },
  meanLuma: { low: 0.18, high: 0.85 },
  clipped: { warn: 0.08, block: 0.25 },
  lateralLight: { warn: 0.3 },
  rollDeg: { warn: 10 },
  yawDeg: { confirm: 5, hide: 10 },
  pitchDeg: { confirm: 8, hide: 15 },
  blink: 0.5,
  smile: 0.35,
  jawOpen: 0.15,
} as const;

/** Rectangle englobant le visage (yeux → menton), élargi. */
export function faceRect(p: PointSet, w: number, h: number) {
  const f = buildFrame(p);
  const xs = [p.eyeOuterL.x, p.eyeOuterR.x, p.mouthL.x, p.mouthR.x, p.menton.x];
  const ys = [p.eyeOuterL.y, p.eyeOuterR.y, p.eyeInnerL.y, p.eyeInnerR.y, p.menton.y];
  const pad = 0.3 * f.d;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const x1 = Math.min(w, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - 0.6 * f.d));
  const y1 = Math.min(h, Math.ceil(Math.max(...ys) + 0.1 * f.d));
  return { x0, y0, x1, y1 };
}

/** Recadre et rééchantillonne en niveaux de gris (moyenne par boîte). */
export function grayCrop(
  img: RGBAImage,
  rect: { x0: number; y0: number; x1: number; y1: number },
  targetWidth: number,
): { gray: Float32Array; w: number; h: number } {
  const cw = Math.max(1, rect.x1 - rect.x0);
  const ch = Math.max(1, rect.y1 - rect.y0);
  const scale = targetWidth / cw;
  const w = Math.max(1, Math.round(cw * scale));
  const h = Math.max(1, Math.round(ch * scale));
  const gray = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const sy0 = rect.y0 + Math.floor(j / scale);
    const sy1 = Math.max(sy0 + 1, Math.min(rect.y1, rect.y0 + Math.floor((j + 1) / scale)));
    for (let i = 0; i < w; i++) {
      const sx0 = rect.x0 + Math.floor(i / scale);
      const sx1 = Math.max(sx0 + 1, Math.min(rect.x1, rect.x0 + Math.floor((i + 1) / scale)));
      let sum = 0;
      let n = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const k = (y * img.width + x) * 4;
          // Luma Rec. 709
          sum += (0.2126 * img.data[k] + 0.7152 * img.data[k + 1] + 0.0722 * img.data[k + 2]) / 255;
          n++;
        }
      }
      gray[j * w + i] = n ? sum / n : 0;
    }
  }
  return { gray, w, h };
}

/**
 * Netteté normalisée : variance du laplacien divisée par la variance des
 * intensités. La normalisation réduit la dépendance au contraste du visage.
 */
export function sharpness(gray: Float32Array, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0, sum2 = 0, n = 0;
  let gs = 0, gs2 = 0;
  for (let i = 0; i < gray.length; i++) {
    gs += gray[i];
    gs2 += gray[i] * gray[i];
  }
  const gm = gs / gray.length;
  const gvar = gs2 / gray.length - gm * gm;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = gray[y * w + x];
      const lap = gray[(y - 1) * w + x] + gray[(y + 1) * w + x] + gray[y * w + x - 1] + gray[y * w + x + 1] - 4 * c;
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  const m = sum / n;
  const lvar = sum2 / n - m * m;
  return gvar > 1e-6 ? lvar / gvar : 0;
}

export function exposure(gray: Float32Array) {
  let s = 0, hi = 0, lo = 0;
  for (const v of gray) {
    s += v;
    if (v > 0.97) hi++;
    if (v < 0.03) lo++;
  }
  const n = gray.length || 1;
  return { mean: s / n, clippedHigh: hi / n, clippedLow: lo / n };
}

/** Différence relative de luminosité entre moitiés gauche et droite. */
export function lateralLighting(gray: Float32Array, w: number, h: number): number {
  let l = 0, r = 0, nl = 0, nr = 0;
  const half = Math.floor(w / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = gray[y * w + x];
      if (x < half) { l += v; nl++; } else { r += v; nr++; }
    }
  }
  const ml = l / (nl || 1), mr = r / (nr || 1);
  const m = (ml + mr) / 2;
  return m > 1e-6 ? Math.abs(ml - mr) / m : 0;
}

export interface PixelQuality {
  eyeDistancePx: number;
  sharpness: number;
  meanLuma: number;
  clipped: number;
  lateralLight: number;
}

export function measurePixelQuality(img: RGBAImage, p: PointSet): PixelQuality {
  const f = buildFrame(p);
  const rect = faceRect(p, img.width, img.height);
  // Rééchantillonnage à une échelle fixe (D ≈ 80 px) pour comparer les photos.
  const target = Math.max(16, Math.round(((rect.x1 - rect.x0) / f.d) * 80));
  const { gray, w, h } = grayCrop(img, rect, target);
  const e = exposure(gray);
  return {
    eyeDistancePx: f.d,
    sharpness: sharpness(gray, w, h),
    meanLuma: e.mean,
    clipped: e.clippedHigh + e.clippedLow,
    lateralLight: lateralLighting(gray, w, h),
  };
}

export type DistanceClass = "near" | "far" | "unknown";

export interface CaptureContext {
  mode: "auto" | "manual";
  distance: DistanceClass;
  imageShortSide: number;
  /** Pose estimée (mode automatique uniquement). */
  pose?: { yawDeg: number; pitchDeg: number; rollDeg: number } | null;
  /** Scores d'expression MediaPipe (mode automatique uniquement). */
  expression?: { blink: number; smile: number; jawOpen: number } | null;
  faceCount?: number;
  /** Auto-déclarations en mode manuel. */
  declared?: { facingCamera: boolean; mouthClosed: boolean; neutral: boolean; noGlasses: boolean };
}

export function evaluateQuality(px: PixelQuality, ctx: CaptureContext, rollDeg: number): QualityIssue[] {
  const T = THRESHOLDS;
  const issues: QualityIssue[] = [];

  // Pas de taille minimale d'image : seule compte la taille du VISAGE (contrôle ci-dessous).
  if (ctx.faceCount !== undefined && ctx.faceCount > 1) {
    issues.push({
      id: "faces", severity: "block", affects: "all",
      message: "Plusieurs visages ont été détectés.",
      advice: "Reflet n'analyse que ton propre visage, seul dans le cadre.",
    });
  }
  if (px.eyeDistancePx < T.faceEyeDistancePx.block) {
    issues.push({
      id: "faceSize", severity: "block", affects: "all",
      message: "Le visage occupe trop peu de place dans l'image.",
      advice: "Zoome ×2 pour que ton visage remplisse l'ovale.",
    });
  } else if (px.eyeDistancePx < T.faceEyeDistancePx.warn) {
    issues.push({
      id: "faceSize", severity: "warn", affects: "all",
      message: "Le visage est assez petit dans l'image : les repères sont moins précis.",
      advice: "Zoome un peu plus sur ton visage.",
    });
  }
  if (px.sharpness < T.sharpness.block) {
    issues.push({
      id: "blur", severity: "block", affects: "all",
      message: "La photo est trop floue.",
      advice: "Nettoie l'objectif, pose le téléphone (ou retardateur) et évite le mode portrait.",
    });
  } else if (px.sharpness < T.sharpness.warn) {
    issues.push({
      id: "blur", severity: "warn", affects: "all",
      message: "La photo semble un peu floue.",
      advice: "Une photo plus nette réduira l'incertitude des mesures.",
    });
  }
  if (px.meanLuma < T.meanLuma.low || px.meanLuma > T.meanLuma.high || px.clipped > T.clipped.warn) {
    issues.push({
      id: "exposure", severity: px.clipped > T.clipped.block ? "block" : "warn", affects: "all",
      message: px.meanLuma < T.meanLuma.low ? "Le visage est sous-exposé (trop sombre)." : px.meanLuma > T.meanLuma.high ? "Le visage est surexposé (trop clair)." : "Une partie du visage est brûlée ou bouchée.",
      advice: "Mets-toi face à une fenêtre, en lumière du jour, sans flash.",
    });
  }
  if (px.lateralLight > T.lateralLight.warn) {
    issues.push({
      id: "lateralLight", severity: "warn", affects: BILATERAL,
      message: "L'éclairage vient surtout d'un côté.",
      advice: "Une lumière de côté crée des ombres qui déplacent les repères et simulent des asymétries. Mets-toi face à la lumière.",
    });
  }
  if (Math.abs(rollDeg) > T.rollDeg.warn) {
    issues.push({
      id: "roll", severity: "warn", affects: BILATERAL,
      message: `La tête est inclinée d'environ ${Math.round(Math.abs(rollDeg))}°.`,
      advice: "L'inclinaison est corrigée par calcul, mais une tête droite limite les autres déformations.",
    });
  }

  if (ctx.pose) {
    const yaw = Math.abs(ctx.pose.yawDeg), pitch = Math.abs(ctx.pose.pitchDeg);
    if (yaw > T.yawDeg.hide) {
      issues.push({
        id: "yaw", severity: "warn", affects: YAW_SENSITIVE,
        message: `Le visage est tourné d'environ ${Math.round(yaw)}° sur le côté.`,
        advice: "Une rotation crée une fausse asymétrie impossible à corriger ensuite : les mesures gauche-droite sont masquées. Regarde droit l'objectif.",
      });
    }
    if (pitch > T.pitchDeg.hide) {
      issues.push({
        id: "pitch", severity: "warn", affects: PITCH_SENSITIVE,
        message: `La tête est levée ou baissée d'environ ${Math.round(pitch)}°.`,
        advice: "Garde l'objectif à hauteur des yeux : les proportions verticales sont masquées.",
      });
    }
  }
  if (ctx.expression) {
    if (ctx.expression.blink > T.blink) {
      issues.push({
        id: "blink", severity: "warn", affects: ["eyeWidthRatio", "eyeWidthDiff", "outerCanthusOffset"],
        message: "Les yeux semblent fermés ou plissés.",
        advice: "Garde les yeux ouverts, naturellement.",
      });
    }
    if (ctx.expression.smile > T.smile || ctx.expression.jawOpen > T.jawOpen) {
      issues.push({
        id: "expression", severity: "warn", affects: EXPRESSION_SENSITIVE,
        message: "L'expression n'est pas neutre (sourire ou bouche ouverte).",
        advice: "Les mesures de la bouche exigent une expression neutre, lèvres jointes.",
      });
    }
  }
  if (ctx.mode === "manual" && ctx.declared) {
    if (!ctx.declared.mouthClosed || !ctx.declared.neutral) {
      issues.push({
        id: "expression", severity: "warn", affects: EXPRESSION_SENSITIVE,
        message: "Tu as indiqué que l'expression n'est pas neutre ou que la bouche est ouverte.",
        advice: "Les mesures de la bouche sont masquées pour cette photo.",
      });
    }
    if (!ctx.declared.facingCamera) {
      issues.push({
        id: "yaw", severity: "warn", affects: YAW_SENSITIVE,
        message: "Tu as indiqué que le visage n'est pas bien de face.",
        advice: "Les mesures gauche-droite sont masquées pour cette photo.",
      });
    }
  }
  if (ctx.declared && !ctx.declared.noGlasses) {
    issues.push({
      id: "glasses", severity: "warn", affects: ["eyeWidthRatio", "eyeWidthDiff", "outerCanthusOffset"],
      message: "Tu portes des lunettes sur la photo.",
      advice: "Les montures et les verres déplacent ou masquent les coins des yeux ; retire-les pour les mesures des yeux.",
    });
  }
  if (ctx.distance !== "far") {
    issues.push({
      id: "distance", severity: "warn", affects: DISTANCE_SENSITIVE,
      message: ctx.distance === "near" ? "Photo prise de près (bras tendu)." : "La distance de prise de vue est inconnue.",
      advice: "De près, le nez paraît environ 30 % plus large qu'à 1,5 m (Ward et al., 2018). Les rapports impliquant la largeur du nez sont masqués. Pose le téléphone à ~1,5 m avec le retardateur et le zoom ×2.",
    });
  }
  return issues;
}
