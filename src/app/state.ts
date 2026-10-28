/**
 * État de l'application. Les photos et les repères ne vivent qu'en mémoire,
 * le temps de la séance d'analyse ; ils ne sont jamais écrits sur le disque.
 */
import type { Availability } from "../analysis/detector.js";
import type { StoredSession } from "../analysis/history.js";
import type { PhotoAnalysis, SessionResult } from "../analysis/observations.js";
import type { CaptureContext } from "../analysis/quality.js";
import type { Habit } from "../habits/tracker.js";
import type { LoadedImage } from "../image/input.js";
import { wipeImage } from "../image/input.js";
import { DEFAULT_PROFILE, type Profile } from "../recommendations/catalog.js";
import { sanitizeHabits, sanitizeLog, sanitizeProfile, sanitizeSettings, sanitizeWeeks } from "../storage/schema.js";
import { loadEncrypted, readJSON, saveEncrypted, wipeEverything, writeJSON } from "../storage/store.js";

export interface Settings {
  onboarded: boolean;
  adult: boolean | null;
  historyEnabled: boolean;
  noticeAcceptedAt: string | null;
}

export interface CaptureSession {
  distance: CaptureContext["distance"];
  declared: NonNullable<CaptureContext["declared"]>;
  photos: PhotoAnalysis[];
  images: LoadedImage[];
  fingerprints: Set<string>;
  /** Séance terminée : les résultats ont été calculés. */
  finished: boolean;
}

export interface AppState {
  settings: Settings;
  profile: Profile;
  profileSet: boolean;
  habits: Habit[];
  analysisLog: string[];
  /** Semaines (clé du lundi) où un scan de bonne qualité a rapporté de l'XP. */
  scanWeeks: string[];
  /** Distance de prise de vue choisie sur l'écran caméra. */
  distancePref: "near" | "far";
  capture: CaptureSession | null;
  result: SessionResult | null;
  history: StoredSession[];
  detector: Availability | null;
}

const DEFAULT_SETTINGS: Settings = { onboarded: false, adult: null, historyEnabled: false, noticeAcceptedAt: null };

export const state: AppState = {
  settings: sanitizeSettings(readJSON<unknown>("settings", {})),
  profile: sanitizeProfile(readJSON<unknown>("profile", {})),
  profileSet: readJSON<unknown>("profileSet", false) === true,
  habits: sanitizeHabits(readJSON<unknown>("habits", [])),
  analysisLog: sanitizeLog(readJSON<unknown>("analysisLog", [])),
  scanWeeks: sanitizeWeeks(readJSON<unknown>("scanWeeks", [])),
  distancePref: readJSON<unknown>("distancePref", "near") === "far" ? "far" : "near",
  capture: null,
  result: null,
  history: [],
  detector: null,
};

export function saveSettings(patch: Partial<Settings>): void {
  state.settings = { ...state.settings, ...patch };
  writeJSON("settings", state.settings);
}

export function saveProfile(p: Profile): void {
  state.profile = p;
  state.profileSet = true;
  writeJSON("profile", p);
  writeJSON("profileSet", true);
}

export function saveHabits(list: Habit[]): void {
  state.habits = list;
  writeJSON("habits", list);
}

/** Journal des analyses (dates seulement), conservé 7 jours, pour les garde-fous d'usage. */
export function logAnalysis(now = new Date()): void {
  const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  state.analysisLog = [...state.analysisLog.filter((d) => Date.parse(d) > weekAgo), now.toISOString()];
  writeJSON("analysisLog", state.analysisLog);
}

export function analysesInLast24h(now = new Date()): number {
  const dayAgo = now.getTime() - 24 * 3600 * 1000;
  return state.analysisLog.filter((d) => Date.parse(d) > dayAgo).length;
}

export async function loadHistory(): Promise<void> {
  const raw = state.settings.historyEnabled ? await loadEncrypted<unknown>("history", []) : [];
  state.history = Array.isArray(raw)
    ? (raw.filter((x) => typeof x === "object" && x !== null && typeof (x as StoredSession).createdAt === "string" && Array.isArray((x as StoredSession).observations)) as StoredSession[]).slice(-52)
    : [];
}

export async function persistHistory(): Promise<boolean> {
  return saveEncrypted("history", state.history);
}

export function endCapture(): void {
  state.capture?.images.forEach(wipeImage);
  state.capture = null;
}

export async function wipeAll(): Promise<void> {
  endCapture();
  await wipeEverything();
  state.settings = { ...DEFAULT_SETTINGS };
  state.profile = { ...DEFAULT_PROFILE };
  state.profileSet = false;
  state.habits = [];
  state.analysisLog = [];
  state.scanWeeks = [];
  state.distancePref = "near";
  state.result = null;
  state.history = [];
}

export function rewardScan(week: string): boolean {
  if (state.scanWeeks.includes(week)) return false;
  state.scanWeeks = [...state.scanWeeks, week].slice(-120);
  writeJSON("scanWeeks", state.scanWeeks);
  return true;
}

export function saveDistancePref(d: "near" | "far"): void {
  state.distancePref = d;
  writeJSON("distancePref", d);
}
