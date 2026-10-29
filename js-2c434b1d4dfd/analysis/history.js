export function toStored(s) {
    return {
        createdAt: s.createdAt,
        mode: s.mode,
        distance: s.distance,
        photos: s.photos,
        observations: s.observations.map(({ id, level, estimate, low, high }) => ({ id, level, estimate, low, high })),
    };
}
export function compareSessions(prev, cur) {
    if (prev.mode !== cur.mode) {
        return { comparable: false, reason: "Les deux séances n'ont pas utilisé le même mode de repérage (automatique ou manuel)." };
    }
    if (prev.distance !== cur.distance) {
        return { comparable: false, reason: "Les deux séances n'ont pas été prises à la même distance." };
    }
    const changes = [];
    for (const to of cur.observations) {
        const from = prev.observations.find((o) => o.id === to.id);
        if (!from || from.level === "uncertain" || to.level === "uncertain")
            continue;
        if (from.low === undefined || from.high === undefined || to.low === undefined || to.high === undefined)
            continue;
        const overlap = from.low <= to.high && to.low <= from.high;
        changes.push({ id: to.id, kind: overlap ? "stable" : "changed", from, to });
    }
    return { comparable: true, changes };
}
export const MAX_HISTORY = 52;
export function appendSession(list, s) {
    return [...list, s].slice(-MAX_HISTORY);
}
