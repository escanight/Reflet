# Ce qui reste à valider avant un lancement public

Le code fonctionne et est testé. Plusieurs **paramètres** reposent cependant sur des hypothèses qu'il faut mesurer sur des données réelles. Il faut le consentement écrit des volontaires, et aucune photo ne doit être conservée au-delà de l'étude.

## 1. Mode automatique (bloquant)

- [ ] Lancer `npm run setup:vendor` et vérifier l'analyse sur de vraies photos.
- [ ] Lire la fiche du modèle FaceMesh-V2 : licence du `.task`, usages hors périmètre, évaluation d'équité.
- [ ] Vérifier la convention de la matrice de transformation : stockage colonne par colonne, signe du lacet. Le test unitaire suppose un stockage colonne par colonne.
- [ ] Vérifier que la CSP suffit au WASM (`'wasm-unsafe-eval'`, éventuellement `worker-src blob:`).
- [ ] Banc d'essai sur un Android d'entrée de gamme et un iPhone ancien : temps de chargement, temps d'inférence, mémoire. Tester ensuite le passage dans un Web Worker.

## 2. Calibrage de l'incertitude

**Protocole de répétabilité.** 20 adultes de phototypes variés (I à VI), 5 photos chacun à 1,5 m dans des conditions contrôlées, et 5 photos en conditions libres.

- Mode auto : écart-type intra-personne de chaque mesure, à comparer à l'a priori σ = 0,023 / 0,032.
- Mode manuel : 3 personnes placent les repères sur les mêmes photos (variabilité entre opérateurs), puis une même personne recommence deux fois (variabilité chez un même opérateur). Le résultat remplace l'hypothèse σ = 0,020.
- La part systématique (`SYSTEMATIC_FRACTION = 0,5`) se calibre par comparaison avec une anthropométrie manuelle directe (pied à coulisse) ou avec un scan 3D sur un sous-échantillon.
- Il faut vérifier que l'erreur ne dépend pas du phototype. Si elle en dépend, il faut l'afficher ou la corriger.

## 3. Seuils de qualité

`THRESHOLDS` dans `src/analysis/quality.ts` contient des valeurs de départ. Pour les calibrer :

- netteté : la distribution de l'indicateur sur des photos jugées nettes ou floues par 2 annotateurs ;
- lacet et tangage : les ±5° et ±10° sont des conventions de praticiens, à confronter à la dérive observée des mesures en fonction de la pose ;
- exposition : à tester sur des peaux claires et foncées, en contre-jour et en intérieur.

## 4. Contenus

Points non vérifiés selon le rapport de recherche :

- statut de vente de l'adapalène et du peroxyde de benzoyle au Maroc ;
- avertissements sur le DNP, les régimes extrêmes et le RED-S ;
- applicabilité des preuves sur la protection solaire aux phototypes IV à VI ;
- numéros d'urgence marocains (15 ou 150) ;
- ligne d'écoute marocaine en santé mentale.

## 5. Juridique

- Délibération CNDP 478-2013 et position de la CNDP sur un traitement purement local.
- Seuil d'âge du consentement numérique (RGPD art. 8 ; France).
- Notice au titre de l'article 50 de l'AI Act : celle de l'onboarding est un texte prudent, à faire relire.

## 6. Accessibilité

Les éléments suivants sont en place :

- navigation au clavier ;
- régions `aria-live` ;
- libellés ;
- contrastes visés AA ;
- `prefers-reduced-motion` ;
- `forced-colors`.

Il reste à faire un audit avec un lecteur d'écran réel (VoiceOver, TalkBack) et un outil comme axe-core. Le repérage manuel reste difficile sans la vue. C'est une limite intrinsèque, qui doit être indiquée à l'utilisateur.
