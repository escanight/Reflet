/**
 * Validation stricte de tout ce qui est relu depuis le stockage local.
 * Une donnée corrompue ou modifiée à la main ne doit ni planter l'application
 * ni injecter de propriétés inattendues : seules les clés connues, du bon
 * type et dans les bornes prévues, sont conservées.
 */
import { DEFAULT_PROFILE } from "../recommendations/catalog.js";
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = (v, allowed, fallback) => (typeof v === "string" && allowed.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
export function sanitizeSettings(raw) {
    const r = isObj(raw) ? raw : {};
    return {
        onboarded: bool(r.onboarded, false),
        adult: typeof r.adult === "boolean" ? r.adult : null,
        historyEnabled: bool(r.historyEnabled, false),
        noticeAcceptedAt: typeof r.noticeAcceptedAt === "string" && ISO.test(r.noticeAcceptedAt) ? r.noticeAcceptedAt : null,
    };
}
const GOALS = ["peau", "rasage", "cheveux", "sommeil", "photo", "forme", "dents"];
export function sanitizeProfile(raw) {
    const r = isObj(raw) ? raw : {};
    const d = DEFAULT_PROFILE;
    const goals = Array.isArray(r.goals) ? [...new Set(r.goals.filter((g) => typeof g === "string" && GOALS.includes(g)))] : d.goals;
    const minutes = r.minutesPerDay === 5 || r.minutesPerDay === 10 || r.minutesPerDay === 20 ? r.minutesPerDay : d.minutesPerDay;
    return {
        adult: bool(r.adult, d.adult),
        skin: oneOf(r.skin, ["grasse", "seche", "mixte", "sensible", "nsp"], d.skin),
        acne: bool(r.acne, d.acne),
        spots: bool(r.spots, d.spots),
        facialHair: oneOf(r.facialHair, ["rase", "courte", "longue", "aucune"], d.facialHair),
        hair: oneOf(r.hair, ["raides", "ondules", "boucles", "crepus", "tres-courts", "nsp"], d.hair),
        scalpOily: bool(r.scalpOily, d.scalpOily),
        budget: oneOf(r.budget, ["minimal", "modere", "confortable"], d.budget),
        minutesPerDay: minutes,
        goals: goals.length ? goals : d.goals,
        smoker: bool(r.smoker, d.smoker),
    };
}
export function sanitizeLog(raw) {
    return Array.isArray(raw) ? raw.filter((d) => typeof d === "string" && ISO.test(d)).slice(-200) : [];
}
