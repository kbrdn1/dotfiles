---
name: command-template
description: Template de reference pour creer des skills Claude Code (.claude/skills/). Contient la structure SKILL.md avec tous les champs frontmatter valides et les patterns recommandes.
user-invocable: false
---

# Template: Skill Claude Code

Les skills etendent les capacites de Claude. Chaque skill est un repertoire avec un fichier `SKILL.md` et des fichiers support optionnels.

## Structure

### Minimale
```
{nom}/
└── SKILL.md
```

### Avec fichiers support
```
{nom}/
├── SKILL.md              # Instructions principales (requis)
├── reference.md          # Documentation detaillee (charge on-demand)
├── examples/
│   └── sample.md         # Exemples de sortie attendue
└── scripts/
    └── helper.py         # Script utilitaire executable
```

## Template SKILL.md

```yaml
---
name: {{SKILL_NAME}}
description: {{DESCRIPTION}}
argument-hint: {{ARGUMENT_HINT}}
disable-model-invocation: {{true|false}}
user-invocable: {{true|false}}
allowed-tools: {{TOOLS}}
model: {{MODEL}}
context: {{fork}}
agent: {{AGENT}}
---

# {{TITLE}}

## Instructions
{{INSTRUCTIONS}}

## Procedure
{{PROCEDURE}}

## Format de Sortie
{{OUTPUT_FORMAT}}

## Exemples

### Exemple 1
Input: `/{{SKILL_NAME}} arg1`
Output: ...

## Limites
### Ce que cette skill fait:
- {{WILL_DO}}

### Ce que cette skill NE fait PAS:
- {{WILL_NOT}}
```

## Reference des Champs Frontmatter

| Champ | Requis | Description |
|-------|--------|-------------|
| `name` | Non | Nom d'affichage (kebab-case, max 64 chars). Si omis, utilise le nom du repertoire. |
| `description` | Recommande | Ce que fait la skill et quand l'utiliser. Claude l'utilise pour la decouverte automatique. |
| `argument-hint` | Non | Hint en autocompletion. Ex: `[issue-number]`, `[filename] [format]` |
| `disable-model-invocation` | Non | `true` = user seul peut invoquer. Pour effets de bord (deploy, commit). Default: `false` |
| `user-invocable` | Non | `false` = cache du menu `/`. Pour connaissances de fond. Default: `true` |
| `allowed-tools` | Non | Outils sans demande de permission. Ex: `Read, Grep, Glob`, `Bash(git *)` |
| `model` | Non | Modele quand skill active. |
| `context` | Non | `fork` pour sous-agent isole. Requiert des instructions explicites (pas juste des guidelines). |
| `agent` | Non | Type de sous-agent avec `context: fork`. Built-in: `Explore`, `Plan`, `general-purpose`. Custom: nom depuis `.claude/agents/` |
| `hooks` | Non | Hooks scopes au lifecycle de la skill. |

## Controle d'Invocation

| Configuration | User invoque | Claude invoque | Chargement en contexte |
|---------------|-------------|----------------|------------------------|
| (defaut) | Oui | Oui | Description toujours, contenu complet quand invoque |
| `disable-model-invocation: true` | Oui | Non | Description pas en contexte |
| `user-invocable: false` | Non | Oui | Description toujours, contenu complet quand invoque |

## Substitutions

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | Tous les arguments passes a l'invocation |
| `$ARGUMENTS[N]` | Argument par index (0-based) |
| `$N` | Raccourci: `$0` = premier argument, `$1` = deuxieme, etc. |
| `${CLAUDE_SESSION_ID}` | ID de session courante |

## Contexte Dynamique

Syntaxe `!`commande`` pour injecter du shell en preprocessing:

```markdown
## Contexte
- Branch: !`git branch --show-current`
- Status: !`git status --short`
- PR: !`gh pr view $0 --json title,body 2>/dev/null`
```

## Bonnes Pratiques

1. **Description riche**: Inclure keywords et cas d'usage pour decouverte automatique
2. **SKILL.md < 500 lignes**: Deplacer contenu detaille dans fichiers support
3. **Fichiers support**: Referencer depuis SKILL.md pour que Claude sache quand les charger
4. **Effets de bord**: Toujours `disable-model-invocation: true` pour deploy, commit, push, etc.
5. **Connaissances de fond**: `user-invocable: false` pour conventions, patterns, style guides
6. **Sous-agent**: `context: fork` uniquement avec instructions explicites (pas des guidelines)

## Variables du Template:
- `{{SKILL_NAME}}`: Nom de la skill (kebab-case, minuscules, chiffres, tirets)
- `{{DESCRIPTION}}`: Description pour decouverte. Inclure keywords et cas d'usage.
- `{{ARGUMENT_HINT}}`: Format des arguments attendus. Ex: `[target] [--focus area]`
- `{{TOOLS}}`: Liste outils autorises. Ex: `Read, Grep, Glob` ou `Bash(git *)`
- `{{MODEL}}`: Modele optionnel (opus, sonnet, haiku)
- `{{AGENT}}`: Sous-agent optionnel (Explore, Plan, general-purpose, ou custom)
- `{{INSTRUCTIONS}}`: Instructions detaillees pour Claude
- `{{PROCEDURE}}`: Etapes a suivre
- `{{OUTPUT_FORMAT}}`: Format de sortie attendu
