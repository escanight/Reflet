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
import { renderProfile } from "./ui/views/profile.js";

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
  profil: renderProfile,
};

const NAV: Array<{ route: string; label: string; icon: string; center?: boolean }> = [
  { route: "accueil", label: "Accueil", icon: "home" },
  { route: "programme", label: "Programme", icon: "list" },
  { route: "analyse", label: "Scan", icon: "scan", center: true },
  { route: "suivi", label: "Suivi", icon: "calendar" },
  { route: "profil", label: "Profil", icon: "user" },
];

const ACTIVE_ALIAS: Record<string, string> = { resultats: "analyse", glossaire: "profil", donnees: "profil", aide: "profil" };

export function currentRoute(): string {
  const r = location.hash.replace(/^#/, "");
  return r in ROUTES ? r : "accueil";
}

function renderNav(route: string): HTMLElement {
  const active = ACTIVE_ALIAS[route] ?? route;
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
          { class: n.center ? "center-slot" : null },
          h("a", { href: `#${n.route}`, class: `tab${n.center ? " tab-center" : ""}${n.route === active ? " active" : ""}`, "aria-current": n.route === active ? "page" : null, "data-testid": `nav-${n.route}` }, h("span", { class: "tab-icon" }, icon(n.icon, n.center ? 26 : 22)), h("span", { class: "tab-label" }, n.label)),
        ),
      ),
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
  // Crochet de test : force le repérage manuel (visages synthétiques des tests).
  const forceManual = (window as Window & { __REFLET_FORCE_MANUAL__?: boolean }).__REFLET_FORCE_MANUAL__ === true;
  state.detector = forceManual ? { available: false, reason: "forcé (tests)" } : await checkAvailability();
}

void boot();
