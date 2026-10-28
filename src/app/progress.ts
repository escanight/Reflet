/**
 * Rangs et points d'expérience (XP).
 *
 * Le rang récompense ce que tu FAIS (routine, régularité, photos bien prises),
 * jamais ton visage : aucune mesure faciale n'entre dans le calcul.
 * Le score est recalculé à partir des données, il n'est pas stocké : décocher
 * une habitude retire les points correspondants.
 */
import { weekProgress, weekStart, type Habit } from "../habits/tracker.js";

export interface Rank {
  id: number;
  name: string;
  min: number;
  tagline: string;
}

export const RANKS: readonly Rank[] = [
  { id: 1, name: "Recrue", min: 0, tagline: "Tout commence ici." },
  { id: 2, name: "Initié", min: 100, tagline: "Les bases sont posées." },
  { id: 3, name: "Régulier", min: 300, tagline: "La routine s'installe." },
  { id: 4, name: "Discipliné", min: 700, tagline: "Tu tiens dans la durée." },
  { id: 5, name: "Affûté", min: 1500, tagline: "Ça commence à se voir." },
  { id: 6, name: "Glow-up confirmé", min: 3000, tagline: "Des mois de constance." },
  { id: 7, name: "Légende du miroir", min: 6000, tagline: "Rien à prouver." },
];

export const XP = {
  habitDay: 10,
  weekReached: 50,
  goodScanPerWeek: 20,
  programSet: 30,
} as const;

export interface XpBreakdown {
  total: number;
  habits: number;
  weeks: number;
  scans: number;
  program: number;
}

/** Clé de semaine (lundi, date locale AAAA-MM-JJ). */
export function weekKey(d: Date): string {
  const s = weekStart(d);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
}

export function computeXp(habits: readonly Habit[], scanWeeks: readonly string[], programSet: boolean, now = new Date()): XpBreakdown {
  let habitsXp = 0;
  let weeksXp = 0;
  for (const h of habits) {
    habitsXp += h.done.length * XP.habitDay;
    // Semaines complètes passées où l'objectif a été atteint (depuis la création, 2 ans max).
    const created = new Date(h.createdAt);
    const cur = weekStart(now);
    for (let i = 0; i < 104; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() - 7 * i);
      if (d.getTime() + 7 * 864e5 < created.getTime()) break;
      if (weekProgress(h, d).reached) weeksXp += XP.weekReached;
    }
  }
  const scans = new Set(scanWeeks).size * XP.goodScanPerWeek;
  const program = programSet ? XP.programSet : 0;
  return { total: habitsXp + weeksXp + scans + program, habits: habitsXp, weeks: weeksXp, scans, program };
}

export interface RankState {
  rank: Rank;
  next: Rank | null;
  /** Progression vers le rang suivant, entre 0 et 1. */
  progress: number;
  toNext: number;
}

export function rankFor(xp: number): RankState {
  let rank = RANKS[0];
  for (const r of RANKS) if (xp >= r.min) rank = r;
  const next = RANKS.find((r) => r.min > xp) ?? null;
  const progress = next ? (xp - rank.min) / (next.min - rank.min) : 1;
  return { rank, next, progress: Math.max(0, Math.min(1, progress)), toNext: next ? next.min - xp : 0 };
}
