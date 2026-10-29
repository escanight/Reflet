import { h } from "../dom.js";
import { card, pageHeader, sourceList } from "../components.js";
import { GLOSSARY, STATUS_LABEL } from "../../content/glossary.js";
import { WARNINGS } from "../../recommendations/catalog.js";
export function renderGlossary(root) {
    root.appendChild(pageHeader("Mythes et preuves", "Les termes qui circulent sur les forums et les réseaux, avec ce que dit réellement la recherche."));
    root.appendChild(card(null, h("p", null, "Reflet n'utilise aucun de ces termes ailleurs dans l'application, et ne classe personne. Certains de ces vocabulaires viennent de communautés qui présentent l'apparence comme un destin : ce n'est pas ce que montrent les données.")));
    const list = h("div", { class: "glossary" });
    for (const t of GLOSSARY) {
        list.appendChild(h("article", { class: "card term" }, h("div", { class: "advice-head" }, h("h2", { class: "card-title" }, t.term), h("span", { class: `badge badge-status-${t.status}` }, STATUS_LABEL[t.status])), h("p", null, t.text), t.sources.length ? sourceList(t.sources) : h("p", { class: "muted small" }, "Aucune source fiable trouvée.")));
    }
    root.appendChild(list);
    root.appendChild(h("h2", { class: "section-title" }, "Pratiques à éviter"));
    root.appendChild(card(null, h("ul", { class: "warning-list" }, WARNINGS.map((w) => h("li", null, h("strong", null, w.title), h("span", null, w.text), sourceList([w.source]))))));
}
