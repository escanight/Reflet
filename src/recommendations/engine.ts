/**
 * Moteur de recommandations : règles explicites et déterministes.
 * Entrées : profil déclaré (questionnaire) et, facultativement, les
 * problèmes de prise de vue relevés lors de l'analyse. Aucune
 * recommandation n'est tirée d'un trait du visage : les traits osseux ne
 * sont pas modifiables et ne justifient aucun conseil.
 */
import { ADVICE, CATEGORY_LABEL, type Advice, type Category, type HabitTemplate, type Profile } from "./catalog.js";

export interface AdviceView {
  advice: Advice;
  optional: boolean;
  notes: string[];
  /** Pourquoi cette recommandation apparaît (personnalisation). */
  reason?: string;
}

export interface ProgramSection {
  category: Category;
  title: string;
  items: AdviceView[];
}

export interface Program {
  sections: ProgramSection[];
  dailyMinutes: number;
  suggestedHabits: Array<HabitTemplate & { adviceId: string }>;
}

const ALWAYS = new Set(["spf", "teeth", "sleep", "photo", "habits"]);
const DAILY_PRIORITY = ["spf", "teeth", "cleanse", "shave", "beard", "moisturize"];
const ORDER: Category[] = ["quotidien", "hebdo", "soins", "presentation", "bienetre"];

export interface AnalysisHints {
  /** Identifiants des problèmes de prise de vue relevés (ex. "distance"). */
  issueIds: string[];
}

export function selectAdvice(profile: Profile): Advice[] {
  return ADVICE.filter((a) => {
    if (a.applies && !a.applies(profile)) return false;
    if (ALWAYS.has(a.id)) return true;
    if (a.goal === "base") return true;
    return profile.goals.includes(a.goal);
  });
}

export function buildProgram(profile: Profile, hints?: AnalysisHints): Program {
  const chosen = selectAdvice(profile);

  // Budget temps : les gestes quotidiens au-delà du temps déclaré deviennent optionnels.
  const optional = new Set<string>();
  let minutes = 0;
  const daily = chosen
    .filter((a) => a.category === "quotidien" || (a.minutes !== undefined && a.category === "presentation"))
    .sort((a, b) => rank(a.id) - rank(b.id));
  for (const a of daily) {
    const m = a.minutes ?? 0;
    if (minutes + m <= profile.minutesPerDay || a.id === "spf" || a.id === "teeth") minutes += m;
    else optional.add(a.id);
  }

  const photoIssues = new Set(["distance", "lateralLight", "yaw", "pitch", "blur", "exposure", "faceSize"]);
  const hit = hints?.issueIds.filter((i) => photoIssues.has(i)) ?? [];

  const views: AdviceView[] = chosen.map((a) => {
    const notes: string[] = [];
    const b = a.budget?.[profile.budget];
    if (b) notes.push(b);
    if (!profile.adult && a.minorNote) notes.push(a.minorNote);
    const view: AdviceView = { advice: a, optional: optional.has(a.id), notes };
    if (a.id === "photo" && hit.length) {
      view.reason = "Ton dernier scan a relevé des conditions de prise de vue qui faussent les mesures.";
    }
    if (a.id === "acne") view.reason = "Tu as indiqué une tendance à l'acné.";
    if (a.id === "shave" || a.id === "beard") view.reason = "D'après ta réponse sur la pilosité du visage.";
    if (a.id === "tobacco") view.reason = "Tu as indiqué fumer.";
    return view;
  });

  const sections: ProgramSection[] = ORDER.map((c) => ({
    category: c,
    title: CATEGORY_LABEL[c],
    items: views
      .filter((v) => v.advice.category === c)
      .sort((x, y) => Number(!!y.reason) - Number(!!x.reason) || Number(x.optional) - Number(y.optional)),
  })).filter((s) => s.items.length > 0);

  // Habitudes suggérées : 3 au maximum, celles liées aux objectifs d'abord.
  const habitCandidates = chosen.filter((a) => a.habit && !optional.has(a.id));
  habitCandidates.sort((a, b) => goalRank(profile, a) - goalRank(profile, b));
  const suggestedHabits = habitCandidates.slice(0, 3).map((a) => ({ ...(a.habit as HabitTemplate), adviceId: a.id }));

  return { sections, dailyMinutes: minutes, suggestedHabits };
}

function rank(id: string): number {
  const i = DAILY_PRIORITY.indexOf(id);
  return i === -1 ? 99 : i;
}

function goalRank(p: Profile, a: Advice): number {
  if (a.id === "spf") return 0;
  if (a.goal !== "base" && p.goals.includes(a.goal)) return 1 + p.goals.indexOf(a.goal);
  return 50;
}
