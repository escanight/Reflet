import { wipeImage } from "../image/input.js";
import { DEFAULT_PROFILE } from "../recommendations/catalog.js";
import { sanitizeLog, sanitizeProfile, sanitizeSettings } from "../storage/schema.js";
import { loadEncrypted, readJSON, removeKey, saveEncrypted, wipeEverything, writeJSON } from "../storage/store.js";
const DEFAULT_SETTINGS = { onboarded: false, adult: null, historyEnabled: false, noticeAcceptedAt: null };
// Données de l'ancien système de routine (supprimé en 3.0) : effacées au démarrage.
removeKey("habits");
removeKey("scanWeeks");
export const state = {
    settings: sanitizeSettings(readJSON("settings", {})),
    profile: sanitizeProfile(readJSON("profile", {})),
    profileSet: readJSON("profileSet", false) === true,
    analysisLog: sanitizeLog(readJSON("analysisLog", [])),
    distancePref: readJSON("distancePref", "near") === "far" ? "far" : "near",
    capture: null,
    lastNote: null,
    result: null,
    history: [],
    detector: null,
};
export function saveSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    writeJSON("settings", state.settings);
}
export function saveProfile(p) {
    state.profile = p;
    state.profileSet = true;
    writeJSON("profile", p);
    writeJSON("profileSet", true);
}
/** Journal des analyses (dates seulement), conservé 7 jours, pour les garde-fous d'usage. */
export function logAnalysis(now = new Date()) {
    const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
    state.analysisLog = [...state.analysisLog.filter((d) => Date.parse(d) > weekAgo), now.toISOString()];
    writeJSON("analysisLog", state.analysisLog);
}
export function analysesInLast24h(now = new Date()) {
    const dayAgo = now.getTime() - 24 * 3600 * 1000;
    return state.analysisLog.filter((d) => Date.parse(d) > dayAgo).length;
}
export async function loadHistory() {
    const raw = state.settings.historyEnabled ? await loadEncrypted("history", []) : [];
    state.history = Array.isArray(raw)
        ? raw.filter((x) => typeof x === "object" && x !== null && typeof x.createdAt === "string" && Array.isArray(x.observations)).slice(-52)
        : [];
}
export async function persistHistory() {
    return saveEncrypted("history", state.history);
}
export function endCapture() {
    state.capture?.images.forEach(wipeImage);
    state.capture = null;
}
export async function wipeAll() {
    endCapture();
    await wipeEverything();
    state.settings = { ...DEFAULT_SETTINGS };
    state.profile = { ...DEFAULT_PROFILE };
    state.profileSet = false;
    state.analysisLog = [];
    state.distancePref = "near";
    state.result = null;
    state.lastNote = null;
    state.history = [];
}
export function saveDistancePref(d) {
    state.distancePref = d;
    writeJSON("distancePref", d);
}
