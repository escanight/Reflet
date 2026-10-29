import { h, clear } from "../dom.js";
import { button, icon } from "../components.js";
import { saveProfile, saveSettings, state } from "../../app/state.js";
import { go } from "../../app/router.js";
let step = 0;
export function renderOnboarding(root) {
    clear(root);
    root.appendChild(h("div", { class: "onboarding" }, step === 0 ? welcome(() => { step = 1; renderOnboarding(root); }) : age()));
}
function welcome(next) {
    return h("div", { class: "onboard-panel" }, h("div", { class: "hero-mark", "aria-hidden": "true" }), h("h1", { tabindex: "-1", id: "page-title" }, "Reflet"), h("p", { class: "lead" }, "Scanne ta tête, tiens ta routine, deviens TROP BEAU wola 🗿🔥"), h("ul", { class: "feature-list" }, h("li", null, icon("scan", 20), h("span", null, h("strong", null, "Scan en 3 secondes"), h("small", null, "Ta note /20, tes yeux, ton nez, ta mâchoire"))), h("li", null, icon("list", 20), h("span", null, h("strong", null, "Le programme glow-up"), h("small", null, "Peau, barbe, sommeil : ce qui marche vraiment, sah"))), h("li", null, icon("shield", 20), h("span", null, h("strong", null, "100 % sur ton téléphone"), h("small", null, "Aucune photo envoyée ni enregistrée")))), button("Commencer", () => {
        saveSettings({ noticeAcceptedAt: new Date().toISOString() });
        next();
    }, { icon: "arrow" }), h("p", { class: "fine" }, "Reflet utilise un modèle de vision par ordinateur qui place des repères sur le visage, sur ton appareil. Il ne t'identifie pas et ne déduit ni âge, ni origine, ni santé. ", h("a", { href: "#donnees" }, "Détails")));
}
function age() {
    const choose = (adult) => {
        saveSettings({ adult, onboarded: true });
        saveProfile({ ...state.profile, adult });
        state.profileSet = false;
        step = 0;
        go(adult ? "accueil" : "programme");
    };
    return h("div", { class: "onboard-panel" }, h("h1", { tabindex: "-1", id: "page-title" }, "Tu as 18 ans ou plus ?"), h("p", { class: "lead" }, "Le scan du visage est réservé aux majeurs. Avant 18 ans, tu as accès au programme et aux rangs."), h("div", { class: "button-col" }, button("Oui, 18 ans ou plus", () => choose(true)), button("Non, moins de 18 ans", () => choose(false), { variant: "ghost" })));
}
