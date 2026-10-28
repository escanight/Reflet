import { h, svg, announce } from "../dom.js";
import { button, icon, linkButton } from "../components.js";
import { saveHabits, state } from "../../app/state.js";
import { localDateKey, toggleDone, weekProgress } from "../../habits/tracker.js";
import { computeXp, rankFor } from "../../app/progress.js";
import { symmetryIndex } from "../../analysis/summary.js";
import { canPromptInstall, isFramed, isIOS, isStandalone, promptInstall } from "../../app/install.js";

export function rankRing(progress: number, rankId: number): SVGElement {
  const R = 30, C = 2 * Math.PI * R;
  return svg("svg", { viewBox: "0 0 72 72", class: "rank-ring", "aria-hidden": "true" },
    svg("circle", { cx: 36, cy: 36, r: R, class: "gauge-track" }),
    svg("circle", { cx: 36, cy: 36, r: R, class: "gauge-fill", "stroke-dasharray": `${C * progress} ${C}`, transform: "rotate(-90 36 36)" }),
    (() => {
      const t = svg("text", { x: 36, y: 42, "text-anchor": "middle", class: "rank-ring-text" });
      t.textContent = String(rankId);
      return t;
    })(),
  );
}

export function currentRank() {
  const xp = computeXp(state.habits, state.scanWeeks, state.profileSet);
  return { xp, ...rankFor(xp.total) };
}

export function renderDashboard(root: HTMLElement): void {
  const adult = state.settings.adult === true;
  const { xp, rank, next, progress, toNext } = currentRank();

  root.appendChild(
    h("header", { class: "home-top" },
      h("h1", { id: "page-title", tabindex: "-1", class: "wordmark" }, "Reflet"),
      h("a", { href: "#profil", class: "rank-chip", "aria-label": `Rang ${rank.name}, ${xp.total} XP` }, h("span", { class: "rank-chip-dot" }), rank.name),
    ),
  );

  // Rang
  root.appendChild(
    h("a", { href: "#profil", class: "rank-card" },
      rankRing(progress, rank.id),
      h("div", null,
        h("p", { class: "eyebrow" }, "Ton rang"),
        h("p", { class: "rank-name" }, rank.name),
        h("p", { class: "muted small" }, next ? `${xp.total} XP · encore ${toNext} pour ${next.name}` : `${xp.total} XP · rang maximal`),
      ),
      icon("arrow", 18),
    ),
  );

  // Action principale
  if (adult) {
    const r = state.result;
    const sym = r ? symmetryIndex(r.observations) : null;
    root.appendChild(
      h("a", { href: "#analyse", class: "cta-card", "data-testid": "cta-scan" },
        h("div", { class: "cta-icon" }, icon("scan", 30)),
        h("div", null, h("p", { class: "cta-title" }, "Lancer un scan"), h("p", { class: "cta-sub" }, r ? `Dernier : symétrie ${sym?.value ?? "—"}${sym?.value !== null && sym ? " %" : ""}` : "3 secondes · 100 % sur ton téléphone")),
      ),
    );
    if (r) root.appendChild(h("div", { class: "button-row" }, linkButton("Voir mon dernier résultat", "#resultats", { variant: "quiet", icon: "arrow" })));
  } else {
    root.appendChild(
      h("a", { href: "#programme", class: "cta-card" },
        h("div", { class: "cta-icon" }, icon("list", 30)),
        h("div", null, h("p", { class: "cta-title" }, "Mon programme"), h("p", { class: "cta-sub" }, "Peau, sommeil, sport : monte en rang")),
      ),
    );
  }

  // Aujourd'hui
  const today = localDateKey(new Date());
  const section = h("section", { class: "today" }, h("h2", { class: "section-title" }, "Aujourd'hui"));
  if (state.habits.length) {
    const list = h("ul", { class: "today-list" });
    for (const hb of state.habits) {
      const done = hb.done.includes(today);
      const p = weekProgress(hb, new Date());
      list.appendChild(
        h("li", null,
          h("button", {
            type: "button", class: `today-item${done ? " done" : ""}`, "aria-pressed": done ? "true" : "false",
            onclick: (() => {
              saveHabits(state.habits.map((x) => (x.id === hb.id ? toggleDone(x, today) : x)));
              announce(done ? `${hb.label} : décoché.` : `${hb.label} : fait, +10 XP.`);
              const view = document.getElementById("view");
              if (view) {
                view.replaceChildren();
                renderDashboard(view);
              }
            }) as EventListener,
          },
            h("span", { class: "today-check", "aria-hidden": "true" }, done ? icon("check", 18) : null),
            h("span", { class: "today-label" }, hb.label),
            h("span", { class: "today-meta" }, `${p.done}/${p.target}`),
          ),
        ),
      );
    }
    section.appendChild(list);
  } else {
    section.appendChild(h("div", { class: "card center" }, h("p", { class: "muted" }, "Aucune habitude pour l'instant."), h("div", { class: "button-row center" }, linkButton(state.profileSet ? "Choisir mes habitudes" : "Créer mon programme", "#programme", { variant: "ghost", icon: "plus" }))));
  }
  root.appendChild(section);

  // Installation
  if (!isStandalone() && !isFramed()) {
    if (canPromptInstall()) {
      root.appendChild(h("div", { class: "install-bar" }, icon("plus", 18), h("span", null, "Installe Reflet sur ton écran d'accueil"), button("Installer", () => void promptInstall(), { variant: "ghost" })));
    } else if (isIOS()) {
      root.appendChild(h("p", { class: "muted small center" }, "iPhone : Partager › « Sur l'écran d'accueil » pour installer Reflet."));
    }
  }
}
