/**
 * Définition et explication de chaque mesure affichée.
 * Le vocabulaire est descriptif : aucune « norme idéale », aucun « défaut ».
 */
import type { MetricId } from "./geometry.js";

export interface SourceLink {
  label: string;
  url: string;
}

export type MetricGroup = "symmetry" | "eyes" | "lower" | "noseMouth";

export interface MetricDefinition {
  id: MetricId;
  group: MetricGroup;
  name: string;
  /** Description courte de ce qui est mesuré. */
  what: string;
  /** Unité et façon d'afficher la valeur. */
  kind: "percentD" | "ratio" | "degrees";
  /** Largeur maximale de l'intervalle 90 % pour chaque niveau. */
  reliableWidth: number;
  confirmWidth: number;
  /** Largeur exprimée relativement à la valeur (ratios). */
  relativeWidth?: boolean;
  meaning: string;
  improve: string;
  sources: SourceLink[];
}

export const SOURCES = {
  rhodes2006: { label: "Rhodes 2006, Annual Review of Psychology (méta-analyse)", url: "https://homepages.uc.edu/~martinj/Taste%20Food%20&%20Wine/Aesthetics_of_Food_&_Drink/Rhodes%20-%20Evolutions%20of%20Facial%20Beauty.pdf" },
  pound2014: { label: "Pound et al. 2014 — asymétrie et santé (ALSPAC, 4 732 scans 3D)", url: "https://orca.cardiff.ac.uk/63362" },
  ward2018: { label: "Ward et al. 2018 — distorsion des selfies (JAMA Facial Plast Surg)", url: "https://medicalresearch.com/?p=40302" },
  alSebaei2015: { label: "Al-Sebaei 2015 — les canons néoclassiques ne sont pas universels", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4369102/" },
  holland2008: { label: "Holland 2008 — critique du masque du nombre d'or", url: "https://dx.doi.org/10.1007/s00266-007-9080-z" },
  wflw: { label: "Précision des détecteurs de repères (300-W, WFLW)", url: "https://arxiv.org/pdf/2508.14929" },
  mediapipeRepeat: { label: "Répétabilité MediaPipe selon la pose (arXiv 2507.18248)", url: "https://arxiv.org/pdf/2507.18248" },
  tennstedt2026: { label: "Tennstedt et al. 2026 — pas de rapport « optimal » universel", url: "https://arxiv.org/abs/2602.13368" },
} satisfies Record<string, SourceLink>;

const SYM_MEANING =
  "Tous les visages présentent une légère asymétrie naturelle. Une symétrie parfaite n'est pas un idéal : les visages rendus parfaitement symétriques par effet miroir sont jugés moins attrayants. La symétrie ne renseigne pas sur la santé.";
const SYM_IMPROVE =
  "Rien à « corriger » : la structure osseuse ne se modifie ni par des exercices ni par la posture de la langue. Ce qui change réellement l'apparence d'une asymétrie sur photo : l'éclairage de face, la tête droite et la distance de prise de vue.";

export const METRICS: Record<MetricId, MetricDefinition> = {
  outerCanthusOffset: {
    id: "outerCanthusOffset", group: "symmetry",
    name: "Coins externes des yeux",
    what: "Différence de distance entre chaque coin externe de l'œil et l'axe du visage.",
    kind: "percentD", reliableWidth: 8, confirmWidth: 16,
    meaning: SYM_MEANING, improve: SYM_IMPROVE,
    sources: [SOURCES.rhodes2006, SOURCES.pound2014],
  },
  eyeWidthDiff: {
    id: "eyeWidthDiff", group: "symmetry",
    name: "Largeur apparente des deux yeux",
    what: "Différence de largeur entre les deux yeux, en % de leur largeur moyenne.",
    kind: "percentD", reliableWidth: 8, confirmWidth: 16,
    meaning: "Une petite différence est courante. Si la tête est légèrement tournée, l'œil le plus éloigné paraît plus étroit : cette mesure est très sensible à l'orientation du visage.",
    improve: SYM_IMPROVE,
    sources: [SOURCES.rhodes2006, SOURCES.mediapipeRepeat],
  },
  alarOffset: {
    id: "alarOffset", group: "symmetry",
    name: "Ailes du nez",
    what: "Différence de distance entre chaque aile du nez et l'axe du visage.",
    kind: "percentD", reliableWidth: 8, confirmWidth: 16,
    meaning: SYM_MEANING, improve: SYM_IMPROVE,
    sources: [SOURCES.rhodes2006],
  },
  mouthCornerOffset: {
    id: "mouthCornerOffset", group: "symmetry",
    name: "Coins de la bouche",
    what: "Différence de distance entre chaque coin de la bouche et l'axe du visage.",
    kind: "percentD", reliableWidth: 8, confirmWidth: 16,
    meaning: SYM_MEANING + " La bouche est mobile : la moindre expression modifie cette mesure.",
    improve: SYM_IMPROVE,
    sources: [SOURCES.rhodes2006],
  },
  mouthLineAngle: {
    id: "mouthLineAngle", group: "symmetry",
    name: "Inclinaison de la bouche par rapport aux yeux",
    what: "Angle entre la ligne des coins de la bouche et la ligne des yeux.",
    kind: "degrees", reliableWidth: 4, confirmWidth: 8,
    meaning: "Un petit angle est fréquent et peut venir de l'expression du moment, d'une habitude de mastication ou simplement de la mesure.",
    improve: "Pour les photos : expression détendue, lèvres jointes sans serrer. Aucune méthode n'est validée pour modifier cet angle.",
    sources: [SOURCES.rhodes2006],
  },
  subnasaleMidline: {
    id: "subnasaleMidline", group: "symmetry",
    name: "Base du nez par rapport à l'axe",
    what: "Décalage latéral de la base du nez par rapport au milieu des yeux.",
    kind: "percentD", reliableWidth: 8, confirmWidth: 16,
    meaning: "Le nez étant en relief, une très légère rotation de la tête le décale nettement sur la photo. Un décalage mesuré ne signifie pas une déviation réelle.",
    improve: "Une déviation de la cloison nasale ne peut être évaluée que par un professionnel de santé, pas sur une photo.",
    sources: [SOURCES.ward2018, SOURCES.mediapipeRepeat],
  },
  stomionMidline: {
    id: "stomionMidline", group: "symmetry",
    name: "Centre de la bouche par rapport à l'axe",
    what: "Décalage latéral du centre des lèvres par rapport au milieu des yeux.",
    kind: "percentD", reliableWidth: 8, confirmWidth: 16,
    meaning: SYM_MEANING,
    improve: SYM_IMPROVE,
    sources: [SOURCES.rhodes2006],
  },
  mentonMidline: {
    id: "mentonMidline", group: "symmetry",
    name: "Menton par rapport à l'axe",
    what: "Décalage latéral du point le plus bas du menton par rapport au milieu des yeux.",
    kind: "percentD", reliableWidth: 8, confirmWidth: 16,
    meaning: "Le bas du menton est le repère le moins précis : barbe, ombre et cou le masquent souvent. " + SYM_MEANING,
    improve: "Une asymétrie de la mâchoire ressentie (gêne, claquements, douleur) relève d'un dentiste ou d'un orthodontiste, pas d'une photo.",
    sources: [SOURCES.rhodes2006, SOURCES.wflw],
  },
  eyeWidthRatio: {
    id: "eyeWidthRatio", group: "eyes",
    name: "Largeur d'un œil / espace entre les yeux",
    what: "Largeur moyenne d'un œil divisée par la distance entre les coins internes.",
    kind: "ratio", reliableWidth: 0.15, confirmWidth: 0.3, relativeWidth: true,
    meaning: "La « règle des cinq yeux » (rapport de 1) vient des canons artistiques néoclassiques ; elle n'a pas été validée comme norme et varie selon les populations. Cette valeur est descriptive, sans cible.",
    improve: "Rien à atteindre. Pour les photos, l'éclairage de face et des yeux détendus (sans plisser) donnent une image fidèle.",
    sources: [SOURCES.alSebaei2015, SOURCES.tennstedt2026],
  },
  lowerFaceRatio: {
    id: "lowerFaceRatio", group: "lower",
    name: "Lèvre supérieure / lèvre inférieure et menton",
    what: "Hauteur base du nez → lèvres, divisée par la hauteur lèvres → bas du menton.",
    kind: "ratio", reliableWidth: 0.15, confirmWidth: 0.3, relativeWidth: true,
    meaning: "Proportion verticale du bas du visage. Aucune valeur « idéale » n'est validée : les canons de « tiers égaux » ne se vérifient pas dans les populations étudiées.",
    improve: "Rien à atteindre. La valeur dépend de l'inclinaison de la tête et de l'expression : la barbe peut masquer le menton.",
    sources: [SOURCES.alSebaei2015, SOURCES.holland2008],
  },
  noseIntercanthalRatio: {
    id: "noseIntercanthalRatio", group: "noseMouth",
    name: "Largeur du nez / espace entre les yeux",
    what: "Distance entre les ailes du nez divisée par la distance entre les coins internes des yeux.",
    kind: "ratio", reliableWidth: 0.15, confirmWidth: 0.3, relativeWidth: true,
    meaning: "Mesure descriptive, sans cible. Elle est fortement faussée par la distance : à bout de bras, le nez paraît environ 30 % plus large qu'à 1,5 m.",
    improve: "Le levier réel est la photo : retardateur à ~1,5 m et zoom ×2. Aucun exercice ni appareil ne modifie la largeur du nez.",
    sources: [SOURCES.ward2018, SOURCES.alSebaei2015],
  },
  mouthNoseRatio: {
    id: "mouthNoseRatio", group: "noseMouth",
    name: "Largeur de la bouche / largeur du nez",
    what: "Distance entre les coins de la bouche divisée par la distance entre les ailes du nez.",
    kind: "ratio", reliableWidth: 0.15, confirmWidth: 0.3, relativeWidth: true,
    meaning: "Mesure descriptive, sans cible. Elle dépend de la distance (le nez s'élargit de près) et de l'expression (la bouche s'élargit en souriant).",
    improve: "Pour une photo fidèle : expression neutre, prise de vue à distance avec zoom.",
    sources: [SOURCES.ward2018],
  },
};

export const GROUPS: Record<MetricGroup, { title: string; intro: string }> = {
  symmetry: {
    title: "Symétrie apparente gauche-droite",
    intro: "Écarts entre les deux côtés du visage, en % de la distance entre les centres des yeux. « Gauche » et « droite » désignent les côtés de la photo.",
  },
  eyes: {
    title: "Proportions des yeux",
    intro: "Rapport mesurable de face avec des repères bien définis.",
  },
  lower: {
    title: "Proportions du bas du visage",
    intro: "Mesure verticale, sensible à l'inclinaison de la tête.",
  },
  noseMouth: {
    title: "Nez et bouche",
    intro: "Rapports affichés seulement si la photo a été prise à au moins 1 m environ.",
  },
};

/** Ce que Reflet refuse de mesurer, et pourquoi (rapport de recherche). */
export const EXCLUDED: ReadonlyArray<{ name: string; reason: string }> = [
  { name: "Score d'attractivité, « PSL », « potentiel », percentile", reason: "Aucune validité scientifique ; les juges humains eux-mêmes ne s'accordent qu'à moitié, et les modèles de notation reproduisent des biais documentés." },
  { name: "Tiers supérieur, hauteur du front", reason: "La ligne des cheveux est mal définie et souvent masquée." },
  { name: "Inclinaison des yeux (« canthal tilt »)", reason: "Une seule étude, sur des visages féminins retouchés ; très sensible à l'inclinaison de la tête." },
  { name: "Largeur/hauteur du visage (fWHR), « midface ratio », largeur des mâchoires", reason: "Repères de la mâchoire mal définis de face, forte dépendance à la focale, aucune validation." },
  { name: "Angle de la mâchoire, projection du menton, profil du nez", reason: "Ces mesures exigent une vue de profil ou une mesure 3D : impossibles sur une photo de face." },
  { name: "Valeurs en millimètres", reason: "Une photo sans objet de référence ne donne aucune échelle absolue." },
  { name: "Forme du visage classée automatiquement", reason: "Aucune preuve pour les règles de coupe « selon la forme du visage » ; c'est une convention de coiffeur." },
  { name: "Analyse de la peau (acné, taches, rides)", reason: "Les modèles de peau sont nettement moins fiables sur les peaux foncées, et ce serait un diagnostic médical." },
  { name: "Âge, sexe, origine, émotion", reason: "Inférences interdites ou inappropriées (AI Act, art. 5 ; RGPD, art. 9) et sans utilité pour vous." },
];
