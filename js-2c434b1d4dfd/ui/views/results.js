import { h, svg } from "../dom.js";
import { button, details, icon, linkButton, notice, sourceList } from "../components.js";
import { drawOverlay } from "../overlay.js";
import { persistHistory, state } from "../../app/state.js";
import { go } from "../../app/router.js";
import { METRICS, SOURCES } from "../../analysis/metrics.js";
import { formatValue } from "../../analysis/observations.js";
import { leversFor, scanNote, symmetryIndex, zoneScores } from "../../analysis/summary.js";
import { appendSession, toStored } from "../../analysis/history.js";
import { abandonCapture } from "./analyse.js";
let savedFor = null;
export function gauge(value, label) {
    const R = 52, C = 2 * Math.PI * R;
    const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
    return h("div", { class: "gauge", role: "img", "aria-label": value === null ? `${label} : non mesurable` : `${label} : ${value} %` }, svg("svg", { viewBox: "0 0 128 128", "aria-hidden": "true" }, svg("circle", { cx: 64, cy: 64, r: R, class: "gauge-track" }), svg("circle", { cx: 64, cy: 64, r: R, class: "gauge-fill", "stroke-dasharray": `${C * pct} ${C}`, transform: "rotate(-90 64 64)" })), h("div", { class: "gauge-center" }, h("span", { class: "gauge-value" }, value === null ? "—" : `${value} %`), h("span", { class: "gauge-label" }, label)));
}
/** Précision en 3 points : ●●● fiable, ●●○ à confirmer, ●○○ indicatif. */
function dots(n) {
    const label = ["non mesurable", "indicatif", "à confirmer", "fiable"][n];
    return h("span", { class: "dots", title: `Précision : ${label}`, "aria-label": `Précision : ${label}` }, [1, 2, 3].map((i) => h("span", { class: i <= n ? "dot on" : "dot" })));
}
function precisionOf(o) {
    if (!o)
        return 0;
    if (o.level === "reliable")
        return 3;
    if (o.level === "confirm")
        return 2;
    return o.rawEstimate !== undefined ? 1 : 0;
}
function obs(id) {
    return state.result?.observations.find((o) => o.id === id);
}
function valueText(o) {
    if (!o)
        return "—";
    const def = METRICS[o.id];
    if (o.level !== "uncertain" && o.estimate !== undefined)
        return formatValue(def.kind, o.estimate);
    if (o.rawEstimate !== undefined)
        return `≈ ${formatValue(def.kind, o.rawEstimate)}`;
    return "—";
}
function card(title, value, prec, foot, ...body) {
    return h("details", { class: "stat-card" }, h("summary", null, h("span", { class: "stat-card-title" }, title), h("span", { class: "stat-card-value" }, value), h("span", { class: "stat-card-foot" }, dots(prec), " ", foot)), h("div", { class: "stat-card-body" }, ...body));
}
function metricCard(title, id, foot) {
    const o = obs(id);
    const def = METRICS[id];
    return card(title, valueText(o), precisionOf(o), foot, h("p", null, def.what), o && o.influences.length ? h("p", { class: "small muted" }, o.influences[0]) : null, o?.hiddenReason ? h("p", { class: "small muted" }, o.hiddenReason) : null, h("p", { class: "small muted" }, def.meaning));
}
export function renderResults(root) {
    if (state.settings.adult !== true)
        state.result = null;
    const r = state.result;
    if (!r) {
        root.append(h("header", { class: "scan-header" }, h("h1", { id: "page-title", tabindex: "-1" }, "Résultat")), h("div", { class: "card center" }, h("p", null, "Aucun scan pour l'instant."), h("div", { class: "button-row center" }, linkButton("Lancer un scan", "#analyse", { icon: "scan" }))));
        return;
    }
    const photos = state.capture?.photos ?? [];
    const sym = symmetryIndex(r.observations);
    root.appendChild(h("header", { class: "scan-header row", "data-mode": r.mode, "data-photos": String(r.photos) }, h("h1", { id: "page-title", tabindex: "-1" }, "Le verdict 🗿")));
    if (r.blockedReasons?.length && !r.photos) {
        root.appendChild(notice("block", h("p", null, [...new Set(r.blockedReasons)].join(" "))));
    }
    // Héros : la note sur 20 (photo + routine), jamais une note du visage.
    const note = photos.length ? scanNote(photos[0]) : state.lastNote ?? scanNote(undefined);
    const hero = h("section", { class: "hero-card" });
    const cap = state.capture;
    if (cap && cap.images.length && cap.photos.length) {
        const c = h("canvas", { class: "hero-photo", role: "img", "aria-label": "Repères sur ta photo" });
        drawOverlay(c, cap.images[0].canvas, cap.photos[0].points, { axes: true, crop: true });
        hero.appendChild(c);
    }
    hero.appendChild(h("div", { class: "hero-side note-side", "data-testid": "note20" }, h("p", { class: "note-big" }, h("span", null, fmtNote(note.total)), h("small", null, "/20")), h("p", { class: "tier" }, note.tier.name), h("p", { class: "muted small center" }, note.tier.line)));
    root.appendChild(hero);
    root.appendChild(h("section", { class: "criteria", "aria-label": "Détail de la note" }, note.criteria.map((c) => h("div", { class: `crit${c.points === 4 ? " ok" : c.points === 0 ? " ko" : ""}` }, h("span", { class: "crit-label" }, c.label), h("span", { class: "crit-bar" }, [0, 1, 2, 3].map((i) => h("span", { class: i < c.points ? "seg on" : "seg" }))), h("span", { class: "crit-pts" }, `${c.points}/4`), c.tip ? h("span", { class: "crit-tip" }, c.tip) : null))));
    root.appendChild(h("section", { class: "zones" }, zoneScores(r.observations).map((z) => h("div", { class: "zone", "data-testid": `zone-${z.id}` }, h("span", { class: "zone-head" }, h("span", { "aria-hidden": "true" }, z.emoji), " ", z.label), h("span", { class: "zone-value" }, z.score === null ? "—" : `${z.precision === 1 ? "≈\u00a0" : ""}${fmtNote(z.score)}`, z.score === null ? null : h("small", null, "/10")), h("span", { class: "zone-line" }, dots(z.precision), " ", z.line)))));
    root.appendChild(h("p", { class: "sym-chip" }, "Symétrie globale : ", h("strong", null, sym.value === null ? "—" : `${sym.value}\u00a0%`), " ", dots(sym.precision)));
    root.appendChild(h("section", { class: "levers" }, h("h2", { class: "section-title" }, "Pour monter en flèche 📈"), h("div", { class: "lever-row" }, leversFor(r).map((l) => h("a", { href: "#programme", class: "lever" }, icon("arrow", 16), l.label)))));
    const allIds = ["outerCanthusOffset", "eyeWidthDiff", "alarOffset", "mouthCornerOffset", "mouthLineAngle", "subnasaleMidline", "stomionMidline", "mentonMidline", "mouthNoseRatio"];
    root.appendChild(h("section", { class: "card compact" }, details("Les chiffres pour les geeks 🤓", h("div", { class: "stat-grid" }, metricCard("Yeux", "eyeWidthRatio", "œil / écart"), metricCard("Bas du visage", "lowerFaceRatio", "lèvre / menton"), metricCard("Nez", "noseIntercanthalRatio", "nez / écart des yeux")), h("ul", { class: "metric-rows" }, allIds.map((id) => {
        const o = obs(id);
        return h("li", null, h("span", null, METRICS[id].name), h("span", { class: "metric-row-right" }, valueText(o), dots(precisionOf(o))));
    })), h("p", { class: "small muted" }, "Comment c'est calculé : la note /20 = 5 critères de ton scan notés sur 4 (lumière, netteté, cadrage, pose, distance & expression). Les notes des zones = leur symétrie gauche-droite, mesurée par l'IA sur ta photo (personne n'est symétrique à 100\u00a0%, et c'est normal). L'IA ne juge pas ta beauté kho : ça, aucune machine ne sait le faire. « ≈ » = mesure approximative (lumière, angle, distance)."), sourceList([SOURCES.rhodes2006, SOURCES.ward2018]))));
    if (state.settings.historyEnabled && savedFor !== r.createdAt) {
        const saveBtn = button("Garder ce scan dans l'historique", async () => {
            state.history = appendSession(state.history, toStored(r));
            if (await persistHistory()) {
                savedFor = r.createdAt;
                saveBtn.replaceWith(h("p", { class: "muted small" }, icon("check", 14), " Enregistré, sans photo."));
            }
        }, { variant: "quiet", icon: "check" });
        root.appendChild(saveBtn);
    }
    root.appendChild(h("div", { class: "button-row" }, button("Re-scanner 📸", () => {
        abandonCapture();
        go("analyse");
    }, { icon: "scan" }), button("Effacer", () => {
        abandonCapture();
        state.result = null;
        go("accueil");
    }, { variant: "quiet", icon: "trash" })));
}
export function fmtNote(v) {
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}
