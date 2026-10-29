/**
 * Repérage manuel guidé : l'utilisateur place lui-même les 11 repères.
 * C'est la solution de remplacement honnête lorsque le modèle MediaPipe
 * n'est pas installé : les mesures viennent de points réellement placés,
 * jamais de valeurs simulées.
 *
 * Interaction : toucher pour placer, glisser pour ajuster (loupe ×3 au-dessus
 * du doigt), flèches pour un réglage au pixel près (clavier ou boutons).
 */
import { h, svg, announce } from "./dom.js";
import { button, icon, notice } from "./components.js";
import { drawOverlay, COLORS } from "./overlay.js";
import { POINT_DEFINITIONS, POINT_IDS, isCompletePointSet } from "../analysis/points.js";
import { sanityCheck } from "../analysis/geometry.js";
/** Positions schématiques (dérivées du modèle canonique MediaPipe) pour l'aide visuelle. */
const SCHEMA = {
    eyeOuterL: [14, 29], eyeInnerL: [35, 29], eyeInnerR: [65, 29], eyeOuterR: [86, 29],
    alarL: [36, 58], alarR: [64, 58], subnasale: [50, 67],
    mouthL: [30, 85], mouthR: [70, 85], stomion: [50, 84], menton: [50, 125],
};
function schemaFigure(active, placed) {
    const fig = svg("svg", { viewBox: "0 0 100 140", class: "schema", "aria-hidden": "true" }, svg("ellipse", { cx: 50, cy: 70, rx: 44, ry: 62, class: "schema-face" }), svg("path", { d: "M8 29 Q24 20 41 29 M59 29 Q76 20 92 29", class: "schema-line" }), svg("path", { d: "M50 34 L46 58 Q50 67 54 58", class: "schema-line" }), svg("path", { d: "M30 85 Q50 78 70 85 Q50 94 30 85", class: "schema-line" }));
    for (const id of POINT_IDS) {
        const [x, y] = SCHEMA[id];
        fig.appendChild(svg("circle", { cx: x, cy: y, r: id === active ? 5 : 2.6, class: id === active ? "schema-dot active" : placed.has(id) ? "schema-dot placed" : "schema-dot" }));
    }
    return fig;
}
export function createLandmarker(opts) {
    const points = {};
    let selected = null;
    let dragging = null;
    let pointerId = null;
    const canvas = h("canvas", { class: "landmark-canvas", "aria-label": "Photo : touchez pour placer le repère demandé", tabindex: "0" });
    const loupe = h("canvas", { class: "loupe", width: "132", height: "132", "aria-hidden": "true" });
    const stage = h("div", { class: "landmark-stage" }, canvas, loupe);
    const instruction = h("div", { class: "landmark-instruction", "aria-live": "polite" });
    const errors = h("div", { class: "landmark-errors" });
    const progress = h("p", { class: "muted small landmark-progress" });
    const nextMissing = () => POINT_IDS.find((id) => !points[id]) ?? null;
    function redraw() {
        drawOverlay(canvas, opts.image, points, { active: selected ?? nextMissing() });
    }
    function refreshPanel() {
        const target = nextMissing();
        const placed = new Set(POINT_IDS.filter((id) => points[id]));
        instruction.replaceChildren();
        if (target) {
            const def = POINT_DEFINITIONS.find((d) => d.id === target);
            instruction.append(schemaFigure(target, placed), h("div", null, h("p", { class: "eyebrow" }, `Repère ${placed.size + 1} sur ${POINT_IDS.length}`), h("p", { class: "landmark-label" }, def.label), h("p", { class: "muted small" }, def.hint)));
        }
        else {
            instruction.append(schemaFigure(selected, placed), h("div", null, h("p", { class: "eyebrow" }, "Tous les repères sont placés"), h("p", { class: "landmark-label" }, "Vérifiez-les, puis validez."), h("p", { class: "muted small" }, "Touchez un point pour le sélectionner et l'ajuster.")));
        }
        progress.textContent = selected
            ? `Point sélectionné : ${POINT_DEFINITIONS.find((d) => d.id === selected).label.toLowerCase()}. Utilisez les flèches pour l'ajuster.`
            : "";
        validateBtn.disabled = !isCompletePointSet(points);
        undoBtn.disabled = placed.size === 0;
    }
    function toImage(e) {
        const r = canvas.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
    }
    function hitTest(p) {
        const r = canvas.getBoundingClientRect();
        const radius = (26 / r.width) * canvas.width;
        let best = null;
        let bestD = radius;
        for (const id of POINT_IDS) {
            const q = points[id];
            if (!q)
                continue;
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bestD) {
                bestD = d;
                best = id;
            }
        }
        return best;
    }
    function showLoupe(p, e) {
        const ctx = loupe.getContext("2d");
        if (!ctx)
            return;
        const r = canvas.getBoundingClientRect();
        const zoom = 3;
        const cssToImg = canvas.width / r.width;
        const half = (66 / zoom) * cssToImg;
        ctx.clearRect(0, 0, 132, 132);
        ctx.save();
        ctx.beginPath();
        ctx.arc(66, 66, 64, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(canvas, p.x - half, p.y - half, half * 2, half * 2, 0, 0, 132, 132);
        ctx.restore();
        ctx.strokeStyle = COLORS.active;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(66, 52);
        ctx.lineTo(66, 80);
        ctx.moveTo(52, 66);
        ctx.lineTo(80, 66);
        ctx.stroke();
        const sr = stage.getBoundingClientRect();
        const left = Math.min(sr.width - 136, Math.max(4, e.clientX - sr.left - 66));
        const top = Math.max(4, e.clientY - sr.top - 170);
        loupe.style.left = `${left}px`;
        loupe.style.top = `${top}px`;
        loupe.classList.add("visible");
    }
    canvas.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        pointerId = e.pointerId;
        const p = toImage(e);
        const hit = hitTest(p);
        if (hit) {
            dragging = hit;
            selected = hit;
        }
        else {
            const target = nextMissing();
            if (!target)
                return;
            points[target] = p;
            dragging = target;
            selected = null;
        }
        redraw();
        showLoupe(points[dragging], e);
    });
    canvas.addEventListener("pointermove", (e) => {
        if (!dragging || e.pointerId !== pointerId)
            return;
        points[dragging] = toImage(e);
        redraw();
        showLoupe(points[dragging], e);
    });
    const endDrag = (e) => {
        if (e.pointerId !== pointerId)
            return;
        if (dragging) {
            const def = POINT_DEFINITIONS.find((d) => d.id === dragging);
            announce(`${def.label} placé.`);
        }
        dragging = null;
        pointerId = null;
        loupe.classList.remove("visible");
        errors.replaceChildren();
        redraw();
        refreshPanel();
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    function nudge(dx, dy) {
        const id = selected ?? [...POINT_IDS].reverse().find((k) => points[k]) ?? null;
        if (!id || !points[id])
            return;
        selected = id;
        const step = Math.max(1, canvas.width / 600);
        points[id] = { x: points[id].x + dx * step, y: points[id].y + dy * step };
        redraw();
        refreshPanel();
    }
    canvas.addEventListener("keydown", (e) => {
        const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const v = map[e.key];
        if (v) {
            e.preventDefault();
            nudge(v[0], v[1]);
        }
    });
    const undoBtn = button("Annuler le dernier", () => {
        const last = [...POINT_IDS].reverse().find((id) => points[id]);
        if (last)
            delete points[last];
        selected = null;
        redraw();
        refreshPanel();
    }, { variant: "quiet", icon: "undo" });
    const validateBtn = button("Valider les repères", () => {
        if (!isCompletePointSet(points))
            return;
        const problems = sanityCheck(points);
        if (problems.length) {
            errors.replaceChildren(notice("warn", h("p", null, h("strong", null, "Certains repères semblent mal placés :")), h("ul", null, problems.map((p) => h("li", null, p)))));
            announce("Certains repères semblent mal placés.");
            return;
        }
        opts.onDone({ ...points });
    }, { icon: "check" });
    const pad = h("div", { class: "nudge-pad", role: "group", "aria-label": "Ajuster le point sélectionné" }, button(h("span", { class: "sr-only" }, "Vers le haut"), () => nudge(0, -1), { variant: "quiet", icon: "arrow" }), button(h("span", { class: "sr-only" }, "Vers la gauche"), () => nudge(-1, 0), { variant: "quiet", icon: "arrow" }), button(h("span", { class: "sr-only" }, "Vers la droite"), () => nudge(1, 0), { variant: "quiet", icon: "arrow" }), button(h("span", { class: "sr-only" }, "Vers le bas"), () => nudge(0, 1), { variant: "quiet", icon: "arrow" }));
    pad.querySelectorAll("button").forEach((b, i) => b.classList.add(["up", "left", "right", "down"][i]));
    const root = h("div", { class: "landmarker" }, instruction, stage, progress, h("div", { class: "landmark-controls" }, undoBtn, pad), errors, h("div", { class: "button-row" }, button("Abandonner cette photo", opts.onCancel, { variant: "ghost" }), validateBtn), h("p", { class: "muted small" }, icon("info", 14), " Les points sont placés sur ton téléphone. Rien n'est envoyé."));
    redraw();
    refreshPanel();
    return root;
}
