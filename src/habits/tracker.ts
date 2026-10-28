/**
 * Suivi d'habitudes hebdomadaire, sans « série » à perdre.
 *  - objectif en jours par semaine (ex. 5/7) ;
 *  - 2 jours de réserve par semaine, utilisables sans justification ;
 *  - aucune notification, aucun message de culpabilisation.
 */

export interface Habit {
  id: string;
  label: string;
  weeklyTarget: number;
  /** Plan « Quand… alors… » écrit par l'utilisateur. */
  cue: string;
  adviceId?: string;
  createdAt: string;
  /** Jours cochés, au format AAAA-MM-JJ (date locale). */
  done: string[];
  /** Jours de réserve utilisés, au format AAAA-MM-JJ. */
  reserve: string[];
}

export const RESERVE_PER_WEEK = 2;
export const MAX_ACTIVE_HABITS = 5;

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lundi de la semaine de `d` (semaine ISO, commençant le lundi). */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - dow);
  return x;
}

export function weekDays(d: Date): string[] {
  const start = weekStart(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return localDateKey(x);
  });
}

export function toggleDone(h: Habit, day: string): Habit {
  const done = h.done.includes(day) ? h.done.filter((x) => x !== day) : [...h.done, day].sort();
  const reserve = h.reserve.filter((x) => x !== day);
  return { ...h, done, reserve };
}

export function reserveUsed(h: Habit, ref: Date): number {
  const days = new Set(weekDays(ref));
  return h.reserve.filter((d) => days.has(d)).length;
}

export function toggleReserve(h: Habit, day: string, ref: Date): Habit {
  if (h.reserve.includes(day)) return { ...h, reserve: h.reserve.filter((x) => x !== day) };
  if (reserveUsed(h, ref) >= RESERVE_PER_WEEK) return h;
  return { ...h, reserve: [...h.reserve, day].sort(), done: h.done.filter((x) => x !== day) };
}

export interface WeekProgress {
  done: number;
  reserve: number;
  target: number;
  reached: boolean;
  /** Message neutre, jamais culpabilisant. */
  message: string;
}

export function weekProgress(h: Habit, ref: Date): WeekProgress {
  const days = new Set(weekDays(ref));
  const done = h.done.filter((d) => days.has(d)).length;
  const reserve = h.reserve.filter((d) => days.has(d)).length;
  const target = h.weeklyTarget;
  const reached = done >= target;
  let message: string;
  if (reached) message = "Objectif de la semaine atteint.";
  else if (done === 0) message = "Une nouvelle semaine commence : un jour à la fois.";
  else message = `${done} jour${done > 1 ? "s" : ""} sur ${target} visés cette semaine.`;
  return { done, reserve, target, reached, message };
}

/** Nombre de semaines (sur les `n` dernières, semaine en cours exclue) où l'objectif a été atteint. */
export function weeksReached(h: Habit, ref: Date, n = 8): number {
  let count = 0;
  const start = weekStart(ref);
  for (let i = 1; i <= n; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() - 7 * i);
    if (weekProgress(h, d).reached) count++;
  }
  return count;
}

export function createHabit(label: string, weeklyTarget: number, cue: string, adviceId?: string, now = new Date()): Habit {
  const target = Math.min(7, Math.max(1, Math.round(weeklyTarget)));
  return {
    id: `h-${now.getTime().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    label: label.trim().slice(0, 80),
    weeklyTarget: target,
    cue: cue.trim().slice(0, 200),
    adviceId,
    createdAt: now.toISOString(),
    done: [],
    reserve: [],
  };
}
