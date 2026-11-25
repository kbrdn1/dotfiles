---
name: me:report
description: "Rapport HTML local et live d'une branche à l'entrée en review : faits collectés par script (fichiers, diffs, commits, review, CI du sha exact) pour 0 token, texte écrit par le modèle section par section dans notes.json, page qui se rafraîchit seule toutes les 2 s, ouvrir dans Zed / nvim / GitHub, sources cliquables, Q&A orienté propositions, captures du rendu (capture.mjs, avant / après) obligatoires quand le diff touche au front. Mode plan (--plan) : même page pour un plan de mono, d'orchestrator ou de sprint, avec le graphe des issues et leur état vivant. Triggers: /me:report, rapport de fin de dev, rapport de review, rapport de la PR, rafraîchir le rapport, report refresh, plan en page, page de plan, plan de sprint, captures du rendu, captures front, avant après."
---

# me:report : rapport local et live

Une page par branche, sous `~/Reports/<owner>-<repo>/<branche>/` (`$ME_REPORTS_ROOT` pour changer).
Pas sous `~/.claude` : Sheprd (Herdr) refuse de servir une page rangée dans un dossier caché.

| fichier | écrit par | coût |
|---|---|---|
| `index.html`, `view.css`, `dither-charts.js`, `view.js` | copiés de `shell/` par `collect.py` | 0 |
| `assets/`, `docs.js` | `collect.py` : blobs avant / après des images et PDF modifiés, markdown, pour les aperçus | 0 |
| `zed-theme.js` | `collect.py` : le thème Zed actif (sombre et clair), lu dans `~/.config/zed` | 0 |
| `data.js`, `diffs.js` | `collect.py` (git, gh, gwm, TSV de review), écriture atomique | 0 |
| `facts.json` | `collect.py` : le contenu de `data.js` en JSON pur (`kind`, `facts`, `notes`, `rev`, `generatedAt`), pour Herdr (mod kt-threads), atomique | 0 |
| `notes.json` | **le modèle**, texte seulement | ce qui change |
| `review/pass-N-{standards,spec}.md`, `pass-N.sha`, `decisions.tsv` | le loop `claude-review-pr`, étape (D) | une copie de fichier par passe |
| `review/codex-N.md`, `codex-N.sha` | le loop `codex-review-pr`, étape (D) : rapport normalisé (puces + `RESUME` qui a fait foi) | une copie par passe |
| `captures.json` | **le modèle** : les plans du rendu à capturer (format : `references/captures.md`) | un manifeste |
| `captures/*.png`, `captures/sha` | `capture.mjs` (Playwright, Chromium du cache) : après, avant sur la base, sha de la capture | 0 |

`ci-until-green` relance `collect.py` après chaque verdict, seulement si la branche a déjà un rapport.

⛔ Le modèle n'écrit jamais de HTML, de CSS ni de faits. Fichiers, lignes, commits, CI, passes de review :
`collect.py` les lit, exacts par construction.

## Quand

- **Entrée en review** : la PR est ouverte, on ne développe plus. Avant `/me:loop:claude-review-pr`.
- **Refresh** : les loops (review, CI) relancent `collect.py` ; à la demande, `/me:report refresh`.
- **Après la review**, seulement si le code a bougé : sections en retard réécrites, captures en retard refaites, rien
  d'autre.

## Protocole

Toujours depuis le **worktree** de la branche (jamais le checkout principal).

```bash
C=~/.claude/skills/me/report/collect.py
$C                 # REPORT / FACTS / NOTES : trois lignes, c'est tout ce qu'il faut lire
```

1. `NOTES absentes` → écrire `notes.json` (schéma ci-dessous) depuis `git diff <base>...HEAD`,
   l'issue (`gh issue view N`) et la spec si spec-driven. `basedOn` = sha court de HEAD. Relancer `$C`.
   `CAPTURES absentes` → captures obligatoires (section « Captures du rendu ») : écrire `captures.json`, lancer
   `capture.mjs` avec le serveur de la branche, relancer `$C`.
2. Ouvrir, une seule fois (la page se met à jour seule ensuite) :
   - dans Herdr (`HERDR_ENV` ou `HC_TERMINAL_ID`) : `/Applications/Herdr.app/Contents/MacOS/sheprd browser open <REPORT>`
     (skill `herdr-gpui-browser`) ;
   - sinon : `open <REPORT>`.
3. Refresh : `$C`. `STALE=` vide → fini, 0 token. Sinon `$C --stale-diff` donne le diff restreint aux
   fichiers des sections en retard : réécrire **ces sections-là** dans `notes.json` (Edit par id, sans relire
   le reste), mettre `basedOn` au sha de HEAD, relancer `$C`. Même moment, même règle pour la ligne `CAPTURES … en
   retard` : `node ~/.claude/skills/me/report/capture.mjs --stale` (serveur de la branche lancé), puis `$C`.
4. Réponses du Q&A : elles arrivent en une ligne (`rapport owner/repo#30 · gg=a q2="…" · note: …`), collée
   par l'utilisateur ou envoyée par Sheprd (« The page sent a result »). Les appliquer, puis retirer les
   questions tranchées de `notes.json`.

`STALE` : une section est en retard si un fichier de son `files` a changé depuis `basedOn`
(`"*"` = n'importe quel changement, un dossier couvre son contenu, glob accepté, `[]` = jamais).
Si `basedOn` n'est plus un ancêtre de HEAD (rebase, force-push), toutes les sections avec `files` le sont.

Branche déjà fusionnée par merge commit : `base...HEAD` serait vide, `collect.py` compare au premier parent
du merge (`FACTS … base dev avant <sha>`). Le rapport garde ses fichiers après le merge.

## notes.json

```json
{
  "title": "titre court", "subtitle": "une phrase", "basedOn": "1d91242",
  "sections": [
    { "id": "tldr", "title": "En bref", "files": ["*"], "body": "markdown avec refs [^issue]" },
    { "id": "flux", "title": "…", "files": ["src/a.rs"], "body": "…", "mermaid": "sequenceDiagram\n…" },
    { "fact": "files" },
    { "id": "fait", "title": "Ce qui a été fait", "files": ["src"], "body": "…" },
    { "fact": "commits" }, { "fact": "ci" }, { "fact": "review" },
    { "id": "suite", "title": "Suite", "files": [], "body": "…" }
  ],
  "questions": [
    { "id": "gg", "in": "suite", "title": "question ?", "why": "contexte en une phrase",
      "options": [ { "id": "a", "label": "…", "why": "…", "reco": true }, { "id": "b", "label": "…", "why": "…" } ] }
  ],
  "sources": [
    { "id": "issue", "kind": "issue", "label": "…", "href": "https://github.com/…/issues/23" },
    { "id": "svc", "kind": "code", "label": "…", "path": "chemin/relatif/au/repo.js", "line": 87 }
  ]
}
```

- **Ordre** = celui de `sections`. Les blocs de faits (`{"fact": "files|commits|ci|review|captures"}`) se placent
  où ils servent ; un bloc non placé arrive après la première section (`captures` puis `files`) ou à la fin.
- **Structure par défaut d'un rapport** : en bref → rendu (captures, si le front a bougé) → flux (diagramme) →
  fichiers → ce qui a été fait, groupé par intention → commits → CI → review → détail technique + sources → suite.
- **Sources** : toute affirmation technique non triviale porte une ref `[^id]` au plus près. `path` relatif
  au repo ou absolu, `line` pour ouvrir à la ligne (Zed, nvim) ; `href` pour le web.
- **Diagramme** mermaid seulement quand il montre le mécanisme réel (lu dans le code, pas supposé).
- **Questions** : orientées propositions, une seule `reco`, un `why` par option ; `in` = id de la section
  où elle compte, sinon regroupées en fin. Toujours un champ libre (la page l'ajoute).
- Français, phrases courtes, pas de marketing, « non testé » quand c'est le cas.
- **Encadrés** (motif « watch out / key idea / good to know », voir `references/design-patterns.md`) :
  `> [!WATCH] …` (attention, rouge), `> [!KEY] …` (idée clé, violet), `> [!GOOD] …` (bon à savoir, vert),
  `> [!NOTE] …` (bleu). Un par section au plus : c'est ce qui doit sauter aux yeux.

## Captures du rendu

Un rapport de front montre l'écran, pas seulement le diff. **Quand le diff touche au rendu** (`collect.py` le dit :
`CAPTURES absentes`), **les captures sont obligatoires à l'entrée en review**, et refaites quand elles passent en
retard, au même moment que les sections en retard (refresh, après les correctifs d'une passe de review). Format,
options et motifs « front » par projet : `references/captures.md`.

1. Écrire `captures.json` dans le dossier du rapport (`$C --dir`) :
   - `baseUrl` = le serveur de la branche (le lancer depuis le worktree, sur un port libre) ;
   - `beforeUrl` = la base déployée (preprod), pour l'avant ;
   - un plan par écran touché × `desktop` et `mobile` × thèmes du site, plus un plan par état introduit (ouvert,
     survol, focus, erreur, vide), avec ses `actions` ;
   - `files` = ce dont dépend ce rendu (c'est ce qui le met en retard) ;
   - `note` = ce qu'il faut regarder, en une phrase.
   Sobriété : le minimum qui montre tout ce qui a changé, 4 à 12 plans en général, pas une matrice complète.
2. `node ~/.claude/skills/me/report/capture.mjs` depuis le worktree. Lire sa sortie : un `ÉCHEC` se corrige (sélecteur,
   action, `css` pour masquer un bandeau), jamais en retirant le plan.
3. `$C` : ligne `CAPTURES n (k en retard)`. `captures/sha` n'avance que quand tout est à jour.
4. Regarder les images avant de dire que le rendu est bon : une capture vide, sombre au lieu de clair, ou coupée se
   voit tout de suite.

Le corps de la PR pointe vers le dossier du rapport (`~/Reports/<owner>-<repo>/<branche>/captures/`), jamais vers
`/tmp` : il disparaît et casse les liens. Une PR soumise à l'accord de l'utilisateur (visuel, client) lui montre ces
captures-là (`me:dispatch`, « Accord de l'utilisateur »).

## Section review (alimentée par le loop)

`collect.py` lit les rapports du loop `me:loop:claude-review-pr` **tels quels** (étape (D) du loop) :
`review/pass-N-standards.md`, `review/pass-N-spec.md` (format `- [Pn] titre — fichier:ligne`, explication
indentée, ligne `RESUME: P0= P1= P2= P3=`), `review/pass-N.sha`, et `review/decisions.tsv`
(`p<N>-<axe>-<rang>⇥fixed|discarded⇥sha-ou-raison`). Garde anti-faux-propre : un rapport sans `RESUME`
chiffré s'affiche « non exécuté », jamais comme un zéro ; `SPEC_SKIPPED=1` s'affiche « non lancé ».
Les deux axes ne sont jamais fusionnés. Une passe à la main (sans loop) : mêmes fichiers, même format.

Le loop `me:loop:codex-review-pr` tient sa propre série : `review/codex-N.md` (un seul axe, `codex`),
`review/codex-N.sha`, décisions `c<N>-codex-<rang>` dans le même `decisions.tsv`. Elle sort dans `facts.reviewCodex`
(même forme que `facts.review`, plus `reviewer` et `axes`). Quand les deux séries existent, la section review a un
sélecteur claude | codex : deux reviewers, deux séries, jamais mélangées.

## Mode plan

Même coquille, `kind: "plan"`, pour un plan de Mono ou d'Orchestrator, un sprint ou une décision à valider.

Invocation : `/me:report plan <slug> [ce que le plan couvre]` ; un sprint passe plutôt par `/me:goal`, qui pose
le plan lui-même.

```bash
$C --plan <slug>   # dans un dépôt : ~/Reports/<owner>-<repo>/plans/<slug>/ ; hors dépôt : ~/Reports/_plans/<slug>/
```

- Le modèle écrit `notes.json` comme pour un rapport (`title`, `subtitle`, `sections`, `questions`, `sources`),
  sans `basedOn` ni `files` : un plan n'a pas de diff, donc pas de sections en retard. Pour un sprint, il ajoute
  la structure du plan : `"issues": [{ "n": 23 }, { "n": 25, "deps": [23] }]`. Quelles issues et quelles
  dépendances, c'est le plan lui-même. Le bloc se place avec `{ "fact": "issues" }`.
- `collect.py` relit l'état vivant, 0 token. Il fait un appel GraphQL pour les issues et un `gh pr list` pour les
  PR, liées par `Closes #N` ou par la branche `#N-`. Il y ajoute la CI de la PR, le worktree gwm et ses agents,
  et le rapport `me:report` de la branche s'il existe.
  Statut dérivé, une seule source pour la page et pour Herdr :
  - `done` : issue fermée ou PR mergée ;
  - `review` : PR ouverte ;
  - `wip` : worktree ou PR en draft ;
  - `blocked` : une dépendance n'est pas faite ;
  - `todo` : le reste.
- Trois vues du même état, choix mémorisé par plan :
  - **kanban** (par défaut) : colonnes à faire, bloqué, en cours, en review, fait. Une carte qui change de colonne
    au refresh s'allume quelques secondes ;
  - **graphe** des dépendances, coloré par état, dessiné depuis ces faits et jamais depuis un mermaid écrit par le
    modèle (il serait faux dès la première issue fermée) ;
  - **liste** : une ligne par issue avec PR, CI, rapport, Zed et `cd`.
- Toujours le dépôt principal, même lancé depuis un worktree : un plan couvre plusieurs branches.
- Refresh, sans rien de plus à lancer : chaque collecte de branche relit les plans du dépôt qui suivent son issue
  (ligne `PLANS` de la sortie). Les loops review, codex et CI font donc avancer le kanban. À la main :
  `$C --plan <slug>`.
- Sans issues (plan d'idées, plan de `~/.claude`), il n'y a pas de bloc issues : sections, questions, sources.
- **Rendu** : chaque carte d'issue (kanban, liste) porte en vignette la première capture du rapport de sa branche ;
  une galerie « Rendu » (`{ "fact": "captures" }`, après les issues par défaut) reprend toutes les captures du plan,
  groupées par issue, avec leur état « en retard » tel que la dernière collecte de la branche l'a vu. Les PNG sont
  liées dans `plans/<slug>/captures/` (la page ne lit que son dossier).

## Agent sur la tâche

`collect.py` lit, sans token, les sessions que `gwm list` voit sur le worktree, puis leur transcript Claude
Code (`~/.claude/projects/*/<id>.jsonl`, fin du fichier) : modèle, effort, dernière action, dernier message,
mission (`last-prompt`).

## La page

Construite sur kbrdn.dev v2 : monogramme K animé au survol (`Logo.vue`) et favicon du portfolio, cadre à zones quadrillées et lueur, trame animée (DitherCanvas simplifié),
barre flottante avec encoche live et navigation à encre, en-tête façon article (couverture = ampleur du diff
par fichier, titre brouillé, sous-titre Fenix, tags par langage, chiffres à rouleaux), récit posé comme un
article, faits en panneaux (anatomie de `Panel.vue`), sommaire à gauche, pastille review.

Diffs : **`@pierre/diffs` 1.6.2** (esm.sh, chargé au premier dépliage, mis en cache ensuite) : coloration par
langage, mot à mot.
- **Coloration :** celle de Zed. Le moteur tree-sitter `highlights` de Pierre lit le thème Zed actif (`zed-theme.js`),
  avec les mêmes captures que l'éditeur et les mêmes couleurs.
  - Un thème intégré à Zed (One Light, One Dark) se prend dans le catalogue de Pierre.
  - Sans thème trouvé, retour à Shiki avec `pierre-dark` / `pierre-light`.
- **Fonds +/− :** ils gardent la palette de la page (option `unsafeCSS`). Un rendu simple s'affiche
d'abord et reste en secours hors ligne. Clic sur un numéro de ligne = Zed à la ligne ; clic sur un symbole =
carte qui l'ouvre dans Zed à `ligne:colonne` (le LSP de Zed donne hover, définition, références : une page
statique n'a pas de serveur de langage), `nvim`, `git grep`.

- **Favicon** : `icons/report.svg` (rapport : un diff, « + » vert sur « − » rouge) et `icons/plan.svg` (plan : trois colonnes de kanban), posées en data URI par
  `collect.py` à chaque collecte ; glyphes dans `GLYPHS` de `~/.claude/scripts/dither-tile.py`, qui les régénère sans argument.
- **Graphes** : tous tramés à la Monocode, par `shell/dither-charts.js`. C'est un module vanilla en Canvas 2D,
  sans dépendance ni build, réutilisable tel quel (MIT, port de `dither.rs` / `charts.rs` au commit
  `09d0443`, même logique que `viz.js` de Herdr). Sa vérification : `node shell/dither-charts.check.js`.
  - Principe : cellules de 3 px, Bayer 4x4, couleurs lues dans les variables CSS de la page, en clair et en sombre.
    Les graphes prennent la largeur de leur conteneur, avec une lueur douce dessous.
  - Entrée : une seule fois par graphe, même s'il est reconstruit au refresh, et aucune sous `prefers-reduced-motion`.
  - Où ils servent :
    - couverture : barres empilées par fichier, cliquables ;
    - diffstat de chaque fichier ;
    - « bloquants » : écart signé à la passe précédente et tendance par passe ;
    - CI : anneau ok / ko / en cours ;
    - review : barres P0..P3 par passe (clic = la passe), puis carte fichier × passe des findings ;
    - lecture : progression du sommaire ;
    - plan : jauge d'avancement et part de chaque colonne du kanban.
  - Garde anti-faux-propre : une passe dont un axe n'a pas tourné porte « ? » et le dit au survol et sous le
    graphe ; sans aucun axe tourné, elle n'a pas de barre, jamais un zéro.
- **Sommaire** fixe en checklist (étape courante, lues, en retard), compteurs live (fichiers, CI, review,
  réponses), progression de lecture ; sur mobile il se replie. Thème auto / clair / sombre.
- **Mise en page** (motifs de `references/design-patterns.md`) : sommaire à gauche avec le récap à cocher des
  réponses et la liste des annotations ; contenu large au centre ; raccourcis dans une bande en bas d'écran ;
  palette **⌘K** (sections, fichiers, findings, sources, commits).
- **Review passe par passe** : frise des passes ; une passe = son verdict (converge, stagne, remonte), ses deux
  axes, ce qui a changé depuis la précédente (`+` nouveaux, `−` corrigés ou écartés, `~` déjà vus : rapprochés
  par fichier et titre, approximatif et dit comme tel) et ses findings. `←` / `→` au clavier.
- **Annotations de diff** : « + » dans la gouttière d'un diff Pierre, commentaire sous la ligne, gardé dans la
  page. Envoyées avec les réponses (« envoyer la review » : `herdr.send` dans Sheprd, sinon copie). L'aperçu donne
  aussi une commande `gh api …/pulls/N/reviews` qui les publierait en review COMMENT sur la PR : à lancer soi-même,
  la page ne publie jamais rien.
- **Plein écran** : diagrammes ajustés à l'écran (zoom affiché, `+` `−` `0`), diffs côte à côte ou unifiés.
- **Live** : relit `data.js` toutes les 2 s, re-rend seulement les panneaux changés, les surligne, et dit
  ce qui a changé en pied de sommaire ; barre compacte au scroll.
- **Rendu** (`{ "fact": "captures" }`, juste après « En bref » par défaut : le visuel d'abord) : galerie groupée
  par écran, filtres bureau / mobile et thème, badge « en retard », tag « avant / après ». Clic : la visionneuse
  plein écran, au curseur glissant quand l'avant existe (`c` côte à côte, `s` curseur, `← →` avant / après, `j` `k`
  capture suivante / précédente). Diff qui touche au rendu sans `captures.json` : le bloc le réclame.
- **Aperçus avant / après**, repris des vues Changes et History de Herdr :
  - **images** (png, jpg, gif, webp, avif, svg, ico) : vignettes sur damier, dimensions, poids et écart. Clic :
    visionneuse plein écran, ajustée, zoom 10 à 800 %, `←` `→` avant / après, `c` comparer, `0` ajuster, `1` 100 % ;
  - **PDF** : affiché dans la page, sans le diff texte qui n'a pas de sens ;
  - **markdown** : rendu au-dessus du diff, bascule après / avant, dans une iframe sandbox (aucun script : le
    HTML d'un document du dépôt reste inerte).
  `collect.py` copie les blobs git dans `assets/` sous leur empreinte, plafonds 20 Mo par fichier et 120 Mo par
  rapport, et met le markdown dans `docs.js`. Une image binaire n'affiche que son aperçu, un SVG aussi son diff.
- **Fichiers** : filtre par statut et par texte (`/`), groupés par dossier, diffstat en tirets, diff déplié
  avec numéros de ligne et `ouvrir L<n> ↗` par hunk ; `zed`, `nvim` (commande copiée), `github` (ancre du
  fichier dans la PR).
- **Références** : survol d'une ref = carte avec ouvrir (Zed, nvim, web) ; liste des sources en bas.
- **Diagrammes** : zoom (pinch, ⌘ + molette, boutons), déplacement, plein écran, source copiable.
  - Le style suit le portfolio : canevas quadrillé, nœuds en cartes arrondies, fil neutre et pointes accent,
    étiquettes en pastille, groupes en cadre pointillé, notes et blocs alt/loop teintés d'accent.
  - Les libellés sont en SVG et dans la police que mermaid mesure : les toucher en CSS les couperait.
  - Limite mermaid : une note sur deux acteurs (`Note over A,B`) prend la largeur entre eux, pas celle du texte.
    Garder la note courte, ou la poser sur un seul acteur.
- **Clavier** : `⌘K` chercher, `j`/`k` sections, `←`/`→` passes de review, `/` fichiers, `x` replier, `t` thème,
  `g` haut, `?` aide, `échap`.
- **Q&A** : réponses gardées (localStorage) ; « copier pour Claude » partout, « envoyer à l'agent » dans
  Sheprd (`herdr.send`).
- Panneaux repliables (mémorisés), lien de section copiable, `prefers-reduced-motion` respecté.

`collect.py --dir` : le dossier du rapport, sans réseau (pour les loops).

## Limites connues

- `collect.py` prend ~10 s, surtout `gh` (PR + check-runs). `--offline` saute gh (ni PR ni CI).
- Captures : Chromium seul (pas de WebKit) ; `capture.mjs` ne lance pas le serveur de la branche ; une capture prise
  sur un arbre non commité porte quand même le sha de HEAD (il le signale).
- Mode plan : un plan n'avance qu'avec les collectes des branches de ses issues. Une issue sans branche ni worktree
  ne bouge qu'au `$C --plan <slug>` suivant.
