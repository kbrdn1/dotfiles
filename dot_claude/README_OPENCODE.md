# Configuration OpenCode pour SuperClaude

Ce répertoire contient la configuration SuperClaude adaptée pour OpenCode.

## Installation

### 1. Copier la configuration globale

```bash
# Copier le fichier de configuration dans le répertoire OpenCode
cp ~/.claude/opencode.jsonc ~/.config/opencode/opencode.jsonc

# Ou créer un lien symbolique pour synchronisation automatique
ln -s ~/.claude/opencode.jsonc ~/.config/opencode/opencode.jsonc
```

### 2. Copier les agents

```bash
# Créer le répertoire des agents OpenCode
mkdir -p ~/.config/opencode/agent

# Copier les agents SuperClaude
cp ~/.claude/agents/*.md ~/.config/opencode/agent/
```

### 3. Copier les instructions

```bash
# Les instructions seront chargées depuis ~/.claude/ si vous utilisez OpenCode
# depuis ce répertoire, sinon copiez-les :
cp ~/.claude/CLAUDE.md ~/.config/opencode/
cp ~/.claude/RULES.md ~/.config/opencode/
cp ~/.claude/FLAGS.md ~/.config/opencode/
cp ~/.claude/PRINCIPLES.md ~/.config/opencode/
cp ~/.claude/BUSINESS_*.md ~/.config/opencode/
cp ~/.claude/MODE_*.md ~/.config/opencode/
cp ~/.claude/MCP_*.md ~/.config/opencode/
```

## Structure de Configuration

### opencode.jsonc

Configuration principale avec :
- **Modèles** : Claude Sonnet 4 (principal) + Haiku (léger)
- **Instructions** : Framework SuperClaude complet
- **Agents** : 13 agents spécialisés
- **Commandes** : Raccourcis pour modes de pensée
- **Permissions** : Validation des commandes bash
- **MCP** : Support pour serveurs MCP

### Agents Disponibles

- `backend-architect` : Architecture backend et API
- `frontend-architect` : Architecture frontend et UI
- `security-engineer` : Analyse de sécurité
- `performance-engineer` : Optimisation performance
- `quality-engineer` : Qualité et tests
- `devops-architect` : DevOps et infrastructure
- `refactoring-expert` : Refactoring de code
- `root-cause-analyst` : Debug et analyse
- `requirements-analyst` : Analyse des besoins
- `technical-writer` : Documentation
- `business-panel` : Analyse multi-perspectives
- `explore-codebase` : Exploration de code
- `explore-docs` : Exploration documentation

### Commandes Personnalisées

- `/brainstorm <sujet>` : Mode brainstorming collaboratif
- `/think <question>` : Analyse structurée standard
- `/think-hard <question>` : Analyse architecturale profonde
- `/ultrathink <question>` : Analyse maximale
- `/panel <sujet>` : Discussion panel d'experts
- `/security <code>` : Audit de sécurité
- `/perf <code>` : Optimisation performance

## Utilisation

### Depuis ce répertoire

```bash
cd ~/.claude
opencode tui
# Les instructions seront chargées automatiquement
```

### Depuis un projet

```bash
cd ~/mon-projet
opencode tui
# Utilisez les agents : /agent security-engineer "Analyze auth.js"
```

### Avec validation de sécurité

Le script `scripts/validate-command.js` peut être intégré comme hook pour valider
les commandes bash avant exécution (nécessite configuration OpenCode hooks).

## Variables d'Environnement

```bash
# Spécifier un chemin de config personnalisé
export OPENCODE_CONFIG=~/.claude/opencode.jsonc

# Définir le modèle par défaut
export OPENCODE_MODEL="anthropic/claude-sonnet-4-20250514"
```

## Différences Claude Code vs OpenCode

| Fonctionnalité | Claude Code | OpenCode |
|----------------|-------------|----------|
| Config format | settings.json | opencode.json(c) |
| Instructions | Via UI | Via `instructions` array |
| Agents | Built-in | Via config ou fichiers .md |
| Commandes | Limité | Via `command` object |
| MCP servers | Via UI | Via `mcp` object |
| Hooks/Scripts | PreToolUse hooks | À venir |

## Notes

- OpenCode utilise le même format d'agents que Claude Code (fichiers markdown)
- Les glob patterns sont supportés pour les instructions
- Les variables `{env:VAR}` et `{file:path}` sont disponibles
- Le schéma JSON est disponible sur https://opencode.ai/config.json
