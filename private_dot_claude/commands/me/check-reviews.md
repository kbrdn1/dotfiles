---
name: check-reviews
description: "Analyser et appliquer les reviews IA — en ligne d'abord (@codex review en commentaire PR / Codex Cloud, prioritaire, charge locale nulle), puis CLI locaux (Codex, CodeRabbit) et bots GitHub (Copilot/CodeRabbit) en fallback — et maintainers sur une PR"
category: orchestration
complexity: advanced
mcp-servers: []
personas: [reviewer, implementer]
argument-hint: "<pr-url|pr-number> [--all] [--dry-run] [--auto] [--instruction \"<texte>\"] [--local] [--copilot]"
allowed-tools: Bash(gh :*), Bash(git :*), Bash(jq :*), Bash(node :*), Bash(ls :*), Bash(which :*), Bash(sleep :*), Bash(coderabbit :*), Bash(cr :*), Read, Edit, MultiEdit, Write, AskUserQuestion
---

# Analyseur et Applicateur de Reviews PR

## Contexte
- Répertoire actuel: !`pwd`
- Branche actuelle: !`git branch --show-current 2>/dev/null`
- Remote origin: !`git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | sed 's/.*github.com[:/]\(.*\)/\1/'`
- Statut git: !`git status --short 2>/dev/null | head -5`
- Codex CLI (fallback local): !`which codex >/dev/null 2>&1 && echo "✅ disponible ($(codex --version 2>/dev/null))" || echo "❌ absent"`
- Companion Codex (fallback local): !`ls -t /Users/kbrdn1/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs /Users/kbrdn1/.claude/plugins/marketplaces/openai-codex/plugins/codex/scripts/codex-companion.mjs 2>/dev/null | head -1 || echo "introuvable"`
- CodeRabbit CLI (fallback local): !`which coderabbit >/dev/null 2>&1 && echo "✅ disponible ($(coderabbit --version 2>/dev/null))" || echo "❌ absent — installer: curl -fsSL https://cli.coderabbit.ai/install.sh | sh"`
- CONTRIBUTING.md: !`cat CONTRIBUTING.md 2>/dev/null | head -80 || echo "Pas de fichier CONTRIBUTING.md"`

## Rôle
Tu es un expert en revue de code et intégration continue. Ta stratégie de review IA privilégie **le cloud d'abord** (charge locale nulle, review constante), puis bascule sur des **CLI locaux** si le en-ligne ne fonctionne pas :

1. **`@codex review`** (commentaire PR → bot **Codex Cloud**) — source prioritaire, exécutée côté GitHub, **zéro charge locale**.
2. **CLI locaux** (fallback si le en-ligne échoue, **charge la machine**) : **Codex CLI** puis **CodeRabbit CLI** en complément.
3. **Bots GitHub** (Copilot/CodeRabbit déjà postés sur la PR) + maintainers humains — dernier filet de sécurité.

Tu analyses les findings de la première source qui répond, évalues leur pertinence contextuelle, et appliques les recommandations validées avec des commits atomiques respectant les conventions du projet.

> Prérequis cloud : Codex cloud configuré pour le repo + « Code review » activé dans les settings Codex. Sur GitHub, Codex ne remonte que les issues **P0/P1** (haute priorité).
> Prérequis CLI CodeRabbit : authentifié via `coderabbit auth login --agent`.

## Analyse des Arguments

Arguments reçus: `$ARGUMENTS`

**Parsing:**
- `$1` = URL de review GitHub OU numéro de PR
  - URL format: `https://github.com/{owner}/{repo}/pull/{number}#pullrequestreview-{id}`
  - Numéro simple: `58` (utilise le repo courant)
- `--all` = Traiter toutes les reviews sans filtrer par type
- `--dry-run` = Afficher les changements sans les appliquer
- `--auto` = Mode automatique (applique tout sans confirmation)
- `--instruction "<texte>"` = Instruction one-off passée au tag (`@codex review <texte>`, ex: « for security regressions »)
- `--local` = **Forcer les CLI locaux** (Codex CLI puis CodeRabbit CLI) au lieu du cloud
- `--copilot` = **Forcer le fallback bots** : lire directement les reviews des bots GitHub (Copilot/CodeRabbit) + maintainers

## Procédure

### Phase 0: SÉLECTION DE LA SOURCE DE REVIEW

**Par défaut → `@codex review` en commentaire PR (cloud, Phase 1A).**

Routage explicite par flag :
- `--copilot` → bots GitHub directement (Phase 1C)
- `--local` → CLI locaux directement (Phase 1B)
- sinon → cloud `@codex review` (Phase 1A)

**Cascade de fallback automatique** (passer à la source suivante si la courante échoue, en l'annonçant clairement) :
1. **En ligne** : `@codex review` (Codex Cloud) — Phase 1A
2. **Local** (le en-ligne ne fonctionne pas : cloud sans réponse après timeout, repo sans Codex cloud, hors-ligne) — Phase 1B :
   - Codex CLI, puis CodeRabbit CLI en complément
3. **Bots GitHub** (Copilot/CodeRabbit déjà sur la PR) + maintainers — Phase 1C

### Phase 1A: REVIEW VIA `@codex review` (commentaire PR — mode par défaut, cloud)

1. **Identifier la PR**
   ```bash
   gh pr view {number} --json number,title,headRefName,baseRefName,author,state,url
   ```

2. **Poster le commentaire déclencheur** (le tag exact `@codex review` est obligatoire ; instruction one-off optionnelle)
   ```bash
   gh pr comment {number} --body "@codex review"
   # Avec --instruction "for security regressions" :
   gh pr comment {number} --body "@codex review for security regressions"
   ```

3. **Attendre la review du bot Codex** (réaction 👀 puis review postée). Poll borné (~5 min), filtrage par login contenant `codex` (robuste au login exact, généralement `chatgpt-codex-connector[bot]`)
   ```bash
   for i in $(seq 1 20); do
     CODEX_REVIEW=$(gh api repos/{owner}/{repo}/pulls/{number}/reviews \
       --jq '[.[] | select(.user.login | test("codex";"i"))] | last')
     [ -n "$CODEX_REVIEW" ] && [ "$CODEX_REVIEW" != "null" ] && break
     sleep 15
   done
   ```
   - Si aucune review Codex après le timeout → **fallback Phase 1B** (CLI locaux). L'annoncer (« ⚠️ Pas de réponse de @codex (cloud) — fallback sur les CLI locaux »).

4. **Récupérer la review + commentaires inline du bot Codex**
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/reviews \
     --jq '[.[] | select(.user.login | test("codex";"i"))]'
   gh api repos/{owner}/{repo}/pulls/{number}/comments \
     --jq '[.[] | select(.user.login | test("codex";"i"))]'
   ```

5. **Mapper chaque commentaire Codex vers le format interne** (Phases 2→4) : `path`→file_path, `line`/`original_line`→line_number, sévérité déduite (P0→critical, P1→high), `body`→problème + suggestion. Source = `🤖 Codex Cloud (@codex review)`.

> Note : on **n'utilise pas** `@codex fix …` (qui ferait pousser un fix par le cloud). check-reviews applique les changements **localement** pour garder des commits atomiques conformes aux conventions du repo.

### Phase 1B: REVIEW VIA CLI LOCAUX (fallback « en ligne KO » / `--local`)

**Charge la machine locale.** Deux CLI, essayés dans l'ordre. Tous deux reviewent l'**état local du dépôt** → le garde-fou de branche est obligatoire.

**🔴 Garde-fou de branche (OBLIGATOIRE, commun aux deux CLI)**
```bash
git branch --show-current   # doit == headRefName de la PR
```
- Si la branche courante ≠ `headRefName` : proposer (AskUserQuestion, ou auto si `--auto`) `gh pr checkout {number}`. Ne **jamais** lancer une review CLI sur une branche qui ne correspond pas à la PR.
```bash
git fetch origin {baseRefName}
```

#### 1B-i — Codex CLI

1. **Résoudre le chemin du companion** (version non garantie, glob des deux emplacements, le plus récent en premier)
   ```bash
   CODEX_COMPANION=$(ls -t \
     /Users/kbrdn1/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs \
     /Users/kbrdn1/.claude/plugins/marketplaces/openai-codex/plugins/codex/scripts/codex-companion.mjs \
     2>/dev/null | head -1)
   ```
   - Si vide ou `which codex` échoue → passer à **1B-ii** (CodeRabbit CLI).

2. **Lancer la review** (foreground) puis **récupérer le JSON** conforme à `review-output.schema.json`
   ```bash
   node "$CODEX_COMPANION" review --wait --base "origin/{baseRefName}" --scope branch
   node "$CODEX_COMPANION" result --json
   ```
   Structure : `verdict` (approve|needs-attention), `summary`, `findings[]` (severity critical|high|medium|low, title, body, file, line_start, line_end, confidence 0-1, recommendation), `next_steps[]`.
   - JSON non parsable / `findings` absent / exit non-zéro → passer à **1B-ii**.
   - `verdict == "approve"` et `findings == []` → rien à appliquer → rapport final (Phase 5).

3. **Mapper** : `file`→file_path, `line_start`/`line_end`→line_number, `severity`→sévérité, `title`+`body`→commentaire, `recommendation`→action, `confidence`×100→pertinence. Source = `🤖 Codex CLI (review locale)`.

#### 1B-ii — CodeRabbit CLI (complément)

> Format de sortie `--agent` à confirmer au premier run (non testé end-to-end ici).

1. **Vérifier la dispo / l'auth**
   - `which coderabbit` échoue → passer au **fallback Phase 1C**.
   - Si non authentifié : `coderabbit auth login --agent`.

2. **Lancer la review structurée pour agents** (alias `cr`)
   ```bash
   coderabbit review --agent --base "origin/{baseRefName}"
   # ou ne reviewer que les commits :
   coderabbit review --agent --base "origin/{baseRefName}" --type committed
   ```
   - Findings du dernier run si besoin : `coderabbit review findings`.
   - Échec / non authentifié / aucun finding parsable → **fallback Phase 1C**.

3. **Mapper** chaque finding (fichier, ligne, sévérité, problème, suggestion) → format interne. Source = `🐰 CodeRabbit CLI (review locale)`.

### Phase 1C: REVIEW VIA BOTS GITHUB (dernier filet / `--copilot`)

Lecture passive des reviews déjà postées sur la PR (utile car Copilot/CodeRabbit reviewent souvent en auto).

1. **Extraire les infos de la PR**
   ```bash
   gh pr view {number} --json number,title,headRefName,baseRefName,author,state,reviews
   ```

2. **Récupérer reviews + commentaires inline**
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/reviews
   gh api repos/{owner}/{repo}/pulls/{number}/comments
   ```

3. **Identifier les sources**
   - 🤖 **Agents IA**: `copilot-pull-request-reviewer[bot]`, `coderabbitai[bot]`, `github-actions[bot]`
   - 👤 **Maintainers**: Tous les autres reviewers humains
   - **Priorisation**: Maintainers > CodeRabbit > Copilot (en cas de conflit)

### Phase 2: ANALYSE ET CATÉGORISATION

Pour chaque finding/commentaire, extraire et catégoriser:

```
📝 FINDING/COMMENTAIRE #{n}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Source: {Codex Cloud (@codex review) | Codex CLI (locale) | CodeRabbit CLI (locale) | reviewer_name (bot|human)}
📁 Fichier: {file_path}:{line}
🏷️ Catégorie: {bug|security|performance|style|docs|test|refactor|nitpick}
📊 Sévérité: {critical|high|medium|low}  (cloud: P0→critical, P1→high)
🎯 Confiance: {confidence en %  — si fournie par le CLI Codex}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Problème:
{title + body}

💡 Action suggérée:
{recommendation / extracted_suggestion}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Critères de pertinence:**
- ✅ **Pertinent**: Bug avéré, faille sécurité, amélioration mesurable, non-respect conventions
- ⚠️ **Contextuel**: Dépend de l'architecture projet, préférences équipe
- ❌ **Non pertinent**: Opinion subjective, over-engineering, hors scope PR

### Phase 3: PRÉSENTATION INTERACTIVE

Pour chaque finding/commentaire (sauf si `--auto`):

```
┌─────────────────────────────────────────────────────────────────┐
│ 📝 REVIEW #{n}/{total} - {source}                               │
├─────────────────────────────────────────────────────────────────┤
│ 📁 {file}:{line}                                               │
│ 🏷️ {category} | 📊 Sévérité: {severity} | 🎯 {confidence}%    │
├─────────────────────────────────────────────────────────────────┤
│ 💬 {problème résumé}                                            │
├─────────────────────────────────────────────────────────────────┤
│ 💡 SUGGESTION:                                                  │
│ {code suggéré ou action}                                        │
├─────────────────────────────────────────────────────────────────┤
│ 🎯 ÉVALUATION CONTEXTUELLE:                                     │
│ {analyse de pertinence basée sur le projet}                     │
│ Pertinence estimée: {score}%                                    │
└─────────────────────────────────────────────────────────────────┘
```

Utiliser **AskUserQuestion** pour demander:
- ✅ Appliquer cette recommandation
- ⏭️ Passer (ne pas appliquer)
- 📝 Modifier avant d'appliquer
- 🛑 Arrêter et résumer

### Phase 4: APPLICATION DES CHANGEMENTS

Pour chaque recommandation validée:

1. **Lire le fichier cible**
   ```
   Read {file_path}
   ```

2. **Appliquer la modification**
   - Utiliser `Edit` pour modifications simples
   - Utiliser `MultiEdit` pour modifications multiples dans le même fichier

3. **Créer un commit atomique**
   ```bash
   git add {file_path}
   git commit -m "{type}: {description courte}

   Addresses review finding by {Codex|CodeRabbit|reviewer}:
   - {résumé de la modification}

   PR #{number}"
   ```

   **Types de commit** (selon conventions projet ou Conventional Commits):
   - `fix:` corrections de bugs
   - `refactor:` restructuration code
   - `style:` formatage/style
   - `docs:` documentation
   - `test:` ajout/modification tests
   - `perf:` optimisations performance
   - `security:` corrections sécurité

### Phase 5: RAPPORT FINAL ET PUSH

```
╔═══════════════════════════════════════════════════════════════╗
║                    📊 RAPPORT DE TRAITEMENT                   ║
╠═══════════════════════════════════════════════════════════════╣
║ PR: #{number} - {title}                                       ║
║ Source review: {@codex Cloud | Codex CLI | CodeRabbit CLI | Bots GitHub} ║
║ Findings/Commentaires traités: {total}                        ║
╠═══════════════════════════════════════════════════════════════╣
║ ✅ APPLIQUÉS ({count}):                                       ║
║   • {commit_hash} - {description}                             ║
╠═══════════════════════════════════════════════════════════════╣
║ ⏭️ IGNORÉS ({count}):                                         ║
║   • {file}:{line} - {raison}                                  ║
╠═══════════════════════════════════════════════════════════════╣
║ ❌ NON APPLICABLES ({count}):                                 ║
║   • {description} - {raison}                                  ║
╚═══════════════════════════════════════════════════════════════╝
```

**Demander confirmation pour push:**
```
🚀 Pousser {n} commits vers origin/{branch}?
```

Si confirmé:
```bash
git push origin {branch}
```

## Règles d'Exécution

### OBLIGATOIRE
- **TOUJOURS** privilégier le cloud `@codex review` ; ne basculer sur les CLI locaux puis les bots que selon la cascade de fallback (Phase 0)
- **TOUJOURS** utiliser le tag exact `@codex review` (instruction one-off ajoutée après, ex: `@codex review for security regressions`)
- **TOUJOURS** vérifier le garde-fou de branche avant toute review **CLI local** (Codex ou CodeRabbit) : branche courante == `headRefName`
- **TOUJOURS** lire le fichier avant de le modifier
- **TOUJOURS** vérifier que la modification n'introduit pas d'erreurs de syntaxe
- **TOUJOURS** respecter les conventions de commit du projet (CONTRIBUTING.md)
- **TOUJOURS** créer des commits atomiques (un changement = un commit)
- **JAMAIS** appliquer de modifications qui cassent la compilation/tests
- **JAMAIS** modifier des fichiers hors du scope des findings de review

### PRIORISATION DES SOURCES
1. 🤖 **`@codex review` (Codex Cloud, commentaire PR)** — source prioritaire, charge locale nulle (P0/P1)
2. 🤖 **Codex CLI (review locale)** — fallback (charge la machine), ou forcé via `--local`
3. 🐰 **CodeRabbit CLI (review locale)** — complément local si Codex CLI indisponible/échoue
4. 👤 Maintainers/CODEOWNERS (priorité maximale sur les conflits humains)
5. 🤖 CodeRabbitAI / GitHub Copilot (bots en ligne déjà postés — dernier filet) — forcé via `--copilot`

> On n'utilise **qu'une seule** source à la fois (pas de fusion par défaut) : la première de la cascade qui répond. En cas de conflit avec un maintainer humain dans une revue mixte, le maintainer prime.

### FILTRAGE INTELLIGENT
- **Ignorer automatiquement**: Commentaires de statut, badges, liens promo, réaction 👀 du bot
- **Signaler conflits**: Si deux sources suggèrent des approches différentes
- **Grouper par fichier**: Pour optimiser les modifications

## Exemples

### Exemple 1: PR simple — review @codex cloud par défaut
```
/me:check-reviews 58
```

### Exemple 2: @codex review ciblé (instruction one-off)
```
/me:check-reviews 58 --instruction "for security regressions"
```

### Exemple 3: Mode automatique
```
/me:check-reviews 58 --auto
```

### Exemple 4: Forcer les CLI locaux (Codex puis CodeRabbit)
```
/me:check-reviews 58 --local
```

### Exemple 5: Forcer le fallback bots GitHub (Copilot/CodeRabbit)
```
/me:check-reviews 58 --copilot
```

## Limites

### Ce que cette commande FAIT:
- ✅ Déclenche une review **@codex cloud** via un commentaire `@codex review` (source prioritaire, charge locale nulle)
- ✅ Bascule en fallback sur les CLI locaux (Codex CLI puis CodeRabbit CLI), puis sur les bots GitHub
- ✅ Vérifie le garde-fou de branche en mode CLI local
- ✅ Parse les commentaires Codex cloud, les findings JSON du CLI Codex et les findings `--agent` de CodeRabbit
- ✅ Évalue la pertinence contextuelle de chaque suggestion
- ✅ Permet un contrôle interactif granulaire
- ✅ Crée des commits atomiques avec messages descriptifs
- ✅ Respecte les conventions de contribution du projet
- ✅ Génère un rapport détaillé des actions

### Ce que cette commande NE FAIT PAS:
- ❌ N'utilise pas `@codex fix` (les fixes sont appliqués localement pour garder des commits atomiques)
- ❌ Ne fusionne pas plusieurs sources de review à la fois (une seule, la première qui répond)
- ❌ Ne modifie pas les fichiers sans confirmation (sauf --auto)
- ❌ Ne pousse pas automatiquement sans validation
- ❌ Ne résout pas les conflits de merge
- ❌ Ne crée pas de nouvelles PR
- ❌ N'exécute pas les tests (utiliser /sc:test après)
