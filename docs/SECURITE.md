# Audit de sécurité et de confidentialité — Reflet 1.1.0

Date : 28 octobre 2026. L'audit a porté sur l'ensemble du code (`src/`, `scripts/`, `public/`, `index.html`) : une analyse statique d'abord, puis des tests automatisés qui reproduisent chaque attaque.

## Surface d'attaque

Reflet est un site **statique**, sans serveur applicatif, sans compte, sans base de données distante ni API. Les seules entrées sont :

- les fichiers image (sélection, caméra, glisser-déposer, collage) ;
- les saisies au clavier (questionnaire, habitudes) ;
- le contenu du stockage local, qu'un tiers ayant accès à l'appareil pourrait modifier ;
- l'adresse de la page (fragment `#…`).

## Constats et corrections

| # | Risque | Gravité | État | Mesure | Test |
|---|---|---|---|---|---|
| 1 | Injection HTML (XSS) par une saisie ou par des données stockées | Élevée | ✅ Absent | Aucun `innerHTML`, `eval` ni `new Function` dans le code : tout le texte passe par `textContent`. La CSP interdit les scripts en ligne. | `stockage local corrompu…` (une charge `<img onerror>` reste du texte) |
| 2 | Fuite de photos ou de données vers un tiers | Élevée | ✅ Absent | Traitement 100 % local, sans aucune bibliothèque d'analyse ni traceur. La CSP `connect-src 'self'` interdit techniquement toute connexion externe. | Chaque parcours vérifie qu'aucune requête ne part hors de l'origine |
| 3 | Bombe de décompression (petit fichier décrivant une image gigantesque, qui épuise la mémoire) | Moyenne | 🔧 Corrigé | Dimensions lues dans l'en-tête avant décodage (JPEG, PNG, WebP), puis vérifiées après décodage : 40 mégapixels et 12 000 px de côté au maximum | `image piégée (50 000 × 50 000)` + test unitaire |
| 4 | Fichier non image, ou déguisé par son extension | Moyenne | ✅ Maîtrisé | Format reconnu par les octets de signature, taille limitée à 15 Mo | `fichier non image refusé` |
| 5 | Données stockées corrompues ou modifiées : plantage, propriétés injectées (`__proto__`) | Moyenne | 🔧 Corrigé | Validation stricte à la relecture : seules les clés connues sont gardées, avec contrôle des types, des énumérations, des longueurs et des dates | `security.test.mjs` (4 tests) + test de bout en bout |
| 6 | Caméra restée allumée | Moyenne (vie privée) | 🔧 Corrigé | Flux coupé à la capture, en quittant l'écran, ou quand l'app passe en arrière-plan | `caméra : quitter l'écran l'éteint` |
| 7 | Métadonnées EXIF/GPS conservées avec la photo | Moyenne (vie privée) | ✅ Absent | Seuls les pixels sont gardés (redessin sur un canvas). Les photos ne sont jamais stockées. | Parcours complet : aucune image ni aucun repère dans le stockage |
| 8 | Contenu collé ou déposé dans la zone de collage (texte, HTML) | Faible | 🔧 Corrigé | `beforeinput` et `drop` bloqués ; seuls les fichiers image sont acceptés | Test du collage |
| 9 | Intégration de la page dans un site tiers (clickjacking) | Faible | 🔧 Renforcé | `frame-ancestors 'none'` et `X-Frame-Options: DENY` dans `_headers` | Test des en-têtes |
| 10 | Liens externes (`window.opener`, référent) | Faible | ✅ Maîtrisé | Tous les liens en `target="_blank"` portent `rel="noopener noreferrer"` ; `referrer: no-referrer` | Analyse statique |
| 11 | Empoisonnement du cache hors ligne | Faible | ✅ Maîtrisé | Le service worker ne met en cache que des réponses de même origine (`type: basic`), en lecture seule (GET) | Test hors ligne |
| 12 | Routage par l'adresse | Faible | ✅ Maîtrisé | Le fragment est comparé à une liste fermée de routes | Analyse statique |
| 13 | Historique lisible depuis les fichiers du navigateur | Faible | ✅ Maîtrisé | Désactivé par défaut. S'il est activé : AES-GCM 256 avec une clé non extractible, et intégrité vérifiée au déchiffrement. | `chiffrement local AES-GCM` |
| 14 | Dépendances vulnérables | Faible | ✅ Maîtrisé | Aucune dépendance à l'exécution. Les outils de développement ne sont pas livrés. MediaPipe est figé à 0.10.21 et auto-hébergé. | — |
| 15 | Secrets exposés dans le code client | — | ✅ Absent | Il n'existe aucun secret, puisqu'il n'y a aucun service à appeler | Analyse statique |

## En-têtes HTTP de production (`site/_headers`)

`Content-Security-Policy` (sans `unsafe-inline` ni `unsafe-eval` ; `wasm-unsafe-eval` pour MediaPipe), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` (caméra limitée au site, micro et géolocalisation interdits), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options`, `Strict-Transport-Security`.

## Risques résiduels

- **Hébergeur compromis.** Toute application web peut être modifiée par celui qui contrôle le serveur. Pour s'en protéger : accès restreints, déploiement depuis un dépôt signé, code source public et vérifiable.
- **Appareil déverrouillé.** Une personne qui a le téléphone en main voit les habitudes et l'historique, s'il est activé. Le chiffrement protège seulement contre une lecture des fichiers bruts.
- **Fichier du modèle MediaPipe.** Son empreinte SHA-256 (`64184e22…0bc9ff`) est vérifiée à chaque construction par la CI : un modèle modifié fait échouer la mise en ligne.
- **Visionneuses intégrées.** Une application tierce qui affiche Reflet dans un cadre (aperçu de chat, par exemple) peut interdire la caméra ou les fichiers. C'est une protection de cette application, qu'une page web ne peut pas et ne doit pas contourner.
