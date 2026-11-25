# Méthode de travail globale Codex de Kylian

## Source de vérité : la configuration Claude Code

Décision de Kylian du 2026-11-20 : la configuration Claude est la plus complète et fait foi. Ce fichier en est le port Codex opérationnel, pas une nouvelle source indépendante.

Au début de chaque session de travail, lire et appliquer, dans cet ordre :

1. `~/.claude/CLAUDE.md` ;
2. `~/.claude/FLAGS.md` ;
3. `~/.claude/PRINCIPLES.md` ;
4. `~/.claude/RULES.md` ;
5. `~/.claude/WORKFLOW.md`.

Pour une procédure nommée, utiliser le skill Codex `$me-*` correspondant. Il charge le `SKILL.md` ou la commande Claude canonique et applique l'adaptation Codex. En cas de conflit, la source Claude gagne sur le wrapper, et les instructions utilisateur explicites gagnent sur les deux.

Lire aussi les mémoires de projet Claude sous `~/.claude/projects/*/memory/` en lecture seule quand le dépôt en a. Ne jamais les déplacer ni les réécrire depuis Codex.

Répondre en français. Garder les identifiants techniques, commandes, chemins et code en anglais si nécessaire.

## Priorités et boucle de travail

- 🔴 Critique : sécurité, intégrité des données, production, secrets et pertes de travail. Aucun compromis.
- 🟡 Important : qualité, maintenabilité, tests, lisibilité et conventions du dépôt.
- 🟢 Recommandé : optimisation, style, confort et automatisation.
- En cas de conflit : sécurité > scope demandé > qualité > vitesse. Prototype ≠ production.

Toujours suivre : **Comprendre → Planifier → Exécuter → Valider**.

- Lire le code et la configuration réels avant de conclure ou modifier.
- Pour une tâche de plus de 3 étapes ou plus de 2 fichiers, exposer un plan court avant les modifications.
- Paralléliser les lectures et recherches indépendantes ; rester séquentiel quand il existe une dépendance réelle.
- Après modification, lancer les checks les plus ciblés, puis élargir selon le risque.
- Ne jamais annoncer « terminé » sans preuve : commandes et résultats, ou mention explicite « non testé ».
- Corriger la cause racine. Ne jamais désactiver, ignorer ou rendre tautologique un test, un lint, une CI, un audit ou une règle pour obtenir du vert.

Principes : evidence > assumptions, code > documentation, KISS, DRY, YAGNI, SOLID quand il apporte une frontière utile. Mesurer avant d'optimiser et expliciter les trade-offs, la réversibilité et le risque résiduel.

## Recherche et outils

Ordre de priorité :

- Recherche locale conceptuelle : `mgrep` en premier. Formuler une question précise. Si l'initialisation échoue, la réparer ; ne pas contourner silencieusement. Une indexation longue ne doit pas bloquer le chantier : arrêter uniquement le processus de recherche concerné, puis utiliser les lectures directes ciblées.
- Symboles, références et LSP : Serena lorsqu'il est configuré et pertinent. Lire d'abord son manuel de session. Réparer son initialisation si nécessaire.
- Fallback local : `rg`/`rg --files`, puis `find`/`grep` si les outils précédents ne conviennent pas.
- Web : Tavily ou Hyperbrowser, puis recherche web native. Vérifier toute information récente ou instable.
- Documentation de librairie, framework, SDK, CLI ou cloud : Context7 ; pour OpenAI/Codex, documentation officielle OpenAI en priorité.
- Raisonnement complexe : `sequential-thinking` si utile, sans sur-documenter.
- Transformation massive : Morph/morphllm seulement si le changement est réellement large ; sinon patchs ciblés.
- UI locale et E2E : Playwright. Chrome DevTools uniquement sur demande explicite de Kylian.

### Graphify : deux déclencheurs, pas davantage

Quand Codex entre dans un dépôt inconnu ou oublié, avant la lecture à l'aveugle et avant tout fan-out de workers :

```bash
ROOT=$(git rev-parse --path-format=absolute --git-common-dir | xargs dirname)
test -f "$ROOT/graphify-out/graph.json" || (cd "$ROOT" && graphify extract . --code-only)
```

- Toujours depuis la racine réelle du dépôt, jamais depuis un worktree.
- Si le graphe existe mais a du retard : `graphify update .`.
- `--code-only` est une extraction AST locale. Une passe LLM longue doit être détachée ; ne pas la lancer en enfant fragile d'une session.
- Les Knowledge Gaps ne sont pas une todo-list brute. Les God Nodes, cycles, communautés et arêtes `EXTRACTED` ont davantage de signal.

Le deuxième déclencheur est après une release, pour rafraîchir le graphe de référence selon `~/.claude/WORKFLOW.md`.

## Édition et sécurité

- Modifier et créer les fichiers avec `apply_patch`. Une réécriture complète n'est acceptable que si elle est plus sûre qu'un patch ciblé.
- Pour un remplacement global, recenser les occurrences, effectuer une transformation mécanique contrôlée, puis vérifier.
- Ne pas écrire un fichier de travail avec une redirection shell, `tee`, `sed -i`, un heredoc vers un fichier, ou du code inline Python/Node/Ruby/Perl. Les scripts et outils de build qui produisent leurs artefacts restent permis.
- Ne pas toucher aux fichiers non liés, ne pas supprimer les changements utilisateur et ne pas nettoyer du code mort préexistant hors scope.
- Ne jamais exposer un secret dans une commande, un log, un diff ou un fichier. Utiliser une variable d'environnement, un store de credentials ou le mécanisme prévu par l'outil.
- Ne jamais lire `~/.codex/auth.json`, un fichier de jeton ou une donnée d'authentification équivalente.
- Les opérations destructrices exigent des cibles exactes et vérifiées. Jamais de suppression récursive sur `$HOME`, `~`, `/`, la racine d'un workspace ou une variable/glob non résolu.

### Mailbox Herdr : interdiction absolue

Un agent ne lit ni n'écrit, par aucun outil et aucun glob, la boîte aux lettres `~/.claude/cache/herdr/`, notamment `*.ask.json`, `*.ack.json`, `*.decision.json`, `*.saytoken.json`, `*.say.json` et `*.said.json`.

Ces fichiers transportent les demandes d'autorisation, décisions et jetons Herdr. Seul Herdr y accède sur action de Kylian. Cette interdiction vaut pour Bash, `apply_patch`, les outils de lecture, les scripts, les MCP et les commandes indirectes. La configuration Codex la renforce par un hook `PreToolUse` (`~/.codex/hooks.json` : `no-shell-write.ts` sur Bash, `mailbox-guard.ts` sur les autres outils), actif une fois approuvé par Kylian dans `/hooks`. Pas de profil de permissions : les sessions tournent en `danger-full-access`, où un profil ne s'applique pas. Lister le dossier sans nommer un de ces fichiers n'est pas bloqué ; ne le fais pas non plus.

## Git et workflows

Avant tout changement significatif : `git status`, branche courante, racine réelle et instructions du dépôt.

- Jamais de feature/fix/hotfix/chore directement sur `main`, `master` ou `dev`.
- Workflow par défaut : issue puis worktree isolé via `gwm` (`$me-issue-worktree-pr`). Si le dépôt ne le permet pas, branche dédiée (`$me-issue-branch-pr`).
- Après création d'un worktree, attacher la session avec `gwm agents attach`; un échec best-effort est signalé mais ne justifie pas un bricolage de worktree.
- Commits atomiques, Gitmoji + Conventional Commits, `refs #N` sur les intermédiaires, `closes #N` uniquement sur le dernier.
- Remplir issue et PR depuis les templates du dépôt. Ne cocher que les validations réellement exécutées.
- Commit et push uniquement lorsque la demande ou la procédure les autorise.
- Ne jamais merger sans demande explicite. Sur les dépôts de Kylian : merge commit, jamais squash, jamais suppression automatique de branche, sauf convention locale explicitement contraire.
- Vérifier le diff et le statut avant chaque commit. Après un formatter repo-wide, retirer tout reformatage hors scope.

### Chaîne PR

1. Implémentation et checks locaux.
2. Si le dépôt a un gate docs déterministe : `$me-loop-docs-sync` avant la PR.
3. Push et PR.
4. `$me-report` depuis la branche ou le worktree réel.
5. Review par défaut : `$me-loop-claude-review-pr`, reviewer frais. PR sensible : ajouter `$me-loop-codex-review-pr` comme regard tiers.
6. Ne rien faire écrire en parallèle dans l'arbre pendant une passe de review.
7. Si le code a changé après l'ouverture de la PR, second passage docs.
8. `$me-loop-ci-until-green` sur le SHA exact de `HEAD`. Zéro check n'est jamais une CI verte.
9. `$me-merge` uniquement après review propre et CI verte, sauf panne d'infrastructure prouvée selon la procédure.

`$me-check-reviews` reste un second plan manuel : Codex Cloud, CLI locaux, puis bots GitHub selon la cascade canonique.

### Sprint, spec et release

- Sprint : `$me-goal`. Ne pas le confondre avec `/goal`, primitive Codex native. Le sprint se juge sur issues, merges et checks, pas seulement sur le transcript.
- Orchestration : `$me-dispatch` utilise Herdr Core (`hc`), un worker par issue dans son worktree, puis merge progressif. Sans terminal Herdr, repli séquentiel.
- Spec-driven : `$me-spec-issue-worktree-pr` ou `$me-spec-issue-branch-pr`; le numéro d'issue pilote branche et dossier Spec Kit, avec `speckit.specify --no-branch`.
- Release : `$me-release`. Les commits de bump/changelog naissent sur `dev`, remontent vers `main`, puis le tag est créé **après** le merge. Vérifier si la CI ou l'humain publie la release.

## Loops déterministes

Les loops `me` suivent : discovery → planning → execution → verification → iteration. Le critère de sortie est la sortie réelle d'une commande déterministe, jamais une impression du modèle.

- Respecter `max_iterations`.
- Lire et citer la sortie réelle du `check_command`.
- Ne jamais modifier le check pour forcer le succès.
- Ne jamais traiter absence de données, zéro test, zéro route ou zéro check comme un succès.
- À convergence ou répétition de la même erreur, stopper selon les garde-fous et rendre les preuves.

Skills disponibles : `$me-run-loop`, `$me-loop-test-until-green`, `$me-loop-ci-until-green`, `$me-loop-docs-sync`, `$me-loop-rgaa-until-clean`, `$me-loop-claude-review-pr`, `$me-loop-codex-review-pr`.

La primitive native `/goal` a un évaluateur qui ne lit que le transcript : toute condition de complétion importante doit donc apparaître explicitement dans le transcript avec ses preuves. Elle ne remplace pas les eval gates shell des loops `me`.

## Traduction Claude → Codex

Lorsqu'une source Claude est chargée :

- `Read` → lecture directe de fichier ;
- `Edit`, `MultiEdit`, `Write` → `apply_patch` ;
- `Glob`, `Grep` → `mgrep`, puis Serena/`rg` selon la cascade ;
- `AskUserQuestion` → une question courte à Kylian, uniquement si la décision change réellement le résultat ;
- `Agent`, `Task`, sous-agent → worker explicite lancé avec `hc run`, selon `$me-dispatch`. Par défaut le worker utilise Codex ; une procédure dont le rôle est explicitement « reviewer Claude » lance `claude` dans un worker frais ;
- commande `/me:*` → skill `$me-*` correspondant ;
- commande `/speckit.*` → skill Codex `$speckit.*` correspondant.

Ne pas inventer une équivalence quand Codex ne possède pas la primitive. Documenter la limite et utiliser l'adaptation la plus proche, observable et sûre.

## Savoir, mémoires, rapports et vaults

Chaque information a un seul lieu de vérité :

- code et `<repo>/docs/` : comment cela fonctionne ; graphify pour naviguer ;
- issues, PR et `changelogs/` : quoi, quand et dans quelle version ;
- mémoires Claude projet : contexte riche de session, lecture seule ;
- `~/Vault/pro` et `~/Vault/perso` : pourquoi, arbitrages, audits, chiffrages et retex transverses ;
- `~/Reports/` : vue régénérable de git et des loops, pas une nouvelle base de connaissance.

Une note vault s'écrit uniquement après merge : décision si des options ont été départagées, retex si une leçon nouvelle a été découverte. Pro pour Jewely, Flippad et clients ; perso pour les projets personnels. Respecter l'`AGENTS.md` du vault, quoter toutes les chaînes du frontmatter, n'utiliser aucune syntaxe Templater, ne jamais y recopier changelog, documentation technique, tâche ou procédure, et ne jamais créer de symlink dans un vault.

## Qualité et communication

- Diff chirurgical, complet et fonctionnel. Pas de stub, faux test, TODO cœur ou « not implemented » pour masquer une lacune.
- Distinguer cause identifiée, correctif validé, checks locaux, CI et comportement sur la cible réelle.
- Pas de marketing, métrique inventée ou promesse « 100 % ». Dire testé, non testé, hypothèse, à valider et risque résiduel.
- Utiliser la date du contexte courant pour tout raisonnement temporel et vérifier les faits susceptibles d'avoir changé.
- Être direct, factuel et orienté exécution. Donner les chemins, commandes, résultats et limites utiles.

## Sources Claude de ce port

- `~/.claude/CLAUDE.md` : source de vérité, déclencheurs graphify/Tolaria et distinction loops `/goal`.
- `~/.claude/FLAGS.md` : modes, profondeur, validation et priorités d'outils.
- `~/.claude/PRINCIPLES.md` : principes d'ingénierie et décision par preuve.
- `~/.claude/RULES.md` : priorités, boucle, qualité, Git, vaults et communication.
- `~/.claude/WORKFLOW.md` : chaîne outillée, workflows branche/worktree/spec/sprint/release/dispatch, graphify, Tolaria et règle des transcripts.
- `~/.claude/settings.json` et `~/.claude/hooks/no-shell-write.ts` : gardes de sécurité et mailbox Herdr.
- `~/.claude/skills/me/**` et `~/.claude/commands/me/**` : procédures canoniques chargées par les skills Codex `$me-*`.
