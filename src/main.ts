import { state, loadHistory, endCapture } from "./app/state.js";
import { setRenderer } from "./app/router.js";
import { setupInstall, onInstallChange } from "./app/install.js";
import { checkAvailability } from "./analysis/detector.js";
import { clear, h } from "./ui/dom.js";
import { icon } from "./ui/components.js";
import { renderOnboarding } from "./ui/views/onboarding.js";
import { renderDashboard } from "./ui/views/dashboard.js";
import { renderAnalyse, resetAnalyse } from "./ui/views/analyse.js";
import { renderResults } from "./ui/views/results.js";
import { renderProgram } from "./ui/views/program.js";
import { renderTracker } from "./ui/views/tracker.js";
import { renderGlossary } from "./ui/views/glossary.js";
import { renderData } from "./ui/views/data.js";
import { renderHelp } from "./ui/views/help.js";

type View = (root: HTMLElement) => void | Promise<void>;

const ROUTES: Record<string, View> = {
  bienvenue: renderOnboarding,
  accueil: renderDashboard,
  analyse: renderAnalyse,
  resultats: renderResults,
  programme: renderProgram,
  suivi: renderTracker,
  glossaire: renderGlossary,
  donnees: renderData,
  aide: renderHelp,
};

const NAV: Array<{ route: string; label: string; icon: string }> = [
  { route: "accueil", label: "Accueil", icon: "home" },
  { route: "analyse", label: "Analyse", icon: "scan" },
  { route: "programme", label: "Programme", icon: "list" },
  { route: "suivi", label: "Suivi", icon: "calendar" },
  { route: "glossaire", label: "Savoir", icon: "book" },
];

export function currentRoute(): string {
  const r = location.hash.replace(/^#/, "");
  return r in ROUTES ? r : "accueil";
}

function renderNav(active: string): HTMLElement {
  return h(
    "nav",
    { class: "tabbar", "aria-label": "Navigation principale" },
    h("a", { href: "#accueil", class: "brand", "aria-label": "Reflet, accueil" }, h("span", { class: "brand-mark", "aria-hidden": "true" }), h("span", { class: "brand-name" }, "Reflet")),
    h(
      "ul",
      null,
      NAV.map((n) =>
        h(
          "li",
          null,
          h("a", { href: `#${n.route}`, class: n.route === active ? "tab active" : "tab", "aria-current": n.route === active ? "page" : null }, icon(n.icon, 22), h("span", null, n.label)),
        ),
      ),
    ),
    h(
      "div",
      { class: "nav-secondary" },
      h("a", { href: "#donnees", class: active === "donnees" ? "active" : "" }, icon("shield", 16), "Mes données"),
      h("a", { href: "#aide", class: active === "aide" ? "active" : "" }, icon("heart", 16), "Besoin d'en parler ?"),
    ),
  );
}

let rendering = 0;

export async function render(): Promise<void> {
  const ticket = ++rendering;
  let route = currentRoute();
  if (!state.settings.onboarded && route !== "bienvenue" && route !== "donnees" && route !== "aide") {
    history.replaceState(null, "", "#bienvenue");
    route = "bienvenue";
  }
  // Les photos ne restent en mémoire que pendant l'analyse et l'affichage des résultats.
  if (route !== "analyse" && route !== "resultats") {
    endCapture();
    resetAnalyse();
  }
  const app = document.getElementById("app");
  if (!app) return;
  clear(app);
  const main = h("main", { id: "view", class: `view view-${route}` });
  if (route !== "bienvenue") app.appendChild(renderNav(route));
  app.appendChild(main);
  try {
    await ROUTES[route](main);
  } catch (e) {
    if (ticket !== rendering) return;
    console.error(e);
    clear(main);
    main.appendChild(
      h("div", { class: "card" }, h("h1", null, "Un problème est survenu"), h("p", null, "Cette page n'a pas pu s'afficher. Vos données locales ne sont pas affectées."), h("p", null, h("a", { href: "#accueil" }, "Revenir à l'accueil"))),
    );
  }
  if (ticket !== rendering) return;
  const title = document.getElementById("page-title");
  if (title) title.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

/** Toute erreur inattendue est affichée : jamais d'échec silencieux. */
function showToast(message: string): void {
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast notice notice-block", role: "alert" }, h("div", null, h("p", null, message), h("button", { type: "button", class: "btn btn-quiet", onclick: (() => t.remove()) as EventListener }, "Fermer")));
  document.body.appendChild(t);
}
window.addEventListener("error", (e) => showToast(`Erreur inattendue : ${e.message}. Rechargez la page si le problème persiste.`));
window.addEventListener("unhandledrejection", (e) => showToast(`Erreur inattendue : ${e.reason instanceof Error ? e.reason.message : String(e.reason)}.`));

async function boot(): Promise<void> {
  setRenderer(render);
  setupInstall();
  onInstallChange(() => {
    if (currentRoute() === "accueil") void render();
  });
  window.addEventListener("hashchange", () => void render());
  await loadHistory().catch(() => undefined);
  await render();
  // Vérifie en arrière-plan si le modèle local est installé (requête vers la même origine).
  state.detector = await checkAvailability();
  if (currentRoute() === "analyse" && !state.capture) await render();
}

void boot();
