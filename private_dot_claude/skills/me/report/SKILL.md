---
name: me:report
description: "Rapport HTML local et live d'une branche à l'entrée en review : faits collectés par script (fichiers, diffs, commits, review, CI du sha exact) pour 0 token, texte écrit par le modèle section par section dans notes.json, page qui se rafraîchit seule toutes les 2 s, ouvrir dans Zed / nvim / GitHub, sources cliquables, Q&A orienté propositions. Mode plan (--plan) : même page pour un plan de mono, d'orchestrator ou de sprint, avec le graphe des issues et leur état vivant. Triggers: /me:report, rapport de fin de dev, rapport de review, rapport de la PR, rafraîchir le rapport, report refresh, plan en page, page de plan, plan de sprint."
---

# me:report : rapport local et live

Une page par branche, sous `~/Reports/<owner>-<repo>/<branche>/` (`$ME_REPORTS_ROOT` pour changer).
Pas sous `~/.claude` : Sheprd (Herdr) refuse de servir une page rangée dans un dossier caché.

| fichier | écrit par | coût |
|---|---|---|
| `index.html`, `view.css`, `view.js` | copiés de `shell/` par `collect.py` | 0 |
| `assets/`, `docs.js` | `collect.py` : blobs avant / après des images et PDF modifiés, markdown, pour les aperçus | 0 |
| `zed-theme.js` | `collect.py` : le thème Zed actif (sombre et clair), lu dans `~/.config/zed` | 0 |
| `data.js`, `diffs.js` | `collect.py` (git, gh, gwm, TSV de review), écriture atomique | 0 |
| `facts.json` | `collect.py` : le contenu de `data.js` en JSON pur (`kind`, `facts`, `notes`, `rev`, `generatedAt`), pour Herdr (mod kt-threads), atomique | 0 |
| `notes.json` | **le modèle**, texte seulement | ce qui change |
| `review/pass-N-{standards,spec}.md`, `pass-N.sha`, `decisions.tsv` | le loop `claude-review-pr`, étape (D) | une copie de fichier par passe |
| `review/codex-N.md`, `codex-N.sha` | le loop `codex-review-pr`, étape (D) : rapport normalisé (puces + `RESUME` qui a fait foi) | une copie par passe |

`ci-until-green` relance `collect.py` après chaque verdict, seulement si la branche a déjà un rapport.

⛔ Le modèle n'écrit jamais de HTML, de CSS ni de faits. Fichiers, lignes, commits, CI, passes de review :
`collect.py` les lit, exacts par construction.

## Quand

- **Entrée en review** : la PR est ouverte, on ne développe plus. Avant `/me:loop:claude-review-pr`.
- **Refresh** : les loops (review, CI) relancent `collect.py` ; à la demande, `/me:report refresh`.
- **Après la review**, seulement si le code a bougé : sections en retard réécrites, rien d'autre.

## Protocole

Toujours depuis le **worktree** de la branche (jamais le checkout principal).

```bash
C=~/.claude/skills/me/report/collect.py
$C                 # REPORT / FACTS / NOTES : trois lignes, c'est tout ce qu'il faut lire
```

1. `NOTES absentes` → écrire `notes.json` (schéma ci-dessous) depuis `git diff <base>...HEAD`,
   l'issue (`gh issue view N`) et la spec si spec-driven. `basedOn` = sha court de HEAD. Relancer `$C`.
2. Ouvrir, une seule fois (la page se met à jour seule ensuite) :
   - dans Herdr (`HERDR_ENV` ou `HC_TERMINAL_ID`) : `/Applications/Herdr.app/Contents/MacOS/sheprd browser open <REPORT>`
     (skill `herdr-gpui-browser`) ;
   - sinon : `open <REPORT>`.
3. Refresh : `$C`. `STALE=` vide → fini, 0 token. Sinon `$C --stale-diff` donne le diff restreint aux
   fichiers des sections en retard : réécrire **ces sections-là** dans `notes.json` (Edit par id, sans relire
   le reste), mettre `basedOn` au sha de HEAD, relancer `$C`.
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

- **Ordre** = celui de `sections`. Les blocs de faits (`{"fact": "files|commits|ci|review"}`) se placent
  où ils servent ; un bloc non placé arrive après la première section (`files`) ou à la fin.
- **Structure par défaut d'un rapport** : en bref → flux (diagramme) → fichiers → ce qui a été fait,
  groupé par intention → commits → CI → review → détail technique + sources → suite.
- **Sources** : toute affirmation technique non triviale porte une ref `[^id]` au plus près. `path` relatif
  au repo ou absolu, `line` pour ouvrir à la ligne (Zed, nvim) ; `href` pour le web.
- **Diagramme** mermaid seulement quand il montre le mécanisme réel (lu dans le code, pas supposé).
- **Questions** : orientées propositions, une seule `reco`, un `why` par option ; `in` = id de la section
  où elle compte, sinon regroupées en fin. Toujours un champ libre (la page l'ajoute).
- Français, phrases courtes, pas de marketing, « non testé » quand c'est le cas.
- **Encadrés** (motif « watch out / key idea / good to know », voir `references/design-patterns.md`) :
  `> [!WATCH] …` (attention, rouge), `> [!KEY] …` (idée clé, violet), `> [!GOOD] …` (bon à savoir, vert),
  `> [!NOTE] …` (bleu). Un par section au plus : c'est ce qui doit sauter aux yeux.

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

## Agent sur la tâche

`collect.py` lit, sans token, les sessions que `gwm list` voit sur le worktree, puis leur transcript Claude
Code (`~/.claude/projects/*/<id>.jsonl`, fin du fichier) : modèle, effort, dernière action, dernier message,
mission (`last-prompt`), et la session Monocode correspondante (`monocode.db` en lecture seule) avec son
rattachement : « sur ce worktree » ou sur le checkout principal (le problème de l'axe 1).

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
- Mode plan : un plan n'avance qu'avec les collectes des branches de ses issues. Une issue sans branche ni worktree
  ne bouge qu'au `$C --plan <slug>` suivant.
- Dans Monocode la page ne s'affiche pas (`visual_show` = composants natifs) : donner le chemin.
