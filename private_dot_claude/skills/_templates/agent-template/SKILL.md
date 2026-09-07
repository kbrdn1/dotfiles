---
name: agent-template
description: Template de reference pour creer des sous-agents Claude Code (.claude/agents/). Contient le format frontmatter YAML, les champs supportes, et les patterns recommandes.
user-invocable: false
---

# Template: Sous-Agent Claude Code

Les sous-agents sont des fichiers markdown avec frontmatter YAML dans `.claude/agents/` (projet) ou `~/.claude/agents/` (global). Chaque sous-agent s'execute dans sa propre fenetre de contexte avec une invite systeme personnalisee, des outils specifiques et des permissions independantes.

## Format du Fichier Agent

```markdown
---
name: {{AGENT_NAME}}
description: {{DESCRIPTION}}
tools: {{TOOLS}}
model: {{MODEL}}
permissionMode: {{PERMISSION_MODE}}
skills:
  - {{SKILL_TO_PRELOAD}}
hooks:
  PreToolUse:
    - matcher: "{{TOOL_NAME}}"
      hooks:
        - type: command
          command: "{{VALIDATION_SCRIPT}}"
---

{{SYSTEM_PROMPT}}

Tu es {{AGENT_NAME}}, {{ROLE_DESCRIPTION}}.

## Expertise
- {{EXPERTISE_1}}
- {{EXPERTISE_2}}
- {{EXPERTISE_3}}

## Quand invoque:
1. {{STEP_1}}
2. {{STEP_2}}
3. {{STEP_3}}

## Regles
- Ne JAMAIS: {{NEVER_DO}}
- TOUJOURS: {{ALWAYS_DO}}
- Demander confirmation avant: {{CONFIRM_BEFORE}}

## Format de sortie
{{OUTPUT_FORMAT}}
```

## Reference des Champs Frontmatter

| Champ | Requis | Description |
|-------|--------|-------------|
| `name` | Oui | Identifiant unique (lettres minuscules, tirets) |
| `description` | Oui | Quand Claude doit deleguer. Inclure "use proactively" pour activation proactive. |
| `tools` | Non | Outils autorises. Herite de tous si omis. |
| `disallowedTools` | Non | Outils a refuser, supprimes de la liste heritee. |
| `model` | Non | `sonnet` (defaut), `opus`, `haiku`, `inherit` |
| `permissionMode` | Non | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `skills` | Non | Skills prechargees (contenu complet injecte au demarrage). |
| `hooks` | Non | Hooks lifecycle: `PreToolUse`, `PostToolUse`, `Stop` |

## Modes de Permission

| Mode | Comportement |
|------|-------------|
| `default` | Verification standard avec invites |
| `acceptEdits` | Acceptation auto des modifications fichiers |
| `dontAsk` | Refus auto des invites (outils pre-autorises fonctionnent) |
| `bypassPermissions` | Ignore toutes les verifications (prudence!) |
| `plan` | Mode plan, exploration lecture seule |

## Agents Built-in

| Agent | Modele | Outils | Usage |
|-------|--------|--------|-------|
| `Explore` | haiku | Lecture seule | Recherche et exploration codebase |
| `Plan` | herite | Lecture seule | Recherche pour planification |
| `general-purpose` | herite | Tous | Taches complexes multi-etapes |

## Integration avec les Skills

### Precharger des skills dans un agent
```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
```
Le contenu complet des skills est injecte au demarrage. Les sous-agents n'heritent PAS des skills de la conversation parent.

### Referencer un agent depuis une skill
```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: {{AGENT_NAME}}
---

Instructions pour le sous-agent...
```
Avec `context: fork`, le contenu de la skill devient le prompt du sous-agent.

## Hooks dans les Agents

### PreToolUse (valider avant execution)
```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
```

### PostToolUse (action apres execution)
```yaml
hooks:
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
```

### Stop (nettoyage a la fin)
```yaml
hooks:
  Stop:
    - hooks:
        - type: command
          command: "./scripts/cleanup.sh"
```

## Variables:
- `{{AGENT_NAME}}`: Nom (kebab-case, lettres minuscules, tirets)
- `{{DESCRIPTION}}`: Quand Claude doit deleguer a cet agent
- `{{TOOLS}}`: Outils autorises. Ex: `Read, Grep, Glob, Bash`
- `{{MODEL}}`: sonnet (defaut), opus, haiku, inherit
- `{{PERMISSION_MODE}}`: default, acceptEdits, dontAsk, bypassPermissions, plan
- `{{SKILL_TO_PRELOAD}}`: Nom de skill a precharger
- `{{SYSTEM_PROMPT}}`: Invite systeme complete en markdown
