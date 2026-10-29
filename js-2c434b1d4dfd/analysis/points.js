/**
 * Schéma des repères faciaux utilisés par Reflet.
 *
 * Les noms sont relatifs à l'IMAGE (« L » = côté gauche de la photo,
 * « R » = côté droit de la photo) et non à l'anatomie de la personne :
 * ainsi, une photo miroir (caméra frontale) ne change rien aux calculs ni
 * aux textes affichés.
 */
/** Ordre de saisie en mode manuel (du haut vers le bas, de gauche à droite). */
export const POINT_DEFINITIONS = [
    { id: "eyeOuterL", label: "Coin externe de l'œil à gauche de la photo", hint: "Là où les paupières se rejoignent, côté tempe." },
    { id: "eyeInnerL", label: "Coin interne de l'œil à gauche de la photo", hint: "Là où les paupières se rejoignent, côté nez." },
    { id: "eyeInnerR", label: "Coin interne de l'œil à droite de la photo", hint: "Là où les paupières se rejoignent, côté nez." },
    { id: "eyeOuterR", label: "Coin externe de l'œil à droite de la photo", hint: "Là où les paupières se rejoignent, côté tempe." },
    { id: "alarL", label: "Bord externe de la narine à gauche de la photo", hint: "Le point le plus large de l'aile du nez." },
    { id: "alarR", label: "Bord externe de la narine à droite de la photo", hint: "Le point le plus large de l'aile du nez." },
    { id: "subnasale", label: "Base du nez, au-dessus de la lèvre", hint: "Là où la cloison du nez rejoint la lèvre supérieure." },
    { id: "mouthL", label: "Coin de la bouche à gauche de la photo", hint: "La commissure des lèvres." },
    { id: "mouthR", label: "Coin de la bouche à droite de la photo", hint: "La commissure des lèvres." },
    { id: "stomion", label: "Centre de la ligne entre les lèvres", hint: "Bouche fermée, au milieu de la ligne de contact." },
    { id: "menton", label: "Point le plus bas du menton", hint: "Le bas du menton sur l'axe du visage (pas la mâchoire)." },
];
export const POINT_IDS = POINT_DEFINITIONS.map((d) => d.id);
/**
 * Correspondance avec les indices du maillage MediaPipe Face Landmarker
 * (478 points). Indices vérifiés sur le modèle canonique
 * `canonical_face_model.obj` du dépôt google-ai-edge/mediapipe.
 * Pour une photo non inversée, les indices 33/133/468 se trouvent à gauche
 * de l'image ; les paires sont de toute façon réordonnées par abscisse.
 */
export const MEDIAPIPE_INDEX = {
    eyeOuterL: 33,
    eyeInnerL: 133,
    eyeInnerR: 362,
    eyeOuterR: 263,
    alarL: 129,
    alarR: 358,
    subnasale: 2,
    mouthL: 61,
    mouthR: 291,
    stomion: [13, 14],
    menton: 152,
};
/** Indices complémentaires utilisés pour les contrôles (pose, bouche). */
export const MEDIAPIPE_EXTRA = {
    faceEdgeL: 234,
    faceEdgeR: 454,
    noseTip: 1,
    lipInnerTop: 13,
    lipInnerBottom: 14,
    forehead: 10,
};
const PAIRS = [
    ["eyeOuterL", "eyeOuterR"],
    ["eyeInnerL", "eyeInnerR"],
    ["alarL", "alarR"],
    ["mouthL", "mouthR"],
];
/**
 * Remet chaque paire gauche/droite dans l'ordre de l'image (L = x plus petit)
 * et vérifie l'ordre interne des yeux. Retourne une copie.
 */
export function normalizePairs(points) {
    const out = { ...points };
    for (const [l, r] of PAIRS) {
        if (out[l].x > out[r].x) {
            const tmp = out[l];
            out[l] = out[r];
            out[r] = tmp;
        }
    }
    // Coins internes et externes : l'externe est le plus éloigné du centre.
    if (out.eyeOuterL.x > out.eyeInnerL.x) {
        [out.eyeOuterL, out.eyeInnerL] = [out.eyeInnerL, out.eyeOuterL];
    }
    if (out.eyeOuterR.x < out.eyeInnerR.x) {
        [out.eyeOuterR, out.eyeInnerR] = [out.eyeInnerR, out.eyeOuterR];
    }
    return out;
}
export function isCompletePointSet(p) {
    return POINT_IDS.every((id) => {
        const pt = p[id];
        return !!pt && Number.isFinite(pt.x) && Number.isFinite(pt.y);
    });
}
/** Extrait le jeu de points depuis des repères MediaPipe en pixels. */
export function pointsFromMediapipe(landmarksPx) {
    if (landmarksPx.length < 468) {
        throw new Error("Le modèle n'a pas renvoyé le maillage complet attendu.");
    }
    const get = (i) => ({ x: landmarksPx[i].x, y: landmarksPx[i].y });
    const [a, b] = MEDIAPIPE_INDEX.stomion;
    const raw = {
        eyeOuterL: get(MEDIAPIPE_INDEX.eyeOuterL),
        eyeInnerL: get(MEDIAPIPE_INDEX.eyeInnerL),
        eyeInnerR: get(MEDIAPIPE_INDEX.eyeInnerR),
        eyeOuterR: get(MEDIAPIPE_INDEX.eyeOuterR),
        alarL: get(MEDIAPIPE_INDEX.alarL),
        alarR: get(MEDIAPIPE_INDEX.alarR),
        subnasale: get(MEDIAPIPE_INDEX.subnasale),
        mouthL: get(MEDIAPIPE_INDEX.mouthL),
        mouthR: get(MEDIAPIPE_INDEX.mouthR),
        stomion: { x: (landmarksPx[a].x + landmarksPx[b].x) / 2, y: (landmarksPx[a].y + landmarksPx[b].y) / 2 },
        menton: get(MEDIAPIPE_INDEX.menton),
    };
    return normalizePairs(raw);
}
