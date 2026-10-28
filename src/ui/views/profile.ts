import { h } from "../dom.js";
import { icon } from "../components.js";
import { RANKS, XP } from "../../app/progress.js";
import { currentRank, rankRing } from "./dashboard.js";

export function renderProfile(root: HTMLElement): void {
  const { xp, rank, next, progress, toNext } = currentRank();
  root.append(
    h("header", { class: "scan-header" }, h("h1", { id: "page-title", tabindex: "-1" }, "Profil")),
    h("section", { class: "rank-hero" },
      rankRing(progress, rank.id),
      h("p", { class: "rank-name big" }, rank.name),
      h("p", { class: "muted" }, rank.tagline),
      h("p", { class: "small" }, next ? `${xp.total} XP · encore ${toNext} pour ${next.name}` : `${xp.total} XP`),
    ),
    h("section", { class: "card compact" },
      h("h2", { class: "card-title" }, "Gagner de l'XP"),
      h("ul", { class: "xp-rules" },
        h("li", null, h("span", null, "Habitude cochée"), h("strong", null, `+${XP.habitDay}`)),
        h("li", null, h("span", null, "Objectif de la semaine atteint"), h("strong", null, `+${XP.weekReached}`)),
        h("li", null, h("span", null, "Scan de qualité (1 par semaine)"), h("strong", null, `+${XP.goodScanPerWeek}`)),
        h("li", null, h("span", null, "Programme créé"), h("strong", null, `+${XP.programSet}`)),
      ),
      h("p", { class: "small muted" }, "Ton rang mesure ta régularité, jamais ton visage."),
    ),
    h("section", { class: "card compact" },
      h("h2", { class: "card-title" }, "Les rangs"),
      h("ol", { class: "rank-ladder" }, RANKS.map((r) =>
        h("li", { class: r.id === rank.id ? "current" : r.min <= xp.total ? "reached" : "" },
          h("span", { class: "rank-num" }, String(r.id)),
          h("span", { class: "rank-ladder-name" }, r.name),
          h("span", { class: "muted small" }, `${r.min.toLocaleString("fr-FR")} XP`),
        ))),
    ),
    h("nav", { class: "menu-list", "aria-label": "Plus" },
      menu("#glossaire", "book", "Mythes et preuves", "PSL, mewing, nombre d'or…"),
      menu("#donnees", "shield", "Mes données", "Confidentialité, tout supprimer"),
      menu("#aide", "heart", "Besoin d'en parler ?", "Ressources d'écoute"),
    ),
  );
}

function menu(href: string, ic: string, title: string, sub: string): HTMLElement {
  return h("a", { href, class: "menu-item" }, icon(ic, 20), h("span", null, h("strong", null, title), h("small", null, sub)), icon("arrow", 16));
}
