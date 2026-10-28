import { h } from "../dom.js";
import { button, card, details, icon, levelBadge, linkButton, notice, pageHeader, sourceList } from "../components.js";
import { drawOverlay } from "../overlay.js";
import { persistHistory, state } from "../../app/state.js";
import { go } from "../../app/router.js";
import { EXCLUDED, GROUPS, METRICS, SOURCES, type MetricGroup } from "../../analysis/metrics.js";
import { describe, formatRange, LEVEL_LABEL, type MetricObservation } from "../../analysis/observations.js";
import { appendSession, compareSessions, toStored } from "../../analysis/history.js";
import { abandonCapture } from "./analyse.js";

let saved = false;
let savedFor: string | null = null;

export function renderResults(root: HTMLElement): void {
  if (state.settings.adult !== true) state.result = null;
  const r = state.result;
  if (!r) {
    root.append(pageHeader("Résultats"), card(null, h("p", null, "Aucune analyse dans cette séance. Les résultats ne sont pas conservés après fermeture, sauf si vous activez l'historique."), h("div", { class: "button-row" }, linkButton("Faire une analyse", "#analyse", { icon: "scan" }))));
    return;
  }
  if (savedFor !== r.createdAt) {
    saved = false;
    savedFor = r.createdAt;
  }
  const counts = { reliable: 0, confirm: 0, uncertain: 0 };
  r.observations.forEach((o) => counts[o.level]++);

  root.appendChild(
    pageHeader(
      "Vos observations",
      `${r.photos} photo${r.photos > 1 ? "s" : ""} retenue${r.photos > 1 ? "s" : ""} · ${r.mode === "auto" ? "repérage automatique" : "repérage manuel"} · ${r.distance === "far" ? "prise à 1 m ou plus" : r.distance === "near" ? "prise à bout de bras" : "distance inconnue"}`,
    ),
  );

  root.appendChild(
    card(
      null,
      h("p", { class: "summary-line" }, h("strong", null, `${counts.reliable} fiable${counts.reliable > 1 ? "s" : ""}`), ` · ${counts.confirm} à confirmer · ${counts.uncertain} masquée${counts.uncertain > 1 ? "s" : ""}`),
      h("p", null, "Il n'y a pas de note globale : chaque mesure est présentée seule, avec sa marge d'erreur. Une mesure est masquée quand la marge d'erreur dépasse ce qu'elle cherche à mesurer."),
      r.photos < 3 ? notice("info", h("p", null, `Avec ${r.photos === 1 ? "une seule photo" : "deux photos"}, aucune mesure ne peut être confirmée. Ajoutez des photos prises dans les mêmes conditions pour réduire l'incertitude.`)) : null,
      details(
        "Comment lire les niveaux",
        h(
          "ul",
          { class: "legend" },
          h("li", null, levelBadge("reliable"), " 3 photos concordantes ou plus, marge d'erreur faible, aucune condition défavorable."),
          h("li", null, levelBadge("confirm"), " Valeur indicative : reprenez des photos dans de meilleures conditions pour la confirmer."),
          h("li", null, levelBadge("uncertain"), " La marge d'erreur est trop grande : la valeur n'est pas affichée."),
        ),
        h("p", { class: "muted small" }, "La marge d'erreur combine la précision connue des repères faciaux et l'écart entre vos photos. Les seuils sont provisoires et seront calibrés sur des mesures réelles."),
        sourceList([SOURCES.wflw, SOURCES.mediapipeRepeat]),
      ),
    ),
  );

  // Visualisation des repères (dernière photo de la séance, en mémoire uniquement).
  const cap = state.capture;
  if (cap && cap.images.length && cap.photos.length) {
    const i = cap.images.length - 1;
    const canvas = h("canvas", { class: "review-canvas", role: "img", "aria-label": "Repères placés sur la dernière photo" });
    drawOverlay(canvas, cap.images[i].canvas, cap.photos[i].points, { axes: true, crop: true });
    root.appendChild(card("Repères utilisés", canvas, h("p", { class: "muted small" }, "Image conservée en mémoire seulement le temps de cette page.")));
  }

  for (const g of Object.keys(GROUPS) as MetricGroup[]) {
    const obs = r.observations.filter((o) => METRICS[o.id].group === g);
    root.appendChild(groupCard(g, obs));
  }

  root.appendChild(
    card(
      "Ce qu'il faut retenir",
      h("p", null, "La diversité des visages est normale. Ce que la recherche relie le plus à l'attrait perçu est en partie modifiable : une peau protégée du soleil, le sommeil, l'expression, et la façon dont la photo est prise. La structure osseuse, elle, ne se « corrige » pas avec des exercices."),
      sourceList([SOURCES.rhodes2006, SOURCES.ward2018]),
      h("div", { class: "button-row" }, linkButton("Mon programme personnalisé", "#programme", { icon: "list" })),
    ),
  );

  root.appendChild(
    card(
      "Ce que Reflet ne mesure pas, et pourquoi",
      h("ul", { class: "excluded" }, EXCLUDED.map((e) => h("li", null, h("strong", null, e.name), h("span", null, e.reason)))),
    ),
  );

  // Historique et comparaison
  const historyCard = card("Historique");
  if (!state.settings.historyEnabled) {
    historyCard.append(h("p", null, "L'historique est désactivé : ces résultats disparaîtront à la fermeture. Vous pouvez l'activer dans « Mes données » (mesures chiffrées sur cet appareil, jamais les photos)."), h("div", { class: "button-row" }, linkButton("Mes données", "#donnees", { variant: "ghost", icon: "shield" })));
  } else {
    const prev = [...state.history].reverse().find((s) => s.createdAt !== r.createdAt);
    if (prev) {
      const cmp = compareSessions(prev, toStored(r));
      if (!cmp.comparable) historyCard.append(notice("info", h("p", null, `Comparaison impossible avec la séance du ${new Date(prev.createdAt).toLocaleDateString("fr-FR")} : ${cmp.reason}`)));
      else if (!cmp.changes.length) historyCard.append(h("p", null, "Aucune mesure assez fiable dans les deux séances pour être comparée."));
      else {
        historyCard.append(
          h("p", null, `Comparaison avec la séance du ${new Date(prev.createdAt).toLocaleDateString("fr-FR")} (mêmes conditions) :`),
          h("ul", { class: "compare" }, cmp.changes.map((c) => h("li", null, h("span", null, METRICS[c.id].name), h("span", { class: c.kind === "changed" ? "tag tag-change" : "tag" }, c.kind === "changed" ? "Différence au-delà de la marge d'erreur" : "Pas de changement mesurable")))),
          h("p", { class: "muted small" }, "Une différence vient le plus souvent d'un changement de lumière, d'angle ou d'expression : les traits osseux d'un adulte ne changent pas en quelques semaines."),
        );
      }
    }
    const saveBtn = button(saved ? "Enregistré" : "Enregistrer les mesures (sans photo)", async () => {
      state.history = appendSession(state.history, toStored(r));
      const ok = await persistHistory();
      saved = ok;
      saveBtn.replaceWith(ok ? h("p", { class: "muted" }, icon("check", 16), " Mesures enregistrées et chiffrées sur cet appareil.") : notice("warn", h("p", null, "Le stockage de ce navigateur est indisponible : rien n'a été enregistré.")));
    }, { variant: "ghost", icon: "check", disabled: saved });
    historyCard.append(saveBtn);
  }
  root.appendChild(historyCard);

  root.appendChild(
    h(
      "div",
      { class: "button-row" },
      button("Nouvelle analyse", () => {
        abandonCapture();
        go("analyse");
      }, { variant: "ghost", icon: "scan" }),
      button("Effacer ces résultats", () => {
        abandonCapture();
        state.result = null;
        go("accueil");
      }, { variant: "quiet", icon: "trash" }),
    ),
  );
}

function groupCard(g: MetricGroup, obs: MetricObservation[]): HTMLElement {
  const G = GROUPS[g];
  const c = card(G.title, h("p", { class: "muted small" }, G.intro));
  const list = h("div", { class: "obs-list" });
  for (const o of obs) list.appendChild(observationRow(o));
  c.appendChild(list);
  // Explications communes au groupe (sens, limites, sources).
  const def = METRICS[obs[0].id];
  c.appendChild(details("Ce que cela signifie", h("p", null, def.meaning), h("p", null, h("strong", null, "Améliorations possibles et limites : "), def.improve), sourceList(dedupe(obs.flatMap((o) => METRICS[o.id].sources)))));
  return c;
}

function observationRow(o: MetricObservation): HTMLElement {
  const def = METRICS[o.id];
  const range = formatRange(o);
  return h(
    "article",
    { class: `obs obs-${o.level}`, "aria-label": `${def.name} : ${LEVEL_LABEL[o.level]}` },
    h("div", { class: "obs-head" }, h("h3", null, def.name), levelBadge(o.level)),
    h("p", { class: "obs-text" }, describe(o)),
    o.level !== "uncertain" && range ? h("p", { class: "obs-range" }, "Plage plausible : ", h("strong", null, range)) : null,
    details(
      "Détails",
      h("p", null, h("strong", null, "Mesure : "), def.what),
      h("p", null, h("strong", null, "Photos utilisées : "), String(o.photosUsed)),
      o.influences.length ? h("div", null, h("strong", null, "Facteurs qui influencent ce résultat :"), h("ul", null, o.influences.map((f) => h("li", null, f)))) : null,
      o.id !== "eyeWidthDiff" && METRICS[o.id].group === "symmetry" ? null : h("p", null, def.meaning),
    ),
  );
}

function dedupe<T extends { url: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}
