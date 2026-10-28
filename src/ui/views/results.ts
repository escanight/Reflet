import { h, svg } from "../dom.js";
import { button, details, icon, linkButton, notice, sourceList } from "../components.js";
import { drawOverlay } from "../overlay.js";
import { persistHistory, state } from "../../app/state.js";
import { go } from "../../app/router.js";
import { METRICS, SOURCES } from "../../analysis/metrics.js";
import { formatValue, type MetricObservation } from "../../analysis/observations.js";
import { leversFor, note20, qualityScore, symmetryIndex } from "../../analysis/summary.js";
import { appendSession, toStored } from "../../analysis/history.js";
import { abandonCapture, lastScanXp } from "./analyse.js";
import type { MetricId } from "../../analysis/geometry.js";

let savedFor: string | null = null;

export function gauge(value: number | null, label: string): HTMLElement {
  const R = 52, C = 2 * Math.PI * R;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return h(
    "div",
    { class: "gauge", role: "img", "aria-label": value === null ? `${label} : non mesurable` : `${label} : ${value} %` },
    svg("svg", { viewBox: "0 0 128 128", "aria-hidden": "true" },
      svg("circle", { cx: 64, cy: 64, r: R, class: "gauge-track" }),
      svg("circle", { cx: 64, cy: 64, r: R, class: "gauge-fill", "stroke-dasharray": `${C * pct} ${C}`, transform: "rotate(-90 64 64)" }),
    ),
    h("div", { class: "gauge-center" }, h("span", { class: "gauge-value" }, value === null ? "—" : `${value} %`), h("span", { class: "gauge-label" }, label)),
  );
}

/** Précision en 3 points : ●●● fiable, ●●○ à confirmer, ●○○ indicatif. */
function dots(n: 0 | 1 | 2 | 3): HTMLElement {
  const label = ["non mesurable", "indicatif", "à confirmer", "fiable"][n];
  return h("span", { class: "dots", title: `Précision : ${label}`, "aria-label": `Précision : ${label}` }, [1, 2, 3].map((i) => h("span", { class: i <= n ? "dot on" : "dot" })));
}

function precisionOf(o: MetricObservation | undefined): 0 | 1 | 2 | 3 {
  if (!o) return 0;
  if (o.level === "reliable") return 3;
  if (o.level === "confirm") return 2;
  return o.rawEstimate !== undefined ? 1 : 0;
}

function obs(id: MetricId): MetricObservation | undefined {
  return state.result?.observations.find((o) => o.id === id);
}

function valueText(o: MetricObservation | undefined): string {
  if (!o) return "—";
  const def = METRICS[o.id];
  if (o.level !== "uncertain" && o.estimate !== undefined) return formatValue(def.kind, o.estimate);
  if (o.rawEstimate !== undefined) return `≈ ${formatValue(def.kind, o.rawEstimate)}`;
  return "—";
}

function card(title: string, value: string, prec: 0 | 1 | 2 | 3, foot: string, ...body: Array<Node | null>): HTMLElement {
  return h(
    "details",
    { class: "stat-card" },
    h("summary", null, h("span", { class: "stat-card-title" }, title), h("span", { class: "stat-card-value" }, value), h("span", { class: "stat-card-foot" }, dots(prec), " ", foot)),
    h("div", { class: "stat-card-body" }, ...body),
  );
}

function metricCard(title: string, id: MetricId, foot: string): HTMLElement {
  const o = obs(id);
  const def = METRICS[id];
  return card(
    title,
    valueText(o),
    precisionOf(o),
    foot,
    h("p", null, def.what),
    o && o.influences.length ? h("p", { class: "small muted" }, o.influences[0]) : null,
    o?.hiddenReason ? h("p", { class: "small muted" }, o.hiddenReason) : null,
    h("p", { class: "small muted" }, def.meaning),
  );
}

export function renderResults(root: HTMLElement): void {
  if (state.settings.adult !== true) state.result = null;
  const r = state.result;
  if (!r) {
    root.append(
      h("header", { class: "scan-header" }, h("h1", { id: "page-title", tabindex: "-1" }, "Résultat")),
      h("div", { class: "card center" }, h("p", null, "Aucun scan pour l'instant."), h("div", { class: "button-row center" }, linkButton("Lancer un scan", "#analyse", { icon: "scan" }))),
    );
    return;
  }
  const photos = state.capture?.photos ?? [];
  const sym = symmetryIndex(r.observations);
  const quality = qualityScore(photos);

  root.appendChild(
    h("header", { class: "scan-header row", "data-mode": r.mode, "data-photos": String(r.photos) },
      h("h1", { id: "page-title", tabindex: "-1" }, "Ton résultat"),
      lastScanXp > 0 ? h("span", { class: "xp-pill" }, `+${lastScanXp} XP`) : null,
    ),
  );
  if (r.blockedReasons?.length && !r.photos) {
    root.appendChild(notice("block", h("p", null, [...new Set(r.blockedReasons)].join(" "))));
  }

  // Héros : la note sur 20 (photo + routine), jamais une note du visage.
  const note = note20(quality.score, state.habits);
  const hero = h("section", { class: "hero-card" });
  const cap = state.capture;
  if (cap && cap.images.length && cap.photos.length) {
    const c = h("canvas", { class: "hero-photo", role: "img", "aria-label": "Repères sur ta photo" });
    drawOverlay(c, cap.images[0].canvas, cap.photos[0].points, { axes: true, crop: true });
    hero.appendChild(c);
  }
  hero.appendChild(
    h("div", { class: "hero-side note-side", "data-testid": "note20" },
      h("p", { class: "note-big" }, h("span", null, fmtNote(note.total)), h("small", null, "/20")),
      h("p", { class: "tier" }, note.tier.name),
      h("p", { class: "muted small center" }, note.tier.line),
    ),
  );
  root.appendChild(hero);

  root.appendChild(
    h("section", { class: "halves" },
      half("Photo", note.photo, quality.short ?? "Lumière, netteté, angle : parfait.", null),
      half("Routine", note.routine, state.habits.length ? "Tes habitudes de la semaine." : "Ajoute des habitudes pour remplir cette moitié.", state.habits.length ? "#suivi" : "#programme"),
    ),
  );

  root.appendChild(
    h("p", { class: "sym-chip" }, "Symétrie du visage : ", h("strong", null, sym.value === null ? "—" : `${sym.value}\u00a0%`), " ", dots(sym.precision)),
  );

  root.appendChild(
    h("section", { class: "levers" },
      h("h2", { class: "section-title" }, "Pour monter ta note"),
      h("div", { class: "lever-row" }, leversFor(r).map((l) => h("a", { href: "#programme", class: "lever" }, icon("arrow", 16), l.label))),
    ),
  );

  const allIds: MetricId[] = ["outerCanthusOffset", "eyeWidthDiff", "alarOffset", "mouthCornerOffset", "mouthLineAngle", "subnasaleMidline", "stomionMidline", "mentonMidline", "mouthNoseRatio"];
  root.appendChild(
    h("section", { class: "card compact" },
      details(
        "Mesures du visage (détail)",
        h("div", { class: "stat-grid" },
          metricCard("Yeux", "eyeWidthRatio", "œil / écart"),
          metricCard("Bas du visage", "lowerFaceRatio", "lèvre / menton"),
          metricCard("Nez", "noseIntercanthalRatio", "nez / écart des yeux"),
        ),
        h("ul", { class: "metric-rows" }, allIds.map((id) => {
          const o = obs(id);
          return h("li", null, h("span", null, METRICS[id].name), h("span", { class: "metric-row-right" }, valueText(o), dots(precisionOf(o))));
        })),
        h("p", { class: "small muted" }, "La note sur 20 ne juge pas ton visage : elle additionne la qualité de ta photo et ta routine. La symétrie résume les écarts gauche-droite ; 100\u00a0% n'est pas un idéal. ≈ = marge d'erreur large."),
        sourceList([SOURCES.rhodes2006, SOURCES.ward2018]),
      ),
    ),
  );

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

  root.appendChild(
    h("div", { class: "button-row" },
      button("Nouveau scan", () => {
        abandonCapture();
        go("analyse");
      }, { icon: "scan" }),
      button("Effacer", () => {
        abandonCapture();
        state.result = null;
        go("accueil");
      }, { variant: "quiet", icon: "trash" }),
    ),
  );
}

export function fmtNote(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function half(title: string, v: number, hint: string, href: string | null): HTMLElement {
  const bar = h("span", { class: "half-bar" }, h("span", { class: "half-fill", "data-pct": String(v * 10) }));
  const inner = [h("span", { class: "half-title" }, title), h("span", { class: "half-value" }, `${fmtNote(v)}/10`), bar, h("span", { class: "half-hint" }, hint)];
  const el = href ? h("a", { href, class: "half" }, ...inner) : h("div", { class: "half" }, ...inner);
  queueMicrotask(() => el.querySelectorAll<HTMLElement>(".half-fill").forEach((f) => (f.style.width = `${f.dataset.pct}%`)));
  return el;
}
