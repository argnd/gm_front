# GM (Maître du Jeu) — Prompt de reprise de contexte

> Colle ce document en début de session pour reprendre le travail là où il en est.
> Dernière mise à jour : 2026-08-30 (fin de session « socle FX + effets de stats »).

## ⚠️ À FAIRE EN PREMIER : rescanner le projet

**Ce document peut être en retard sur le code.** Des modifications ont été faites en parallèle,
hors des sessions Claude (retouches manuelles, commentaires ajoutés dans le code, back mis à
jour). Avant toute proposition ou tout code, relire au minimum :

- `src/styles.scss` (tokens du socle, keyframes globaux — le cœur du système)
- `src/app/home/ambiance/` (engine, fx-layer, field-mask.service, play-field.directive)
- `src/app/home/stats-panel/`, `src/app/home/decor/`, `src/app/home/debug-panel/`
- `src/app/models/turn.model.ts` et le DTO back `JAVA/ia_game_master/.../model/TurnsPayload.java`

Puis vérifier que `npx tsc -p tsconfig.app.json --noEmit` et `npx ng test --watch=false` passent
**avant** de commencer, pour partir d'une base saine.

## Le projet

Jeu de rôle narratif : le joueur écrit des actions libres, une IA « Maître du Jeu » raconte la
suite. Une partie = 20 tours. Trois axes d'ambiance (romance / adventure / other, 0–100 chacun,
somme ≤ 100, seuils de palier 30/60/90) et six stats (Health, Mana, STR, AGI, INT, Gold, 0–10,
**haute > 8**, **basse < 2**) pilotent le récit ET la mise en scène visuelle.

- Front (code vivant) : `ANGULAR/gm_front` — Angular 22 standalone, **zoneless**, signals,
  control flow `@if/@for`, SCSS, Vitest. Back : `JAVA/ia_game_master` (Cloud Run), un endpoint
  `POST /answer`, token Google en Bearer.
- **Modèle d'échange à jour** (`src/app/models/turn.model.ts`, aligné sur `TurnsPayload.java`) :
  `Turn { text, stats, ambiance, objects, answer, newstats, newAmbiance, newObjects, diceRolls,
  extra }` dans `AnswerPayload { turns }`. Le front renvoie tout l'historique à chaque tour.
  `GameObject { name, description }`. `diceRolls: DiceRoll[]|null` (dice, label, stat, rolls,
  modifier, total, difficulty, success — **pas encore rempli par le back**),
  `extra: Record<string, unknown>|null`.
- **Le parsing du JSON dans le texte de l'answer a été SUPPRIMÉ** (`extractStatsFromAnswer` et
  ses helpers n'existent plus). L'`answer` est du récit pur ; `newstats`, `newAmbiance` et
  `newObjects` sont lus depuis les champs structurés. `newObjects` est **autoritaire** : reçu
  (même vide), il remplace l'inventaire — l'IA renvoie l'inventaire complet à chaque tour, comme
  les stats. « Nouveau tirage » vide aussi l'inventaire.
- Contenu statique en JSON (`src/app/content/`) : `copy.json` (labels, glyphes, `statSignatures`,
  **`statSignaturesLow`**, actionCopy et actionHints par famille d'ambiance), `rules.json`
  (statNames, maxTurns=20, defaultAmbiance 10/10/10, seuils, stats { highThreshold 8,
  lowThreshold 2, scale 10 }, statRoll { min 1, max 10, minimums { Health: 5 } }), `fx.json`
  (6 runes). L'engine (`ambiance/ambiance.engine.ts`) les importe et ré-exporte tout.

## Règles de travail imposées par l'utilisateur (à respecter strictement)

1. Travailler par **petits blocs** : proposer → il ajuste → il valide → coder → vérifier au
   navigateur → il valide visuellement **sur son propre build (port 4200, via son IDE)** → il
   push. Plan numéroté avant toute tâche multi-fichiers.
2. **Claude teste sur le port 4250** (launch.json `gm-front`) et **coupe son serveur** dès ses
   vérifications finies, avant de présenter le code.
3. Jamais de commit/push (il les fait lui-même), jamais d'installation de dépendances ni de
   fontes externes, aucune donnée qui sorte de la machine, pas de lecture de .env/secrets.
4. Pas de commentaires dans le code sauf demande (l'utilisateur en ajoute lui-même après coup :
   ne pas les supprimer). Respecter les conventions du fichier.
5. Pour tester /home sans Google :
   `sessionStorage.setItem('gm_session', JSON.stringify({user:{name:'Testeur',photoUrl:'',
   idToken:'dev-fake-token'},loginTime:Date.now()}))` puis naviguer vers `/home`.
6. Le **login est terminé** : ne plus y toucher.
7. Signaler les problèmes vus en passant, ne pas les corriger d'office.
8. **Accessibilité traitée en fin de projet** — ne pas corriger d'office (dette connue : la règle
   `prefers-reduced-motion` de styles.scss cible `.gm-page *` et **rate les pseudo-éléments**,
   donc halo, voile, shimmer et rune de coin continuent d'animer en mouvement réduit).
   Garder en tête que certaines animations seront réduites/absentes/altérées sur petits viewports.

## Socle FX (posé cette session — à réutiliser pour TOUT nouvel effet)

### 1. Fondu générique d'apparition / disparition

Tokens `--fx-in: 640ms` / `--fx-out: 420ms` (suivent `--motion-scale`), keyframe `gm-fade`,
classes `.gm-appear` / `.gm-vanish`, et propriété enregistrée `@property --fx-gate` (number,
initial 1). **Deux recettes, une seule à choisir selon le cas :**

- **R1 — effets CSS persistants** (pseudo-éléments, éléments toujours dans le DOM) : le visuel
  complet est déclaré dans la règle de base mais éteint (`--fx-gate: 0` +
  `transition: --fx-gate var(--fx-out) ease`) ; la classe d'état pose `--fx-gate: 1;
  transition-duration: var(--fx-in)` et lance l'animation. Les opacités s'écrivent
  `calc(... * var(--fx-gate))`, **y compris dans les keyframes** (sinon l'animation écrase la
  transition). Une animation qui pilote l'opacité reste en base avec `paused` et passe à
  `running` dans l'état.
- **R2 — DOM dynamique** (`@if`/`@for`) : envelopper le groupe dans un conteneur portant
  `animate.enter="gm-appear" animate.leave="gm-vanish"` (API native Angular 22). Angular retient
  le conteneur jusqu'à la fin du fondu puis le détruit — la règle « détruit, jamais masqué » est
  respectée, la destruction est juste différée de 420 ms.

### 2. Atténuation à l'approche des champs de jeu

Contrainte permanente : les champs d'interaction deviendront **transparents** et changeront de
place et de taille ; les animations doivent pouvoir s'atténuer à leur approche.

- `FieldMaskService` (`ambiance/field-mask.service.ts`) : registre des champs + mesure de leurs
  rects viewport dans un signal. Re-mesure **sur événements uniquement** (ResizeObserver par
  champ + body, resize, scroll capturé passif, visibilitychange), coalescée en un rAF, et ne
  publie que si les rects ont changé.
- `PlayFieldDirective` (`[gmPlayField]`) : posée sur fiche, objets, pupitre, jets de dés, chaque
  carte de tour, l'intro et le message « le MJ écrit ». Un nouvel élément qui devient champ de jeu
  reçoit cet attribut, rien d'autre à faire.
- Le fx-layer rend un `<svg>` inline avec `<mask id="gm-field-mask">` : fond blanc + un rect
  arrondi par champ, noir à `1 - var(--field-dim)`, flouté à `var(--field-feather)/2`.
- **Règle d'or** : tout effet plein-écran vit dans `.fx-weather` (qui porte le masque) — l'outlet
  du slot `fx` y est, donc les décors d'état en héritent. Restent dehors, jamais atténués : le
  feutre, la vignette et le voile de bord d'écran.

### 3. Tokens de rendu (pilotables par état ET par le debug)

`--surface-alpha` (fond des cartes), `--border-alpha` (bordures), `--shadow-alpha` (ombres),
`--field-dim` (0.25 — intensité résiduelle des particules sous un champ), `--field-feather`
(40px — largeur du fondu d'approche). `--surface-bg`, `--surface-border-color` et
`--surface-shadow` sont des `color-mix`/`calc` de ces alphas. Le **pupitre est branché** dessus
(liseré respirant, sceau d'envoi, bordure + fond + focus du champ de saisie). Un état peut donc
écrire `.amb-state-x { --surface-alpha: .7; --border-alpha: .3 }` et tout suit.

## Architecture des états d'ambiance

**20 états** : `neutral`, 9 solos, 3 duos palier 1, 1 trio, 6 duos palier 2 dominant.
`resolveAmbianceState(ambiance)` dans l'engine ; la classe `amb-state-<état>` est posée sur
`.gm-page`. **Registre de décor** `home/decor/ambiance-decor.ts` :
`AMBIANCE_DECOR: Partial<Record<AmbianceState, () => Promise<Type>>>` — imports dynamiques, un
état = un composant + une ligne. État absent → rien ne se rend. Le home résout le composant via un
`effect` (garde anti-course) et distribue `decor` (Type) + `decorData` ({ ambiance, stats }).
Chaque composant d'état calcule ses propres paliers depuis l'ambiance brute.

**Slots** : `head`, `foot`, `field-bloom-left/right`, `answer`, `answer-end`, `navbar`, `stats`,
`objects`, `rolls`, `trail`, `overlay`, `fx`.

**Règles d'or** : hôtes de décor `display: none` par défaut ; aucune logique dans le constructeur
d'un composant d'état ; la mise en page de la base ne dépend jamais d'un hôte de décor ; un décor
qui survole des surfaces doit être déclaré APRÈS elles dans le DOM (les `.gm-surface` sont
positionnées et recouvrent sinon tout décor déclaré avant).

## Effets de stats — état d'avancement (7 sur 12)

Mécanique complète : `isLowStat` / `lowStats` dans l'engine, classes `stat-<slug>-high` **et**
`stat-<slug>-low` sur `.gm-page`, `.is-high` / `.is-low` + signatures hautes et basses dans la
fiche, crochet `data-stat="<slug>"` sur chaque ligne de stat.

| Stat | Haute (> 8) | Basse (< 2) |
|---|---|---|
| Vitalité ❤ | ✅ battement cardiaque du glyphe (`gm-heartbeat` 1,6 s) + halo vert diffus (`--vital`) centré sur le glyphe, boîte 140×110 px en pixels fixes, `closest-side` | ✅ vignette resserrée (0.5), voile rouge pulsant aux bords (`gm-lifeblood`, hors `.fx-weather`), glyphe vacillant (`gm-flicker`), liseré rouge sur la fiche |
| Mana ✦ | ✅ runes en orbite **périphérique** (rayon 300–560 px) + rune `ᛉ` au coin des cartes | ✅ les 6 runes grises (`--text-dim`), éteintes, immobiles, couchées au ras du bas de l'écran (`.fx-rune-fallen`, inclinaisons ±80°) |
| Or ◈ | ✅ (hérité) flocons montants + liserés shimmer + ombre dorée | ✅ 14 poussières gris-brun (`--stone` + encre, sans lueur) qui **chutent** (`gm-drift` à `--lift` négatif), réparties en bandes stratifiées ; `--border-alpha: 0.45` éteint tous les liserés |
| Force ⛊ | ❌ **à faire — ébauche validée, à coder** | ❌ à faire |
| Agilité ➤ | ❌ à faire | ❌ à faire |
| Esprit ✧ | ❌ à faire | ❌ à faire |

### Prochaine tâche : Force haute

Ébauche montrée et à confirmer : **fissures filaires** au ras du bas du viewport — 3 groupes de
polylignes SVG (langage filaire de la flore neutre), trait principal anguleux 45–95 px + 1-2
ramifications fines + éclats ponctuels, teinte `--stone`, opacités 0.25–0.6, **immobiles** une
fois écloses (fondu R2 à l'apparition/disparition, aucune animation continue), réparties sur la
largeur, rendues dans `.fx-weather`. Plus **ombres alourdies** : une ligne
`.gm-page.stat-str-high { --surface-shadow: ... }` (plus descendue, plus sombre).
Variante proposée non tranchée : fissures ancrées au pied du pupitre plutôt qu'au bas de l'écran.

### Suggestions pour les 4 effets suivants

- **Force basse** — le glyphe ⛊ s'affaisse (légère bascule) et tremble par instants ; les ombres
  s'estompent, tout paraît frêle.
- **Agilité haute** — sillages de vent : rares traits horizontaux fins qui filent dans le fond.
- **Agilité basse** — la poussière du socle *retombe* au lieu de monter, plus lentement.
- **Esprit haute** — constellation de savoir : 5-6 points reliés par des segments filaires dans
  une marge, allumage séquentiel puis scintillement.
- **Esprit basse** — brume grise très lente au bas de l'écran ; les labels perdent en netteté,
  jamais le récit.

## État neutre (base, terminé sauf demande)

- Base : tokens éclaircis, 2 colonnes (fiche+objets | récit 780px), piste horizontale 20 losanges,
  panneau Objets, panneau Jets de dés (vide tant que le back n'envoie rien), intro « le MJ est une
  IA », tirage stats min 1 / Vitalité min 5.
- Pupitre : d20 + question serif par ambiance, suggestions tournantes, champ haut autogrow,
  Entrée=envoyer, ligne d'horizon gemmée, bouton avec dé roulant, sceau d'envoi, liseré respirant.
- **Décor neutre** (`decor/neutral-decor.component.*`) : flore filaire dispersée (graine sur la
  fiche, jeune pousse sur Objets, bouton clos sur Jets, fleur en fin de piste, rameau en tête du
  pupitre, rosette en bas-droit du récit, bouquet au pied du pupitre, bandeau de pied). Éclosions
  par palier de somme : +1 fleur à 60 / 70 / 80, **chacune en fondu R2**. Seuil global : tous axes
  < 30.
- **Pollen** (slot `fx`) : grains jaune-vert, seuil somme ≥ 20, 8 → 22 grains, stratifié.
- **Luciole** (`home/firefly/`, socle, hors registre) : halo caméléon (moyenne pondérée des hues),
  errance dans la marge gauche, ruée rare vers la marge droite du pupitre, masquée < 1240 px.

## Panneau debug (bas-gauche, 3 onglets)

- **Ambiance & stats** : sélecteur déroulant des **20 états** (notation `Neutre, 1R, 1A, 2R,
  2A + 1R`…) bidirectionnel (affiche l'état résolu courant + sa clé technique) ; 3 curseurs
  d'ambiance avec budget partagé 100 et presets 0/29/59/89 ; curseurs de stats avec boutons
  rapides **1** et **9** par stat ; boutons « toutes les stats à 9 / 3 / 1 » et « ambiance neutre ».
- **Rendu** : 5 curseurs avec presets — opacité des surfaces (0/45/100), opacité des bordures
  (0/50/100), ombre des surfaces (0/50/100), plancher sous les champs (0/50/100), fondu
  d'approche (0/50/100 px). Les valeurs ne sont posées inline que **hors défaut**, pour laisser
  l'autorité aux états.
- **Échanges** : historique des payloads.

## Vérifications d'usage

```
cd ANGULAR/gm_front
npx tsc -p tsconfig.app.json --noEmit
npx ng test --watch=false
```

Serveur via preview (port 4250), **coupé en fin de vérification**. Si le watcher esbuild reste
bloqué sur des erreurs périmées après une rafale d'édits, redémarrer le serveur. Attention : dans
le navigateur de Claude, **si le volet n'est pas affiché la page ne compose plus de frames** —
transitions, animations et scroll sont gelés et les mesures sont fausses ; mettre l'onglet au
premier plan (`tabs_select`) avant toute mesure temporelle ou capture.
