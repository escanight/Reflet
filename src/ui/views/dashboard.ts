import { h } from "../dom.js";
import { card, icon, linkButton, pageHeader } from "../components.js";
import { state } from "../../app/state.js";
import { weekDays, weekProgress } from "../../habits/tracker.js";
import { LEVEL_LABEL } from "../../analysis/observations.js";
import { button } from "../components.js";
import { canPromptInstall, isFramed, isIOS, isStandalone, promptInstall } from "../../app/install.js";

export function renderDashboard(root: HTMLElement): void {
  const adult = state.settings.adult === true;
  const now = new Date();
  const hour = now.getHours();
  const hello = hour >= 5 && hour < 18 ? "Bonjour" : "Bonsoir";

  root.appendChild(pageHeader(hello, "Ce qui compte vraiment se trouve dans vos habitudes, pas dans un score."));

  // Analyse
  if (adult) {
    const r = state.result;
    if (r) {
      const counts = { reliable: 0, confirm: 0, uncertain: 0 };
      r.observations.forEach((o) => counts[o.level]++);
      root.appendChild(
        card(
          "Dernière analyse",
          h("p", { class: "muted" }, `${new Date(r.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · ${r.photos} photo${r.photos > 1 ? "s" : ""} · ${r.mode === "auto" ? "repérage automatique" : "repérage manuel"}`),
          h(
            "div",
            { class: "stat-row" },
            stat(String(counts.reliable), LEVEL_LABEL.reliable),
            stat(String(counts.confirm), LEVEL_LABEL.confirm),
            stat(String(counts.uncertain), "Masquées"),
          ),
          h("div", { class: "button-row" }, linkButton("Voir les observations", "#resultats", { variant: "ghost", icon: "arrow" })),
        ),
      );
    } else {
      root.appendChild(
        card(
          "Analyse de photo",
          h("p", null, "Importez une photo de face : Reflet vérifie d'abord sa qualité, puis ne montre que les mesures assez fiables, avec leur marge d'erreur."),
          h("div", { class: "button-row" }, linkButton("Commencer une analyse", "#analyse", { icon: "scan" })),
        ),
      );
    }
  } else {
    root.appendChild(
      card(
        "Votre espace",
        h("p", null, "Avant 18 ans, Reflet se concentre sur les habitudes (sommeil, peau, dents, activité) et sur la façon de prendre de bonnes photos. Les mesures du visage ne sont pas proposées."),
        h("div", { class: "button-row" }, linkButton("Mon programme", "#programme", { icon: "list" })),
      ),
    );
  }

  // Habitudes de la semaine
  const days = weekDays(now);
  if (state.habits.length) {
    root.appendChild(
      card(
        "Cette semaine",
        h(
          "ul",
          { class: "habit-summary" },
          state.habits.map((hb) => {
            const p = weekProgress(hb, now);
            const pct = Math.min(100, Math.round((p.done / p.target) * 100));
            return h(
              "li",
              null,
              h("div", { class: "habit-summary-head" }, h("span", null, hb.label), h("span", { class: "muted" }, `${p.done}/${p.target}`)),
              h("div", { class: "bar", role: "img", "aria-label": `${p.done} jours sur ${p.target} visés` }, h("span", { class: "bar-fill", "data-pct": String(pct) })),
            );
          }),
        ),
        h("p", { class: "muted small" }, `Semaine du ${new Date(days[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}. Deux jours de réserve par habitude.`),
        h("div", { class: "button-row" }, linkButton("Cocher aujourd'hui", "#suivi", { variant: "ghost", icon: "check" })),
      ),
    );
  } else {
    root.appendChild(
      card(
        "Vos habitudes",
        h("p", null, "Répondez à quelques questions pour obtenir un programme adapté à votre peau, votre pilosité, votre budget et votre temps."),
        h("div", { class: "button-row" }, linkButton(state.profileSet ? "Voir mon programme" : "Créer mon programme", "#programme", { variant: state.result ? "primary" : "ghost", icon: "list" })),
      ),
    );
  }

  if (!isStandalone() && !isFramed()) {
    if (canPromptInstall()) {
      root.appendChild(card("Installer Reflet", h("p", null, "Ajoutez Reflet à votre écran d'accueil : elle s'ouvre comme une application, en plein écran, fonctionne hors ligne, et la caméra s'ouvre directement dedans."), h("div", { class: "button-row" }, button("Installer l'application", () => void promptInstall(), { icon: "plus" }))));
    } else if (isIOS()) {
      root.appendChild(card("Installer Reflet", h("p", null, "Sur iPhone : touchez le bouton Partager de Safari, puis « Sur l'écran d'accueil ». Reflet s'ouvrira ensuite comme une application.")));
    }
  }

  root.appendChild(
    h(
      "div",
      { class: "tile-row" },
      h("a", { href: "#glossaire", class: "tile" }, icon("book", 22), h("span", null, "Mythes et preuves"), h("small", null, "PSL, mewing, nombre d'or…")),
      h("a", { href: "#donnees", class: "tile" }, icon("shield", 22), h("span", null, "Mes données"), h("small", null, "Ce qui est stocké, tout supprimer")),
      h("a", { href: "#aide", class: "tile" }, icon("heart", 22), h("span", null, "Besoin d'en parler ?"), h("small", null, "Ressources d'écoute")),
    ),
  );

  // Les barres utilisent un attribut data-pct : la largeur est appliquée via le CSSOM (compatible CSP).
  root.querySelectorAll<HTMLElement>(".bar-fill").forEach((el) => (el.style.width = `${el.dataset.pct}%`));
}

function stat(value: string, label: string): HTMLElement {
  return h("div", { class: "stat" }, h("span", { class: "stat-value" }, value), h("span", { class: "stat-label" }, label));
}
