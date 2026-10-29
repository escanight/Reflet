import { clear, h } from "../dom.js";
import { button, card, checkbox, choiceGroup, details, evidenceBadge, icon, notice, pageHeader, sourceList } from "../components.js";
import { saveProfile, state } from "../../app/state.js";
import { buildProgram } from "../../recommendations/engine.js";
import { WARNINGS } from "../../recommendations/catalog.js";
let editing = false;
export function renderProgram(root) {
    clear(root);
    if (!state.profileSet || editing) {
        renderQuestionnaire(root);
        return;
    }
    const hints = state.result ? { issueIds: state.result.issueIds } : undefined;
    const program = buildProgram(state.profile, hints);
    root.appendChild(pageHeader("Conseils glow-up", "Touche un conseil pour le détail, sah"));
    for (const s of program.sections) {
        root.appendChild(h("h2", { class: "section-title" }, s.title));
        for (const v of s.items)
            root.appendChild(adviceCard(v));
    }
    root.appendChild(h("section", { class: "card compact" }, details("À éviter absolument", h("ul", { class: "warning-list" }, WARNINGS.map((w) => h("li", null, h("strong", null, w.title), h("span", null, w.text), sourceList([w.source])))))));
    root.appendChild(h("div", { class: "button-row" }, button("Modifier mes réponses", () => { editing = true; renderProgram(root); }, { variant: "ghost" })));
    root.appendChild(h("p", { class: "fine" }, "Pas de diagnostic ni de médicament : pour un souci de peau, de cheveux ou de dents, vois un pharmacien, un médecin ou un dentiste."));
}
function adviceCard(v) {
    const a = v.advice;
    return h("details", { class: `advice${v.optional ? " optional" : ""}` }, h("summary", null, h("span", { class: "advice-title" }, a.title), h("span", { class: "advice-sub" }, a.objective), h("span", { class: "advice-meta" }, evidenceBadge(a.evidence), v.reason ? h("span", { class: "tag tag-reason" }, "Pour toi") : null, v.optional ? h("span", { class: "tag" }, "Optionnel") : null)), h("div", { class: "advice-body" }, v.reason ? h("p", { class: "reason" }, icon("info", 14), " ", v.reason) : null, h("ul", { class: "how" }, a.how.map((x) => h("li", null, x))), v.notes.length ? h("div", { class: "notes" }, v.notes.map((n) => h("p", null, n))) : null, h("p", { class: "small muted" }, h("strong", null, "Limites : "), a.limits), sourceList(a.sources)));
}
function renderQuestionnaire(root) {
    const p = { ...state.profile, adult: state.settings.adult === true, goals: [...state.profile.goals] };
    root.appendChild(pageHeader("Ton programme", "6 questions · tes réponses restent sur ton téléphone"));
    const form = h("form", { class: "questionnaire", novalidate: true });
    const goals = [
        { v: "peau", label: "Peau" },
        { v: "rasage", label: "Rasage et barbe" },
        { v: "cheveux", label: "Cheveux" },
        { v: "dents", label: "Dents et sourire" },
        { v: "sommeil", label: "Sommeil" },
        { v: "forme", label: "Forme et alimentation" },
        { v: "photo", label: "Mieux rendre en photo" },
    ];
    form.append(card(null, h("fieldset", { class: "choices" }, h("legend", null, "Tes priorités"), goals.map((g) => checkbox(g.label, p.goals.includes(g.v), (on) => {
        p.goals = on ? [...new Set([...p.goals, g.v])] : p.goals.filter((x) => x !== g.v);
    })))), card(null, choiceGroup("skin", "Ta peau est plutôt…", [
        { value: "grasse", label: "Grasse", hint: "Brillante en journée" },
        { value: "seche", label: "Sèche", hint: "Tiraille, pèle parfois" },
        { value: "mixte", label: "Mixte" },
        { value: "sensible", label: "Sensible", hint: "Rougit, picote facilement" },
        { value: "nsp", label: "Je ne sais pas" },
    ], p.skin, (v) => (p.skin = v)), checkbox("J'ai souvent des boutons (tendance à l'acné)", p.acne, (v) => (p.acne = v)), checkbox("J'ai des taches brunes que je voudrais limiter", p.spots, (v) => (p.spots = v))), card(null, choiceGroup("facialHair", "Pilosité du visage", [
        { value: "rase", label: "Je me rase de près" },
        { value: "courte", label: "Barbe courte ou de quelques jours" },
        { value: "longue", label: "Barbe longue" },
        { value: "aucune", label: "Pas concerné·e" },
    ], p.facialHair, (v) => (p.facialHair = v)), choiceGroup("hair", "Tes cheveux", [
        { value: "raides", label: "Raides" },
        { value: "ondules", label: "Ondulés" },
        { value: "boucles", label: "Bouclés" },
        { value: "crepus", label: "Crépus" },
        { value: "tres-courts", label: "Très courts ou rasés" },
        { value: "nsp", label: "Je ne sais pas" },
    ], p.hair, (v) => (p.hair = v)), checkbox("Mon cuir chevelu graisse vite", p.scalpOily, (v) => (p.scalpOily = v))), card(null, choiceGroup("budget", "Budget pour les produits", [
        { value: "minimal", label: "Minimal", hint: "L'essentiel, sans superflu" },
        { value: "modere", label: "Modéré" },
        { value: "confortable", label: "Confortable" },
    ], p.budget, (v) => (p.budget = v)), choiceGroup("minutes", "Temps par jour", [
        { value: "5", label: "5 minutes" },
        { value: "10", label: "10 minutes" },
        { value: "20", label: "20 minutes" },
    ], String(p.minutesPerDay), (v) => (p.minutesPerDay = Number(v))), checkbox("Je fume", p.smoker, (v) => (p.smoker = v), "Facultatif : pour une information sans jugement.")));
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
