# Claude Code — inventaire de la config

> ⚠️ **Fichier généré.** Ne pas l'éditer à la main — relancer
> `python3 scripts/gen-claude-doc.py`, qui relit `~/.claude`.

La méthode de travail elle-même est décrite dans
[`private_dot_claude/RULES.md`](private_dot_claude/RULES.md) et
[`private_dot_claude/WORKFLOW.md`](private_dot_claude/WORKFLOW.md).
Ce document ne fait que lister ce qui est installé.

| | |
|---|---|
| Skills `me:*` | 28 |
| Autres skills | 42 |
| Skills liés (tiers) | 101 |
| Commandes | 69 |
| Agents | 22 |

## Skills `me:*` — ma méthode de travail

Les procédures maison : workflows git, boucles auto-cadencées, bootstrap projet,
génération de documents. Ce sont elles que `RULES.md` et `WORKFLOW.md` citent.

| Skill | Rôle |
|---|---|
| `me:banner-github` | Génère une bannière de profil GitHub (hero, PNG dark + light) au thème "Claude Dark" de kbrdn.dev — nom, titre, badge de statut, chips de stack, avatar… |
| `me:banner-repo` | Génère une bannière promo de repo (PNG dark + light) au thème "Claude Dark" — générique et adaptable au repo (wordmark, tagline, features, install, + un motif… |
| `me:banner-slim` | Génère une bannière promo "slim" (presque one-line, PNG dark + light) au thème "Claude Dark" — wordmark, tagline, install, version, sur une seule rangée |
| `me:changelog-create` | Méta-skill : génère un /changelog adapté à un projet (façon me:skill-create), basé sur le CLI changelog-generator, avec verbosité configurable gravée à la… |
| `me:check-reviews` | Analyser et appliquer les reviews IA — en ligne d'abord (@codex review en commentaire PR / Codex Cloud, prioritaire, charge locale nulle), puis CLI locaux… |
| `me:codebase-visualizer` | Transforme un dépôt en carte d'architecture isométrique interactive (HTML autonome, thème Claude Dark), publiée en artifact — blocs dimensionnés aux vraies… |
| `me:create-agent` | Cree un nouvel agent Claude Code (.claude/agents/) avec role, outils, modele et permissions |
| `me:create-command` | Cree une nouvelle skill Claude Code avec structure SKILL.md, frontmatter et fichiers support |
| `me:create-loop` | Utiliser quand l'utilisateur veut CRÉER ou définir un nouveau loop auto-cadencé (pas en lancer un existant) |
| `me:cv` | Génère et adapte le CV de Kylian Bardini à une offre ou une entreprise précise, puis produit un PDF A4 une page à la charte kbrdn.dev qui passe le contrôle ATS… |
| `me:design-pattern` | Design patterns — `select` : cadrer un besoin, poser les questions qui tranchent, recommander le patron adapté (ou aucun). `analyze` : lire du code existant,… |
| `me:devis-flippad` | Génère le devis commercial final en PDF à la charte FLIPPAD/JEWELY (en-tête émetteur/client doré, logo, tableau de lots « DÉVELOPPEMENT » avec sous-lignes… |
| `me:devis-xlsx` | Construit un classeur de devis .xlsx paramétrable à partir d'une estimation de charge en jours-homme : onglet paramètres (TJM, TVA, sélecteurs en cellules… |
| `me:flakes` | Detect the project dev stack and manage its Nix flake dev environment (init/update flake.nix + .envrc) |
| `me:lettre` | Rédige une lettre de motivation de Kylian Bardini adaptée à une entreprise et une annonce précises, puis la rend en PDF A4 à la charte kbrdn.dev |
| `me:loop:ci-until-green` | Loop auto-cadencé — attend la CI de la PR de la branche courante, lit les checks du SHA exact de HEAD, corrige la cause racine des jobs en échec et repousse,… |
| `me:loop:claude-review-pr` | Loop auto-cadencé — relance une review par agent Claude (spawné depuis la session, effort high minimum) sur la PR de la branche courante et corrige jusqu'à 0… |
| `me:loop:codex-review-pr` | Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8… |
| `me:loop:docs-sync` | Loop auto-cadencé — détecte la dérive entre la surface publique du projet (CLI, API, config) et sa documentation, met les docs à jour, et reboucle jusqu'à zéro… |
| `me:loop:rgaa-until-clean` | Loop auto-cadencé — relance l'audit d'accessibilité automatisé (axe-core / pa11y) sur les routes modifiées, corrige les violations via la skill me:rgaa, et… |
| `me:loop:test-until-green` | Loop auto-cadencé générique (tout langage) — détecte le runner de tests du projet, le relance et corrige jusqu'à ce que tous les tests passent (exit 0), max 10… |
| `me:release` | Publier une version : migration du changelog vers changelogs/<version>.md, bump des fichiers de version, merge dev → main, tag APRÈS le merge, release GitHub… |
| `me:rezero` | Traduction française fidèle et enrichie des contenus Re:Zero — IF Stories / What If en priorité, Light Novels et Web Novels ensuite |
| `me:rules` | Crée et fait évoluer les <repo>/.claude/rules/*.md path-scoped (frontmatter paths:) selon le stack du projet — conventions techniques chargées seulement quand… |
| `me:run-loop` | Utiliser quand l'utilisateur veut lancer une boucle auto-cadencée qui répète une action jusqu'à une condition de sortie observable — par ex. "boucle jusqu'à ce… |
| `me:setup` | Génère ou met à jour le CLAUDE.md d'un projet, aligné sur mes workflows (gwm worktree, mgrep/serena/context7, Git flow Gitmoji+Conventional, reviews via boucle… |
| `me:skill-create` | Expert assistant for creating custom Claude Code skills with interactive guided workflow, architecture design, code generation, and deployment automation |
| `me:visual-explainer` | Generate visual HTML pages -- diff reviews, plan reviews, project recaps, diagrams, changelogs, fact-checks, explorations, prototypes, reports, custom editors,… |

## Autres skills

Skills à part entière vivant dans le dépôt, hors namespace `me:`.

| Skill | Rôle |
|---|---|
| `aside-browser` | Read when you need a browser automation (QA, element interaction, screencapture/snapshot, network capture, so on), or have to work across user's logged-in… |
| `changelog-generator` | Generate changelogs from Git history -- extract git logs, split CHANGELOG.md into individual version files, calculate working days with French holidays |
| `chezmoi` | Use when editing, syncing, or adding ANY config file managed by chezmoi for this machine (dotfiles under ~/.config, ~/.claude, ~/.oh-my-zsh, ~/.warp, and other… |
| `claude-memory` | Create and update CLAUDE.md files following best practices |
| `cleanup-context` | Optimize memory bank files by removing duplicates, consolidating content, and archiving obsolete documentation |
| `commit` | Quick commit and push with minimal, clean messages |
| `create-pull-request` | Create and push PR with auto-generated title and description |
| `debug` | Systematic bug debugging with deep analysis and resolution |
| `deep-code-analysis` | Analyze code thoroughly to answer complex questions with detailed exploration and research |
| `design-export` | Extract a website's design system (colors, typography, spacing, components, shadows, radius) into a DESIGN.md file |
| `epct` | Systematic implementation using Explore-Plan-Code-Test methodology |
| `excalidraw-diagram` | Create Excalidraw diagram JSON files that make visual arguments |
| `explain-architecture` | Analyze and explain architectural patterns, design patterns, and structural decisions in the codebase |
| `explore` | Deep codebase exploration to answer specific questions |
| `fix-pr-comments` | Fetch PR review comments and implement all requested changes |
| `formatter-linter-expert` | Universal code formatter and linter analyzer for multi-ecosystem projects (Laravel/PHP, Bun/Node/TS/JS, React, Vue, Astro, Nuxt, Go, Rust, Deno) with… |
| `git-flow-branch` | End-to-end GitHub workflow on a branch in the current checkout — opens the issue via `gh`, creates a feature branch from the up-to-date default branch, makes… |
| `git-flow-worktree` | End-to-end GitHub workflow with an isolated git worktree — opens the issue via `gh`, creates a clean worktree with `gwm`, makes atomic Gitmoji/Conventional… |
| `gwm` | Manage git worktrees across any repository with the `gwm` Rust binary (CLI + ratatui TUI) |
| `herdr` | Control Herdr, a terminal multiplexer for coding agents |
| `oneshot` | Ultra-fast feature implementation - Explore then Code then Test |
| `premortem` | Exécute un premortem sur n'importe quel plan, lancement, produit, recrutement, stratégie ou décision |
| `prompt-agent` | Create and optimize agent prompts with agent-specific patterns |
| `prompt-command` | Create and optimize command prompts with command-specific patterns |
| `run-tasks` | Execute GitHub issues or task files with full EPCT workflow and PR creation |
| `spec-git-flow-branch` | Spec-driven end-to-end GitHub workflow on a branch in the current checkout — opens the issue via `gh`, creates a feature branch (`<type>/#<issue>-<slug>`) from… |
| `spec-git-flow-worktree` | Spec-driven end-to-end GitHub workflow in an isolated git worktree — opens the issue via `gh`, creates a clean worktree with `gwm`, then runs the full Spec Kit… |
| `speckit.analyze` | Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation |
| `speckit.checklist` | Generate a custom checklist for the current feature based on user requirements |
| `speckit.clarify` | Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec |
| `speckit.constitution` | Create or update the project constitution from interactive or provided principle inputs, ensuring all dependent templates stay in sync |
| `speckit.converge` | Assess the current codebase against the feature's spec, plan, and tasks, then append any remaining unbuilt work as new, traceable tasks to tasks.md so… |
| `speckit.implement` | Execute the implementation plan by processing and executing all tasks defined in tasks.md |
| `speckit.install` | Bootstrap the SpecKit spec-driven development system into any project directory |
| `speckit.plan` | Execute the implementation planning workflow using the plan template to generate design artifacts |
| `speckit.specify` | Create or update the feature specification from a natural language feature description |
| `speckit.tasks` | Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts |
| `speckit.taskstoissues` | Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts |
| `use-spark` | Use the spark CLI to access the user's Spark email data - list emails, search by topic, read threads, check calendar events, find availability, look up… |
| `watch-ci` | Monitor CI pipeline and automatically fix failures until green |
| `worktree-wrapper` | Manage git worktrees for fiches-pedagogiques via the local wrapper script tools/worktree-manager.sh (backed by gwq) |
| `xlsx` | Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization |

## Skills liés (non versionnés)

101 symlinks vers des installations tierces — le dépôt ne les
embarque pas, il faut réinstaller la source pour les retrouver. Le lien dit
d'où ils viennent.

| Source | Nb | Exemples |
|---|---|---|
| `(racine)` | 94 | code-research, feature-research, gws-admin-reports, gws-calendar, gws-calendar-agenda, gws-calendar-insert… |
| `default` | 1 | terminal-browser |
| `paperasse` | 6 | commissaire-aux-comptes, comptable, controleur-fiscal, fiscaliste, notaire, syndic |

## Commandes

Chaque commande est un point d'entrée léger qui délègue à un skill.

| Commande | Rôle |
|---|---|
| `0` | Monitor CI pipeline and automatically fix failures until green |
| `_fragments:backend:api-design` | — |
| `_fragments:backend:security` | — |
| `_fragments:base:output-formats` | — |
| `_fragments:base:procedures` | — |
| `_fragments:base:role-definitions` | — |
| `_fragments:devops:ci-cd-patterns` | — |
| `_fragments:devops:docker-templates` | — |
| `_fragments:docs:api-documentation` | — |
| `_fragments:docs:markdown-style` | — |
| `_fragments:web:accessibility` | — |
| `_fragments:web:react-patterns` | — |
| `_templates:agent-template` | — |
| `_templates:command-template` | — |
| `changelog-generator` | Generate comprehensive changelogs from Git history with dual formats (client-accessible and technical) including working days calculation, feature… |
| `claude-memory` | Create and update CLAUDE.md files following best practices |
| `cleanup-context` | Optimize memory bank files by removing duplicates, consolidating content, and archiving obsolete documentation |
| `commit` | Quick commit and push with minimal, clean messages |
| `create-pull-request` | Create and push PR with auto-generated title and description |
| `debug` | Systematic bug debugging with deep analysis and resolution |
| `deep-code-analysis` | Analyze code thoroughly to answer complex questions with detailed exploration and research |
| `epct` | Systematic implementation using Explore-Plan-Code-Test methodology |
| `explain-architecture` | Analyze and explain architectural patterns, design patterns, and structural decisions in the codebase |
| `explore` | Deep codebase exploration to answer specific questions |
| `fix-pr-comments` | Fetch PR review comments and implement all requested changes |
| `formatter-linter-expert` | Universal code formatter and linter analyzer for multi-ecosystem projects (Laravel/PHP, Bun/Node/TS/JS, React, Vue, Astro, Nuxt, Go, Rust, Deno) with… |
| `me:banner-github` | Génère une bannière de profil GitHub (hero, PNG dark + light) au thème Claude Dark — nom, titre, badge, chips, avatar optionnel |
| `me:banner-repo` | Génère une bannière promo de repo (PNG dark + light) au thème Claude Dark — générique et adaptable (wordmark, tagline, features, install, motif à droite) |
| `me:banner-slim` | Génère une bannière promo slim (presque one-line, PNG dark + light) au thème Claude Dark — wordmark, tagline, install, version, à embarquer dans un README |
| `me:changelog-create` | Méta-commande : génère un /changelog adapté au projet (verbosité configurable, basé sur changelog-generator) |
| `check-reviews` | Analyser et appliquer les reviews IA — en ligne d'abord (@codex review en commentaire PR / Codex Cloud, prioritaire, charge locale nulle), puis CLI locaux… |
| `me:codebase-visualizer` | Transforme un repo en carte d'architecture isométrique interactive (HTML autonome, thème Claude Dark) publiée en artifact — blocs aux vraies LOC, flux animés,… |
| `create-agent` | Crée un nouvel agent Claude Code avec rôle, capacités et limites |
| `create-command` | Crée une nouvelle slash command Claude Code avec fragments modulaires |
| `me:create-loop` | Crée un nouveau loop auto-cadencé — scaffolde la skill me:loop:<name> + sa commande /me:loop:<name> |
| `cv` | Adapte le CV à une offre/entreprise et produit un PDF A4 une page qui passe le gate ATS (pdftotext), à la charte kbrdn.dev — via la skill me:cv |
| `design-export` | Extrait le design system d'un site web (couleurs, typographie, spacing, composants) dans un DESIGN.md via Hyperbrowser |
| `me:design-pattern` | Design patterns — select : choisir le patron adapté à un besoin (ou aucun) · analyze : lire du code existant, smells + SOLID + refactorings (read-only) |
| `devis-flippad` | Génère le devis commercial final en PDF à la charte FLIPPAD/JEWELY (en-tête doré, tableau de lots, récapitulatif HT/TVA/TTC, page CGV + signature + paiement,… |
| `devis-xlsx` | Transforme une estimation de charge en jours-homme en classeur de devis .xlsx paramétrable (TJM en cellule, totaux par formule, fourchettes bas/haut,… |
| `flakes` | Detect the project dev stack and manage its Nix flake dev environment (init/update flake.nix + .envrc) |
| `issue-branch-pr` | Workflow Issue → Branche → Commits atomiques → Push → PR (sans worktree) |
| `issue-worktree-pr` | Workflow complet Issue → Worktree (gwm) → Commits atomiques → Push → PR |
| `lettre` | Rédige une lettre de motivation adaptée à une entreprise et une annonce, en PDF A4 à la charte kbrdn.dev — via la skill me:lettre |
| `me:loop:ci-until-green` | Loop auto-cadencé — attend la CI de la PR de la branche courante sur le SHA exact de HEAD et corrige la cause racine des jobs rouges jusqu'à ce que tous les… |
| `me:loop:claude-review-pr` | Loop auto-cadencé — relance une review par agent Claude (spawné depuis la session, effort high minimum) sur la PR de la branche courante et corrige jusqu'à 0… |
| `me:loop:codex-review-pr` | Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8… |
| `me:loop:docs-sync` | Loop auto-cadencé — détecte la dérive surface publique ↔ docs (CLI/API/config), met à jour, jusqu'à zéro écart, max 6 itérations. check_command PAR PROJET… |
| `me:loop:rgaa-until-clean` | Loop auto-cadencé — relance l'audit a11y automatisé (axe/pa11y) sur les routes modifiées et corrige via me:rgaa jusqu'à 0 violation détectable, max 6 itérations |
| `me:loop:test-until-green` | Loop auto-cadencé — relance `npm test` et corrige jusqu'à ce que tous les tests passent (exit 0), max 10 itérations |
| `me:release` | Publie une version : changelog → bump → merge dev → main → tag (après le merge) → release GitHub → propagation |
| `rezero` | Traduction française fidèle et enrichie d'un contenu Re:Zero (IF Stories en priorité, Light Novel, Web Novel) — via la skill me:rezero |
| `me:rgaa` | Accessibilité RGAA 4.1.2 / WCAG 2.2 — audit, correction des non-conformités ou application d'un pattern accessible (type de page, thème, composant),… |
| `me:rules` | Crée et fait évoluer les <repo>/.claude/rules/ path-scoped selon le stack du projet |
| `me:run-loop` | Lance une boucle auto-cadencée (self-pace) jusqu'à une condition de sortie observable — route vers la bonne skill loop:<name> |
| `me:setup` | Génère/maj le CLAUDE.md d'un projet aligné sur mes workflows (gwm, mgrep/serena, Git flow, reviews) |
| `me:skill-create` | Expert assistant for creating custom Claude Code skills with interactive guided workflow, architecture design, code generation, and deployment automation |
| `spec-issue-branch-pr` | Workflow spec-driven Issue → Branche → Spec Kit (specify/plan/tasks/implement) → Commits → PR (sans worktree) |
| `spec-issue-worktree-pr` | Workflow spec-driven Issue → Worktree (gwm) → Spec Kit (specify/plan/tasks/implement) → Commits → PR |
| `visual-explainer` | Generate visual HTML pages -- diff reviews, plan reviews, project recaps, diagrams, changelogs, fact-checks, explorations, prototypes, reports, custom editors,… |
| `oneshot` | Ultra-fast feature implementation - Explore then Code then Test |
| `prompt-agent` | Create and optimize agent prompts with agent-specific patterns |
| `prompt-command` | Create and optimize command prompts with command-specific patterns |
| `run-tasks` | Execute GitHub issues or task files with full EPCT workflow and PR creation |
| `brainstorm` | Interactive requirements discovery through Socratic dialogue and systematic exploration |
| `estimate` | Provide development estimates for tasks, features, or projects with intelligent analysis |
| `help` | List all available /sc commands and their functionality |
| `spec-panel` | Multi-expert specification review and improvement using renowned specification and software engineering experts |
| `watch-ci` | Monitor CI pipeline and automatically fix failures until green |

## Agents

| Agent | Rôle |
|---|---|
| `action` | Conditional action executor - performs actions only when specific conditions are met |
| `backend-architect` | Design reliable backend systems with focus on data integrity, security, and fault tolerance |
| `business-panel-experts` | Multi-expert business strategy panel synthesizing Christensen, Porter, Drucker, Godin, Kim & Mauborgne, Collins, Taleb, Meadows, and Doumont; supports… |
| `deep-research-agent` | Specialist for comprehensive research with adaptive strategies and intelligent exploration |
| `devops-architect` | Automate infrastructure and deployment processes with focus on reliability and observability |
| `explore-codebase` | Use this agent whenever you need to explore the codebase to realize a feature |
| `explore-docs` | Use this agent IMMEDIATELY when the user asks about library features, implementation methods, "how to do X with Y library", documentation searches, or ANY… |
| `frontend-architect` | Create accessible, performant user interfaces with focus on user experience and modern frameworks |
| `jean-claude` | Professeur Rust socratique strict - ne donne jamais la réponse, guide par les questions |
| `learning-guide` | Teach programming concepts and explain code with focus on understanding through progressive learning and practical examples |
| `performance-engineer` | Optimize system performance through measurement-driven analysis and bottleneck elimination |
| `python-expert` | Deliver production-ready, secure, high-performance Python code following SOLID principles and modern best practices |
| `quality-engineer` | Ensure software quality through comprehensive testing strategies and systematic edge case detection |
| `refactoring-expert` | Improve code quality and reduce technical debt through systematic refactoring and clean code principles |
| `requirements-analyst` | Transform ambiguous project ideas into concrete specifications through systematic requirements discovery and structured analysis |
| `root-cause-analyst` | Systematically investigate complex problems to identify underlying causes through evidence-based analysis and hypothesis testing |
| `security-engineer` | Identify security vulnerabilities and ensure compliance with security standards and best practices |
| `Snipper` | Use this agent when you need to modify code |
| `socratic-mentor` | Educational guide specializing in Socratic method for programming knowledge with focus on discovery learning through strategic questioning |
| `system-architect` | Design scalable system architecture with focus on maintainability and long-term technical decisions |
| `technical-writer` | Create clear, comprehensive technical documentation tailored to specific audiences with focus on usability and accessibility |
| `websearch` | Use this agent when you need to make a quick web search |

## Divers

- **Output styles** : `assistant`, `honnest`, `senior-dev`
- **Hooks** : `herdr-agent-state.sh`
