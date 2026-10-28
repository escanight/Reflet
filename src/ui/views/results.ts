import { h, svg } from "../dom.js";
import { button, details, icon, levelBadge, linkButton, notice, sourceList } from "../components.js";
import { drawOverlay } from "../overlay.js";
import { persistHistory, state } from "../../app/state.js";
import { go } from "../../app/router.js";
import { EXCLUDED, METRICS, SOURCES } from "../../analysis/metrics.js";
import { describe, formatRange, formatValue, type MetricObservation } from "../../analysis/observations.js";
import { leversFor, qualityScore, symmetryIndex } from "../../analysis/summary.js";
import { appendSession, compareSessions, toStored } from "../../analysis/history.js";
import { abandonCapture, lastScanXp } from "./analyse.js";
import type { MetricId } from "../../analysis/geometry.js";

let savedFor: string | null = null;

export function gauge(value: number | null, label: string, sub?: string): SVGElement | HTMLElement {
  const R = 52, C = 2 * Math.PI * R;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return h(
    "div",
    { class: "gauge", role: "img", "aria-label": value === null ? `${label} : non mesurable` : `${label} : ${value} %${sub ? `, ${sub}` : ""}` },
    svg("svg", { viewBox: "0 0 128 128", "aria-hidden": "true" },
      svg("circle", { cx: 64, cy: 64, r: R, class: "gauge-track" }),
      svg("circle", { cx: 64, cy: 64, r: R, class: "gauge-fill", "stroke-dasharray": `${C * pct} ${C}`, transform: "rotate(-90 64 64)" }),
    ),
    h("div", { class: "gauge-center" }, h("span", { class: "gauge-value" }, value === null ? "—" : `${value} %`), h("span", { class: "gauge-label" }, label)),
  );
}

function statCard(title: string, value: string, chip: HTMLElement | null, foot: string, ...more: Array<Node | null>): HTMLElement {
  return h(
    "details",
    { class: "stat-card" },
    h("summary", null, h("span", { class: "stat-card-title" }, title), h("span", { class: "stat-card-value" }, value), chip, h("span", { class: "stat-card-foot" }, foot)),
    h("div", { class: "stat-card-body" }, ...more),
  );
}

function obs(id: MetricId): MetricObservation | undefined {
  return state.result?.observations.find((o) => o.id === id);
}

function metricCard(title: string, id: MetricId): HTMLElement {
  const o = obs(id);
  const def = METRICS[id];
  if (!o) return h("span");
  const visible = o.level !== "uncertain" && o.estimate !== undefined;
  return statCard(
    title,
    visible ? formatValue(def.kind, o.estimate!) : "—",
    levelBadge(o.level),
    visible ? `Plage ${formatRange(o)}` : shortReason(o.hiddenReason),
    h("p", null, h("strong", null, def.name), " · ", def.what),
    h("p", null, describe(o)),
    o.influences.length ? h("ul", { class: "small" }, o.influences.map((f) => h("li", null, f))) : null,
    h("p", { class: "small muted" }, def.meaning),
    sourceList(def.sources),
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
    h("header", { class: "scan-header" },
      h("h1", { id: "page-title", tabindex: "-1" }, "Ton résultat"),
      h("p", { class: "muted small" }, `${r.photos} image${r.photos > 1 ? "s" : ""} · ${r.mode === "auto" ? "scan automatique" : "repérage manuel"} · ${new Date(r.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`),
    ),
  );

  if (r.blockedReasons?.length && !r.photos) {
    root.appendChild(notice("block", h("p", null, h("strong", null, "Photo refusée : "), [...new Set(r.blockedReasons)].join(" "))));
  }
  if (lastScanXp > 0) root.appendChild(h("p", { class: "xp-toast" }, icon("check", 16), ` +${lastScanXp} XP · scan de qualité cette semaine`));

  // Héros : photo + jauge de symétrie
  const hero = h("section", { class: "hero-card" });
  const cap = state.capture;
  if (cap && cap.images.length && cap.photos.length) {
    const c = h("canvas", { class: "hero-photo", role: "img", "aria-label": "Repères utilisés sur ta photo" });
    drawOverlay(c, cap.images[0].canvas, cap.photos[0].points, { axes: true, crop: true });
    hero.appendChild(c);
  }
  hero.appendChild(
    h(
      "div",
      { class: "hero-side" },
      gauge(sym.value, "Symétrie"),
      sym.value !== null
        ? h("p", { class: "muted small center" }, `Plage ${sym.low}–${sym.high} %`)
        : h("p", { class: "muted small center" }, r.photos ? "Marge d'erreur trop grande" : "Photo inexploitable"),
      details("C'est quoi ?", h("p", { class: "small" }, "Moyenne des écarts gauche-droite mesurés (yeux, nez, bouche, menton). Tous les visages sont un peu asymétriques, et 100 % n'est pas un idéal : les visages parfaitement symétriques sont jugés moins attrayants. Ce n'est pas une note de beauté."), sourceList([SOURCES.rhodes2006, SOURCES.pound2014])),
    ),
  );
  root.appendChild(hero);

  // Cartes
  const qualityCard = statCard(
    "Qualité photo",
    `${quality.score}/100`,
    null,
    quality.tip ? "Touche pour le conseil" : "Rien à redire",
    quality.tip ? h("p", null, quality.tip) : h("p", null, "Netteté, lumière et pose sont bonnes."),
    h("p", { class: "small muted" }, "Plus la photo est propre, plus les mesures sont précises. C'est la partie que tu contrôles à 100 %."),
  );
  root.appendChild(
    h("div", { class: "stat-grid" },
      qualityCard,
      metricCard("Yeux", "eyeWidthRatio"),
      metricCard("Bas du visage", "lowerFaceRatio"),
      metricCard("Nez / yeux", "noseIntercanthalRatio"),
    ),
  );

  // Détail symétrie
  const symIds: MetricId[] = ["outerCanthusOffset", "eyeWidthDiff", "alarOffset", "mouthCornerOffset", "mouthLineAngle", "subnasaleMidline", "stomionMidline", "mentonMidline", "mouthNoseRatio"];
  root.appendChild(
    h("section", { class: "card compact" },
      details(
        "Toutes les mesures",
        h("ul", { class: "metric-rows" }, symIds.map((id) => {
          const o = obs(id)!;
          return h("li", null, h("span", null, METRICS[id].name), h("span", { class: "metric-row-right" }, o.level !== "uncertain" && o.estimate !== undefined ? formatValue(METRICS[id].kind, o.estimate) : "—", levelBadge(o.level)));
        })),
        h("p", { class: "small muted" }, "« Gauche » et « droite » = côtés de la photo. Une valeur est masquée quand la marge d'erreur est plus grande qu'elle."),
      ),
    ),
  );

  // Leviers
  root.appendChild(
    h("section", { class: "levers" },
      h("h2", { class: "section-title" }, "Tes leviers"),
      h("div", { class: "lever-row" }, leversFor(r).map((l) => h("a", { href: "#programme", class: "lever" }, icon("arrow", 16), l.label))),
    ),
  );

  // Historique (si activé)
  if (state.settings.historyEnabled) {
    const prev = [...state.history].reverse().find((s) => s.createdAt !== r.createdAt);
    const box = h("section", { class: "card compact" });
    if (prev) {
      const cmp = compareSessions(prev, toStored(r));
      box.appendChild(h("p", { class: "small" }, !cmp.comparable ? `Pas comparable au scan précédent : ${cmp.reason}` : cmp.changes.some((c) => c.kind === "changed") ? "Certaines mesures diffèrent du scan précédent (souvent la lumière ou l'angle)." : "Aucun changement mesurable depuis le scan précédent."));
    }
    const saveBtn = button(savedFor === r.createdAt ? "Enregistré" : "Enregistrer ce scan", async () => {
      state.history = appendSession(state.history, toStored(r));
      if (await persistHistory()) {
        savedFor = r.createdAt;
        saveBtn.replaceWith(h("p", { class: "muted small" }, icon("check", 14), " Enregistré (chiffré, sans photo)."));
      }
    }, { variant: "ghost", icon: "check", disabled: savedFor === r.createdAt });
    box.appendChild(saveBtn);
    root.appendChild(box);
  }

  root.appendChild(
    h("section", { class: "card compact" },
      details("Ce que Reflet ne mesure pas", h("ul", { class: "excluded" }, EXCLUDED.map((e) => h("li", null, h("strong", null, e.name), h("span", null, e.reason))))),
    ),
  );

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

/** Raison courte, lisible sur une carte, du masquage d'une mesure. */
export function shortReason(r?: string): string {
  const t = (r ?? "").toLowerCase();
  if (t.includes("près") || t.includes("distance")) return "Photo prise de près";
  if (t.includes("expression") || t.includes("sourire")) return "Sourire ou bouche ouverte";
  if (t.includes("tourné") || t.includes("de face")) return "Tête tournée";
  if (t.includes("levée") || t.includes("baissée")) return "Tête levée ou baissée";
  if (t.includes("lunettes")) return "Lunettes";
  if (t.includes("fermés")) return "Yeux fermés";
  if (t.includes("marge")) return "Marge d'erreur trop grande";
  return "Non mesurable ici";
}
