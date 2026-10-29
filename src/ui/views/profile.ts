import { h } from "../dom.js";
import { icon } from "../components.js";
import { APP_VERSION } from "./data.js";

export function renderProfile(root: HTMLElement): void {
  root.append(
    h("header", { class: "scan-header" }, h("h1", { id: "page-title", tabindex: "-1" }, "Profil")),
    h("nav", { class: "menu-list", "aria-label": "Profil" },
      menu("#programme", "list", "Mes réponses aux conseils", "Peau, barbe, cheveux, budget"),
      menu("#glossaire", "book", "Mythes et preuves", "PSL, mewing, nombre d'or…"),
      menu("#donnees", "shield", "Mes données", "Confidentialité, tout supprimer"),
      menu("#aide", "heart", "Besoin d'en parler ?", "Ressources d'écoute"),
    ),
    h("p", { class: "fine center" }, `Reflet ${APP_VERSION} · gratuit · ta tête reste sur ton tel`),
  );
}

function menu(href: string, ic: string, title: string, sub: string): HTMLElement {
  return h("a", { href, class: "menu-item" }, icon(ic, 20), h("span", null, h("strong", null, title), h("small", null, sub)), icon("arrow", 16));
}
