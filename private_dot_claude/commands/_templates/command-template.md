# Template: Slash Command Claude Code

```markdown
---
name: {{COMMAND_NAME}}
description: "{{DESCRIPTION}}"
category: {{CATEGORY}}
complexity: {{COMPLEXITY}}
mcp-servers: [{{MCP_SERVERS}}]
personas: [{{PERSONAS}}]
argument-hint: {{ARGUMENT_HINT}}
---

# {{TITLE}}

## Contexte
{{CONTEXT_COMMANDS}}

## Rôle
{{ROLE_DEFINITION}}

## Instructions
{{INSTRUCTIONS}}

## Procédure
{{PROCEDURE}}

## Format de Sortie
{{OUTPUT_FORMAT}}

## Exemples
{{EXAMPLES}}

## Limites
### Ce que cette commande fait:
- {{WILL_DO}}

### Ce que cette commande NE fait PAS:
- {{WILL_NOT}}
```

## Variables à remplacer:
- `{{COMMAND_NAME}}`: Nom de la commande (kebab-case)
- `{{DESCRIPTION}}`: Description courte pour /help
- `{{CATEGORY}}`: utility | orchestration | analysis | generation
- `{{COMPLEXITY}}`: low | basic | intermediate | advanced
- `{{MCP_SERVERS}}`: Liste des serveurs MCP requis
- `{{PERSONAS}}`: Liste des personas activés
- `{{ARGUMENT_HINT}}`: Format des arguments attendus
- `{{CONTEXT_COMMANDS}}`: Commandes !`bash` pour contexte
- `{{ROLE_DEFINITION}}`: Définition du rôle Claude
- `{{INSTRUCTIONS}}`: Instructions détaillées
- `{{PROCEDURE}}`: Étapes à suivre
- `{{OUTPUT_FORMAT}}`: Format de sortie attendu
- `{{EXAMPLES}}`: Exemples d'utilisation
