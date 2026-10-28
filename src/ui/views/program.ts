import { clear, h, announce } from "../dom.js";
import { button, card, checkbox, choiceGroup, details, evidenceBadge, icon, linkButton, notice, pageHeader, sourceList } from "../components.js";
import { saveHabits, saveProfile, state } from "../../app/state.js";
import { buildProgram, type AdviceView } from "../../recommendations/engine.js";
import { WARNINGS, type Goal, type Profile } from "../../recommendations/catalog.js";
import { createHabit, MAX_ACTIVE_HABITS } from "../../habits/tracker.js";

let editing = false;

export function renderProgram(root: HTMLElement): void {
  clear(root);
  if (!state.profileSet || editing) {
    renderQuestionnaire(root);
    return;
  }
  const hints = state.result ? { issueIds: state.result.issueIds } : undefined;
  const program = buildProgram(state.profile, hints);

  root.appendChild(pageHeader("Mon programme", `Environ ${program.dailyMinutes} minutes par jour pour l'essentiel. Chaque conseil indique son niveau de preuve et ses limites.`));

  const tracked = new Set(state.habits.map((x) => x.adviceId).filter(Boolean));
  const toAdd = program.suggestedHabits.filter((s) => !tracked.has(s.adviceId));
  if (toAdd.length && state.habits.length < MAX_ACTIVE_HABITS) {
    root.appendChild(
      card(
        "Commencez petit",
        h("p", null, "Trois habitudes au maximum pour démarrer. Une habitude met en moyenne 66 jours à devenir automatique, avec de grandes différences d'une personne à l'autre."),
        h("ul", { class: "habit-picks" }, toAdd.map((s) => h("li", null, icon("check", 16), h("span", null, h("strong", null, s.label), ` · ${s.weeklyTarget} jours sur 7`)))),
        h(
          "div",
          { class: "button-row" },
          button(toAdd.length > 1 ? `Suivre ces ${toAdd.length} habitudes` : "Suivre cette habitude", () => {
            const room = MAX_ACTIVE_HABITS - state.habits.length;
            const created = toAdd.slice(0, room).map((s) => createHabit(s.label, s.weeklyTarget, s.cue, s.adviceId));
            saveHabits([...state.habits, ...created]);
            announce(`${created.length} habitude${created.length > 1 ? "s" : ""} ajoutée${created.length > 1 ? "s" : ""} au suivi.`);
            renderProgram(root);
          }, { icon: "plus" }),
          linkButton("Voir le suivi", "#suivi", { variant: "ghost" }),
        ),
      ),
    );
  }

  for (const s of program.sections) {
    root.appendChild(h("h2", { class: "section-title" }, s.title));
    for (const v of s.items) root.appendChild(adviceCard(v, tracked.has(v.advice.id), () => renderProgram(root)));
  }

  root.appendChild(h("h2", { class: "section-title" }, "À éviter"));
  root.appendChild(
    card(
      null,
      h("p", { class: "muted small" }, "Pratiques répandues dans les communautés en ligne, avec des risques documentés."),
      h("ul", { class: "warning-list" }, WARNINGS.map((w) => h("li", null, h("strong", null, w.title), h("span", null, w.text), sourceList([w.source])))),
    ),
  );

  root.appendChild(h("div", { class: "button-row" }, button("Modifier mes réponses", () => { editing = true; renderProgram(root); }, { variant: "ghost" })));
  root.appendChild(h("p", { class: "muted small" }, "Reflet ne pose pas de diagnostic et ne prescrit aucun médicament. Pour un problème de peau, de cheveux ou de dents qui vous inquiète, consultez un pharmacien, un médecin ou un dentiste."));
}

function adviceCard(v: AdviceView, tracked: boolean, refresh: () => void): HTMLElement {
  const a = v.advice;
  return h(
    "article",
    { class: `card advice${v.optional ? " optional" : ""}` },
    h("div", { class: "advice-head" }, h("h3", null, a.title), evidenceBadge(a.evidence)),
    v.reason ? h("p", { class: "reason" }, icon("info", 14), " ", v.reason) : null,
    v.optional ? h("p", { class: "tag" }, "Optionnel : dépasse le temps quotidien que vous avez indiqué") : null,
    h("p", null, h("strong", null, "Objectif : "), a.objective),
    h("ul", { class: "how" }, a.how.map((x) => h("li", null, x))),
    v.notes.length ? h("div", { class: "notes" }, v.notes.map((n) => h("p", null, n))) : null,
    details("Limites et sources", h("p", null, a.limits), sourceList(a.sources)),
    a.habit
      ? tracked
        ? h("p", { class: "muted small" }, icon("check", 14), " Suivie dans l'onglet Suivi.")
        : state.habits.length < MAX_ACTIVE_HABITS
          ? button("Suivre cette habitude", () => {
              saveHabits([...state.habits, createHabit(a.habit!.label, a.habit!.weeklyTarget, a.habit!.cue, a.id)]);
              announce("Habitude ajoutée au suivi.");
              refresh();
            }, { variant: "quiet", icon: "plus" })
          : null
      : null,
  );
}

function renderQuestionnaire(root: HTMLElement): void {
  const p: Profile = { ...state.profile, adult: state.settings.adult === true, goals: [...state.profile.goals] };
  root.appendChild(pageHeader("Votre programme", "Quelques questions pour adapter les conseils. Les réponses restent sur cet appareil."));
  const form = h("form", { class: "questionnaire", novalidate: true });
  const goals: Array<{ v: Goal; label: string }> = [
    { v: "peau", label: "Peau" },
    { v: "rasage", label: "Rasage et barbe" },
    { v: "cheveux", label: "Cheveux" },
    { v: "dents", label: "Dents et sourire" },
    { v: "sommeil", label: "Sommeil" },
    { v: "forme", label: "Forme et alimentation" },
    { v: "photo", label: "Mieux rendre en photo" },
  ];
  form.append(
    card(
      null,
      h(
        "fieldset",
        { class: "choices" },
        h("legend", null, "Vos priorités"),
        goals.map((g) =>
          checkbox(g.label, p.goals.includes(g.v), (on) => {
            p.goals = on ? [...new Set([...p.goals, g.v])] : p.goals.filter((x) => x !== g.v);
          }),
        ),
      ),
    ),
    card(
      null,
      choiceGroup("skin", "Votre peau est plutôt…", [
        { value: "grasse", label: "Grasse", hint: "Brillante en journée" },
        { value: "seche", label: "Sèche", hint: "Tiraille, pèle parfois" },
        { value: "mixte", label: "Mixte" },
        { value: "sensible", label: "Sensible", hint: "Rougit, picote facilement" },
        { value: "nsp", label: "Je ne sais pas" },
      ], p.skin, (v) => (p.skin = v)),
      checkbox("J'ai souvent des boutons (tendance à l'acné)", p.acne, (v) => (p.acne = v)),
      checkbox("J'ai des taches brunes que je voudrais limiter", p.spots, (v) => (p.spots = v)),
    ),
    card(
      null,
      choiceGroup("facialHair", "Pilosité du visage", [
        { value: "rase", label: "Je me rase de près" },
        { value: "courte", label: "Barbe courte ou de quelques jours" },
        { value: "longue", label: "Barbe longue" },
        { value: "aucune", label: "Pas concerné·e" },
      ], p.facialHair, (v) => (p.facialHair = v)),
      choiceGroup("hair", "Vos cheveux", [
        { value: "raides", label: "Raides" },
        { value: "ondules", label: "Ondulés" },
        { value: "boucles", label: "Bouclés" },
        { value: "crepus", label: "Crépus" },
        { value: "tres-courts", label: "Très courts ou rasés" },
        { value: "nsp", label: "Je ne sais pas" },
      ], p.hair, (v) => (p.hair = v)),
      checkbox("Mon cuir chevelu graisse vite", p.scalpOily, (v) => (p.scalpOily = v)),
    ),
    card(
      null,
      choiceGroup("budget", "Budget pour les produits", [
        { value: "minimal", label: "Minimal", hint: "L'essentiel, sans superflu" },
        { value: "modere", label: "Modéré" },
        { value: "confortable", label: "Confortable" },
      ], p.budget, (v) => (p.budget = v)),
      choiceGroup("minutes", "Temps par jour", [
        { value: "5", label: "5 minutes" },
        { value: "10", label: "10 minutes" },
        { value: "20", label: "20 minutes" },
      ], String(p.minutesPerDay) as "5" | "10" | "20", (v) => (p.minutesPerDay = Number(v) as 5 | 10 | 20)),
      checkbox("Je fume", p.smoker, (v) => (p.smoker = v), "Facultatif : pour une information sans jugement."),
    ),
  );
  const err = h("div");
  form.append(err, h("div", { class: "button-row" }, button("Voir mon programme", () => undefined, { type: "submit", icon: "arrow" })));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!p.goals.length) {
      err.replaceChildren(notice("warn", h("p", null, "Choisissez au moins une priorité.")));
      return;
    }
    saveProfile(p);
    editing = false;
    renderProgram(root);
  });
  root.appendChild(form);
}
