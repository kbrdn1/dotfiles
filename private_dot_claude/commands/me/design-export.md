---
name: design-export
description: "Extrait le design system d'un site web (couleurs, typographie, spacing, composants) dans un DESIGN.md via Hyperbrowser"
category: design
complexity: simple
mcp-servers: ["hyperbrowser"]
personas: []
argument-hint: "<url>"
allowed-tools: ["Bash", "Read", "Write", "WebFetch", "Skill"]
---

# /me:design-export

Slash command qui invoque la skill `design-export` pour extraire le design system d'un site web et l'exporter dans un fichier `DESIGN.md` à la racine du projet courant.

## Arguments

- `<url>` (requis) : URL du site cible. Le `https://` est ajouté automatiquement s'il manque.

## Usage

```
/me:design-export stripe.com
/me:design-export https://linear.app
/me:design-export anthropic.com
```

## Comportement

1. Invoquer la skill `design-export` via le tool Skill avec l'URL en argument
2. Laisser la skill orchestrer l'extraction (MCP > SDK fallback)
3. La skill écrit `DESIGN.md` dans `cwd`
4. Rapporter en une ligne ce qui a été écrit (sections, nombre de tokens extraits)

## Règles

- Ne pas hallucinent de valeurs : seules les données réellement extraites par Hyperbrowser sont écrites
- Aucune section vide dans le `DESIGN.md` final (omettre si pas de data)
- Pas de commit automatique du `DESIGN.md` - l'utilisateur garde le contrôle git
- Si aucun transport Hyperbrowser disponible (MCP ou SDK), arrêter et indiquer clairement quoi installer

## Prerequisites

L'un des deux doit être disponible :
- **Serveur MCP Hyperbrowser** (recommandé) : `npm i -g hyperbrowser-mcp` puis `claude mcp add hyperbrowser hyperbrowser-mcp --scope user -e HYPERBROWSER_API_KEY=<key>`
- **SDK Node** : `@hyperbrowser/sdk` résolu à la volée via `bunx` + variable d'env `HYPERBROWSER_API_KEY`

## Voir aussi

- Skill complète : `~/.claude/skills/design-export/SKILL.md`
- Source originale : `hyperbrowserai/examples` sur GitHub
