# GM (Maître du Jeu) — Prompt de reprise de contexte

> Colle ce document en début de session pour reprendre le travail là où il en est.
> Dernière mise à jour : 2026-08-28 (fin de session « état neutre »).

## Le projet

Jeu de rôle narratif : le joueur écrit des actions libres, une IA « Maître du Jeu » raconte la
suite. Une partie = 20 tours. Trois axes d'ambiance (romance / adventure / other, 0–100 chacun,
somme ≤ 100, seuils de palier 30/60/90) et six stats (Health, Mana, STR, AGI, INT, Gold, 0–10,
haute > 8, basse < 2) pilotent le récit ET la mise en scène visuelle.

- Front (code vivant) : `ANGULAR/gm_front` — Angular 22 standalone, **zoneless**, signals,
  control flow `@if/@for`, SCSS, Vitest. Back : `JAVA/ia_game_master` (Cloud Run), un endpoint
  `POST /answer`, token Google en Bearer.
- Modèle d'échange (`src/app/models/turn.model.ts`) : `Turn { text, stats, ambiance, answer,
  newstats, newAmbiance, diceRolls, extra }` dans `AnswerPayload { turns }`. Le front renvoie tout
  l'historique à chaque tour. `diceRolls: DiceRoll[]|null` (dice, label, stat, rolls, modifier,
  total, difficulty, success — remplis par le back, pas encore implémenté côté back) et
  `extra: Record<string, unknown>|null` (bloc libre). `GameObject { name, description }`.
- Contenu statique en JSON (`src/app/content/`) : `copy.json` (labels, glyphes, signatures,
  actionCopy et actionHints par famille d'ambiance), `rules.json` (statNames, maxTurns=20,
  defaultAmbiance 10/10/10, seuils, statRoll { min 1, max 10, minimums { Health: 5 } }),
  `fx.json` (runes). L'engine (`ambiance/ambiance.engine.ts`) les importe et ré-exporte tout.

## Règles de travail imposées par l'utilisateur (à respecter strictement)

1. Travailler par **petits blocs** : proposer → il ajuste → il valide → coder → vérifier au
   navigateur → il valide visuellement. Plan numéroté avant toute tâche multi-fichiers.
2. Jamais de commit/push (il les fait lui-même), jamais d'installation de dépendances ni de
   fontes externes, aucune donnée qui sorte de la machine, pas de lecture de .env/secrets.
3. Pas de commentaires dans le code sauf demande. Respecter les conventions du fichier.
4. Tests navigateur sur le **port 4250** (launch.json `gm-front` le fait). Pour tester /home sans
   Google : `sessionStorage.setItem('gm_session', JSON.stringify({user:{name:'Testeur',
   photoUrl:'',idToken:'dev-fake-token'},loginTime:Date.now()}))` (expire au bout de 10 min).
5. Le **login est terminé** : ne plus y toucher (il est découplé des tokens du thème).
6. Signaler les problèmes vus en passant, ne pas les corriger d'office.

## Architecture des états d'ambiance (le cœur du chantier en cours)

**20 états** (somme ≤ 100 rend le reste impossible) : `neutral`, 9 solos (`romance-1/2/3`, etc.),
3 duos palier 1 (`romance-1-adventure-1`, `romance-1-other-1`, `adventure-1-other-1`), 1 trio
(`romance-1-adventure-1-other-1`), 6 duos palier 2 dominant (`romance-2-adventure-1`,
`romance-2-other-1`, `adventure-2-romance-1`, `adventure-2-other-1`, `other-2-romance-1`,
`other-2-adventure-1`). ~200 animations au total à terme.

**Cadre par animation** (validé) : deux éléments — **seuil** d'apparition (valeur d'ambiance
libre, pas forcément 30/60/90) et **évolution** (par palier ou linéaire). Chaque combinaison de
paliers est une ambiance à part entière, pas une superposition.

**Mécanique implémentée** :
- `resolveAmbianceState(ambiance): AmbianceState` dans l'engine (20 clés, tri par valeur puis
  ordre canonique romance<adventure<other, défensif face aux anomalies). La classe
  `amb-state-<état>` est posée sur `.gm-page` (crochet CSS pour l'étage theming à venir).
- **Registre de décor** `src/app/home/decor/ambiance-decor.ts` :
  `AMBIANCE_DECOR: Partial<Record<AmbianceState, () => Promise<Type>>>` — **imports dynamiques**
  (lazy). Un état = un composant de décor + une ligne de registre. État absent → rien ne se rend.
- Le home résout le composant via un `effect` (avec garde anti-course) et distribue partout
  `decor` (Type) + `decorData` (`{ ambiance, stats }`). **Chaque composant d'état calcule ses
  propres paliers/seuils** depuis l'ambiance brute (ex. `stage` computed du neutre) — aucune
  formule d'évolution dans le home.
- **Slots** (chaque zone rend le composant d'état via `NgComponentOutlet` + `decorInputs(slot)`) :
  `head`, `foot`, `field-bloom-left`, `field-bloom-right` (pupitre), `answer` et `answer-end`
  (zone récit — haut-droit et bas-droit intérieur), `navbar`, `stats`, `objects`, `rolls`,
  `trail`, `overlay`, `fx` (couche gm-fx).
- **Règles d'or** : les animations d'état doivent être *détruites* entre états (swap de registre,
  `@if`, compteurs à zéro) — jamais masquées. Hôtes de décor `display: none` par défaut, seuls
  les slots stylés s'affichent (sinon ils cassent les flex parents). **Aucune logique dans le
  constructeur d'un composant d'état** (il est instancié ~1× par slot). **La mise en page de la
  base ne doit jamais dépendre d'un hôte de décor** (présent ou absent, la géométrie tient —
  ex. le bouton Jouer porte son propre `margin-left: auto`). **Ordre de peinture** : un décor qui
  survole des surfaces doit être déclaré APRÈS elles dans le DOM (ou porter un z-index) — les
  cartes `.gm-surface` sont positionnées et recouvrent sinon tout décor déclaré avant elles
  (piège rencontré deux fois : luciole, rosette du récit).

## État d'avancement

**Action 1 — données** : faite (modèle enrichi diceRolls/extra + extraction JSON). Le back doit
encore être mis à jour par l'utilisateur (diceRolls/extra en champs de premier niveau).

**Action 2 — login** : fait et clos. Thème « Observatoire arcanique » : moteur canvas TS pur
(`login/fx/login-fx.ts`, rAF, DPR, pause onglet caché, reduced-motion, teardown, redémarrage si
le canvas change) + 3 scènes : champ de constellation (cœurs nets/halo variable moyenne 0,70,
scintillement 2 ondes désaccordées, lanterne du curseur adoucie avec répulsion), feux follets des
3 axes (ignorent le curseur), étoile filante (marges latérales uniquement, 1re à 8-16 s puis
20-30 s). Nébuleuses CSS conservées derrière. Centre fondu (pas de carte), textes sobres.

**Action 3 — états du home** : EN COURS. Fait :
- Base neutre : tokens éclaircis (encres #0a0e18…, surfaces #1a2338…), 2 colonnes (fiche+objets |
  récit 780px), piste horizontale 20 losanges + compteur entre chat et récit, panneau debug
  unifié (2 onglets : Ambiance & stats / Échanges, bas-gauche), panneau Objets (vide, stockage
  type stats), panneau **Jets de dés** (sous la piste, au-dessus du récit + séparateur gemmé ;
  police `--font-display` Bahnschrift ; vide tant que le back n'envoie rien), intro « le MJ est
  une IA » (disparaît au premier message), tirage stats min 1 / Vitalité min 5.
- Pupitre (chat-input) : d20 + question serif par ambiance, suggestions tournantes (fondu 6 s,
  pool `actionHints` par famille), champ haut (min 168px, autogrow 340px), Entrée=envoyer,
  focus auto, ligne d'horizon gemmée, bouton avec dé roulant, sceau d'envoi, liseré respirant.
- **Décor neutre** (`decor/neutral-decor.component.*`) : flore filaire pilotée par `--accent`.
  Le « cycle de l'éclosion » est DISPERSÉ dans l'interface (validé après itérations) : graine au
  bas de la fiche (slot stats), jeune pousse sur Objets, bouton clos sur Jets de dés, fleur
  entrouverte en fin de piste, rameau couché en tête du pupitre, rosette épanouie au bas-droit
  INTÉRIEUR de la zone d'histoire (slot answer-end, suit la dernière carte), bouquet au pied du
  pupitre près de « Jouer » ; le bandeau du pied reste aéré (pousse lointaine à gauche, graine
  centre-droit, bouquet). Éclosions par palier (somme, multiples de 10) : +1 fleur à 60 (coin
  haut-gauche du champ), 70 (marge haut-droite du récit, slot answer), 80 (coin haut-droit du
  champ, miroir). Seuil global : tous axes < 30.
- **Pollen** (cas `fx` du décor neutre) : grains jaune-vert 2-4 px montant lentement (keyframe
  global gm-drift), seuil somme ≥ 20, évolution linéaire 8 → 22 grains (somme 20 → 87),
  répartition stratifiée avec léger biais gauche (`(index+rand)/count` puissance 1.25).
- **Luciole** (`home/firefly/`, élément du SOCLE — toujours affichée, hors registre d'états) :
  cœur 4 px, halo 12+44×glow px (double au max), teinte = moyenne pondérée linéaire de la base
  jaune-vert (poids 1−somme/100) et des 3 hues d'axes (poids valeur/100), scintillement propre.
  Vit dans la marge gauche de la fiche (ancrée au rail), errance à dominante horizontale avec
  profondeur z (scale 0.55–1.2), amplitudes croissant vers la gauche de l'écran (60 → 250 px,
  portée ≤ 280 px bornée au viewport). Ruée rare (cooldown 20 s puis 12 %/cycle) : fondu 240 ms
  → téléportation dans la marge sombre À DROITE du pupitre (zone mesurée à l'exécution,
  y 16–170) → 2-5 sauts nerveux (240–460 ms, pauses 90–330 ms) → flottement 0,4–1,1 s → fondu
  retour. Deux couches DOM (coquille position/fondu, cœur halo/scintillement), z-index 4 pour
  survoler les surfaces, masquée < 1240 px. Timers nettoyés par DestroyRef.
- **Panneau debug** : presets d'ambiance à 0 / 29 / 59 / 89 (juste sous les seuils de palier).
- **Purge totale** des anciennes animations d'ambiance (mixins de paliers, blocs amb-dominant,
  couches fx pétales/braises/motes/etc., :host-context amb, keyframes orphelins). Conservé :
  socle (poussière 11 grains, feutre, vignette), animations **Mana** (runes en orbite + rune en
  coin de carte) et **Or** (flocons + liserés shimmer) comme bases de déclinaison, classes
  stat-*-high, keyframes gm-drift/breathe/orbit/shimmer/fade-up/spin.

**Prochaines étapes** : l'état neutre est bien fourni (flore dispersée + pollen + luciole —
trois mécaniques d'évolution : palier / linéaire / socle caméléon). Suite : compléter le neutre
si demandé (idée en réserve : signet végétal de la fiche), puis les états un à un. Proposition
Romance-1 sur la table (non validée) : pétales épars (linéaire, seuil 30) + rougeur d'horizon
(linéaire, seuil 40).

## Vérifications d'usage

`npx tsc -p tsconfig.app.json --noEmit` puis `npx ng test --watch=false` ; serveur via preview
(port 4250) ; si le watcher esbuild reste bloqué sur des erreurs périmées après une rafale
d'édits, redémarrer le serveur. Panneau debug : sliders d'ambiance (budget 100 partagé — poser
les axes dans l'ordre en laissant du budget), boutons stats à 9/3.
