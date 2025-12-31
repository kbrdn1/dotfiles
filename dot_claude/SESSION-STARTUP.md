# 🚀 Guide de Démarrage de Session

Checklist rapide pour vérifier que SuperClaude fonctionne correctement.

---

## ⚡ Quick Check (30 secondes)

### 1️⃣ Vérifier que le Framework est Chargé

**Dans Claude Code, tapez simplement:**
```
Quelle version de SuperClaude est chargée?
```

**Réponse attendue:** Claude devrait mentionner SuperClaude v4.1.5 et lister les composants chargés.

### 2️⃣ Test Rapide de Commande

**Essayez une commande simple:**
```
/sc:brainstorm
```

**Comportement attendu:**
- Message d'activation du mode Brainstorming
- Questions socratiques si vous donnez une idée

### 3️⃣ Test MCP Server

**Vérifiez qu'un MCP fonctionne:**
```
Utilise Context7 pour chercher la documentation React hooks
```

**Comportement attendu:** Claude utilise le MCP Context7 pour chercher la doc officielle.

---

## 🔍 Vérification Complète (5 minutes)

### Core Framework

✅ **Test CLAUDE.md:**
```
Liste tous les modes comportementaux disponibles
```
Attendu: 6 modes (Brainstorming, Business Panel, Introspection, Orchestration, Task Management, Token Efficiency)

✅ **Test FLAGS:**
```
Quels sont les flags disponibles pour modifier ton comportement?
```
Attendu: Liste des flags (--brainstorm, --introspect, --task-manage, etc.)

### Slash Commands

✅ **Test liste commandes:**
```
Liste toutes les commandes /sc:* disponibles
```
Attendu: 22 commandes listées

✅ **Test commande workflow:**
```
/sc:workflow
```
Attendu: Activation du mode workflow avec description

### Agents

✅ **Test activation agent:**
```
/sc:task analyze "architecture système" --strategy systematic
```
Attendu: Activation des agents architect, analyzer selon le contexte

✅ **Test agent spécifique:**
```
J'ai besoin d'un expert sécurité pour analyser ce code
```
Attendu: Activation du security-engineer agent

### MCP Servers

✅ **Sequential (raisonnement):**
```
Utilise Sequential pour analyser ce problème complexe: [votre problème]
```

✅ **Context7 (documentation):**
```
Cherche dans Context7 la doc officielle de Next.js
```

✅ **Magic (UI components):**
```
Crée un composant bouton moderne avec Magic
```

✅ **Playwright (tests):**
```
Utilise Playwright pour tester ce formulaire
```

✅ **Serena (mémoire session):**
```
Sauvegarde le contexte de cette session avec Serena
```

✅ **Morphllm (transformations):**
```
Utilise Morphllm pour appliquer ce pattern sur tous les fichiers
```

---

## 🔧 Diagnostic Rapide

### Symptôme: Commandes /sc:* ne fonctionnent pas

**Diagnostic:**
```bash
# Dans votre terminal
ls ~/.claude/commands/sc/*.md | wc -l
```
Attendu: `22`

**Solution si problème:**
```bash
export PATH="$HOME/.local/bin:$PATH"
SuperClaude install --yes --components commands
```

### Symptôme: Agents ne s'activent pas

**Diagnostic:**
```bash
ls ~/.claude/agents/*.md | wc -l
```
Attendu: `15`

**Solution si problème:**
```bash
SuperClaude install --yes --components agents
```

### Symptôme: MCP servers ne répondent pas

**Diagnostic:**
```bash
cat ~/.claude.json | jq -r '.mcpServers | keys'
```
Attendu: Liste avec `sequential-thinking`, `context7`, `magic`, `playwright`, `serena`, `morphllm-fast-apply`

**Solution si problème:**
1. Redémarrer Claude Code
2. Vérifier l'installation des serveurs
3. Re-installer: `SuperClaude install --yes --components mcp`

### Symptôme: Modes comportementaux ne s'activent pas

**Diagnostic:**
```bash
ls ~/.claude/MODE_*.md | wc -l
```
Attendu: `6`

**Solution si problème:**
```bash
SuperClaude install --yes --components modes
```

---

## 📋 Checklist de Session Productive

Avant de commencer à travailler, assurez-vous que:

- [ ] Claude reconnaît SuperClaude v4.1.5
- [ ] Au moins une commande `/sc:*` fonctionne
- [ ] Au moins un MCP server répond (Context7 recommandé)
- [ ] Les modes comportementaux sont détectés
- [ ] La statusline s'affiche correctement

**Si tous ces points sont OK → Vous êtes prêt à travailler! 🎉**

---

## 🎯 Commandes les Plus Utiles

### Pour Commencer un Projet
```
/sc:brainstorm "votre idée de projet"
```

### Pour Analyser du Code
```
/sc:analyze @fichier.js --focus security
```

### Pour Implémenter une Feature
```
/sc:implement "votre feature" --strategy systematic
```

### Pour Gérer des Tâches Complexes
```
/sc:task create "votre objectif" --strategy agile --parallel
```

### Pour Sauvegarder votre Progression
```
/sc:save
```

### Pour Reprendre une Session
```
/sc:load
```

---

## 💡 Astuces Pro

### 1. Utilisez les Modes Automatiquement
Les modes s'activent automatiquement selon le contexte:
- Questions vagues → Brainstorming
- Tâches complexes → Task Management
- Besoin d'efficacité → Token Efficiency

### 2. Combinez Commandes et Flags
```
/sc:implement "auth system" --strategy systematic --think-hard
```

### 3. Exploitez les MCP Servers
Ne demandez pas juste "cherche la doc", demandez:
```
Utilise Context7 pour trouver les meilleures pratiques Next.js App Router
```

### 4. Sessions Persistantes
Sauvegardez régulièrement avec `/sc:save` pour ne jamais perdre votre contexte.

---

## 🆘 Problème Persistant?

Si après toutes ces vérifications quelque chose ne fonctionne toujours pas:

1. **Lire le status complet:**
   ```bash
   cat ~/.claude/SUPERCLAUDE-STATUS.md
   ```

2. **Réinstaller complètement:**
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   SuperClaude install --yes --components core modes agents commands mcp_docs mcp
   ```

3. **Redémarrer Claude Code** (important!)

4. **Vérifier les logs:**
   ```bash
   ls ~/.claude/logs/
   ```

---

**Happy Coding! 🚀**

**Version:** SuperClaude v4.1.5
**Dernière mise à jour:** 2025-10-07
