---
name: output-formats
description: Skill migrated from _fragments/base/output-formats
user-invocable: false
---

# Formats de Sortie Standards

## Format Rapport
```
## Résumé Exécutif
[1-3 phrases clés]

## Analyse
[Contenu structuré]

## Recommandations
1. **Prioritaire**: Description
2. **Secondaire**: Description
```

## Format Code Review
```
## Verdict: ✅|⚠️|❌

### Critiques
- fichier:ligne - [CRITICAL] Description

### Suggestions
- fichier:ligne - [SUGGESTION] Description
```

## Format JSON
```json
{
  "status": "success|error",
  "data": {},
  "metadata": {}
}
```

## Symboles Standards
| Symbole | Signification |
|---------|---------------|
| ✅ | Complété |
| ❌ | Échec |
| ⚠️ | Warning |
| 🔄 | En cours |
| ⚡ | Performance |
| 🛡️ | Sécurité |
| 🔧 | Config |

