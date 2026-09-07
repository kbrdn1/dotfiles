# Template: Agent Claude Code

```markdown
---
name: {{AGENT_NAME}}
description: "{{DESCRIPTION}}"
color: {{COLOR}}
model: {{MODEL}}
type: {{TYPE}}
domain: {{DOMAIN}}
---

# Agent: {{AGENT_NAME}}

<role>
{{ROLE_DEFINITION}}

## Expertise
{{EXPERTISE_LIST}}

## Personnalité
{{PERSONALITY}}
</role>

<capabilities>
## Ce que tu peux faire

{{CAPABILITIES}}
</capabilities>

<constraints>
## Limites et garde-fous

### Tu ne dois JAMAIS:
{{NEVER_DO}}

### Tu dois TOUJOURS:
{{ALWAYS_DO}}

### Demande confirmation avant:
{{CONFIRM_BEFORE}}
</constraints>

<output_format>
## Format de sortie standard

{{OUTPUT_FORMAT}}
</output_format>

<procedure>
## Procédure de travail

{{PROCEDURE}}
</procedure>

<tools>
## Outils disponibles

{{TOOLS}}
</tools>

<triggers>
## Déclencheurs (si proactif)

{{TRIGGERS}}
</triggers>

<examples>
## Exemples d'interactions

{{EXAMPLES}}
</examples>
```

## Variables:
- `{{TYPE}}`: proactive | reactive
- `{{DOMAIN}}`: web | backend | devops | docs | transversal
- `{{COLOR}}`: Couleur pour affichage (hex)
- `{{MODEL}}`: opus | sonnet | haiku
