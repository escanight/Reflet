/**
 * Assemble les mesures d'une ou plusieurs photos en observations
 * explicables, chacune avec un niveau de certitude.
 *
 * Règles (cf. rapport de recherche, « Règles du système d'indicateurs ») :
 *  - aucune agrégation en note globale ;
 *  - trois niveaux : « Fiable », « À confirmer », « Incertain » (valeur masquée) ;
 *  - une seule photo ne peut jamais être « Fiable » : il en faut au moins 3
 *    concordantes, prises dans les mêmes conditions ;
 *  - aucune mesure n'est fabriquée si la photo échoue aux contrôles.
 */
import { buildFrame, computeMetrics, sanityCheck, type MetricId, type MetricValues } from "./geometry.js";
import { METRICS } from "./metrics.js";
import { normalizePairs, type PointSet } from "./points.js";
import {
  evaluateQuality,
  measurePixelQuality,
  type CaptureContext,
  type PixelQuality,
  type QualityIssue,
  type RGBAImage,
  YAW_SENSITIVE,
} from "./quality.js";
import { LANDMARK_SIGMA, intervalOf, median, sampleMetrics, type Interval } from "./uncertainty.js";

export type Level = "reliable" | "confirm" | "uncertain";

export const LEVEL_LABEL: Record<Level, string> = {
  reliable: "Fiable",
  confirm: "À confirmer",
  uncertain: "Incertain",
};

/** Issues qui masquent les mesures qu'elles affectent. */
const HIDING = new Set(["yaw", "pitch", "expression", "distance", "blink", "glasses"]);

export interface PhotoAnalysis {
  id: string;
  mode: "auto" | "manual";
  points: PointSet;
  rollDeg: number;
  pixel: PixelQuality;
  issues: QualityIssue[];
  blocked: boolean;
  sigmaFraction: number;
  base: MetricValues;
  intervals: Record<MetricId, Interval>;
}

export class InvalidPointsError extends Error {
  constructor(public problems: string[]) {
    super(problems.join(" "));
  }
}

const DEGRADED = new Set(["faceSize", "blur", "exposure"]);

export function analyzePhoto(id: string, rawPoints: PointSet, img: RGBAImage, ctx: CaptureContext, mcSamples = 300): PhotoAnalysis {
  const points = normalizePairs(rawPoints);
  const problems = sanityCheck(points);
  if (problems.length) throw new InvalidPointsError(problems);
  const frame = buildFrame(points);
  const pixel = measurePixelQuality(img, points);
  const issues = evaluateQuality(pixel, ctx, frame.rollDeg);
  const blocked = issues.some((i) => i.severity === "block");
  // σ a priori : 300-W (2,9 %) pour une photo conforme, WFLW (4,0 %) si dégradée.
  const degraded = issues.some((i) => DEGRADED.has(i.id));
  const sigmaFraction = ctx.mode === "manual" ? LANDMARK_SIGMA.manual : degraded ? LANDMARK_SIGMA.auto : LANDMARK_SIGMA.autoGood;
  const base = computeMetrics(points);
  const intervals = {} as Record<MetricId, Interval>;
  if (!blocked) {
    const samples = sampleMetrics(points, sigmaFraction, mcSamples);
    for (const k of Object.keys(samples) as MetricId[]) intervals[k] = intervalOf(samples[k]);
  }
  return { id, mode: ctx.mode, points, rollDeg: frame.rollDeg, pixel, issues, blocked, sigmaFraction, base, intervals };
}

export interface MetricObservation {
  id: MetricId;
  level: Level;
  /** Valeur estimée (médiane) — absente si masquée. */
  estimate?: number;
  low?: number;
  high?: number;
  photosUsed: number;
  /** Facteurs qui ont influencé ou dégradé la mesure. */
  influences: string[];
  /** Raison du masquage, le cas échéant. */
  hiddenReason?: string;
  disagreement: boolean;
}

/** Fraction de l'incertitude a priori considérée comme systématique (hypothèse à calibrer). */
export const SYSTEMATIC_FRACTION = 0.5;
const Z90 = 1.645;
const T90 = [Number.NaN, 6.314, 2.92, 2.353, 2.132, 2.015, 1.943, 1.895, 1.86, 1.833];

function affects(issue: QualityIssue, m: MetricId): boolean {
  return issue.affects === "all" || issue.affects.includes(m);
}

export interface ObserveOptions {
  /** Nombre de photos SOURCES distinctes (les variantes de cadrage d'une même photo comptent pour une). */
  sourcePhotos?: number;
}

export function observeMetric(m: MetricId, photos: readonly PhotoAnalysis[], opts: ObserveOptions = {}): MetricObservation {
  const def = METRICS[m];
  const influences = new Set<string>();
  const hiding = new Set<string>();
  const usable: PhotoAnalysis[] = [];
  let downgraded = false;
  for (const ph of photos) {
    if (ph.blocked) continue;
    const hit = ph.issues.filter((i) => affects(i, m));
    const hides = hit.filter((i) => HIDING.has(i.id));
    if (hides.length) {
      hides.forEach((i) => hiding.add(i.message));
      continue;
    }
    hit.forEach((i) => {
      influences.add(i.message);
      downgraded = true;
    });
    if (ph.intervals[m] && Number.isFinite(ph.intervals[m].median)) usable.push(ph);
  }
  const n = usable.length;
  if (n === 0) {
    return {
      id: m, level: "uncertain", photosUsed: 0, influences: [...influences], disagreement: false,
      hiddenReason: hiding.size ? [...hiding].join(" ") : "Aucune photo exploitable pour cette mesure.",
    };
  }
  const medians = usable.map((p) => p.intervals[m].median);
  const sigmas = usable.map((p) => (p.intervals[m].high - p.intervals[m].low) / (2 * Z90));
  const sigmaPrior = sigmas.reduce((a, b) => a + b, 0) / n;
  const estimate = median(medians);
  let half: number;
  let disagreement = false;
  if (n === 1) {
    half = Z90 * sigmaPrior;
  } else {
    const mean = medians.reduce((a, b) => a + b, 0) / n;
    const s = Math.sqrt(medians.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    const t = T90[Math.min(n - 1, T90.length - 1)] ?? Z90;
    half = Math.hypot(Z90 * SYSTEMATIC_FRACTION * sigmaPrior, (t * s) / Math.sqrt(n));
    disagreement = s > sigmaPrior;
  }
  const width = 2 * half;
  const w = def.relativeWidth ? width / Math.max(Math.abs(estimate), 1e-6) : width;
  if (m && YAW_SENSITIVE.includes(m) && usable.some((p) => p.mode === "manual")) {
    influences.add("En mode manuel, l'orientation de la tête ne peut pas être vérifiée.");
    downgraded = true;
  }
  if (disagreement) influences.add("Les photos ne concordent pas entre elles : les conditions ont probablement changé.");
  const sources = opts.sourcePhotos ?? n;
  if (sources < 3) influences.add(sources === 1 ? (n > 1 ? "Une seule photo, analysée sous plusieurs cadrages : la stabilité du repérage est mesurée, pas celle de la prise de vue." : "Une seule photo : la répétabilité n'a pas pu être vérifiée.") : "Deux photos seulement : trois photos concordantes sont nécessaires pour une mesure fiable.");

  let level: Level;
  if (w > def.confirmWidth) level = "uncertain";
  else if (n < 3 || sources < 3 || downgraded || disagreement || w > def.reliableWidth) level = "confirm";
  else level = "reliable";

  const obs: MetricObservation = { id: m, level, photosUsed: n, influences: [...influences], disagreement };
  if (level === "uncertain") {
    obs.hiddenReason = "La marge d'erreur est plus grande que l'écart éventuel : cette mesure n'est pas exploitable sur ces photos.";
  } else {
    obs.estimate = estimate;
    obs.low = estimate - half;
    obs.high = estimate + half;
  }
  return obs;
}

export interface SessionResult {
  createdAt: string;
  mode: "auto" | "manual";
  distance: CaptureContext["distance"];
  photos: number;
  photosBlocked: number;
  observations: MetricObservation[];
  /** Problèmes de prise de vue relevés (identifiants), pour personnaliser le programme. */
  issueIds: string[];
  /** Raisons pour lesquelles des photos ont été refusées. */
  blockedReasons?: string[];
}

export function buildSession(photos: readonly PhotoAnalysis[], distance: CaptureContext["distance"], now = new Date(), opts: ObserveOptions = {}): SessionResult {
  const ids = Object.keys(METRICS) as MetricId[];
  return {
    createdAt: now.toISOString(),
    mode: photos.some((p) => p.mode === "manual") ? "manual" : "auto",
    distance,
    photos: opts.sourcePhotos ?? photos.length,
    photosBlocked: photos.filter((p) => p.blocked).length,
    observations: ids.map((m) => observeMetric(m, photos, opts)),
    issueIds: [...new Set(photos.flatMap((p) => p.issues.map((i) => i.id)))],
  };
}

/** Phrase descriptive neutre pour une observation visible. */
export function describe(o: MetricObservation): string {
  const def = METRICS[o.id];
  if (o.level === "uncertain" || o.estimate === undefined || o.low === undefined || o.high === undefined) {
    return o.hiddenReason ?? "Mesure masquée.";
  }
  const includesZero = o.low <= 0 && o.high >= 0;
  const fmt = (v: number) => formatValue(def.kind, v);
  switch (o.id) {
    case "outerCanthusOffset":
    case "alarOffset":
    case "mouthCornerOffset":
      if (includesZero) return "Aucun écart mesurable : la plage plausible inclut une symétrie complète.";
      return `Le côté ${o.estimate > 0 ? "gauche" : "droit"} de la photo est un peu plus éloigné de l'axe (environ ${fmt(Math.abs(o.estimate))}).`;
    case "eyeWidthDiff":
      if (includesZero) return "Aucune différence mesurable entre les deux yeux.";
      return `L'œil à ${o.estimate > 0 ? "gauche" : "droite"} de la photo paraît un peu plus large (environ ${fmt(Math.abs(o.estimate))}).`;
    case "mouthLineAngle":
      if (includesZero) return "La ligne de la bouche est parallèle à celle des yeux, aux erreurs de mesure près.";
      return `Le coin de la bouche à ${o.estimate > 0 ? "gauche" : "droite"} de la photo est légèrement plus bas (environ ${fmt(Math.abs(o.estimate))}).`;
    case "subnasaleMidline":
    case "stomionMidline":
    case "mentonMidline":
      if (includesZero) return "Centré sur l'axe du visage, aux erreurs de mesure près.";
      return `Décalé vers la ${o.estimate > 0 ? "droite" : "gauche"} de la photo (environ ${fmt(Math.abs(o.estimate))}).`;
    default:
      return `${fmt(o.estimate)} (plage plausible ${fmt(o.low)} – ${fmt(o.high)}).`;
  }
}

export function formatValue(kind: "percentD" | "ratio" | "degrees", v: number): string {
  const nf = (x: number, d: number) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (kind === "percentD") return `${nf(v, 0)}\u00a0%`;
  if (kind === "degrees") return `${nf(v, 0)}°`;
  return nf(v, 2);
}

export function formatRange(o: MetricObservation): string | null {
  if (o.low === undefined || o.high === undefined) return null;
  const k = METRICS[o.id].kind;
  return `${formatValue(k, o.low)} à ${formatValue(k, o.high)}`;
}
