/**
 * Estimation de l'incertitude des mesures par propagation Monte-Carlo.
 *
 * Chaque repère est perturbé par un bruit gaussien isotrope d'écart-type σ,
 * puis toutes les mesures sont recalculées. L'intervalle affiché est
 * l'intervalle 5 %–95 % des valeurs obtenues.
 *
 * Le générateur pseudo-aléatoire est déterministe (graine dérivée des
 * coordonnées) : la même photo donne toujours le même intervalle. Le hasard
 * sert uniquement à estimer l'incertitude, jamais à produire une mesure.
 */
import { computeMetrics, buildFrame } from "./geometry.js";
import { POINT_IDS } from "./points.js";
/** Générateur mulberry32 (domaine public). */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function seedFromPoints(p) {
    let h = 2166136261 >>> 0;
    for (const id of POINT_IDS) {
        for (const v of [p[id].x, p[id].y]) {
            h ^= Math.round(v * 100);
            h = Math.imul(h, 16777619) >>> 0;
        }
    }
    return h;
}
function gaussian(rand) {
    // Box-Muller
    let u = 0;
    while (u === 0)
        u = rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function quantile(sorted, q) {
    if (sorted.length === 0)
        return Number.NaN;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
/**
 * Écart-type de position d'un repère, exprimé en fraction de la distance
 * entre les coins externes des yeux (normalisation des benchmarks 300-W et
 * WFLW). Pour un bruit gaussien 2D, erreur moyenne = σ·√(π/2) ≈ 1,25 σ.
 *
 * - autoGood : photo conforme aux contrôles → erreur moyenne ≈ 2,9 %
 *   (meilleurs détecteurs sur 300-W, arXiv 2508.14929), σ ≈ 0,023 ;
 * - auto : photo dégradée → ≈ 4,0 % (WFLW), σ ≈ 0,032.
 *   MediaPipe n'a pas été validé contre une mesure manuelle : ces valeurs
 *   sont des a priori prudents, pas des performances mesurées de MediaPipe.
 * - manual : HYPOTHÈSE de conception (pointé au doigt avec loupe), à
 *   calibrer par un test de répétabilité (docs/VALIDATION.md).
 */
export const LANDMARK_SIGMA = { autoGood: 0.023, auto: 0.032, manual: 0.02 };
export function sampleMetrics(p, sigmaFraction, n = 400) {
    const outerDist = Math.hypot(p.eyeOuterR.x - p.eyeOuterL.x, p.eyeOuterR.y - p.eyeOuterL.y);
    const sigmaPx = sigmaFraction * outerDist;
    const rand = mulberry32(seedFromPoints(p));
    const samples = {};
    const base = computeMetrics(p);
    for (const k of Object.keys(base))
        samples[k] = [];
    for (let i = 0; i < n; i++) {
        const q = {};
        for (const id of POINT_IDS) {
            q[id] = { x: p[id].x + gaussian(rand) * sigmaPx, y: p[id].y + gaussian(rand) * sigmaPx };
        }
        let m;
        try {
            buildFrame(q);
            m = computeMetrics(q);
        }
        catch {
            continue;
        }
        for (const k of Object.keys(m)) {
            if (Number.isFinite(m[k]))
                samples[k].push(m[k]);
        }
    }
    return samples;
}
export function intervalOf(values) {
    const s = [...values].sort((a, b) => a - b);
    return { median: quantile(s, 0.5), low: quantile(s, 0.05), high: quantile(s, 0.95) };
}
export function median(values) {
    return quantile([...values].sort((a, b) => a - b), 0.5);
}
