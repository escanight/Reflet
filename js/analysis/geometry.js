const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function buildFrame(p) {
    const eyeL = mid(p.eyeOuterL, p.eyeInnerL);
    const eyeR = mid(p.eyeOuterR, p.eyeInnerR);
    const d = dist(eyeL, eyeR);
    if (!(d > 0))
        throw new Error("Repères des yeux confondus : impossible de construire le repère.");
    const ux = { x: (eyeR.x - eyeL.x) / d, y: (eyeR.y - eyeL.y) / d };
    // Perpendiculaire orientée vers le bas de l'image (y image croissant).
    let uy = { x: -ux.y, y: ux.x };
    if (uy.y < 0)
        uy = { x: -uy.x, y: -uy.y };
    const origin = mid(p.eyeInnerL, p.eyeInnerR);
    const rollDeg = (Math.atan2(ux.y, ux.x) * 180) / Math.PI;
    return { origin, ux, uy, d, rollDeg };
}
/** Projette un point dans le repère du visage, en unités de D. */
export function toFrame(f, pt) {
    const vx = pt.x - f.origin.x;
    const vy = pt.y - f.origin.y;
    return { x: (vx * f.ux.x + vy * f.ux.y) / f.d, y: (vx * f.uy.x + vy * f.uy.y) / f.d };
}
/**
 * Calcule toutes les mesures brutes pour un jeu de points.
 * Les écarts gauche-droite sont exprimés en % de D (signe : positif si le
 * côté gauche de la photo est plus éloigné de la ligne médiane / plus bas).
 */
export function computeMetrics(p) {
    const f = buildFrame(p);
    const t = (pt) => toFrame(f, pt);
    const oL = t(p.eyeOuterL), iL = t(p.eyeInnerL), iR = t(p.eyeInnerR), oR = t(p.eyeOuterR);
    const aL = t(p.alarL), aR = t(p.alarR);
    const mL = t(p.mouthL), mR = t(p.mouthR);
    const sn = t(p.subnasale), st = t(p.stomion), me = t(p.menton);
    const eyeWL = dist(oL, iL);
    const eyeWR = dist(oR, iR);
    const intercanthal = dist(iL, iR);
    const noseW = dist(aL, aR);
    const mouthW = dist(mL, mR);
    const upper = st.y - sn.y; // subnasale → stomion
    const lower = me.y - st.y; // stomion → menton
    const pct = (v) => v * 100;
    const mouthAngle = (Math.atan2(mR.y - mL.y, mR.x - mL.x) * 180) / Math.PI;
    return {
        eyeWidthRatio: ((eyeWL + eyeWR) / 2) / intercanthal,
        eyeWidthDiff: pct((eyeWL - eyeWR) / ((eyeWL + eyeWR) / 2)), // % de la largeur moyenne
        outerCanthusOffset: pct(Math.abs(oL.x) - Math.abs(oR.x)),
        mouthCornerOffset: pct(Math.abs(mL.x) - Math.abs(mR.x)),
        alarOffset: pct(Math.abs(aL.x) - Math.abs(aR.x)),
        mouthLineAngle: -mouthAngle, // positif : coin gauche de la photo plus bas
        subnasaleMidline: pct(sn.x),
        stomionMidline: pct(st.x),
        mentonMidline: pct(me.x),
        lowerFaceRatio: lower > 0 ? upper / lower : Number.NaN,
        noseIntercanthalRatio: noseW / intercanthal,
        mouthNoseRatio: mouthW / noseW,
    };
}
/** Plausibilité anatomique minimale : rejette les saisies incohérentes. */
export function sanityCheck(p) {
    const problems = [];
    let f;
    try {
        f = buildFrame(p);
    }
    catch {
        return ["Les coins des yeux sont confondus."];
    }
    const t = (pt) => toFrame(f, pt);
    const sn = t(p.subnasale), st = t(p.stomion), me = t(p.menton);
    const iL = t(p.eyeInnerL), iR = t(p.eyeInnerR);
    if (!(sn.y > 0.2))
        problems.push("La base du nez doit se trouver sous la ligne des yeux.");
    if (!(st.y > sn.y))
        problems.push("La ligne des lèvres doit se trouver sous la base du nez.");
    if (!(me.y > st.y))
        problems.push("Le menton doit se trouver sous la bouche.");
    if (!(iR.x - iL.x > 0.2))
        problems.push("Les coins internes des yeux sont trop proches l'un de l'autre.");
    const m = computeMetrics(p);
    if (!(m.eyeWidthRatio > 0.3 && m.eyeWidthRatio < 3))
        problems.push("Les largeurs d'yeux semblent incohérentes.");
    if (!(m.noseIntercanthalRatio > 0.4 && m.noseIntercanthalRatio < 3))
        problems.push("La largeur du nez semble incohérente.");
    if (!(m.mouthNoseRatio > 0.5 && m.mouthNoseRatio < 4))
        problems.push("La largeur de la bouche semble incohérente.");
    if (Math.abs(m.subnasaleMidline) > 40)
        problems.push("La base du nez est très loin de l'axe du visage.");
    return problems;
}
export { dist, mid };
