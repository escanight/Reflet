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
}

const WEIGHT: Record<string, number> = { block: 30, yaw: 15, pitch: 10, blur: 12, exposure: 12, lateralLight: 10, faceSize: 10, expression: 8, blink: 8, roll: 5, glasses: 6, distance: 10 };

export function qualityScore(photos: readonly PhotoAnalysis[]): QualitySummary {
  if (!photos.length) return { score: 0, tip: null };
  let worst: { w: number; tip: string } | null = null;
  const scores = photos.map((p) => {
    let s = 100;
    for (const i of p.issues) {
      const w = i.severity === "block" ? WEIGHT.block : WEIGHT[i.id] ?? 5;
      s -= w;
      if (!worst || w > worst.w) worst = { w, tip: i.advice };
    }
    return Math.max(0, s);
  });
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { score, tip: (worst as { w: number; tip: string } | null)?.tip ?? null };
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
