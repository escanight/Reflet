/**
 * Validation stricte de tout ce qui est relu depuis le stockage local.
 * Une donnée corrompue ou modifiée à la main ne doit ni planter l'application
 * ni injecter de propriétés inattendues : seules les clés connues, du bon
 * type et dans les bornes prévues, sont conservées.
 */
import { DEFAULT_PROFILE, type Goal, type Profile } from "../recommendations/catalog.js";
import type { Habit } from "../habits/tracker.js";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export interface SettingsShape {
  onboarded: boolean;
  adult: boolean | null;
  historyEnabled: boolean;
  noticeAcceptedAt: string | null;
}

export function sanitizeSettings(raw: unknown): SettingsShape {
  const r = isObj(raw) ? raw : {};
  return {
    onboarded: bool(r.onboarded, false),
    adult: typeof r.adult === "boolean" ? r.adult : null,
    historyEnabled: bool(r.historyEnabled, false),
    noticeAcceptedAt: typeof r.noticeAcceptedAt === "string" && ISO.test(r.noticeAcceptedAt) ? r.noticeAcceptedAt : null,
  };
}

const GOALS: readonly Goal[] = ["peau", "rasage", "cheveux", "sommeil", "photo", "forme", "dents"];

export function sanitizeProfile(raw: unknown): Profile {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_PROFILE;
  const goals = Array.isArray(r.goals) ? [...new Set(r.goals.filter((g): g is Goal => typeof g === "string" && (GOALS as readonly string[]).includes(g)))] : d.goals;
  const minutes = r.minutesPerDay === 5 || r.minutesPerDay === 10 || r.minutesPerDay === 20 ? r.minutesPerDay : d.minutesPerDay;
  return {
    adult: bool(r.adult, d.adult),
    skin: oneOf(r.skin, ["grasse", "seche", "mixte", "sensible", "nsp"] as const, d.skin),
    acne: bool(r.acne, d.acne),
    spots: bool(r.spots, d.spots),
    facialHair: oneOf(r.facialHair, ["rase", "courte", "longue", "aucune"] as const, d.facialHair),
    hair: oneOf(r.hair, ["raides", "ondules", "boucles", "crepus", "tres-courts", "nsp"] as const, d.hair),
    scalpOily: bool(r.scalpOily, d.scalpOily),
    budget: oneOf(r.budget, ["minimal", "modere", "confortable"] as const, d.budget),
    minutesPerDay: minutes,
    goals: goals.length ? goals : d.goals,
    smoker: bool(r.smoker, d.smoker),
  };
}

export function sanitizeHabits(raw: unknown): Habit[] {
  if (!Array.isArray(raw)) return [];
  const out: Habit[] = [];
  for (const x of raw.slice(0, 20)) {
    if (!isObj(x) || typeof x.id !== "string" || typeof x.label !== "string") continue;
    const target = Number(x.weeklyTarget);
    const days = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((d): d is string => typeof d === "string" && DATE.test(d)))].slice(-800) : []);
    out.push({
      id: str(x.id, 60),
      label: str(x.label, 80),
      weeklyTarget: Number.isInteger(target) && target >= 1 && target <= 7 ? target : 5,
      cue: str(x.cue, 200),
      adviceId: typeof x.adviceId === "string" ? str(x.adviceId, 40) : undefined,
      createdAt: typeof x.createdAt === "string" && ISO.test(x.createdAt) ? x.createdAt : new Date(0).toISOString(),
      done: days(x.done),
      reserve: days(x.reserve),
    });
  }
  return out;
}

export function sanitizeLog(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string" && ISO.test(d)).slice(-200) : [];
}

export function sanitizeWeeks(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((d): d is string => typeof d === "string" && DATE.test(d)))].slice(-120) : [];
}
