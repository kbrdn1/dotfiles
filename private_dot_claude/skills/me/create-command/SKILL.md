---
name: create-command
description: Cree une nouvelle skill Claude Code avec structure SKILL.md, frontmatter et fichiers support
argument-hint: "[nom] [--it] [--global] [--domain=web|backend|devops|docs]"
disable-model-invocation: true
---

# Meta-skill: Createur de Skills

> **Note**: Les skills remplacent les anciennes slash commands. Cette skill genere le format `skills/<nom>/SKILL.md` au lieu de `commands/<nom>.md`.

## Contexte
- Repertoire projet: !`pwd`
- Skills projet: !`ls .claude/skills/ 2>/dev/null || echo "Aucune"`
- Skills globales: !`ls ~/.claude/skills/ 2>/dev/null | head -15`
- Fragments disponibles: !`ls ~/.claude/skills/_fragments/ 2>/dev/null`

## Role
Tu es un generateur expert de skills Claude Code. Tu crees des skills bien structurees avec un SKILL.md, des fichiers support optionnels, et un frontmatter conforme au standard Claude Code.

## Analyse des Arguments

Arguments recus: `$ARGUMENTS`

**Parsing:**
- `$1` = Nom de la skill (optionnel si --it)
- `--it` = Mode interactif (pose des questions)
- `--global` = Creer dans `~/.claude/skills/` (sinon `.claude/skills/`)
- `--domain=X` = Domaine pour fragments (web, backend, devops, docs)

## Mode Interactif (si --it)

Pose ces questions sequentiellement avec AskUserQuestion:

1. **Nom**: Quel nom pour la skill? (kebab-case, lettres minuscules, chiffres, tirets, max 64 chars)
2. **Description**: Decris ce que fait cette skill et quand l'utiliser (Claude utilise ceci pour decider quand l'activer)
3. **Portee**: Globale (tous projets) ou locale (projet actuel)?
4. **Arguments**: Quels arguments la skill accepte-t-elle? (hint pour autocompletion)
5. **Invocation**: Qui peut l'invoquer? (les deux / user seul / Claude seul)
6. **Outils**: Quels outils autoriser sans confirmation? (allowed-tools)
7. **Execution**: Inline ou sous-agent? (context: fork?)
8. **Comportement**: Decris en detail ce que la skill doit faire

## Procedure de Generation

### 1. Collecter les informations
Si mode interactif: pose les questions ci-dessus
Sinon: extrais les infos des arguments

### 2. Charger les fragments pertinents
Selon le domaine specifie, integre les patterns de:
- `_fragments/base/` -> Toujours inclus
- `_fragments/{domain}/` -> Si domaine specifie

### 3. Generer la skill
Cree le repertoire et le fichier SKILL.md avec frontmatter valide.

### 4. Ecrire les fichiers
- Global: `~/.claude/skills/{nom}/SKILL.md`
- Local: `.claude/skills/{nom}/SKILL.md`
- Namespace optionnel: `{namespace}/{nom}/SKILL.md`

### 5. Confirmer la creation

## Structure de Skill Generee

### Structure minimale
```
{nom}/
└── SKILL.md
```

### Structure avec fichiers support
```
{nom}/
├── SKILL.md              # Instructions principales (requis)
├── reference.md          # Documentation detaillee (charge on-demand)
├── examples.md           # Exemples d'utilisation
└── scripts/
    └── helper.py         # Script utilitaire executable
```

### Template SKILL.md

```markdown
---
name: {nom}
description: {description detaillee pour decouverte par Claude}
argument-hint: {format arguments}
---

# {Titre de la skill}

## Instructions
{Instructions detaillees}

## Procedure
{Etapes a suivre}

## Format de Sortie
{Format attendu}

## Exemples

### Exemple 1
Input: `/{nom} arg1`
Output: ...

## Limites
### Ce que cette skill fait:
- ...

### Ce que cette skill NE fait PAS:
- ...
```

## Champs Frontmatter Valides

| Champ | Requis | Description |
|-------|--------|-------------|
| `name` | Non | Nom d'affichage. Si omis, utilise le nom du repertoire. |
| `description` | Recommande | Ce que fait la skill et quand l'utiliser. Claude l'utilise pour decidir quand l'activer. |
| `argument-hint` | Non | Hint affiche en autocompletion. Ex: `[issue-number]` |
| `disable-model-invocation` | Non | `true` = seul le user peut invoquer. Pour workflows avec effets de bord. |
| `user-invocable` | Non | `false` = cache du menu `/`. Pour connaissances de fond. |
| `allowed-tools` | Non | Outils utilisables sans demande de permission. Ex: `Read, Grep, Glob` |
| `model` | Non | Modele a utiliser quand la skill est active. |
| `context` | Non | `fork` pour executer dans un sous-agent isole. |
| `agent` | Non | Type de sous-agent quand `context: fork`. Ex: `Explore`, `Plan`, custom. |
| `hooks` | Non | Hooks scopes au lifecycle de cette skill. |

**Champs NON valides** (ne pas utiliser): `category`, `complexity`, `mcp-servers`, `personas`, `version`, `dependencies`, `command`, `wave-enabled`, `performance-profile`, `purpose`, `color`, `type`, `domain`

## Substitutions Disponibles

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | Tous les arguments passes a l'invocation |
| `$ARGUMENTS[N]` | Argument specifique par index (0-based) |
| `$N` | Raccourci pour `$ARGUMENTS[N]` ($0 = premier argument) |
| `${CLAUDE_SESSION_ID}` | ID de session courante |

## Contexte Dynamique

Utilise la syntaxe `!`commande`` pour injecter du contexte shell avant envoi a Claude:

```markdown
## Contexte
- Branch: !`git branch --show-current`
- Status: !`git status --short`
```

Les commandes s'executent en preprocessing, Claude recoit le resultat.

## Integration des Fragments par Domaine

### web
Integre automatiquement:
- Patterns React (`_fragments/web/react-patterns/SKILL.md`)
- Standards accessibilite (`_fragments/web/accessibility/SKILL.md`)

### backend
Integre automatiquement:
- Design API REST (`_fragments/backend/api-design/SKILL.md`)
- Checklist securite (`_fragments/backend/security/SKILL.md`)

### devops
Integre automatiquement:
- Templates Docker (`_fragments/devops/docker-templates/SKILL.md`)
- Patterns CI/CD (`_fragments/devops/ci-cd-patterns/SKILL.md`)

### docs
Integre automatiquement:
- Style Markdown (`_fragments/docs/markdown-style/SKILL.md`)
- Documentation API (`_fragments/docs/api-documentation/SKILL.md`)

## Regles de Generation

1. **Frontmatter valide uniquement**: Seuls les champs documentes par Claude Code
2. **Description riche**: Inclure des keywords pour la decouverte automatique par Claude
3. **Instructions explicites**: Claude a besoin d'instructions precises et actionnables
4. **Variables**: Utilise `$ARGUMENTS`, `$0`, `$1`... selon besoins
5. **SKILL.md < 500 lignes**: Deplacer le contenu detaille dans des fichiers support
6. **Fichiers support**: Referencer depuis SKILL.md pour que Claude sache quand les charger

## Controle d'Invocation

| Frontmatter | User invoque | Claude invoque | Quand charge en contexte |
|-------------|-------------|----------------|--------------------------|
| (defaut) | Oui | Oui | Description toujours, contenu complet quand invoque |
| `disable-model-invocation: true` | Oui | Non | Description pas en contexte |
| `user-invocable: false` | Non | Oui | Description toujours, contenu complet quand invoque |

## Actions Finales

1. Cree le repertoire `skills/{nom}/`
2. Ecris `SKILL.md` avec frontmatter valide
3. Cree les fichiers support si necessaire
4. Affiche confirmation avec:
   - Chemin du repertoire cree
   - Invocation: `/{nom}` ou `/{namespace}:{nom}`
   - Resume des fonctionnalites
   - Controle d'invocation configure
   - Conseil: tester avec "What skills are available?"

## Exemple Complet

Pour `/me:create-command review-pr --global --domain=backend`:

```markdown
---
name: review-pr
description: Review une PR GitHub avec focus securite et qualite backend. Utiliser quand on demande une code review, un audit de PR, ou une verification de qualite.
argument-hint: "[pr-number] [--security] [--perf]"
disable-model-invocation: true
allowed-tools: Bash(gh *)
---

# Code Review de Pull Request

## Contexte
- PR: !`gh pr view $0 --json title,body,files 2>/dev/null || echo "PR non specifiee"`
- Diff: !`gh pr diff $0 2>/dev/null | head -100`
- Checks: !`gh pr checks $0 2>/dev/null`

## Instructions
1. Analyse le diff de la PR #$0
2. Si --security: Focus vulnerabilites (injection, auth, validation)
3. Si --perf: Focus performance (N+1, memory leaks, algorithmes)
4. Sinon: Review generale complete

## Procedure
1. **Comprendre**: Lis description et contexte
2. **Analyser**: Examine chaque fichier modifie
3. **Identifier**: Liste problemes par severite
4. **Suggerer**: Propose corrections concretes

## Format de Sortie

### Resume
[1-2 phrases]

### Problemes Critiques
- [ ] fichier:ligne - Description - Suggestion

### Suggestions
- [ ] Description - Benefice

### Verdict
Approuve | Changements demandes | Rejete
```
