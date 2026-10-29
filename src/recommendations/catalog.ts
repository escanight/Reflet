/**
 * Catalogue des recommandations. Chaque entrée précise son objectif, sa mise
 * en pratique, son niveau de preuve, ses limites et ses sources.
 * Contenu tiré du rapport de recherche (étape 1) ; aucune source inventée.
 * Aucun médicament n'est prescrit, aucun diagnostic n'est posé.
 */
import type { SourceLink } from "../analysis/metrics.js";

export type Evidence = "etabli" | "plausible" | "expert" | "nonprouve";

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  etabli: "Preuve établie",
  plausible: "Preuve limitée",
  expert: "Avis d'experts",
  nonprouve: "Non prouvé",
};

export const EVIDENCE_HELP: Record<Evidence, string> = {
  etabli: "Appuyé par des essais contrôlés, des méta-analyses ou des recommandations officielles fortes.",
  plausible: "Quelques études, souvent petites ou observationnelles : l'effet est possible mais incertain.",
  expert: "Recommandé par des organismes de référence, sans essai dédié à cet effet précis.",
  nonprouve: "Aucune preuve solide n'a été trouvée.",
};

export type Category = "quotidien" | "hebdo" | "soins" | "presentation" | "bienetre";

export const CATEGORY_LABEL: Record<Category, string> = {
  quotidien: "Routine quotidienne",
  hebdo: "Routine hebdomadaire",
  soins: "Soins et hygiène",
  presentation: "Coiffure, barbe et présentation",
  bienetre: "Bien-être",
};

export type Budget = "minimal" | "modere" | "confortable";
export type Goal = "peau" | "rasage" | "cheveux" | "sommeil" | "photo" | "forme" | "dents";

export interface Profile {
  adult: boolean;
  skin: "grasse" | "seche" | "mixte" | "sensible" | "nsp";
  acne: boolean;
  spots: boolean;
  facialHair: "rase" | "courte" | "longue" | "aucune";
  hair: "raides" | "ondules" | "boucles" | "crepus" | "tres-courts" | "nsp";
  scalpOily: boolean;
  budget: Budget;
  minutesPerDay: 5 | 10 | 20;
  goals: Goal[];
  smoker: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  adult: true,
  skin: "nsp",
  acne: false,
  spots: false,
  facialHair: "aucune",
  hair: "nsp",
  scalpOily: false,
  budget: "minimal",
  minutesPerDay: 10,
  goals: ["peau", "sommeil", "photo"],
  smoker: false,
};

export interface Advice {
  id: string;
  category: Category;
  goal: Goal | "base";
  title: string;
  objective: string;
  how: string[];
  evidence: Evidence;
  limits: string;
  sources: SourceLink[];
  minutes?: number;
  applies?: (p: Profile) => boolean;
  /** Variante selon le budget déclaré. */
  budget?: Partial<Record<Budget, string>>;
  /** Variante pour les moins de 18 ans. */
  minorNote?: string;
}

const S = {
  hughes2013: { label: "Hughes et al. 2013 — essai randomisé de Nambour (Ann Intern Med)", url: "https://read.qxmd.com/read/23732711/sunscreen-and-prevention-of-skin-aging-a-randomized-trial" },
  aadSunscreen: { label: "AAD — Comment appliquer un écran solaire", url: "https://aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen" },
  aadSpots: { label: "AAD — Estomper les taches brunes", url: "https://aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots" },
  aadWash: { label: "AAD — Se laver le visage", url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101" },
  aadAcneGuideline: { label: "AAD — Recommandations 2024 sur l'acné", url: "https://www.newswise.com/articles/american-academy-of-dermatology-issues-updated-guidelines-for-the-management-of-acne" },
  aadAcneTime: { label: "AAD — Délai d'efficacité des traitements de l'acné", url: "https://www.aad.org/public/diseases/acne/DIY/wont-clear" },
  vidalAcne: { label: "Vidal — Médicaments locaux de l'acné", url: "https://www.vidal.fr/maladies/peau-cheveux-ongles/acne/medicaments-locaux.html" },
  aadHair: { label: "AAD — Conseils pour des cheveux en bonne santé", url: "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips" },
  aadBeard: { label: "AAD — Entretenir sa barbe", url: "https://aad.org/public/everyday-care/skin-care-secrets/face/healthy-beard" },
  aadRazor: { label: "AAD — Boutons et feu du rasoir", url: "https://www.aad.org/public/everyday-care/skin-care-basics/hair/razor-bump-remedies" },
  nidirect: { label: "nidirect (NHS Irlande du Nord) — Poils incarnés", url: "https://nidirect.gov.uk/conditions/ingrown-hairs" },
  nhsTeeth: { label: "NHS — Bien se brosser les dents", url: "https://www.nhs.uk/live-well/healthy-body/how-to-keep-your-teeth-clean/" },
  ufsbd: { label: "UFSBD — Recommandations d'hygiène bucco-dentaire", url: "https://ufsbd.fr/wp-content/uploads/2025/03/UFSBD-fiche-patient-Recommandations.pdf" },
  cochraneFloss: { label: "Cochrane — Brossettes et fil interdentaires", url: "https://www.cochrane.org/CD012018/ORAL_interdental-brushing-and-flossing-oral-health" },
  aasm: { label: "AASM/SRS — Durée de sommeil recommandée chez l'adulte", url: "https://www.aasm.org/resources/pdf/adultsleepdurationconsensus.pdf" },
  aasmTeen: { label: "AASM — Sommeil des enfants et adolescents", url: "https://aasm.org/?p=2098" },
  spfSleep: { label: "Santé publique France — Sommeil", url: "https://www.santepubliquefrance.fr/sommeil/les-enjeux-de-sante" },
  beautySleep: { label: "Axelsson et al. 2010 « Beauty sleep » (BMJ) — Karolinska", url: "https://news.ki.se/a-good-nights-sleep-the-key-to-being-attractive" },
  sundelin2017: { label: "Sundelin et al. 2017 — privation de sommeil et attrait perçu", url: "https://doaj.org/article/98e2dc7b6a6d46e39e01920966529f86" },
  who2020: { label: "OMS 2020 — Activité physique et sédentarité", url: "https://www.ncbi.nlm.nih.gov/books/NBK566048/" },
  spfFood: { label: "Santé publique France — Repères alimentaires", url: "https://www.santepubliquefrance.fr/sites/default/files/cadic_files/documents/spf00006444.pdf" },
  guyuron: { label: "Guyuron et al. 2013 — jumeaux et tabac", url: "https://www.newswise.com/articles/face-it-twins-who-smoke-look-older-says-study-in-plastic-and-reconstructive-surgery" },
  spfAlcohol: { label: "Santé publique France — Repères alcool", url: "https://www.santepubliquefrance.fr/alcool/comment-reduire-les-risques-de-la-consommation-dalcool" },
  ward2018: { label: "Ward et al. 2018 — distorsion des selfies", url: "https://medicalresearch.com/?p=40302" },
  juhl2018: { label: "Juhl et al. 2018 — produits laitiers et acné (méta-analyse)", url: "https://www.mdpi.com/2072-6643/10/8/1049/xml" },
} satisfies Record<string, SourceLink>;

export const ADVICE: Advice[] = [
  {
    id: "spf", category: "quotidien", goal: "base",
    title: "Protection solaire chaque matin",
    objective: "Limiter le vieillissement cutané visible et les taches liées au soleil.",
    how: [
      "Un écran à large spectre, SPF 30 ou plus, sur le visage et le cou, même par temps nuageux.",
      "Environ une cuillère à café pour le visage ; renouveler toutes les 2 heures en extérieur.",
      "Peau sujette aux taches : un écran teinté à l'oxyde de fer bloque aussi la lumière visible.",
    ],
    evidence: "etabli",
    limits: "L'essai de référence (Australie, adultes de moins de 55 ans) a mesuré 24 % de vieillissement en moins sur 4,5 ans ; son applicabilité aux peaux foncées (phototypes IV à VI) n'a pas été vérifiée.",
    sources: [S.hughes2013, S.aadSunscreen, S.aadSpots],
    minutes: 1,
    budget: {
      minimal: "Tout écran SPF 30+ « large spectre » répond à la recommandation ; la marque n'est pas un critère.",
      modere: "Choisis une texture agréable (fluide, gel) : c'est celle que tu utiliseras vraiment.",
      confortable: "Un écran teinté peut remplacer un produit de teint si tu en utilises.",
    },
  },
  {
    id: "cleanse", category: "quotidien", goal: "peau",
    title: "Nettoyage doux du visage",
    objective: "Retirer sueur, sébum et écran solaire sans irriter la peau.",
    how: [
      "Deux fois par jour au maximum, et après une forte transpiration.",
      "Nettoyant doux, eau tiède, du bout des doigts, sans frotter ; sécher en tamponnant.",
      "Arrêter tout produit qui pique ou brûle.",
    ],
    evidence: "expert",
    limits: "Se laver plus souvent n'améliore pas la peau ; l'irritation peut elle-même provoquer des taches, surtout sur les peaux mates et foncées.",
    sources: [S.aadWash, S.aadSpots],
    minutes: 2,
  },
  {
    id: "moisturize", category: "quotidien", goal: "peau",
    title: "Hydratant après la toilette",
    objective: "Limiter la sensation de tiraillement et l'irritation.",
    how: ["Une petite quantité de crème non parfumée sur peau encore légèrement humide."],
    evidence: "expert",
    limits: "Utile surtout pour les peaux sèches ou irritées ; inutile d'empiler plusieurs produits.",
    sources: [S.aadWash],
    minutes: 1,
    applies: (p) => p.skin === "seche" || p.skin === "sensible" || p.skin === "mixte",
  },
  {
    id: "acne", category: "soins", goal: "peau",
    title: "Acné : les options qui ont fait leurs preuves",
    objective: "Savoir quoi demander au pharmacien ou au médecin, et combien de temps attendre.",
    how: [
      "Les recommandations 2024 de l'Académie américaine de dermatologie (AAD) soutiennent fortement le peroxyde de benzoyle et les rétinoïdes locaux ; l'acide salicylique n'a qu'une recommandation conditionnelle.",
      "Compter au moins 4 à 6 semaines pour une amélioration et 2 à 3 mois pour un éclaircissement.",
      "Demandez conseil à un pharmacien ou à un médecin : le statut de vente (avec ou sans ordonnance) varie selon les pays et les dosages.",
    ],
    evidence: "etabli",
    limits: "Reflet n'évalue pas la sévérité d'une acné et ne prescrit rien. Les rétinoïdes sont contre-indiqués en cas de grossesse ou de projet de grossesse. Les régimes, vitamines, peelings et microneedling n'ont pas de preuves suffisantes selon l'AAD.",
    sources: [S.aadAcneGuideline, S.aadAcneTime, S.vidalAcne],
    applies: (p) => p.acne,
    minorNote: "Avant 18 ans, parlez-en à un parent et à un médecin ou un pharmacien avant d'utiliser un traitement.",
  },
  {
    id: "diet-acne", category: "soins", goal: "peau",
    title: "Alimentation et acné : ce qu'on sait vraiment",
    objective: "Éviter les régimes restrictifs inutiles.",
    how: ["Pas d'éviction alimentaire stricte sans avis médical : le lien avec les produits laitiers est seulement observationnel et faible."],
    evidence: "nonprouve",
    limits: "Les études disponibles sont observationnelles et biaisées (rapport de cotes ≈ 1,25) : elles ne prouvent pas qu'un changement d'alimentation améliore la peau.",
    sources: [S.juhl2018, S.aadAcneGuideline],
    applies: (p) => p.acne,
  },
  {
    id: "shave", category: "presentation", goal: "base",
    title: "Technique de rasage contre l'irritation",
    objective: "Réduire boutons, feu du rasoir et poils incarnés.",
    how: [
      "Raser après la douche, sur poil mouillé, avec un gel ou une mousse ; jamais à sec.",
      "Raser dans le sens de la pousse, sans repasser plusieurs fois au même endroit.",
      "Changer de lame toutes les 5 à 7 utilisations ; rincer la lame à chaque passage.",
    ],
    evidence: "expert",
    limits: "Les poils drus ou frisés s'incarnent plus souvent. Si les boutons persistent, laisser pousser la barbe quelques semaines les réduit ; non traitée, la pseudofolliculite peut laisser des cicatrices : consultez.",
    sources: [S.aadRazor, S.nidirect],
    minutes: 5,
    applies: (p) => p.facialHair === "rase" || p.facialHair === "courte",
  },
  {
    id: "beard", category: "presentation", goal: "base",
    title: "Entretien de la barbe",
    objective: "Une barbe propre et une peau saine dessous.",
    how: [
      "Laver la barbe chaque jour avec un nettoyant doux et hydrater la peau en dessous.",
      "Peau sèche : quelques gouttes d'huile ; peau à tendance acnéique : après-shampooing non comédogène, sans huile.",
      "Tailler le contour régulièrement (la ligne du cou et des joues structure la barbe).",
    ],
    evidence: "expert",
    limits: "Aucun essai n'a évalué les produits pour barbe ; ce sont des conseils de dermatologues. Le style (longueur, contour) relève de tes goûts.",
    sources: [S.aadBeard],
    minutes: 2,
    applies: (p) => p.facialHair === "courte" || p.facialHair === "longue",
    budget: { minimal: "Un nettoyant doux pour le visage suffit aussi pour la barbe ; une tondeuse à sabots couvre la taille." },
  },
  {
    id: "brows", category: "presentation", goal: "base",
    title: "Sourcils : entretien simple et sécurité",
    objective: "Un entretien qui respecte ton style, sans risque pour les yeux.",
    how: [
      "Si tu le souhaites : retire seulement les poils isolés entre les sourcils, à la pince, à la lumière du jour.",
      "Ne jamais utiliser de teinture capillaire permanente sur les sourcils ou les cils.",
    ],
    evidence: "expert",
    limits: "Les teintures permanentes ont causé des lésions oculaires allant jusqu'à la cécité (FDA). Le khôl traditionnel est lié à des intoxications au plomb chez l'enfant.",
    sources: [{ label: "FDA — Sécurité des cosmétiques pour les yeux", url: "https://www.fda.gov/cosmetics/cosmetic-products/eye-cosmetic-safety" }],
  },
  {
    id: "hairwash", category: "hebdo", goal: "cheveux",
    title: "Lavage adapté à ton cuir chevelu",
    objective: "Un cuir chevelu propre sans assécher les longueurs.",
    how: [
      "Cuir chevelu gras, cheveux raides : un lavage quotidien est possible.",
      "Cheveux bouclés, crépus ou secs : laver « au besoin », souvent une à deux fois par semaine.",
      "Shampooing sur le cuir chevelu, après-shampooing sur les longueurs ; chaleur des appareils réglée sur basse ou moyenne, avec protecteur.",
    ],
    evidence: "expert",
    limits: "Il n'existe pas de fréquence universelle ; ajustez selon la sensation du cuir chevelu.",
    sources: [S.aadHair],
    applies: (p) => p.hair !== "tres-courts" || p.scalpOily,
  },
  {
    id: "haircut", category: "presentation", goal: "cheveux",
    title: "Coupe de cheveux : régularité plutôt que « règle de forme du visage »",
    objective: "Une coupe nette et facile à entretenir.",
    how: [
      "Montre au coiffeur 2 ou 3 photos de coupes qui te plaisent, sur des cheveux de même texture que les tiens.",
      "Demande combien de temps la coupe reste nette et planifie le rendez-vous suivant en conséquence.",
      "Indique le temps que tu es prêt à consacrer au coiffage chaque matin.",
    ],
    evidence: "nonprouve",
    limits: "Aucune preuve n'a été trouvée pour les règles de coupe « selon la forme du visage » : c'est une convention de coiffeur. Une chute de cheveux inhabituelle relève d'un médecin.",
    sources: [S.aadHair],
    budget: { minimal: "Une tondeuse à sabots permet d'entretenir une coupe courte entre deux passages chez le coiffeur." },
  },
  {
    id: "teeth", category: "quotidien", goal: "dents",
    title: "Brossage au fluor, deux fois par jour",
    objective: "Prévenir caries et problèmes de gencives ; un sourire entretenu.",
    how: [
      "2 minutes, deux fois par jour, avec un dentifrice d'au moins 1 350 ppm de fluor (adultes).",
      "Cracher sans rincer, pour laisser le fluor agir.",
      "Nettoyer les espaces entre les dents avant le brossage (brossettes ou fil).",
      "Voir un dentiste au moins une fois par an.",
    ],
    evidence: "etabli",
    limits: "Le bénéfice du nettoyage interdentaire est jugé peu certain par Cochrane. Pas de blanchiment avant 18 ans ; au-delà de 0,1 % de peroxyde d'hydrogène, le blanchiment relève du dentiste.",
    sources: [S.nhsTeeth, S.ufsbd, S.cochraneFloss],
    minutes: 4,
  },
  {
    id: "sleep", category: "bienetre", goal: "sommeil",
    title: "Dormir suffisamment",
    objective: "Récupérer ; le manque de sommeil se voit sur le visage.",
    how: [
      "Adultes : au moins 7 heures par nuit.",
      "Horaires réguliers, écrans coupés environ une heure avant le coucher, pas de caféine après 14 h, chambre fraîche (18–20 °C).",
    ],
    evidence: "etabli",
    limits: "Les études sur l'apparence sont petites : elles montrent que la privation de sommeil rend le visage plus fatigué et moins attrayant aux yeux d'inconnus, pas que dormir au-delà de son besoin embellit. Les conseils d'hygiène du sommeil relèvent de l'avis d'experts.",
    sources: [S.aasm, S.spfSleep, S.beautySleep, S.sundelin2017],
    minorNote: "Entre 13 et 18 ans, l'AASM recommande 8 à 10 heures de sommeil par nuit.",
  },
  {
    id: "activity", category: "bienetre", goal: "forme",
    title: "Bouger chaque semaine",
    objective: "Santé générale, énergie et sommeil.",
    how: [
      "Adultes : 150 à 300 minutes d'activité modérée par semaine (marche rapide, vélo…).",
      "Renforcement musculaire au moins 2 jours par semaine.",
    ],
    evidence: "etabli",
    limits: "L'activité physique est recommandée pour la santé ; aucune source ne montre qu'elle rend un visage plus attrayant. Reflet ne fixe aucun objectif de poids ni de « graisse du visage ».",
    sources: [S.who2020],
    minorNote: "Entre 5 et 17 ans, l'OMS recommande en moyenne 60 minutes d'activité par jour.",
  },
  {
    id: "food", category: "bienetre", goal: "forme",
    title: "Repères alimentaires simples",
    objective: "Une alimentation variée, sans régime extrême.",
    how: [
      "Au moins 5 fruits et légumes par jour, des légumineuses deux fois par semaine, l'eau comme boisson principale.",
      "Petit budget : les surgelés nature, les conserves de légumes et l'eau du robinet comptent.",
    ],
    evidence: "expert",
    limits: "Aucun aliment ni complément ne remodèle le visage. Le collagène en complément ne montre pas d'effet dans les essais de bonne qualité indépendants de l'industrie.",
    sources: [S.spfFood, { label: "Myung & Park 2025 — compléments de collagène (synthèse)", url: "https://nutraingredients.com/Article/2025/08/26/industry-reacts-to-meta-analysis-concluding-collagen-supplements-show-no-proven-benefit-for-skin-aging" }],
  },
  {
    id: "tobacco", category: "bienetre", goal: "base",
    title: "Tabac : le vieillissement se voit",
    objective: "Information, sans jugement.",
    how: ["Si tu veux arrêter ou réduire, un médecin ou un pharmacien peut t'accompagner (substituts, suivi)."],
    evidence: "plausible",
    limits: "Dans une étude de 79 paires de jumeaux, cinq ans d'écart de tabagisme suffisaient à faire paraître le fumeur plus âgé ; c'est une étude observationnelle.",
    sources: [S.guyuron],
    applies: (p) => p.smoker,
  },
  {
    id: "alcohol", category: "bienetre", goal: "base",
    title: "Alcool : repères",
    objective: "Connaître les repères de consommation à moindre risque.",
    how: ["Adultes : 10 verres standard par semaine au maximum, pas plus de 2 par jour, et des jours sans alcool."],
    evidence: "expert",
    limits: "Ces repères visent la santé ; ils ne sont pas spécifiques à l'apparence.",
    sources: [S.spfAlcohol],
    minorNote: "Avant 18 ans, le repère est zéro alcool.",
  },
  {
    id: "photo", category: "hebdo", goal: "photo",
    title: "Des photos qui te ressemblent",
    objective: "Éviter qu'une déformation optique soit prise pour un trait du visage.",
    how: [
      "Retardateur ou appui à environ 1,5 m, avec le zoom ×2, plutôt qu'à bout de bras.",
      "Objectif à hauteur des yeux, tête droite, face à une fenêtre en lumière du jour indirecte, sans flash.",
      "Pour suivre une évolution : mêmes lieu, heure, distance et expression à chaque fois.",
    ],
    evidence: "etabli",
    limits: "À 30 cm, la base du nez paraît 29 à 30 % plus large qu'à 1,5 m. Cette distorsion vient de l'optique, pas de ton visage.",
    sources: [S.ward2018],
  },
];

/** Pratiques à éviter, avec sources. Affichées dans le glossaire critique. */
export const WARNINGS: ReadonlyArray<{ title: string; text: string; source: SourceLink }> = [
  { title: "Bone smashing (frapper ses os)", text: "Aucun fondement. Les chirurgiens décrivent fractures, lésions nerveuses, hématomes à drainer et défiguration permanente.", source: { label: "Mater Hospital, avril 2026", url: "https://mater.org.au/about-us/news/mater-news/2026/april/mater-doctors-warn-of-dangers-of-bone-smashing-trend" } },
  { title: "Chewing-gums durs et exerciseurs de mâchoire", text: "Effets mineurs et temporaires au mieux ; risque pour l'articulation de la mâchoire.", source: { label: "Dentistes interrogés par CNBC/NBC", url: "https://www.nbcconnecticut.com/news/business/money-report/gen-z-boys-are-using-hard-gum-to-try-and-chisel-their-jawlines-dentists-say-it-may-do-more-harm-than-good/3355819/" } },
  { title: "SARM et « stéroïdes » vendus comme compléments", text: "Associés par la FDA à des atteintes graves du foie, infarctus, AVC, troubles psychiatriques et infertilité.", source: { label: "FDA", url: "https://www.fda.gov/drugs/fraudulent-products/certain-bodybuilding-products-put-consumers-risk-heart-attack-stroke-serious-liver-damage-and-more" } },
  { title: "Crèmes éclaircissantes hors circuit contrôlé", text: "Peuvent contenir du mercure, de l'hydroquinone ou des corticoïdes ; mises en garde de l'OMS, de l'ANSM et du Centre antipoison du Maroc.", source: { label: "OMS — mercure dans les produits éclaircissants", url: "https://www.who.int/publications/i/item/mercury-in-skin-lightening-products" } },
  { title: "Melanotan (injections « bronzantes »)", text: "Produit non autorisé ; l'agence britannique du médicament met en garde contre son usage.", source: { label: "MHRA via Cosmetics Design Europe", url: "https://cosmeticsdesign-europe.com/Article/2013/09/04/MHRA-warns-against-melanotan-tanning-injections" } },
  { title: "Microneedling à domicile", text: "Risques d'infection et de cicatrices ; la FDA n'a autorisé aucun dispositif contre la chute de cheveux.", source: { label: "FDA", url: "https://www.fda.gov/consumers/consumer-updates/microneedling-devices-getting-point-benefits-risks-and-safety" } },
  { title: "Se déshydrater pour « dessiner » le visage", text: "Une perte d'eau de 1 à 2 % de la masse corporelle dégrade déjà l'humeur et l'attention.", source: { label: "Liska et al. 2019", url: "https://mdpi.com/2072-6643/11/1/70" } },
  { title: "Cabines UV", text: "Cancérogènes avérés (groupe 1) ; interdites aux mineurs en France.", source: { label: "Santé publique France — UV", url: "https://www.santepubliquefrance.fr/uv/les-enjeux-de-sante" } },
  { title: "Médicaments contre la chute de cheveux sans suivi", text: "Le finastéride 1 mg n'est délivré que sur prescription ; en France, une attestation co-signée est exigée depuis avril 2026 en raison de risques d'idées suicidaires et de troubles sexuels.", source: { label: "ANSM", url: "https://ansm.sante.fr/uploads/2026/02/05/20260205-dhpc-finasteride-1mg.pdf" } },
];
