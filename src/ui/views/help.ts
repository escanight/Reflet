import { h } from "../dom.js";
import { card, pageHeader, sourceList } from "../components.js";
import { BDD_SIGNS, HELPLINES, SUPPORT_SOURCES } from "../../content/support.js";

export function renderHelp(root: HTMLElement): void {
  root.appendChild(pageHeader("Besoin d'en parler ?", "Penser souvent à son apparence est courant. Quand cela fait souffrir, en parler aide."));
  root.appendChild(
    card(
      "Des signes à prendre au sérieux",
      h("p", null, "La dysmorphie corporelle est une préoccupation intense pour un détail de son apparence. D'après le NHS, elle peut se manifester ainsi :"),
      h("ul", null, BDD_SIGNS.map((s) => h("li", null, s))),
      h("p", null, "Si vous vous reconnaissez, parlez-en à un médecin généraliste ou à un psychologue : c'est un trouble connu, qui se soigne. Une application de mesure du visage n'est pas une aide dans cette situation, et vous pouvez faire une pause."),
    ),
  );
  const byCountry = new Map<string, typeof HELPLINES>();
  HELPLINES.forEach((l) => byCountry.set(l.country, [...(byCountry.get(l.country) ?? []), l]));
  root.appendChild(
    card(
      "Numéros utiles",
      h("p", { class: "muted small" }, "En cas de danger immédiat, appelez les urgences. Vérifiez les numéros de votre pays : les sources publiques ne s'accordent pas toujours."),
      [...byCountry.entries()].map(([country, lines]) =>
        h(
          "div",
          { class: "helplines" },
          h("h3", null, country),
          h("ul", null, lines.map((l) => h("li", null, h("span", { class: "helpline-number" }, l.number), h("span", null, l.name, l.note ? h("small", null, ` ${l.note}`) : null)))),
        ),
      ),
      h("p", { class: "muted small" }, "Aucune ligne nationale d'écoute en santé mentale n'a été trouvée au Maroc. Un médecin généraliste ou un centre de santé peut orienter vers un psychiatre ou un psychologue."),
      sourceList(SUPPORT_SOURCES),
    ),
  );
}
