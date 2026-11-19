# Claude Code — inventaire de la config

> ⚠️ **Fichier généré.** Ne pas l'éditer à la main — relancer
> `python3 scripts/gen-claude-doc.py`, qui relit `~/.claude`.

La méthode de travail elle-même est décrite dans
[`private_dot_claude/RULES.md`](private_dot_claude/RULES.md) et
[`private_dot_claude/WORKFLOW.md`](private_dot_claude/WORKFLOW.md).
Ce document ne fait que lister ce qui est installé.

| | |
|---|---|
| Skills `me:*` | 32 |
| Autres skills | 45 |
| Skills liés (tiers) | 102 |
| Commandes | 73 |
| Agents | 22 |

## Skills `me:*` — ma méthode de travail

Les procédures maison : workflows git, boucles auto-cadencées, bootstrap projet,
génération de documents. Ce sont elles que `RULES.md` et `WORKFLOW.md` citent.

| Skill | Rôle |
|---|---|
| `me:banner-github` | Génère une bannière de profil GitHub (hero, PNG dark + light) au design de kbrdn.dev (panneau sur champ en dither) — nom, titre, badge de statut, chips de… |
| `me:banner-repo` | Génère une bannière promo de repo (PNG dark + light) au design des fiches de kbrdn.dev (panneau sur champ en dither) — adaptée au repo : wordmark, tagline,… |
| `me:banner-slim` | Génère une bannière promo "slim" (presque one-line, PNG dark + light) au design de kbrdn.dev (panneau sur champ en dither) — wordmark, tagline, install,… |
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
| `me:dispatch` | Orchestre un gros chantier en hiérarchie d'agents avec Herdr Core (hc) : le lead (cette session) lance un worker Claude par issue, chacun dans son worktree gwm… |
| `me:flakes` | Detect the project dev stack and manage its Nix flake dev environment (init/update flake.nix + .envrc) |
| `me:goal` | Workflow sprint : découpe un objectif en issues avec dépendances (bloquée par), pose le plan me:report en page vivante (kanban, graphe), puis mène chaque issue… |
| `me:lettre` | Rédige une lettre de motivation de Kylian Bardini adaptée à une entreprise et une annonce précises, puis la rend en PDF A4 à la charte kbrdn.dev |
| `me:loop:ci-until-green` | Loop auto-cadencé — attend la CI de la PR de la branche courante, lit les checks du SHA exact de HEAD, corrige la cause racine des jobs en échec et repousse,… |
| `me:loop:claude-review-pr` | Loop auto-cadencé — relance une review par agent Claude (spawné depuis la session, effort high minimum) sur la PR de la branche courante et corrige jusqu'à 0… |
| `me:loop:codex-review-pr` | Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8… |
| `me:loop:docs-sync` | Loop auto-cadencé — détecte la dérive entre la surface publique du projet (CLI, API, config) et sa documentation, met les docs à jour, et reboucle jusqu'à zéro… |
| `me:loop:rgaa-until-clean` | Loop auto-cadencé — relance l'audit d'accessibilité automatisé (axe-core / pa11y) sur les routes modifiées, corrige les violations via la skill me:rgaa, et… |
| `me:loop:test-until-green` | Loop auto-cadencé générique (tout langage) — détecte le runner de tests du projet, le relance et corrige jusqu'à ce que tous les tests passent (exit 0), max 10… |
| `me:merge` | Merger la PR de la branche courante sur sa base (dev), fermer l'issue liée, remettre le checkout principal à jour sans écraser ses commits locaux, et écrire la… |
| `me:release` | Publier une version : migration du changelog vers changelogs/<version>.md, bump des fichiers de version, merge dev → main, tag APRÈS le merge, release GitHub… |
| `me:report` | Rapport HTML local et live d'une branche à l'entrée en review : faits collectés par script (fichiers, diffs, commits, review, CI du sha exact) pour 0 token,… |
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
| `aside-browser` | Read when you need a browser, or have to work across user's logged-in websites (e.g |
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
| `herdr-automations` | Write Sheprd automations: small Luau scripts that run on a schedule or by hand to pull a branch, run validation or commands, start agents in new worktrees with… |
| `herdr-gpui-browser` | Open a browser tab in Sheprd beside your terminal to show the user a web page, HTML file, or mockup, and get back their notes and picks |
| `herdr-mods` | Write Sheprd mods: small sandboxed Luau extensions that add a status bar item, a sidebar section, a section of the right-hand mod panel, palette commands, or… |
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

102 symlinks vers des installations tierces — le dépôt ne les
embarque pas, il faut réinstaller la source pour les retrouver. Le lien dit
d'où ils viennent.

| Source | Nb | Exemples |
|---|---|---|
| `(racine)` | 95 | code-research, feature-research, gws-admin-reports, gws-calendar, gws-calendar-agenda, gws-calendar-insert… |
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
| `me:changelog-create` | Génère un /changelog adapté au projet, basé sur changelog-generator, avec verbosité configurable, via la skill me:changelog-create |
| `me:check-reviews` | Analyser et appliquer les reviews IA — en ligne d'abord (@codex review en commentaire PR / Codex Cloud, prioritaire, charge locale nulle), puis CLI locaux… |
| `me:codebase-visualizer` | Transforme un repo en carte d'architecture isométrique interactive (HTML autonome, thème Claude Dark) publiée en artifact — blocs aux vraies LOC, flux animés,… |
| `me:create-agent` | Crée un nouvel agent Claude Code avec rôle, capacités et limites |
| `me:create-command` | Crée une nouvelle slash command Claude Code avec fragments modulaires |
| `me:create-loop` | Crée un nouveau loop auto-cadencé sur mesure et scaffolde la skill me:loop:<name> et sa commande, via la skill me:create-loop |
| `me:cv` | Adapte le CV à une offre/entreprise et produit un PDF A4 une page qui passe le gate ATS (pdftotext), à la charte kbrdn.dev — via la skill me:cv |
| `me:design-export` | Extrait le design system d'un site web (couleurs, typographie, spacing, composants) dans un DESIGN.md via Hyperbrowser |
| `me:design-pattern` | Design patterns : select (recommander le patron adapté, ou aucun) ou analyze (patterns présents, code smells, violations SOLID), via la skill me:design-pattern |
| `me:devis-flippad` | Génère le devis commercial final en PDF à la charte FLIPPAD/JEWELY (en-tête doré, tableau de lots, récapitulatif HT/TVA/TTC, page CGV + signature + paiement,… |
| `me:devis-xlsx` | Transforme une estimation de charge en jours-homme en classeur de devis .xlsx paramétrable (TJM en cellule, totaux par formule, fourchettes bas/haut,… |
| `me:dispatch` | Orchestre des issues en parallèle avec Herdr Core (hc) : un worker Claude par issue dans son worktree gwm, reprise du travail en cours, plan me:report en… |
| `me:flakes` | Detect the project dev stack and manage its Nix flake dev environment (init/update flake.nix + .envrc) |
| `me:goal` | Workflow sprint : découpe un objectif en issues avec dépendances, plan me:report vivant, chaque issue débloquée menée en worktree jusqu'au merge progressif… |
| `me:issue-branch-pr` | Workflow Issue → Branche → Commits atomiques → Push → PR (sans worktree) |
| `me:issue-worktree-pr` | Workflow complet Issue → Worktree (gwm) → Commits atomiques → Push → PR |
| `me:lettre` | Rédige une lettre de motivation adaptée à une entreprise et une annonce, en PDF A4 à la charte kbrdn.dev — via la skill me:lettre |
| `me:loop:ci-until-green` | Loop auto-cadencé — attend la CI de la PR de la branche courante sur le SHA exact de HEAD et corrige la cause racine des jobs rouges jusqu'à ce que tous les… |
| `me:loop:claude-review-pr` | Loop auto-cadencé — relance une review par agent Claude (spawné depuis la session, effort high minimum) sur la PR de la branche courante et corrige jusqu'à 0… |
| `me:loop:codex-review-pr` | Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8… |
| `me:loop:docs-sync` | Loop auto-cadencé — détecte la dérive surface publique ↔ docs (CLI/API/config), met à jour, jusqu'à zéro écart, max 6 itérations. check_command PAR PROJET… |
| `me:loop:rgaa-until-clean` | Loop auto-cadencé — relance l'audit a11y automatisé (axe/pa11y) sur les routes modifiées et corrige via me:rgaa jusqu'à 0 violation détectable, max 6 itérations |
| `me:loop:test-until-green` | Loop auto-cadencé — relance `npm test` et corrige jusqu'à ce que tous les tests passent (exit 0), max 10 itérations |
| `me:merge` | Merge la PR de la branche courante sur dev, ferme l'issue, met le checkout principal à jour et écrit la note vault, via la skill me:merge |
| `me:release` | Publie une version : changelog, bump, merge dev vers main, tag après le merge, release GitHub, propagation, via la skill me:release |
| `me:report` | Rapport HTML local et live de la branche courante (faits par script, texte par section, refresh des sections en retard), ou page de plan avec --plan <slug>,… |
| `me:rezero` | Traduction française fidèle et enrichie d'un contenu Re:Zero (IF Stories en priorité, Light Novel, Web Novel) — via la skill me:rezero |
| `me:rgaa` | Accessibilité RGAA 4.1.2 / WCAG 2.2 : audit, correction des non-conformités ou pattern accessible, via la skill me:rgaa |
| `me:rules` | Crée et fait évoluer les <repo>/.claude/rules/*.md path-scoped selon le stack du projet, via la skill me:rules |
| `me:run-loop` | Lance une boucle auto-cadencée jusqu'à une condition de sortie observable, en routant vers la bonne skill me:loop:<name>, via la skill me:run-loop |
| `me:setup` | Génère ou met à jour le CLAUDE.md d'un projet aligné sur mes workflows, via la skill me:setup |
| `me:skill-create` | Expert assistant for creating custom Claude Code skills with interactive guided workflow, architecture design, code generation, and deployment automation |
| `me:spec-issue-branch-pr` | Workflow spec-driven Issue → Branche → Spec Kit (specify/plan/tasks/implement) → Commits → PR (sans worktree) |
| `me:spec-issue-worktree-pr` | Workflow spec-driven Issue → Worktree (gwm) → Spec Kit (specify/plan/tasks/implement) → Commits → PR |
| `me:visual-explainer` | Generate visual HTML pages -- diff reviews, plan reviews, project recaps, diagrams, changelogs, fact-checks, explorations, prototypes, reports, custom editors,… |
| `oneshot` | Ultra-fast feature implementation - Explore then Code then Test |
| `prompt-agent` | Create and optimize agent prompts with agent-specific patterns |
| `prompt-command` | Create and optimize command prompts with command-specific patterns |
| `run-tasks` | Execute GitHub issues or task files with full EPCT workflow and PR creation |
| `sc:brainstorm` | Interactive requirements discovery through Socratic dialogue and systematic exploration |
| `sc:estimate` | Provide development estimates for tasks, features, or projects with intelligent analysis |
| `sc:help` | List all available /sc commands and their functionality |
| `sc:spec-panel` | Multi-expert specification review and improvement using renowned specification and software engineering experts |
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
- **Hooks** : `herdr-agent-state.sh`, `no-shell-write.allow`, `no-shell-write.check.ts`, `no-shell-write.ts`
