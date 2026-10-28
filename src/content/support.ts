/**
 * Ressources d'aide. Les numéros marocains sont publiés de façon
 * contradictoire selon les sources (15 ou 150 pour la protection civile) ;
 * les deux sont indiqués. Aucune ligne nationale de santé mentale n'a été
 * trouvée au Maroc (TherapyRoute, consulté en octobre 2026).
 */
import type { SourceLink } from "../analysis/metrics.js";

export interface Helpline {
  country: string;
  name: string;
  number: string;
  note?: string;
}

export const HELPLINES: Helpline[] = [
  { country: "Maroc", name: "SAMU (urgences médicales, ministère de la Santé)", number: "141" },
  { country: "Maroc", name: "Protection civile (secours)", number: "15", note: "Certaines sources indiquent 150." },
  { country: "Maroc", name: "Police secours", number: "19" },
  { country: "Maroc", name: "Centre d'écoute pour les enfants (ONDE)", number: "2511" },
  { country: "Maroc", name: "Kolona Maak — écoute des femmes et des filles (UNFM)", number: "8350" },
  { country: "France", name: "Numéro national de prévention du suicide", number: "3114", note: "Gratuit, 24 h/24, 7 j/7." },
  { country: "France", name: "SAMU", number: "15" },
  { country: "Union européenne", name: "Numéro d'urgence européen", number: "112" },
];

export const SUPPORT_SOURCES: SourceLink[] = [
  { label: "Sante.fr — lignes d'écoute", url: "https://www.sante.fr/sante-mentale-2/les-lignes-decoute" },
  { label: "TherapyRoute — lignes de crise au Maroc", url: "https://www.therapyroute.com/article/suicide-hotlines-and-crisis-lines-in-morocco-by-therapyroute" },
  { label: "NHS — dysmorphie corporelle", url: "https://www.nhs.uk/mental-health/conditions/body-dysmorphia/" },
];

/** Signes décrits par le NHS pour la dysmorphie corporelle (paraphrasés). */
export const BDD_SIGNS: string[] = [
  "Penser très souvent à un détail de son apparence que les autres remarquent peu ou pas.",
  "Vérifier son reflet de façon répétée, ou au contraire éviter les miroirs et les photos.",
  "Se comparer sans cesse aux autres.",
  "Cacher une partie de son visage, ou éviter des sorties à cause de son apparence.",
  "Ressentir une détresse qui empiète sur le sommeil, les études, le travail ou les relations.",
];
