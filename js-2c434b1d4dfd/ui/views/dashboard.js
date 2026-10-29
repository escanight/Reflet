import { h } from "../dom.js";
import { button, icon, linkButton } from "../components.js";
import { state } from "../../app/state.js";
import { canPromptInstall, isFramed, isIOS, isStandalone, promptInstall } from "../../app/install.js";
export function renderDashboard(root) {
    const adult = state.settings.adult === true;
    root.appendChild(h("header", { class: "home-top" }, h("h1", { id: "page-title", tabindex: "-1", class: "wordmark" }, "Reflet")));
    if (adult) {
        root.appendChild(h("a", { href: "#analyse", class: "cta-card big", "data-testid": "cta-scan" }, h("div", { class: "cta-icon" }, icon("scan", 34)), h("div", null, h("p", { class: "cta-title" }, "Scanne-toi kho 📸"), h("p", { class: "cta-sub" }, "3 secondes, ta note /20 et le verdict"))));
        const note = state.result ? state.lastNote : null;
        if (note) {
            root.appendChild(h("a", { href: "#resultats", class: "last-scan" }, h("span", { class: "last-note" }, `${note.total}`, h("small", null, "/20")), h("span", null, h("strong", null, note.tier.name), h("small", null, "Ton dernier scan · touche pour revoir")), icon("arrow", 18)));
        }
    }
    else {
        root.appendChild(h("a", { href: "#programme", class: "cta-card big" }, h("div", { class: "cta-icon" }, icon("list", 34)), h("div", null, h("p", { class: "cta-title" }, "Les conseils glow-up"), h("p", { class: "cta-sub" }, "Peau, barbe, sommeil : ce qui marche, sah"))));
    }
    root.appendChild(h("div", { class: "tile-row" }, h("a", { href: "#programme", class: "tile" }, icon("list", 22), h("span", null, "Conseils"), h("small", null, "Peau, barbe, cheveux, sommeil")), h("a", { href: "#glossaire", class: "tile" }, icon("book", 22), h("span", null, "Mythes"), h("small", null, "Mewing, PSL, nombre d'or…")), h("a", { href: "#donnees", class: "tile" }, icon("shield", 22), h("span", null, "Mes données"), h("small", null, "Rien ne sort de ton tel"))));
    if (!isStandalone() && !isFramed()) {
        if (canPromptInstall()) {
            root.appendChild(h("div", { class: "install-bar" }, icon("plus", 18), h("span", null, "Installe Reflet sur ton écran d'accueil"), button("Installer", () => void promptInstall(), { variant: "ghost" })));
        }
        else if (isIOS()) {
            root.appendChild(h("p", { class: "muted small center" }, "iPhone : Partager › « Sur l'écran d'accueil » pour installer Reflet."));
        }
    }
    if (!adult)
        root.appendChild(h("div", { class: "button-row center" }, linkButton("Voir les conseils", "#programme", { variant: "ghost" })));
}
