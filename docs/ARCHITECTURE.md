# Architecture et décisions

## Principes

1. **Le traitement est local.** Pas de serveur applicatif, pas d'API, pas de tiers. Seul un hébergement statique est nécessaire.
2. **Aucune mesure n'est fabriquée.** Une photo qui échoue aux contrôles ne produit aucun chiffre. Sans modèle, l'application passe au repérage manuel au lieu d'un faux résultat.
3. **L'application n'agrège pas.** Elle n'a ni note globale ni percentile. Chaque mesure a son propre niveau de certitude.
4. **Le code est séparé par rôle.** `analysis/`, `recommendations/` et `habits/` ne dépendent pas du DOM et sont testés sous Node. `ui/` ne fait qu'afficher. `storage/` est le seul module qui écrit.

## Pile technique

| Choix | Pourquoi |
|---|---|
| TypeScript compilé par `tsc` en modules ES natifs, sans framework ni bundler | Aucune dépendance d'exécution, environ 290 Ko de JS non minifié, rapide sur les téléphones modestes. Le code est auditable tel quel. |
| MediaPipe Face Landmarker (`@mediapipe/tasks-vision` 0.10.21, mode IMAGE) | Recommandé par la recherche. 478 repères, pose et expressions. Code sous Apache 2.0. InsightFace et le modèle dlib à 68 points sont exclus parce que leurs licences interdisent l'usage commercial. |
| Repérage manuel guidé | Solution de remplacement honnête et toujours disponible. |
| `node:test` et Playwright | Ce sont les outils disponibles hors ligne. Vitest pourra les remplacer. |

## Pipeline d'analyse

1. **Fichier.** Taille au plus 15 Mo, format reconnu par sa signature binaire (JPEG, PNG, WebP, HEIC), jamais par son extension.
2. **Décodage.** `createImageBitmap(..., { imageOrientation: "from-image" })`, puis réduction à 1 280 px et redessin sur un canvas. Les métadonnées EXIF et GPS ne sont jamais conservées. Une empreinte de pixels refuse les doublons.
3. **Repères.** MediaPipe ou saisie manuelle produit 11 points nommés selon l'image : L = gauche de la photo.
4. **Repère du visage.** L'axe X passe par les centres des yeux, ce qui corrige le roulis. L'origine est le milieu des coins internes des yeux. L'unité D est la distance entre les centres des yeux. Une différence de hauteur entre les yeux ne se distingue pas d'une inclinaison de la tête, elle n'est donc jamais mesurée.
5. **Qualité.** Six contrôles :
   - taille du visage ;
   - netteté (variance du laplacien rapportée à la variance des intensités) ;
   - exposition ;
   - éclairage latéral ;
   - roulis ;
   - en mode auto : lacet, tangage, yeux fermés, sourire et bouche ouverte ; en mode manuel : déclarations de l'utilisateur.
6. **Incertitude.** Monte-Carlo sur 300 tirages avec un bruit gaussien par repère :
   - σ = 0,023 pour une photo conforme : erreur moyenne de 2,9 % sur 300-W ;
   - σ = 0,032 pour une photo dégradée : 4,0 % sur WFLW ;
   - σ = 0,020 en mode manuel : hypothèse.

   Ces valeurs sont des fractions de la distance entre les coins externes des yeux. Le générateur est déterministe : la même photo donne toujours le même intervalle.
7. **Séance.** La médiane des photos sert d'estimation. L'incertitude s'écrit `½ largeur = √((1,645·0,5·σ_a priori)² + (t·s/√n)²)` : une part systématique (50 %, hypothèse) s'ajoute à la dispersion observée entre les photos.
8. **Niveaux.**
   - **Incertain** (valeur masquée) si la largeur dépasse le seuil de la mesure, ou si un contrôle masquant s'applique : pose, expression, distance, lunettes.
   - **Fiable** seulement avec au moins 3 photos concordantes, sans condition défavorable, et une largeur sous le seuil de fiabilité.
   - **À confirmer** dans tous les autres cas.

## Mesures

| Affichées | Masquées dans certains cas | Jamais calculées |
|---|---|---|
| Écarts gauche-droite : coins des yeux, ailes du nez, coins de la bouche, largeur des yeux, axe (base du nez, bouche, menton), angle bouche/yeux · largeur d'un œil / espace intercanthal · lèvre supérieure / bas du visage | Nez/intercanthal et bouche/nez si la photo n'a pas été prise à environ 1 m ou plus (distorsion de 30 % à 30 cm) | Score, PSL, tiers supérieur, canthal tilt, fWHR, mâchoire, profil, millimètres, forme du visage, peau, âge, sexe, origine, émotion |

## Stockage

| Donnée | Où | Durée |
|---|---|---|
| Photos, repères | Mémoire uniquement | Effacés dès qu'on quitte l'analyse ou les résultats |
| Réglages, âge déclaré, questionnaire, habitudes | `localStorage` (`reflet:*`) | Jusqu'à suppression |
| Dates des analyses | `localStorage` | 7 jours (garde-fou d'usage répété) |
| Historique des mesures (facultatif, désactivé par défaut) | IndexedDB, chiffré en AES-GCM 256 avec une clé non extractible | Jusqu'à suppression, 52 séances au maximum |

## Sécurité

- CSP : `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; …`, à la fois en balise meta et en en-tête HTTP.
- Aucun `innerHTML` avec des données : tout passe par `textContent` ou `createElement`.
- Aucun secret côté client, puisqu'il n'y a aucun service à appeler.
- Les fichiers importés sont validés par leur signature binaire et limités en taille.

## Mineurs

L'âge est déclaré sans valeur présélectionnée. Avant 18 ans, l'analyse est désactivée et le programme reçoit des notes adaptées : sommeil de 8 à 10 heures, 60 minutes d'activité par jour, zéro alcool, avis d'un parent ou d'un médecin pour l'acné, pas de blanchiment des dents. Ce choix de conception vient du Children's Code de l'ICO. Ce n'est pas une obligation légale identifiée.
