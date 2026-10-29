export const STATUS_LABEL = {
    etabli: "Établi",
    hypothese: "Hypothèse limitée",
    tendance: "Tendance sans base scientifique",
    nondemontre: "Non démontré",
    dangereux: "Dangereux",
};
export const GLOSSARY = [
    {
        term: "Échelle PSL, « sub3/sub5 », « HTN », « Chad », « mogging »",
        status: "tendance",
        text: "Échelles et paliers nés sur trois forums incel-adjacents aujourd'hui fermés. Des criminologues les décrivent comme un cadre pseudoscientifique qui codifie une hiérarchie ; « sub5 » sert aussi de mot codé pour contourner la modération. Aucune étude ne les valide, et même leur plage numérique varie selon les sources.",
        sources: [{ label: "Université de Portsmouth (2025)", url: "https://www.port.ac.uk/news-events-and-blogs/news/why-incel-social-media-accounts-are-encouraging-young-people-towards-extreme-looksmaxxing-procedures" }],
    },
    {
        term: "Score d'attractivité par IA",
        status: "nondemontre",
        text: "Les juges humains ne s'accordent qu'à moitié deux à deux (fiabilité 0,47 à 0,71) et le goût personnel pèse autant que le goût partagé. Les modèles de notation reproduisent des biais documentés selon l'origine. Les grands modèles d'IA surnotent et s'accordent mal avec les humains sur les valeurs absolues.",
        sources: [
            { label: "Langlois et al. 2000 (méta-analyse)", url: "https://gwern.net/docs/www/www.jonathanstray.com/97467f7930b9decf9a1d28071aa425861266436f.pdf" },
            { label: "Hönekopp 2006", url: "https://Www.Gwern.net/doc/psychology/2006-honekopp.pdf" },
            { label: "Hamel & Busch 2025 — biais des modèles de beauté", url: "https://arxiv.org/html/2509.24138v1" },
        ],
    },
    {
        term: "Symétrie",
        status: "etabli",
        text: "Liée à l'attractivité avec un effet modeste (r ≈ 0,25). Les visages rendus parfaitement symétriques sont jugés moins attrayants. Sur 4 732 scans 3D d'adolescents, l'asymétrie n'était pas associée à la santé : elle ne révèle ni « bons gènes » ni état de santé.",
        sources: [
            { label: "Rhodes 2006", url: "https://homepages.uc.edu/~martinj/Taste%20Food%20&%20Wine/Aesthetics_of_Food_&_Drink/Rhodes%20-%20Evolutions%20of%20Facial%20Beauty.pdf" },
            { label: "Pound et al. 2014", url: "https://orca.cardiff.ac.uk/63362" },
        ],
    },
    {
        term: "Proximité de la moyenne",
        status: "etabli",
        text: "Le prédicteur structurel le plus solide de l'attractivité perçue : les visages proches de la moyenne d'une population plaisent. La diversité des visages est normale, et le « toujours plus » (mâchoire plus large, etc.) contredit les données.",
        sources: [
            { label: "Rhodes 2006", url: "https://homepages.uc.edu/~martinj/Taste%20Food%20&%20Wine/Aesthetics_of_Food_&_Drink/Rhodes%20-%20Evolutions%20of%20Facial%20Beauty.pdf" },
            { label: "Johnston et al. 2005 — position de la mandibule", url: "https://pure.qub.ac.uk/en/publications/the-influence-of-mandibular-prominence-on-facial-attractiveness/" },
        ],
    },
    {
        term: "Nombre d'or, masque de Marquardt",
        status: "nondemontre",
        text: "Réfuté : le masque décrit au mieux des visages de femmes blanches « masculinisés » de type mannequin, s'adapte mal aux autres populations et repose sur une méthode défaillante.",
        sources: [
            { label: "Holland 2008", url: "https://dx.doi.org/10.1007/s00266-007-9080-z" },
            { label: "Faderani et al. 2024", url: "https://dbpia.nl.go.kr/asj/article/44/1/NP1/7269091" },
        ],
    },
    {
        term: "Tiers du visage égaux, « cinq yeux »",
        status: "nondemontre",
        text: "Canons artistiques néoclassiques qui ne se vérifient pas comme normes : ils varient fortement selon les populations étudiées.",
        sources: [{ label: "Al-Sebaei 2015", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4369102/" }],
    },
    {
        term: "Canthal tilt (inclinaison des yeux)",
        status: "hypothese",
        text: "Une seule étude, sur des visages féminins retouchés en choix forcé. Aucune base pour noter quelqu'un, encore moins un visage masculin. La mesure varie avec l'inclinaison de la tête : Reflet ne la calcule pas.",
        sources: [{ label: "Bashour & Geist 2007", url: "https://hsrc.himmelfarb.gwu.edu/smhs_ophthalm_facpubs/302" }],
    },
    {
        term: "fWHR (largeur/hauteur du visage)",
        status: "hypothese",
        text: "Différence entre sexes minime (d ≈ 0,1) et contestée ; l'écart observé tient dans la distorsion due à la focale, et le rapport suit surtout le poids corporel. Ce n'est pas un indicateur fiable d'hormones ni de dominance.",
        sources: [
            { label: "Frontiers in Endocrinology 2018", url: "https://www.frontiersin.org/journals/endocrinology/articles/10.3389/fendo.2018.00227/full" },
            { label: "Jones et al. 2025 (PsyPost)", url: "https://www.psypost.org/why-a-popular-facial-measurement-fails-to-predict-male-dominance/" },
        ],
    },
    {
        term: "« Hunter eyes », « midface ratio », longueur du ramus",
        status: "tendance",
        text: "Aucune étude évaluée par des pairs n'a été trouvée pour ces notions.",
        sources: [],
    },
    {
        term: "Mewing (posture de la langue)",
        status: "nondemontre",
        text: "La British Orthodontic Society affirme qu'aucune preuve ne montre que la posture de la langue change la forme du visage. Le principal promoteur de l'« orthotropie » a été radié par le General Dental Council en 2024, radiation confirmée par la High Court en mai 2026.",
        sources: [
            { label: "Mew v GDC [2026] EWHC 1116 (Admin)", url: "https://caselaw.nationalarchives.gov.uk/ewhc/admin/2026/1116" },
            { label: "British Orthodontic Society via GDPUK", url: "https://www.gdpuk.com/archived-news/ftp-case-prompts-orthodontic-society-to-out-spurious-claims/" },
        ],
    },
    {
        term: "Bone smashing",
        status: "dangereux",
        text: "Aucun fondement. Fractures, lésions nerveuses, hématomes et défiguration permanente sont décrits par des chirurgiens.",
        sources: [{ label: "Mater Hospital, avril 2026", url: "https://mater.org.au/about-us/news/mater-news/2026/april/mater-doctors-warn-of-dangers-of-bone-smashing-trend" }],
    },
    {
        term: "Thumb-pulling",
        status: "tendance",
        text: "Aucune source fiable trouvée. Reflet n'affirme rien à ce sujet et ne le recommande jamais.",
        sources: [],
    },
    {
        term: "Effet de halo",
        status: "etabli",
        text: "Les personnes jugées attrayantes reçoivent en moyenne des jugements un peu plus favorables (d ≈ 0,5), mais les distributions se chevauchent largement : l'apparence ne détermine pas une vie.",
        sources: [{ label: "Langlois et al. 2000", url: "https://gwern.net/docs/www/www.jonathanstray.com/97467f7930b9decf9a1d28071aa425861266436f.pdf" }],
    },
];
