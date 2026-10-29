const OFFSETS = ["outerCanthusOffset", "alarOffset", "mouthCornerOffset", "subnasaleMidline", "stomionMidline", "mentonMidline"];
export function symmetryIndex(obs) {
    const usable = obs.filter((o) => OFFSETS.includes(o.id) && o.level !== "uncertain" && o.estimate !== undefined && o.low !== undefined && o.high !== undefined);
    if (!usable.length) {
        const raw = obs.filter((o) => OFFSETS.includes(o.id) && o.rawEstimate !== undefined);
        if (!raw.length)
            return { value: null, low: null, high: null, measures: 0, precision: 0 };
        const v = Math.max(0, Math.min(100, Math.round(100 - raw.reduce((a, o) => a + Math.abs(o.rawEstimate), 0) / raw.length)));
        return { value: v, low: null, high: null, measures: raw.length, precision: 1 };
    }
    const mean = (f) => usable.reduce((a, o) => a + f(o), 0) / usable.length;
    const center = mean((o) => Math.abs(o.estimate));
    const worst = mean((o) => Math.max(Math.abs(o.low), Math.abs(o.high)));
    const best = mean((o) => (o.low <= 0 && o.high >= 0 ? 0 : Math.min(Math.abs(o.low), Math.abs(o.high))));
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(100 - v)));
    const precision = usable.every((o) => o.level === "reliable") ? 3 : 2;
    return { value: clamp(center), low: clamp(worst), high: clamp(best), measures: usable.length, precision };
}
const SHORT_TIP = {
    distance: "Pose le tel à 1,5 m avec le retardateur kho, le selfie à bout de bras ça gonfle le nez 😭",
    lateralLight: "Mets-toi face à la lumière, là t'as la moitié de la tête dans le noir 💀",
    blur: "C'est flou frérot, tiens le tel droit.",
    exposure: "Plus de lumière kho, on se croirait dans une cave.",
    yaw: "Regarde l'objectif droit dans les yeux, pas de profil.",
    pitch: "Tel à hauteur des yeux, pas en contre-plongée.",
    expression: "Visage neutre kho, garde le sourire pour après 😂",
    faceSize: "Rapproche-toi, on te voit à peine.",
    blink: "Ouvre les yeux frérot 😭",
    roll: "Tête droite, pas penchée.",
    glasses: "Enlève les lunettes pour le scan.",
    faces: "Seul dans le cadre kho.",
    resolution: "Image trop petite.",
};
const WEIGHT = { block: 30, yaw: 15, pitch: 10, blur: 12, exposure: 12, lateralLight: 10, faceSize: 10, expression: 8, blink: 8, roll: 5, glasses: 6, distance: 10 };
export function qualityScore(photos) {
    if (!photos.length)
        return { score: 0, tip: null, short: null };
    let worst = null;
    const scores = photos.map((p) => {
        let s = 100;
        for (const i of p.issues) {
            const w = i.severity === "block" ? WEIGHT.block : WEIGHT[i.id] ?? 5;
            s -= w;
            if (!worst || w > worst.w)
                worst = { w, tip: i.advice, id: i.id };
        }
        return Math.max(0, s);
    });
    const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const wst = worst;
    return { score, tip: wst?.tip ?? null, short: wst ? SHORT_TIP[wst.id] ?? wst.tip : null };
}
/** Leviers concrets proposés après un scan (identifiants de conseils du programme). */
export function leversFor(s) {
    const out = [];
    const has = (id) => s.issueIds.includes(id);
    if (has("distance") || has("lateralLight") || has("yaw") || has("blur") || has("exposure"))
        out.push({ adviceId: "photo", label: "Mieux te photographier" });
    out.push({ adviceId: "spf", label: "Écran solaire chaque matin" });
    out.push({ adviceId: "sleep", label: "7 h de sommeil ou plus" });
    return out.slice(0, 3);
}
export const TIERS = [
    { name: "Aïe aïe aïe frérot 💀", min: 0, line: "Safi kho, ce scan c'est un crime. Regarde les critères en rouge et refais-le." },
    { name: "Faut travailler ça mon reuf 😭", min: 5, line: "Sah y'a du taf. Corrige un ou deux critères et ça remonte direct." },
    { name: "Ça passe tranquille 😂", min: 10, line: "Tranquille kho, quelques réglages et c'est carré." },
    { name: "Propre de fou wola 🔥", min: 15, line: "Sah c'est propre. Il manque presque rien." },
    { name: "TROP BEAU WOLA 🗿🔥", min: 18, line: "Scan de boss, rien à redire wola." },
];
export function tierFor(score20) {
    let t = TIERS[0];
    for (const x of TIERS)
        if (score20 >= x.min)
            t = x;
    return t;
}
const CRITERIA = [
    { id: "lumiere", label: "Lumière", issues: { exposure: 2, lateralLight: 2 }, tip: "Mets-toi face à une fenêtre, sans flash." },
    { id: "nettete", label: "Netteté", issues: { blur: 2 }, tip: "Tiens le tel droit ou pose-le, c'est flou." },
    { id: "cadrage", label: "Cadrage", issues: { faceSize: 2, faces: 4, resolution: 4 }, tip: "Ton visage doit remplir l'ovale, seul dans le cadre." },
    { id: "pose", label: "Pose", issues: { yaw: 2, pitch: 2, roll: 1, blink: 1 }, tip: "Tête droite, regard dans l'objectif, yeux ouverts." },
    { id: "distance", label: "Distance & expression", issues: { distance: 2, expression: 2, glasses: 1 }, tip: "Tel à 1,5 m avec le retardateur, visage neutre, sans lunettes." },
];
/** Critères calculés sur la photo source (la première de la séance). Un problème bloquant vaut 0 sur 4. */
export function scanCriteria(photo) {
    return CRITERIA.map((c) => {
        if (!photo)
            return { id: c.id, label: c.label, points: 0, tip: c.tip };
        let pts = 4;
        for (const i of photo.issues) {
            const w = c.issues[i.id];
            if (w === undefined)
                continue;
            pts -= i.severity === "block" ? 4 : w;
        }
        pts = Math.max(0, pts);
        return { id: c.id, label: c.label, points: pts, tip: pts < 4 ? c.tip : null };
    });
}
export function scanNote(photo) {
    const criteria = scanCriteria(photo);
    const total = criteria.reduce((a, c) => a + c.points, 0);
    return { total, criteria, tier: tierFor(total) };
}
const ZONES = [
    { id: "yeux", label: "Yeux", emoji: "👁️", metrics: [["eyeWidthDiff", 0.5], ["outerCanthusOffset", 1]] },
    { id: "nez", label: "Nez", emoji: "👃", metrics: [["alarOffset", 1], ["subnasaleMidline", 1]] },
    { id: "bouche", label: "Bouche", emoji: "👄", metrics: [["mouthCornerOffset", 1], ["stomionMidline", 1], ["mouthLineAngle", 1.5]] },
    { id: "menton", label: "Mâchoire / menton", emoji: "🗿", metrics: [["mentonMidline", 1]] },
];
export function zoneLine(score) {
    if (score === null)
        return "Pas mesurable sur cette photo kho.";
    if (score >= 9)
        return "Symétrie de ouf wola 🔥";
    if (score >= 7)
        return "Clean, sah.";
    if (score >= 5)
        return "Ça passe tranquille.";
    return "Sûrement la photo de travers, refais-la droit 😭";
}
export function zoneScores(obs) {
    return ZONES.map((z) => {
        const vals = [];
        let prec = 3;
        for (const [id, weight] of z.metrics) {
            const o = obs.find((x) => x.id === id);
            if (!o)
                continue;
            const v = o.level !== "uncertain" && o.estimate !== undefined ? o.estimate : o.rawEstimate;
            if (v === undefined)
                continue;
            vals.push(Math.abs(v) * weight);
            const p = o.level === "reliable" ? 3 : o.level === "confirm" ? 2 : 1;
            prec = Math.min(prec, p);
        }
        if (!vals.length)
            return { id: z.id, label: z.label, emoji: z.emoji, score: null, precision: 0, line: zoneLine(null) };
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        // 0 % d'écart → 10/10 ; chaque 1,2 % d'écart (en % de la distance entre les yeux) retire 1 point.
        const score = Math.round(Math.max(0, Math.min(10, 10 - mean / 1.2)) * 2) / 2;
        return { id: z.id, label: z.label, emoji: z.emoji, score, precision: prec, line: zoneLine(score) };
    });
}
