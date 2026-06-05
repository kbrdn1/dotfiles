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
- 🟡 **Édition** : `Edit` + `replace_all` pour les renommages ; plusieurs `Edit` (batchés dans le même tour) pour des changements distincts ; `Write` pour créer/réécrire entièrement. Batch les `Read`.
- 🟢 **Délégation** : `Task`/`Agent` pour les opérations multi-étapes complexes. `Workflow` (multi-agents) uniquement pour les tâches massives/audits, sur opt-in explicite.

---

## Workflows Git (les miens)
Détail + diagrammes : `~/Desktop/WORKFLOW-w-Claude-Code.md`.

- 🟡 **Worktree (défaut)** : `/me:issue-worktree-pr [desc]` (isole via `gwm`).
- 🟡 **Branche (checkout courant)** : `/me:issue-branch-pr [desc]`.
- 🟡 **Sprint** : `/goal [desc]` — worktree autonome, merge progressif dans `dev`.
- 🟡 **Release** : `/generate-changelog` → bump version → tag → merge `main` → release `gh`.
- 🟡 **Reviews** : attendre Copilot/autres → `/me:check-reviews [PR#] --auto` + **CI verte** avant merge.

Conventions :
- 🔴 Branche feature uniquement, **jamais sur `main`/`master`** directement.
- 🟡 Commits atomiques, **Gitmoji + Conventional Commits**, référencent l'issue.
- 🟡 Issue remplie depuis le template du repo (`.github/ISSUE_TEMPLATE/*`).
- 🟡 PR remplie depuis le template du repo (`.github/PULL_REQUEST_TEMPLATE.md`). Worktrees gérés via `gwm` (`.gwm.toml`).
- 🔴 `git status`/`git diff` avant de commit. Commit/push **uniquement** quand demandé.

---

## Qualité & exécution
- 🟡 **Complétude** : si je commence une implémentation, je la termine en état fonctionnel. Pas de TODO sur du code cœur, pas de mock/stub, pas de `not implemented`. Code réel uniquement.
- 🟡 **Scope** : construire **uniquement ce qui est demandé** (MVP d'abord, YAGNI). Pas de features spéculatives ni de bloat non demandé.
- 🔴 **Échecs** : investiguer la cause racine (WHY), jamais désactiver/skip un test ou une validation pour faire passer. Corriger la cause, pas le symptôme.
- 🟡 **Workspace propre** : supprimer les fichiers temporaires en fin de tâche. Placer tests/scripts/docs dans leurs dossiers dédiés.

---

## Communication
- 🟡 **Honnêteté pro** : pas de langage marketing ("blazingly fast", "100% secure"), pas de métriques inventées. Énoncer les trade-offs et les problèmes franchement. Dire "non testé", "MVP", "à valider" quand c'est le cas. Pousser un retour critique quand nécessaire.
- 🔴 **Conscience temporelle** : vérifier la date du jour dans le contexte `<env>` avant tout raisonnement temporel ; ne jamais présumer depuis la date de cutoff. Citer la source de l'info de date.
- 🟢 Répondre en **français** (identifiants techniques et code conservés en l'état).
