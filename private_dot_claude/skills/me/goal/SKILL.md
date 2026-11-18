---
name: me:goal
description: "Workflow sprint : découpe un objectif en issues avec dépendances (bloquée par), pose le plan me:report en page vivante (kanban, graphe), puis mène chaque issue débloquée par le workflow worktree jusqu'au merge progressif dans dev, conflits compris, jusqu'à ce que le sprint soit fini. En parallèle via /me:dispatch dans Herdr, sinon en séquentiel. Reprend un sprint en cours depuis son plan. Triggers: /me:goal, sprint, objectif de sprint, découper en issues, enchaîner les issues, reprendre le sprint. Ne pas confondre avec /goal, commande native de Claude Code."
---

# me:goal : un sprint, du découpage au merge dans dev

L'état du sprint vit dans **le plan `me:report`** (`~/Reports/<owner>-<repo>/plans/<slug>/`) : la structure dans
`notes.json` (issues et dépendances, écrite ici), l'état réel relu par `collect.py` (issue, PR, CI, worktree,
agents). Le kanban de la page avance tout seul : chaque collecte de branche relit le plan.

```bash
C=~/.claude/skills/me/report/collect.py   # toujours depuis le checkout principal du dépôt
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)   # jamais le nom du dossier (k-hub = kbrdn1/kbrdn-hub)
```

## 0. Reprise

`/me:goal <slug>` ou « reprendre le sprint » : si `~/Reports/<owner>-<repo>/plans/<slug>/notes.json` existe, sauter
à l'étape 3 après `$C --plan <slug>`. Sinon, lister les plans du dépôt et demander lequel.

## 1. Découpage

Depuis la description du sprint : des issues petites (une PR chacune, relisible en une passe), chacune avec ce
qu'elle livre et ce qui la bloque. Montrer le découpage (tableau : issue, livre, bloquée par) et le faire valider
en une question avant de créer quoi que ce soit.

Puis créer les issues depuis les templates du dépôt (`.github/ISSUE_TEMPLATE/`, comme la skill
`git-flow-worktree`), en ordre topologique, et ajouter une ligne `Bloquée par #A, #B` au corps de celles qui en
dépendent. Issues déjà existantes : les reprendre, ne pas dupliquer.

## 2. Plan vivant

Écrire `~/Reports/<owner>-<repo>/plans/<slug>/notes.json` (schéma de `me:report`, mode plan) :

- `title`, `subtitle` : l'objectif du sprint en une phrase ;
- `sections` : « But », « Découpage » (pourquoi ce grain, ce qui a été écarté), « Risques » ;
  `{ "fact": "issues" }` placé après le but ;
- `issues` : `[{ "n": 12 }, { "n": 13, "deps": [12] }]`, la source des dépendances ;
- `questions` : seulement ce qui bloque vraiment une décision.

Puis `$C --plan <slug>` et donner le chemin de la page (dans Herdr : `sheprd browser open <REPORT>`).

## 3. Exécution

Les issues `todo` dont toutes les dépendances sont faites (`status` dans `facts.json` du plan) partent :

- **dans une session ouverte dans Herdr** : `/me:dispatch` avec ces issues ; il crée chaque worktree, y lance un agent
  Claude et rend la main. Reprendre ici au retour des agents ;
- **ailleurs** : en séquentiel, une issue après l'autre, par le workflow worktree (skill `git-flow-worktree`,
  l'issue existe déjà : le lui dire), jusqu'à la PR ; puis `/me:report`, `/me:loop:claude-review-pr`
  (`/me:loop:codex-review-pr` en plus si la PR est sensible), `/me:loop:ci-until-green`. Le cwd ne tient pas
  d'un appel Bash à l'autre hors du répertoire de travail : chaque commande, loops compris, commence par
  `cd "$WT" &&` (détail et PR de bots : section « Repli séquentiel » de `me:dispatch`).

Ne jamais lancer une issue `blocked`. Pas deux issues sur les mêmes fichiers en même temps.

## 4. Merge progressif

Une PR est prête quand sa review est à 0 bloquant pertinent et que la CI du sha exact est verte (sections review
et CI de son rapport). Alors `/me:merge` depuis son worktree : merge dans `dev`, issue fermée, note vault.

Puis, dans cet ordre :
1. `$C --plan <slug>` : l'issue passe en « fait », celles qu'elle débloquait passent en « à faire ».
2. Les branches encore ouvertes qui touchent les mêmes fichiers : rebaser ou merger `dev` dans leur worktree,
   résoudre les conflits **là**, jamais sur `dev` ; relancer leur CI.
3. Retour à l'étape 3 avec les issues débloquées.

## 5. Fin

Le sprint est fini quand toutes les issues du plan sont `done`. Le dire avec la page à l'appui, puis lister ce qui
a été reporté (issues ouvertes hors plan, questions restées sans réponse). La release, si elle suit, c'est
`/me:release`.

## Garde-fous

- Jamais sur `main` / `master` ; le sprint se merge dans `dev`.
- Un merge seulement sur review et CI vues dans leur sortie réelle, jamais supposées.
- Le plan dit les dépendances : une issue n'est lancée que si `collect.py` la voit débloquée.
- Une issue qui résiste (stagnation de review, CI rouge après `ci-until-green`) : la sortir du flux, le dire, et
  continuer avec les autres si elles n'en dépendent pas.
