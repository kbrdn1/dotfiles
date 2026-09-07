# Règles de travail — Claude Code

Ma méthode de travail universelle (tous projets). Les conventions techniques par repo vivent dans `<repo>/.claude/rules/` (voir `/me:rules`) ; le contexte projet dans son `CLAUDE.md` (voir `/me:setup`).

## Priorités
- 🔴 **CRITIQUE** : sécurité, intégrité des données, casse en prod — jamais de compromis.
- 🟡 **IMPORTANT** : qualité, maintenabilité, professionnalisme — forte préférence.
- 🟢 **RECOMMANDÉ** : optimisation, style — quand c'est pertinent.

Résolution de conflit : Sécurité > Scope (ne faire que le demandé) > Qualité > Vitesse. Prototype ≠ Production.

---

## Boucle de travail
**Comprendre → Planifier → Exécuter → Valider.**
- 🟡 Tâche >3 étapes ou >2 fichiers : poser un plan (identifier ce qui est parallélisable vs séquentiel) avant d'agir.
- 🟡 Opérations indépendantes → **appels d'outils en parallèle** par défaut ; séquentiel uniquement en cas de dépendance.
- 🟡 Valider avant d'exécuter, vérifier après : lint/typecheck/tests avant de marquer une tâche terminée.
- 🔴 Evidence-based : toute affirmation vérifiable (test, sortie réelle, doc). Lire un fichier avant de l'éditer.

---

## Recherche & outils
- 🟡 **Recherche projet** : `mgrep` en priorité (texte/concept). *Si erreur d'init mgrep → la corriger, obligatoire.* → sinon `serena` pour symboles/références/LSP (*fix init si erreur, obligatoire*) → sinon `find`/`grep` classique.
- 🟡 **Recherche web** : `tavily` ou `hyperbrowser` → `WebSearch` classique en fallback.
- 🟡 **Docs dev** (lib/framework/SDK/CLI) : `context7`.
- 🟢 **Au besoin** : `sequential-thinking` (analyse complexe), `playwright` (navigateur/E2E). `chrome-devtools` **uniquement sur demande** de l'utilisateur.
- 🟢 **Transfo de code en masse** : `morphllm` (morph-mcp, fast-apply) **si besoin**.
- 🟡 **Comprendre une codebase inconnue/oubliée** : `graphify` — `graphify extract . --code-only` (AST local, 0 token, 0 clé) puis interroger `graphify-out/graph.json`, avant de grep à l'aveugle. **Toujours depuis la racine du repo, jamais depuis `worktrees/`.**
- 🟡 **Notes & connaissance** : `tolaria` (MCP multi-vault) sur `~/Vault/pro` et `~/Vault/perso`. Frontmatter à `type` obligatoire, **valeurs de chaîne quotées, aucune syntaxe Templater** (ça casse le parseur YAML sur tout le vault). ⛔ **Pas de symlink dans un vault** : tolaria ne les suit pas (dossier invisible, fichier indexé mais illisible) — les docs de repo restent dans les repos, c'est le rôle de graphify.
- 🟡 **Édition** : `Edit` + `replace_all` pour les renommages ; plusieurs `Edit` (batchés dans le même tour) pour des changements distincts ; `Write` pour créer/réécrire entièrement. Batch les `Read`.
- 🟢 **Délégation** : `Task`/`Agent` pour les opérations multi-étapes complexes. `Workflow` (multi-agents) uniquement pour les tâches massives/audits, sur opt-in explicite.

---

## Workflows Git (les miens)
Détail + diagrammes : `~/Desktop/WORKFLOW-w-Claude-Code.md`.

- 🟡 **Worktree (défaut)** : `/me:issue-worktree-pr [desc]` (isole via `gwm`).
- 🟡 **Branche (checkout courant)** : `/me:issue-branch-pr [desc]`.
- 🟡 **Sprint** : `/me:goal [desc]` — worktree autonome, merge progressif dans `dev`. (⚠️ **pas** `/goal`, qui est la commande native « condition de complétion ».)
- 🟡 **Release** : `/me:release [X.Y.Z]` — changelog (`/changelog` du projet) → bump version → merge `dev` → `main` → **tag après le merge** → release (CI sur tag, ou `gh release create`). Un `/release` propre au repo, s'il existe, fait foi.
- 🟡 **Reviews** : par défaut, la boucle **`/me:loop:claude-review-pr`** (agent Claude spawné en contexte **frais**, auto-cadencé, **depuis le worktree**, corrige les findings bloquants pertinents P0/P1/P2 jusqu'à clean, analyse de convergence). ⚠️ Même modèle que la session = angles morts partagés : sur une **PR sensible** (sécurité, argent, multi-tenant, migration de données), doubler avec **`/me:loop:codex-review-pr`** (CLI Codex local, reviewer **tiers**). En **second plan**, **`/me:check-reviews [PR#]`** manuellement (cascade interne : `@codex review` cloud → CLI locaux `codex`/`coderabbit review --agent` → bots GitHub Copilot/CodeRabbit) ; attendre la **CI verte** avant merge.
- 🟡 **CI** : `/me:loop:ci-until-green` — attend les checks du **SHA exact** de HEAD, corrige la cause racine des jobs rouges, repousse, jusqu'au vert (max 6). 🔴 Jamais de `continue-on-error`, de job désactivé, de test skippé ni de re-run à l'aveugle pour verdir : une CI aveugle est pire qu'une CI rouge.

Conventions :
- 🔴 Branche feature uniquement, **jamais sur `main`/`master`** directement.
- 🟡 Commits atomiques, **Gitmoji + Conventional Commits**, référencent l'issue.
- 🟡 Issue remplie depuis le template du repo (`.github/ISSUE_TEMPLATE/*`).
- 🟡 PR remplie depuis le template du repo (`.github/PULL_REQUEST_TEMPLATE.md`). Worktrees gérés via `gwm` (`.gwm.toml`).
- 🔴 `git status`/`git diff` avant de commit. Commit/push **uniquement** quand demandé.
- 🟢 **Au merge de PR** (pas au commit) : une note dans `~/Vault/pro` ou `perso` — pourquoi cette solution, ce que la review a attrapé qui vaut au-delà de la PR, ce qui est reporté. Seul moment où le contexte est frais et où git ne le garde pas. Jamais y redoubler changelog, doc technique ou tâche.

---

## Qualité & exécution
- 🟡 **Complétude** : si je commence une implémentation, je la termine en état fonctionnel. Pas de TODO sur du code cœur, pas de mock/stub, pas de `not implemented`. Code réel uniquement.
- 🟡 **Scope** : construire **uniquement ce qui est demandé** (MVP d'abord, YAGNI). Pas de features spéculatives ni de bloat non demandé.
- 🟡 **Diff chirurgical** : ne toucher que ce que la tâche exige. Pas d'« amélioration » du code/commentaires/formatage adjacents, pas de refacto de ce qui n'est pas cassé, épouser le style existant même si je ferais autrement. Chaque ligne modifiée doit tracer jusqu'à la demande.
- 🟡 **Suppression scopée** : supprimer uniquement ce que **mon** changement a rendu orphelin (imports, variables, fonctions). Le code mort préexistant : le signaler, pas le supprimer — sauf demande explicite. (Cas formatter repo-wide : garde-fou dans la skill `git-flow-worktree`.)
- 🔴 **Échecs** : investiguer la cause racine (WHY), jamais désactiver/skip un test ou une validation pour faire passer. Corriger la cause, pas le symptôme.
- 🟡 **Workspace propre** : supprimer les fichiers temporaires en fin de tâche. Placer tests/scripts/docs dans leurs dossiers dédiés.

---

## Communication
- 🟡 **Honnêteté pro** : pas de langage marketing ("blazingly fast", "100% secure"), pas de métriques inventées. Énoncer les trade-offs et les problèmes franchement. Dire "non testé", "MVP", "à valider" quand c'est le cas. Pousser un retour critique quand nécessaire.
- 🔴 **Conscience temporelle** : vérifier la date du jour dans le contexte `<env>` avant tout raisonnement temporel ; ne jamais présumer depuis la date de cutoff. Citer la source de l'info de date.
- 🟢 Répondre en **français** (identifiants techniques et code conservés en l'état).
