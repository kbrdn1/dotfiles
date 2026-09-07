---
name: me:setup
description: "Génère ou met à jour le CLAUDE.md d'un projet, aligné sur mes workflows (gwm worktree, mgrep/serena/context7, Git flow Gitmoji+Conventional, reviews via boucle /me:loop:claude-review-pr — agent Claude frais — par défaut, /me:loop:codex-review-pr en reviewer tiers si PR sensible + /me:check-reviews manuel en second plan + /me:loop:ci-until-green). Args: init | update | refresh. Triggers: /me:setup, setup CLAUDE.md projet, init claude.md, refresh claude.md."
---

# Setup du CLAUDE.md projet

Tu génères ou mets à jour le `CLAUDE.md` **à la racine du projet courant**, aligné sur **mes workflows**. Le fichier doit rester **court (<200 lignes)**, impératif et concret (evidence-based : commandes et conventions réelles, vérifiées dans le repo).

## Argument (`init` | `update` | `refresh`)
- **`init`** → créer un `CLAUDE.md` from scratch. Si un existe déjà → demander confirmation (AskUserQuestion) avant d'écraser.
- **`update`** → compléter/corriger l'existant **en préservant** les sections écrites à la main ; ajouter ce qui manque, corriger l'obsolète. Montrer un diff résumé avant d'écrire si les changements sont importants.
- **`refresh`** → re-synchroniser uniquement les sections **auto-générées** (stack, commandes build/test/lint, structure, scripts) en relisant le repo ; ne pas toucher au reste.
- Vide/invalide → afficher l'usage `init | update | refresh` et s'arrêter.

## Procédure

1. **Analyser le projet**
   - `pwd`, lister la racine, détecter le stack via les manifestes (`package.json`, `composer.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `deno.json`…).
   - **Le graphe d'abord** — sur un dépôt qu'on ne connaît pas ou plus, `graphify` avant tout grep : AST local, **0 token, 0 clé API**. ⚠️ Toujours depuis la **racine** du dépôt, jamais depuis un worktree, sinon on indexe le mauvais arbre :

     ```bash
     ROOT=$(git rev-parse --path-format=absolute --git-common-dir | xargs dirname)
     test -f "$ROOT/graphify-out/graph.json" \
       && (cd "$ROOT" && graphify update .) \
       || (cd "$ROOT" && graphify extract . --code-only)
     ```

     Puis interroger `$ROOT/graphify-out/graph.json` (God Nodes, cycles d'imports, communautés, points d'entrée) pour la section **Structure** — c'est mesuré, pas deviné. Le `GRAPH_REPORT.md` est maigre sans la passe docs ; ne pas citer ses Knowledge Gaps sans les recalculer. Sur un dépôt d'équipe, exclure `graphify-out/` en **local** (`.git/info/exclude`), pas dans le `.gitignore` versionné.
   - **Ce que le vault sait déjà** — chercher les notes existantes du projet avant d'écrire, pour que le `CLAUDE.md` ne contredise pas une décision déjà tranchée :

     ```bash
     grep -rl "<nom-du-repo>" ~/Vault/pro ~/Vault/perso --include='*.md' --exclude-dir='99 - Meta' 2>/dev/null
     ```

     Lire en priorité la note d'entité (`<produit>/<dépôt>/<dépôt>.md` ou `01 - Projects/<projet>/<projet>.md`) : elle porte les **écarts avec mes conventions** et les **knobs de release**, exactement ce que le `CLAUDE.md` doit refléter. `mcp__tolaria__search_notes` marche aussi, mais `grep` ne dépend pas du sidecar MCP (cassé après chaque auto-update de l'app).
   - Recherche projet : **mgrep** en priorité (fix init mgrep si erreur — obligatoire) → **serena** (symboles/refs, fix init si erreur) → `find` en dernier recours.
   - Extraire les commandes **réelles** : build / test / lint / format / run (scripts `package.json`, `Makefile`, `justfile`, `composer.json`…), la structure des dossiers, les points d'entrée.
   - Détecter les conventions repo : `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, `.gwm.toml`, branche par défaut.
   - Docs de libs/frameworks si besoin : **context7**.

2. **Générer le `CLAUDE.md`** avec ces sections :

   ```markdown
   # <Nom du projet>

   ## Stack & commandes
   - Build : <cmd réelle>
   - Test  : <cmd réelle>
   - Lint/Format : <cmd réelle>
   - Run   : <cmd réelle>

   ## Structure
   - <dossiers clés et leur rôle>

   ## Langage du projet
   <!-- Le lexique métier. Section OPTIONNELLE : ne la créer que quand il y a
        au moins 3 termes réels à écrire. Un glossaire vide est pire que pas
        de glossaire — il donne l'illusion que le vocabulaire est tranché. -->
   **<Terme>** : <ce que c'est, en une ou deux phrases>.
   _Éviter_ : <synonymes bannis>

   ## Conventions de code
   - <règles spécifiques au stack : naming, patterns, imports>

   ## Workflow Git
   - Branche feature uniquement, jamais sur <default-branch> directement.
   - Worktree par défaut : `/me:issue-worktree-pr [desc]` (gwm). Variante checkout : `/me:issue-branch-pr [desc]`.
   - Sprint : `/me:goal [desc]` (worktree autonome, merge progressif dans `dev`).
   - Release : `/me:release [X.Y.Z]` — changelog (`/changelog` du repo) → bump version, commité sur `dev` → merge `dev` → `main` → tag **après** le merge → release (CI sur tag `v*`, ou `gh release create --notes-file changelogs/<version>.md`). Un `/release` propre au repo, s'il existe, fait foi.
   - Commits atomiques, Gitmoji + Conventional Commits, référencent l'issue.
   - Issue remplie depuis le template du repo (`.github/ISSUE_TEMPLATE/*`).
   - PR remplie depuis le template du repo (`.github/PULL_REQUEST_TEMPLATE.md`) ; review par défaut via la boucle `/me:loop:claude-review-pr` (agent Claude frais, auto-cadencé, depuis le worktree) ; `/me:loop:codex-review-pr` (CLI Codex, reviewer tiers) si PR sensible ; `/me:check-reviews [PR#]` déclenché manuellement en second plan (cascade interne cloud/CLI/bots) ; `/me:loop:ci-until-green` avant merge.

   ## Recherche & outils
   - Archi du repo : `graphify-out/graph.json` (rebuild gratuit : `graphify update .` **depuis la racine**, jamais depuis un worktree). L'interroger avant de grep à l'aveugle.
   - Projet : mgrep → serena → find. Web : tavily / hyperbrowser → WebSearch. Docs : context7.
   - Édition : `Edit`+`replace_all` / plusieurs `Edit` / `Write`.

   ## Note au merge de PR
   - Vault : `~/Vault/<pro|perso>` — arbitrage → `Template — Décision.md`, leçon → `Template — Retex.md`, dans `<entité>/decisions/`.
   - Jamais : changelog, doc technique, tâche, procédure. Frontmatter quoté (cf. `AGENTS.md` du vault).

   ## Notes spécifiques
   - <contraintes du repo : env, secrets, services, gotchas>
   ```

2 bis. **Le lexique — comment le remplir, et surtout ce qu'on n'y met pas.**

   Le `graphify-out/graph.json` et les noms de modules/tables/routes donnent les candidats ; le vault donne les termes déjà tranchés. Quatre règles, dans l'ordre d'importance :

   - 🔴 **Uniquement ce qui est propre à CE domaine.** Avant d'ajouter un terme, se demander : est-ce un concept du métier de ce projet, ou un concept général de programmation ? `timeout`, `repository`, `DTO`, `middleware`, `retry` **n'y sont pas**, même si le projet en est truffé. Un glossaire qui définit `cache` ne sert à personne et noie les cinq termes qui comptent.
   - 🟡 **Être tranché.** Quand plusieurs mots existent pour le même concept, en choisir **un** et lister les autres sous `_Éviter_`. Un glossaire qui liste des synonymes sans arbitrer n'a rien décidé, et le code continuera de mélanger les trois.
   - 🟡 **Définitions serrées, une ou deux phrases.** Dire ce que la chose **est**, pas ce qu'elle fait — une définition qui décrit un comportement périme au premier refactor.
   - 🟡 **Vérifier contre le code.** Si un terme du lexique ne correspond pas à ce que le code fait vraiment (« on annule des Commandes entières, mais tu parles d'annulation partielle »), **le signaler** au lieu d'écrire la version fausse. Une contradiction relevée vaut mieux qu'un glossaire propre et faux.

   Rien à écrire ? **Omettre la section.** Elle se crée le jour où un terme se tranche, pas par anticipation. En mode `update`, un terme du lexique contredit par le code se signale à l'utilisateur — on ne le réécrit pas en silence.

3. **Adapter** au repo : si pas de branche `dev`, ajuster la cible de merge du sprint ; si pas de `.gwm.toml`, le signaler ; si une commande build/test est introuvable, la marquer `<à compléter>` (ne jamais l'inventer).

4. **Écrire** selon le mode, vérifier <200 lignes, **résumer** ce qui a été créé/modifié.

## Lien
- Détail des workflows : `~/Desktop/WORKFLOW-w-Claude-Code.md`. Pour les conventions techniques path-scoped par répertoire, voir [[me:rules]].
