---
name: create-command
description: "Crée une nouvelle slash command Claude Code avec fragments modulaires"
category: meta
complexity: intermediate
mcp-servers: []
personas: []
argument-hint: "[nom] [--it] [--global] [--domain=web|backend|devops|docs]"
---

# Méta-commande: Créateur de Slash Commands

## Contexte
- Répertoire projet: !`pwd`
- Commands projet: !`ls .claude/commands/ 2>/dev/null || echo "Aucune"`
- Commands globales: !`ls ~/.claude/commands/sc/ 2>/dev/null | head -10`
- Fragments disponibles: !`ls ~/.claude/commands/_fragments/ 2>/dev/null`

## Rôle
Tu es un générateur expert de slash commands Claude Code. Tu crées des commandes `.md` bien structurées, documentées et intégrées au framework SuperClaude existant.

## Analyse des Arguments

Arguments reçus: `$ARGUMENTS`

**Parsing:**
- `$1` = Nom de la commande (optionnel si --it)
- `--it` = Mode interactif (pose des questions)
- `--global` = Créer dans `~/.claude/commands/` (sinon `.claude/commands/`)
- `--domain=X` = Domaine pour fragments (web, backend, devops, docs)

## Mode Interactif (si --it)

Pose ces questions séquentiellement avec AskUserQuestion:

1. **Nom**: Quel nom pour la commande? (kebab-case, sans .md)
2. **Description**: Décris brièvement ce que fait cette commande
3. **Portée**: Globale (tous projets) ou locale (projet actuel)?
4. **Arguments**: Quels arguments la commande accepte-t-elle?
5. **Domaine**: web, backend, devops, docs, ou général?
6. **Outils**: Quels outils MCP ou Bash nécessaires?
7. **Comportement**: Décris en détail ce que la commande doit faire

## Procédure de Génération

### 1. Collecter les informations
Si mode interactif: pose les questions ci-dessus
Sinon: extrais les infos des arguments

### 2. Charger les fragments pertinents
Selon le domaine spécifié, intègre les patterns de:
- `_fragments/base/` → Toujours inclus
- `_fragments/{domain}/` → Si domaine spécifié

### 3. Générer la commande
Utilise le template `_templates/command-template.md` et remplace les variables.

### 4. Écrire le fichier
- Global: `~/.claude/commands/{nom}.md`
- Local: `.claude/commands/{nom}.md`
- Namespace optionnel: `{namespace}/{nom}.md`

### 5. Confirmer la création

## Structure de Commande Générée

```markdown
---
name: {nom}
description: "{description}"
category: {utility|orchestration|analysis|generation}
complexity: {low|basic|intermediate|advanced}
mcp-servers: [{serveurs}]
personas: [{personas}]
argument-hint: "{format arguments}"
---

# {Titre de la commande}

## Contexte
!`commande bash pour contexte`

## Rôle
{Définition du rôle basée sur _fragments/base/role-definitions.md}

## Instructions
{Instructions détaillées pour la commande}

## Procédure
{Étapes basées sur _fragments/base/procedures.md}

## Format de Sortie
{Format basé sur _fragments/base/output-formats.md}

## Exemples
### Exemple 1
Input: `/nom-commande arg1`
Output: ...

## Limites
### Ce que cette commande fait:
- ...

### Ce que cette commande NE fait PAS:
- ...
```

## Intégration des Fragments par Domaine

### web
Intègre automatiquement:
- Patterns React (`_fragments/web/react-patterns.md`)
- Standards accessibilité (`_fragments/web/accessibility.md`)

### backend
Intègre automatiquement:
- Design API REST (`_fragments/backend/api-design.md`)
- Checklist sécurité (`_fragments/backend/security.md`)

### devops
Intègre automatiquement:
- Templates Docker (`_fragments/devops/docker-templates.md`)
- Patterns CI/CD (`_fragments/devops/ci-cd-patterns.md`)

### docs
Intègre automatiquement:
- Style Markdown (`_fragments/docs/markdown-style.md`)
- Documentation API (`_fragments/docs/api-documentation.md`)

## Règles de Génération

1. **Frontmatter obligatoire**: Toujours `name`, `description`, `category`
2. **Contexte dynamique**: Utilise `!`commande`` pour collecter contexte pertinent
3. **Instructions explicites**: Claude a besoin d'instructions précises
4. **Variables**: Utilise `$ARGUMENTS`, `$1`, `$2`... selon besoins
5. **Cohérence SuperClaude**: Respecte les conventions existantes

## Actions Finales

1. Crée le répertoire si nécessaire
2. Écris le fichier `.md`
3. Affiche confirmation avec:
   - ✅ Chemin du fichier créé
   - 📝 Commande d'invocation: `/{nom}` ou `/me:{nom}`
   - 📋 Résumé des fonctionnalités
   - 💡 Conseil d'utilisation

## Exemple Complet

Pour `/me:create-command review-pr --global --domain=backend`:

```markdown
---
name: review-pr
description: "Review une PR GitHub avec focus sécurité et qualité"
category: analysis
complexity: intermediate
mcp-servers: []
personas: [reviewer]
argument-hint: "[pr-number] [--security] [--perf]"
---

# Code Review de Pull Request

## Contexte
- PR: !`gh pr view $1 --json title,body,files 2>/dev/null || echo "PR non spécifiée"`
- Diff: !`gh pr diff $1 2>/dev/null | head -100`
- Checks: !`gh pr checks $1 2>/dev/null`

## Rôle
Tu es un code reviewer senior spécialisé en qualité et sécurité backend.

## Instructions
1. Analyse le diff de la PR #$1
2. Si --security: Focus vulnérabilités (injection, auth, validation)
3. Si --perf: Focus performance (N+1, memory leaks, algorithmes)
4. Sinon: Review générale complète

## Procédure
1. **Comprendre**: Lis description et contexte
2. **Analyser**: Examine chaque fichier modifié
3. **Identifier**: Liste problèmes par sévérité
4. **Suggérer**: Propose corrections concrètes

## Format de Sortie
## Résumé
[1-2 phrases]

## Problèmes Critiques
- [ ] fichier:ligne - Description - Suggestion

## Suggestions
- [ ] Description - Bénéfice

## Verdict
✅ Approuvé | ⚠️ Changements demandés | ❌ Rejeté
```
