# Reflet — le miroir honnête

Reflet est une application web gratuite, mobile d'abord, d'analyse faciale **locale** et de programme d'habitudes.

- **Aucune note d'attractivité.** Pas de score, pas de PSL, pas de « potentiel ». Chaque mesure est présentée seule, avec sa marge d'erreur et un niveau de certitude (Fiable, À confirmer, Incertain). Une valeur incertaine est masquée.
- **100 % dans le navigateur.** Aucune photo, aucun repère ni aucune mesure n'est envoyé. Une politique CSP `connect-src 'self'` l'impose techniquement. Aucune photo n'est jamais enregistrée.
- **Seulement des leviers modifiables.** Le programme couvre la protection solaire, la peau, le rasage et la barbe, les cheveux, les dents, le sommeil, l'activité et la prise de vue. Chaque conseil indique son niveau de preuve, ses limites et ses sources.
- **Sans compte, sans publicité, sans paiement, sans traceur.**

La recherche qui fonde ces choix (étape 1) est dans `docs/RECHERCHE.md`.

## Démarrage rapide

```bash
npm install            # TypeScript, Playwright, sharp ; @mediapipe/tasks-vision (figé à 0.10.21)
npm run setup:vendor   # copie MediaPipe en local et télécharge le modèle (facultatif, voir plus bas)
npm run build          # compile src/ → site/js et assemble site/
npm run serve          # http://127.0.0.1:4173/
```

L'application n'a **aucune dépendance d'exécution**. Le dossier `site/` est un site statique à déposer sur n'importe quel hébergeur (Netlify, Cloudflare Pages, GitHub Pages, un serveur nginx…). Le fichier `site/_headers` fournit les en-têtes de sécurité aux hébergeurs qui le lisent. Pour les autres, reprenez les en-têtes de `scripts/serve.mjs`.

## Deux modes de repérage

| Mode | Quand | Fonctionnement |
|---|---|---|
| **Automatique** (MediaPipe Face Landmarker) | Si les fichiers du modèle sont présents dans `site/vendor/mediapipe/` | Détection locale en WASM. La pose (lacet, tangage) et l'expression servent uniquement aux contrôles de qualité. |
| **Manuel guidé** | Toujours disponible ; repli automatique si le modèle manque ou échoue | L'utilisateur place 11 repères avec une loupe ×3 et des flèches de réglage fin. |

L'application ne simule **jamais** une détection : sans modèle, elle le dit et propose le mode manuel.

### Installer le modèle automatique

`npm run setup:vendor` copie `vision_bundle.mjs` et `wasm/` depuis `node_modules/@mediapipe/tasks-vision` et télécharge `face_landmarker.task` depuis `storage.googleapis.com`. Il affiche ensuite l'empreinte SHA-256 du modèle. Consignez-la, puis fixez-la avec la variable `FACE_LANDMARKER_SHA256` pour les déploiements suivants.

> ⚠️ **Non testé.** L'application a été écrite dans un environnement sans accès à npm ni aux serveurs de Google. Le mode automatique (`src/analysis/detector.ts`) suit l'API publique et le code source de MediaPipe 0.10.x, mais il n'a jamais été exécuté. Avant la mise en production :
> 1. lancez `npm run setup:vendor` et vérifiez les chemins copiés ;
> 2. testez sur un Android d'entrée de gamme et sur un iPhone ancien ;
> 3. vérifiez que le WASM fonctionne avec la CSP fournie (`'wasm-unsafe-eval'`). Ajustez `worker-src` si besoin.
>
> La licence du fichier `.task` n'est pas confirmée par Google sur la page consultée. Lisez la fiche du modèle avant tout usage commercial.

## Tests

```bash
npm test      # 38 tests unitaires (dont 5 de sécurité) (node:test) : géométrie, incertitude, qualité, niveaux, recommandations, suivi, validation, chiffrement
npm run e2e   # 14 parcours Playwright, dont caméra simulée, visionneuse qui bloque la caméra, image piégée, stockage corrompu ; (Chromium : mobile, ordinateur, cadre restreint)
```

Les parcours de bout en bout vérifient notamment :

- qu'aucune requête ne part vers un autre site ;
- qu'aucune photo ni aucun repère n'est stocké ;
- qu'une même photo importée deux fois est refusée ;
- que le sélecteur de photo s'ouvre dans un cadre restreint, même avec le stockage bloqué et sans réponse sur la distance ;
- que l'orientation EXIF d'une photo de téléphone est respectée ;
- qu'un fichier qui n'est pas une image est rejeté ;
- que les mineurs n'ont pas accès aux mesures ;
- que « Tout supprimer » vide réellement le stockage.

Les tests utilisent des **visages synthétiques dessinés** (`e2e/fixtures`, générés par `scripts/make-test-face.mjs`) et le modèle canonique de MediaPipe projeté de face. Il n'y a aucune photo de personne réelle.

Mesures faites avec un processeur ralenti 6 fois (Chromium) :

- chargement de l'application : environ 0,6 s ;
- calcul d'une photo (Monte-Carlo inclus) : environ 0,15 s ;
- poids transféré : environ 210 Ko, sans le modèle.

## Structure

```
src/
  analysis/         logique d'analyse, sans DOM, testée
    points.ts       schéma des 11 repères et correspondance MediaPipe
    geometry.ts     repère du visage (correction du roulis), 12 mesures
    uncertainty.ts  propagation Monte-Carlo, a priori d'erreur sourcés
    quality.ts      netteté, exposition, éclairage, pose, expression, distance
    observations.ts niveaux de certitude, agrégation multi-photos, textes
    metrics.ts      définitions, explications, sources, mesures exclues
    history.ts      comparaison de séances dans des conditions identiques
    detector.ts     adaptateur MediaPipe (local, auto-hébergé)
  recommendations/  catalogue sourcé et moteur de règles
  habits/           suivi hebdomadaire, jours de réserve
  storage/          localStorage, IndexedDB, chiffrement AES-GCM
  image/            validation par signature, réduction, purge
  ui/               composants, repérage manuel, superposition, vues
  content/          glossaire critique, ressources d'aide
```

Voir `docs/ARCHITECTURE.md` pour les décisions et `docs/VALIDATION.md` pour ce qui reste à calibrer.

## Journal des corrections

**2.1.1**
- Plus aucune taille d'image minimale : seule la taille du visage compte, avec un refus seulement sous 18 px entre les yeux. Une petite photo nette passe.
- Seuil de flou assoupli pour les webcams.

**2.1.0**
- **Corrigé :** l'ancienne version restait en cache et rouvrait le placement manuel des 11 points. Le cache passe désormais par le réseau d'abord, et l'app se recharge d'elle-même quand une mise à jour arrive.
- **Plus de bascule automatique vers les 11 points :**
  - si la détection échoue avec l'accélération graphique, elle réessaie sur le processeur ;
  - si aucun visage n'est trouvé, elle réessaie sur des recadrages centrés ;
  - le placement manuel n'apparaît que sur demande explicite.
- **Résultat simplifié :**
  - 4 cartes : Qualité photo, Yeux, Bas du visage, Nez ;
  - les valeurs mesurées sont toujours affichées, précédées de « ≈ » quand la marge d'erreur est large ;
  - un indicateur de précision en 3 points ;
  - les détails sont repliés ;
  - animation plus rapide.

**2.0.0 — refonte**
- **Scan automatique** :
  - caméra plein cadre, rafale de 3 images, animation de scan pendant le traitement réel ;
  - le modèle MediaPipe est auto-hébergé, installé et testé par la CI GitHub sur une vraie photo de visage.
- **Nouvelle interface** sombre et épurée :
  - navigation à 4 onglets avec un bouton de scan central ;
  - résultats sous forme de cartes ;
  - texte réduit, explications repliées.
- **Rangs et XP**, de « Recrue » à « Légende du miroir » : le rang monte avec la routine, la régularité et la qualité des photos. Le visage n'entre jamais dans le calcul.
- **Indice de symétrie** donné en fourchette et **score de qualité photo** sur 100.
- **CI** (`.github/workflows/ci.yml`) :
  - compilation et tests unitaires ;
  - tests de bout en bout, dont un scan réel par la galerie et par la caméra simulée ;
  - mise en ligne sur GitHub Pages seulement si tout passe ;
  - rapport avec captures d'écran sur la branche `ci-report`.

**1.1.0**
- **Caméra intégrée** : viseur dans l'application, guide ovale, retardateur de 10 s, bascule avant/arrière. La caméra s'éteint à la capture, en quittant l'écran ou en arrière-plan.
- **Application installable (PWA)** : icône sur l'écran d'accueil, plein écran, fonctionnement hors ligne, sans compte.
- **Audit de sécurité** (`docs/SECURITE.md`) :
  - protection contre les images piégées (bombes de décompression) ;
  - validation stricte des données stockées ;
  - zone de collage verrouillée ;
  - en-têtes HTTP renforcés.
- Le lien qui renvoyait vers le navigateur avec une connexion Claude est supprimé.

**1.0.2**
- Le champ fichier transparent recouvre maintenant tout le bouton : le doigt le touche directement, sans passer par une étiquette ni par un clic simulé, que certaines vues web intégrées (Android) ignorent.
- Si aucun sélecteur ne s'ouvre, une aide propose d'ouvrir l'app dans le navigateur ou de coller la photo (Galerie › Copier, puis appui long › Coller).

**1.0.1**
- Le bouton photo était désactivé sans que ce soit visible tant que la distance n'était pas renseignée : il reste désormais toujours actif, et une distance non renseignée est traitée comme inconnue.
- Les deux boutons (caméra et galerie) sont remplacés par un sélecteur unique `image/*` sans attribut `capture` : le téléphone propose lui-même l'appareil photo ou la photothèque, iOS convertit les photos HEIC en JPEG, et le bouton ne peut plus être bloqué par un cadre restreint.
- Le décodage des images essaie trois méthodes successives (`createImageBitmap` avec orientation EXIF, `createImageBitmap` simple, puis `<img>`).
- Le glisser-déposer et le collage d'image fonctionnent sur ordinateur.
- Chaque étape de l'analyse repart du haut de l'écran.
- La vérification du modèle refuse une page HTML renvoyée par défaut ; le chargement est limité dans le temps.
- Les erreurs inattendues sont affichées à l'écran, et la page « Mes données » contient un diagnostic de l'appareil.
- Les problèmes de prise de vue relevés pendant l'analyse personnalisent de nouveau le programme (ils étaient perdus).

## Limites connues

- Les **seuils de qualité** (netteté, taille du visage, exposition) et l'**incertitude du mode manuel** sont des valeurs provisoires. Ils doivent être calibrés sur des photos réelles (protocole dans `docs/VALIDATION.md`).
- La **distance de prise de vue** est déclarée par l'utilisateur. Elle n'est pas estimée automatiquement.
- Le **HEIC** n'est lu que là où le navigateur le décode (Safari). Ailleurs, un message explique comment exporter la photo en JPEG.
- La détection MediaPipe tourne sur le fil principal, pas dans un Web Worker, faute d'avoir pu tester le chargement du WASM dans un worker module.
- L'application n'est pas encore une PWA installable : il n'y a ni service worker ni mode hors ligne.
