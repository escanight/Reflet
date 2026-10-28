import { h, clear } from "../dom.js";
import { button, icon } from "../components.js";
import { saveProfile, saveSettings, state } from "../../app/state.js";
import { go } from "../../app/router.js";

let step = 0;

export function renderOnboarding(root: HTMLElement): void {
  clear(root);
  const steps = [stepWelcome, stepPrivacy, stepAge];
  const wrap = h("div", { class: "onboarding" }, h("p", { class: "step-count" }, `Étape ${step + 1} sur ${steps.length}`));
  wrap.appendChild(steps[step](() => {
    step = Math.min(step + 1, steps.length - 1);
    renderOnboarding(root);
  }));
  root.appendChild(wrap);
}

function stepWelcome(next: () => void): HTMLElement {
  return h(
    "div",
    { class: "onboard-panel" },
    h("div", { class: "hero-mark", "aria-hidden": "true" }),
    h("h1", { tabindex: "-1", id: "page-title" }, "Reflet, le miroir honnête"),
    h("p", { class: "lead" }, "Des mesures de votre photo quand elles sont fiables, une marge d'erreur toujours affichée, et un programme d'habitudes appuyé sur des sources."),
    h(
      "ul",
      { class: "promise-list" },
      h("li", null, icon("check", 18), h("span", null, h("strong", null, "Aucune note de beauté. "), "Aucun score ne peut dire objectivement si un visage est attirant.")),
      h("li", null, icon("check", 18), h("span", null, h("strong", null, "Gratuit, sans compte, sans publicité. "), "Toutes les fonctions sont accessibles.")),
      h("li", null, icon("check", 18), h("span", null, h("strong", null, "Seulement ce qui se change. "), "Peau, sommeil, rasage, coiffure, prise de vue. Jamais vos os.")),
    ),
    button("Commencer", next, { icon: "arrow" }),
  );
}

function stepPrivacy(next: () => void): HTMLElement {
  return h(
    "div",
    { class: "onboard-panel" },
    h("h1", { tabindex: "-1", id: "page-title" }, "Votre photo ne quitte pas votre appareil"),
    h(
      "ul",
      { class: "promise-list" },
      h("li", null, icon("shield", 18), h("span", null, "L'analyse se fait entièrement dans ce navigateur. Aucune photo, aucun point ni aucune mesure n'est envoyé à un serveur ou à une IA externe.")),
      h("li", null, icon("shield", 18), h("span", null, "Les photos ne sont jamais enregistrées. Elles sont effacées de la mémoire à la fin de l'analyse.")),
      h("li", null, icon("shield", 18), h("span", null, "L'historique des mesures est désactivé par défaut. Si vous l'activez, il est chiffré sur cet appareil et vous pouvez tout supprimer en un geste.")),
      h("li", null, icon("info", 18), h("span", null, "Pour être transparent : Reflet utilise un système de vision par ordinateur qui place des repères sur le visage. Il ne vous identifie pas, et il ne déduit ni votre âge, ni votre origine, ni votre état de santé.")),
    ),
    h("p", { class: "small" }, "Détails et preuves vérifiables dans « Mes données ». ", h("a", { href: "#donnees" }, "Lire maintenant")),
    button("J'ai compris", () => {
      saveSettings({ noticeAcceptedAt: new Date().toISOString() });
      next();
    }, { icon: "arrow" }),
  );
}

function stepAge(): HTMLElement {
  const choose = (adult: boolean) => {
    saveSettings({ adult, onboarded: true });
    saveProfile({ ...state.profile, adult });
    state.profileSet = false;
    step = 0;
    go(adult ? "accueil" : "programme");
  };
  return h(
    "div",
    { class: "onboard-panel" },
    h("h1", { tabindex: "-1", id: "page-title" }, "Avez-vous 18 ans ou plus ?"),
    h("p", { class: "lead" }, "Avant 18 ans, Reflet propose le programme d'habitudes et les conseils de prise de vue, mais pas les mesures du visage. Le visage change encore beaucoup à cet âge, et se focaliser sur des mesures n'aide pas."),
    h("div", { class: "button-row" }, button("Oui, 18 ans ou plus", () => choose(true), { variant: "ghost" }), button("Non, moins de 18 ans", () => choose(false), { variant: "ghost" })),
    h("p", { class: "small" }, "Cette réponse reste sur votre appareil. Vous pourrez la modifier dans « Mes données »."),
  );
}
