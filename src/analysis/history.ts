/**
 * Comparaison de deux séances de mesure, uniquement lorsque les conditions
 * sont comparables (même mode, même classe de distance). Un changement
 * n'est signalé que si les intervalles d'incertitude ne se chevauchent pas.
 */
import type { MetricId } from "./geometry.js";
import type { Level, SessionResult } from "./observations.js";

export interface StoredObservation {
  id: MetricId;
  level: Level;
  estimate?: number;
  low?: number;
  high?: number;
}

export interface StoredSession {
  createdAt: string;
  mode: SessionResult["mode"];
  distance: SessionResult["distance"];
  photos: number;
  observations: StoredObservation[];
}

export function toStored(s: SessionResult): StoredSession {
  return {
    createdAt: s.createdAt,
    mode: s.mode,
    distance: s.distance,
    photos: s.photos,
    observations: s.observations.map(({ id, level, estimate, low, high }) => ({ id, level, estimate, low, high })),
  };
}

export type Comparison =
  | { comparable: false; reason: string }
  | { comparable: true; changes: Array<{ id: MetricId; kind: "stable" | "changed"; from: StoredObservation; to: StoredObservation }> };

export function compareSessions(prev: StoredSession, cur: StoredSession): Comparison {
  if (prev.mode !== cur.mode) {
    return { comparable: false, reason: "Les deux séances n'ont pas utilisé le même mode de repérage (automatique ou manuel)." };
  }
  if (prev.distance !== cur.distance) {
    return { comparable: false, reason: "Les deux séances n'ont pas été prises à la même distance." };
  }
  const changes: Array<{ id: MetricId; kind: "stable" | "changed"; from: StoredObservation; to: StoredObservation }> = [];
  for (const to of cur.observations) {
    const from = prev.observations.find((o) => o.id === to.id);
    if (!from || from.level === "uncertain" || to.level === "uncertain") continue;
    if (from.low === undefined || from.high === undefined || to.low === undefined || to.high === undefined) continue;
    const overlap = from.low <= to.high && to.low <= from.high;
    changes.push({ id: to.id, kind: overlap ? "stable" : "changed", from, to });
  }
  return { comparable: true, changes };
}

export const MAX_HISTORY = 52;

export function appendSession(list: StoredSession[], s: StoredSession): StoredSession[] {
  return [...list, s].slice(-MAX_HISTORY);
}
