/**
 * Synthèses visuelles d'une séance. Ce ne sont PAS des notes d'attractivité :
 *  - l'indice de symétrie résume uniquement les écarts gauche-droite mesurés
 *    (100 % = symétrie parfaite, qui n'est pas un idéal) et il est donné sous
 *    forme de fourchette tenant compte de la marge d'erreur ;
 *  - le score de qualité note la PHOTO (netteté, lumière, pose, distance),
 *    c'est-à-dire ce que tu peux améliorer immédiatement.
 */
import type { MetricId } from "./geometry.js";
import type { MetricObservation, PhotoAnalysis, SessionResult } from "./observations.js";
import { weekProgress, type Habit } from "../habits/tracker.js";

const OFFSETS: MetricId[] = ["outerCanthusOffset", "alarOffset", "mouthCornerOffset", "subnasaleMidline", "stomionMidline", "mentonMidline"];

export interface SymmetrySummary {
  /** Valeur centrale (%), ou null si aucune mesure exploitable. */
  value: number | null;
  low: number | null;
  high: number | null;
  measures: number;
  /** 3 = fiable, 2 = à confirmer, 1 = indicatif (marge d'erreur large), 0 = rien. */
  precision: 0 | 1 | 2 | 3;
}

export function symmetryIndex(obs: readonly MetricObservation[]): SymmetrySummary {
  const usable = obs.filter((o) => OFFSETS.includes(o.id) && o.level !== "uncertain" && o.estimate !== undefined && o.low !== undefined && o.high !== undefined);
  if (!usable.length) {
    const raw = obs.filter((o) => OFFSETS.includes(o.id) && o.rawEstimate !== undefined);
    if (!raw.length) return { value: null, low: null, high: null, measures: 0, precision: 0 };
    const v = Math.max(0, Math.min(100, Math.round(100 - raw.reduce((a, o) => a + Math.abs(o.rawEstimate!), 0) / raw.length)));
    return { value: v, low: null, high: null, measures: raw.length, precision: 1 };
  }
  const mean = (f: (o: MetricObservation) => number) => usable.reduce((a, o) => a + f(o), 0) / usable.length;
  const center = mean((o) => Math.abs(o.estimate!));
  const worst = mean((o) => Math.max(Math.abs(o.low!), Math.abs(o.high!)));
  const best = mean((o) => (o.low! <= 0 && o.high! >= 0 ? 0 : Math.min(Math.abs(o.low!), Math.abs(o.high!))));
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(100 - v)));
  const precision = usable.every((o) => o.level === "reliable") ? 3 : 2;
  return { value: clamp(center), low: clamp(worst), high: clamp(best), measures: usable.length, precision };
}

export interface QualitySummary {
  score: number;
  /** Conseil prioritaire, le plus pénalisant. */
  tip: string | null;
  /** Le même conseil en quelques mots. */
  short: string | null;
}

const SHORT_TIP: Record<string, string> = {
  distance: "Pose le téléphone à 1,5 m, retardateur.",
  lateralLight: "Mets-toi face à la lumière.",
  blur: "Une photo plus nette.",
  exposure: "Plus de lumière, sans flash.",
  yaw: "Regarde droit l'objectif.",
  pitch: "Objectif à hauteur des yeux.",
  expression: "Visage neutre, bouche fermée.",
  faceSize: "Rapproche ton visage.",
  blink: "Yeux bien ouverts.",
  roll: "Tête bien droite.",
  glasses: "Retire tes lunettes.",
  faces: "Seul dans le cadre.",
  resolution: "Une image plus grande.",
};

const WEIGHT: Record<string, number> = { block: 30, yaw: 15, pitch: 10, blur: 12, exposure: 12, lateralLight: 10, faceSize: 10, expression: 8, blink: 8, roll: 5, glasses: 6, distance: 10 };

export function qualityScore(photos: readonly PhotoAnalysis[]): QualitySummary {
  if (!photos.length) return { score: 0, tip: null, short: null };
  let worst: { w: number; tip: string; id: string } | null = null;
  const scores = photos.map((p) => {
    let s = 100;
    for (const i of p.issues) {
      const w = i.severity === "block" ? WEIGHT.block : WEIGHT[i.id] ?? 5;
      s -= w;
      if (!worst || w > worst.w) worst = { w, tip: i.advice, id: i.id };
    }
    return Math.max(0, s);
  });
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const wst = worst as { w: number; tip: string; id: string } | null;
  return { score, tip: wst?.tip ?? null, short: wst ? SHORT_TIP[wst.id] ?? wst.tip : null };
}

/** Leviers concrets proposés après un scan (identifiants de conseils du programme). */
export function leversFor(s: SessionResult): Array<{ adviceId: string; label: string }> {
  const out: Array<{ adviceId: string; label: string }> = [];
  const has = (id: string) => s.issueIds.includes(id);
  if (has("distance") || has("lateralLight") || has("yaw") || has("blur") || has("exposure")) out.push({ adviceId: "photo", label: "Mieux te photographier" });
  out.push({ adviceId: "spf", label: "Écran solaire chaque matin" });
  out.push({ adviceId: "sleep", label: "7 h de sommeil ou plus" });
  return out.slice(0, 3);
}

/* ------------------------------------------------------------------
 * Note sur 20 : photo /10 + routine /10. Elle ne note JAMAIS le visage :
 * seulement la qualité de la photo (ce que tu contrôles tout de suite)
 * et la régularité de ta routine (ce que tu contrôles dans la durée).
 * ------------------------------------------------------------------ */

export interface Tier {
  name: string;
  min: number;
  line: string;
}

export const TIERS: readonly Tier[] = [
  { name: "En chantier", min: 0, line: "Tout reste à construire, et c'est le meilleur moment pour commencer." },
  { name: "Ça chauffe", min: 5, line: "Les bases sont là, continue." },
  { name: "Propre", min: 10, line: "Belle régularité, ça se voit." },
  { name: "Trop frais wola", min: 15, line: "Photo nickel et routine en béton." },
];

export function tierFor(score20: number): Tier {
  let t = TIERS[0];
  for (const x of TIERS) if (score20 >= x.min) t = x;
  return t;
}

const half = (v: number) => Math.round(v * 2) / 2;

/** Photo /10 depuis le score de qualité /100. */
export function photoScore10(quality100: number): number {
  return half(Math.max(0, Math.min(100, quality100)) / 10);
}

/** Routine /10 : part moyenne de l'objectif hebdomadaire atteinte, toutes habitudes confondues. */
export function routineScore10(habits: readonly Habit[], now = new Date()): number {
  if (!habits.length) return 0;
  const avg = habits.reduce((a, h) => {
    const p = weekProgress(h, now);
    return a + Math.min(1, p.done / Math.max(1, p.target));
  }, 0) / habits.length;
  return half(avg * 10);
}

export interface Note20 {
  photo: number;
  routine: number;
  total: number;
  tier: Tier;
}

export function note20(quality100: number, habits: readonly Habit[], now = new Date()): Note20 {
  const photo = photoScore10(quality100);
  const routine = routineScore10(habits, now);
  const total = photo + routine;
  return { photo, routine, total, tier: tierFor(total) };
}
