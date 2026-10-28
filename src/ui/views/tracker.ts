import { clear, h, announce } from "../dom.js";
import { button, card, linkButton, notice, pageHeader } from "../components.js";
import { saveHabits, state } from "../../app/state.js";
import {
  createHabit, localDateKey, MAX_ACTIVE_HABITS, RESERVE_PER_WEEK, reserveUsed, toggleDone, toggleReserve,
  weekDays, weekProgress, weeksReached, type Habit,
} from "../../habits/tracker.js";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
let weekOffset = 0;

export function renderTracker(root: HTMLElement): void {
  clear(root);
  const ref = new Date();
  ref.setDate(ref.getDate() + weekOffset * 7);
  const today = localDateKey(new Date());
  const days = weekDays(ref);

  root.appendChild(pageHeader("Suivi des habitudes", "Un objectif par semaine et deux jours de réserve. Aucune série à perdre, aucune notification."));

  const nav = h(
    "div",
    { class: "week-nav" },
    button("Semaine précédente", () => { weekOffset--; renderTracker(root); }, { variant: "quiet", icon: "back" }),
    h("p", { class: "week-label" }, `Semaine du ${new Date(days[0] + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`),
    weekOffset < 0 ? button("Semaine suivante", () => { weekOffset++; renderTracker(root); }, { variant: "quiet", icon: "arrow" }) : h("span"),
  );
  root.appendChild(nav);

  if (!state.habits.length) {
    root.appendChild(card(null, h("p", null, "Aucune habitude suivie pour l'instant."), h("div", { class: "button-row" }, linkButton("Choisir dans mon programme", "#programme"))));
  }

  for (const hb of state.habits) root.appendChild(habitCard(hb, days, ref, today, root));

  root.appendChild(h("p", { class: "muted small legend-inline" }, "Touchez un jour : une fois = fait ; deux fois = jour de réserve (", String(RESERVE_PER_WEEK), " par semaine) ; trois fois = effacer."));

  if (state.habits.length < MAX_ACTIVE_HABITS) root.appendChild(addHabitForm(root));
  else root.appendChild(notice("info", h("p", null, `${MAX_ACTIVE_HABITS} habitudes au maximum : mieux vaut peu d'habitudes tenues que beaucoup d'abandonnées.`)));
}

function habitCard(hb: Habit, days: string[], ref: Date, today: string, root: HTMLElement): HTMLElement {
  const p = weekProgress(hb, ref);
  const update = (next: Habit) => {
    saveHabits(state.habits.map((x) => (x.id === hb.id ? next : x)));
    renderTracker(root);
  };
  const grid = h(
    "div",
    { class: "week-grid", role: "group", "aria-label": `Jours de la semaine pour ${hb.label}` },
    days.map((d, i) => {
      const done = hb.done.includes(d);
      const reserve = hb.reserve.includes(d);
      const future = d > today;
      const stateLabel = done ? "fait" : reserve ? "jour de réserve" : "non coché";
      return h(
        "button",
        {
          type: "button",
          class: `day${done ? " done" : ""}${reserve ? " reserve" : ""}${d === today ? " today" : ""}`,
          disabled: future,
          "aria-pressed": done ? "true" : "false",
          "aria-label": `${DAY_LABELS[i]} ${new Date(d + "T12:00").getDate()} : ${stateLabel}`,
          onclick: (() => {
            let next: Habit;
            if (!done && !reserve) next = toggleDone(hb, d);
            else if (done) {
              const r = toggleReserve(toggleDone(hb, d), d, ref);
              next = r;
            } else next = toggleReserve(hb, d, ref); // retire la réserve
            const n = next.done.includes(d) ? "fait" : next.reserve.includes(d) ? "jour de réserve" : "effacé";
            announce(`${DAY_LABELS[i]} : ${n}.`);
            update(next);
          }) as EventListener,
        },
        h("span", { class: "day-name" }, DAY_LABELS[i]),
        h("span", { class: "day-mark", "aria-hidden": "true" }, done ? "✓" : reserve ? "R" : String(new Date(d + "T12:00").getDate())),
      );
    }),
  );
  const cue = h("input", { type: "text", value: hb.cue, maxlength: "200", class: "cue-input", "aria-label": `Plan « Quand… alors… » pour ${hb.label}` });
  cue.addEventListener("change", () => update({ ...hb, cue: cue.value.trim().slice(0, 200) }));
  const reached = weeksReached(hb, new Date());
  return card(
    hb.label,
    h("p", { class: p.reached ? "progress-msg reached" : "progress-msg" }, p.message, ` Réserve : ${reserveUsed(hb, ref)}/${RESERVE_PER_WEEK}.`),
    grid,
    h("label", { class: "field" }, h("span", null, "Quand… alors…"), cue),
    reached > 0 ? h("p", { class: "muted small" }, `Objectif atteint ${reached} semaine${reached > 1 ? "s" : ""} sur les 8 dernières.`) : null,
    h("div", { class: "button-row" }, button("Retirer", () => {
      saveHabits(state.habits.filter((x) => x.id !== hb.id));
      announce("Habitude retirée.");
      renderTracker(root);
    }, { variant: "quiet", icon: "trash" })),
  );
}

function addHabitForm(root: HTMLElement): HTMLElement {
  const label = h("input", { type: "text", maxlength: "80", required: true, placeholder: "Ex. : marcher 20 minutes" });
  const target = h("input", { type: "number", min: "1", max: "7", value: "4", inputmode: "numeric" });
  const cue = h("input", { type: "text", maxlength: "200", placeholder: "Quand… (routine existante), alors…" });
  const err = h("div");
  const form = h(
    "form",
    { class: "card add-habit", novalidate: true },
    h("h2", { class: "card-title" }, "Ajouter une habitude"),
    h("label", { class: "field" }, h("span", null, "Habitude"), label),
    h("label", { class: "field" }, h("span", null, "Jours visés par semaine (1 à 7)"), target),
    h("label", { class: "field" }, h("span", null, "Quand… alors… (facultatif)"), cue),
    err,
    h("div", { class: "button-row" }, button("Ajouter", () => undefined, { type: "submit", variant: "ghost", icon: "plus" })),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = label.value.trim();
    const t = Number(target.value);
    if (!name) {
      err.replaceChildren(notice("warn", h("p", null, "Donnez un nom à l'habitude.")));
      return;
    }
    if (!Number.isInteger(t) || t < 1 || t > 7) {
      err.replaceChildren(notice("warn", h("p", null, "Le nombre de jours doit être compris entre 1 et 7.")));
      return;
    }
    saveHabits([...state.habits, createHabit(name, t, cue.value)]);
    announce("Habitude ajoutée.");
    renderTracker(root);
  });
  return form;
}
