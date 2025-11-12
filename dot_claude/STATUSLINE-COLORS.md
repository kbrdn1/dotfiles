# 🎨 StatusLine Colors Guide

Guide complet pour personnaliser les couleurs de votre statusline Claude Code.

---

## 🌈 Vue d'ensemble

La statusline supporte maintenant des **couleurs personnalisables** pour chaque section :
- Modèle Claude (◉ Sonnet 4.5)
- Chemin du projet (⌂ ~/path)
- Statut Git (⎇ branch) avec couleurs dynamiques
- Versions des langages (⬢ Node, ◆ PHP, etc.)
- Docker & Kubernetes (◧ ◈ ⎈)
- Tokens & Performance (◉ tokens)
- Date & Heure (◫ ◷)

---

## 🚀 Démarrage Rapide

### 1. Tester les couleurs disponibles

```bash
~/.claude/test-colors.sh
```

Ce script affiche toutes les couleurs ANSI disponibles avec des exemples.

### 2. Configurer les couleurs

Éditez `~/.claude/statusline-config.yaml`:

```yaml
colors:
  model: '\e[96m'           # Bright cyan
  path: '\e[34m'            # Blue
  git_branch: '\e[95m'      # Bright magenta
  git_clean: '\e[32m'       # Green
  git_dirty: '\e[33m'       # Yellow
  git_conflict: '\e[91m'    # Bright red
  version: '\e[36m'         # Cyan
  docker: '\e[94m'          # Bright blue
  kubernetes: '\e[95m'      # Bright magenta
  token: '\e[93m'           # Bright yellow
  datetime: '\e[90m'        # Gray
```

### 3. Redémarrer Claude Code

Les couleurs seront appliquées au prochain démarrage.

---

## 📊 Codes Couleurs ANSI

### Couleurs de base (30-37)

| Code | Couleur | Exemple | Usage recommandé |
|------|---------|---------|------------------|
| `\e[30m` | Noir (Black) | ◉ | Rarement utilisé |
| `\e[31m` | Rouge (Red) | ◉ | Erreurs, conflits |
| `\e[32m` | Vert (Green) | ◉ | Git clean, succès |
| `\e[33m` | Jaune (Yellow) | ◉ | Git dirty, warnings |
| `\e[34m` | Bleu (Blue) | ◉ | Paths, info |
| `\e[35m` | Magenta | ◉ | Git, K8s |
| `\e[36m` | Cyan | ◉ | Versions |
| `\e[37m` | Blanc (White) | ◉ | Texte général |

### Couleurs brillantes (90-97)

| Code | Couleur | Exemple | Usage recommandé |
|------|---------|---------|------------------|
| `\e[90m` | Bright Black (Gray) | ◉ | Date/heure, infos secondaires |
| `\e[91m` | Bright Red | ◉ | Conflits Git |
| `\e[92m` | Bright Green | ◉ | Git clean, validations |
| `\e[93m` | Bright Yellow | ◉ | Tokens, highlights |
| `\e[94m` | Bright Blue | ◉ | Docker, services |
| `\e[95m` | Bright Magenta | ◉ | Git branch, K8s |
| `\e[96m` | Bright Cyan | ◉ | Modèle, titres |
| `\e[97m` | Bright White | ◉ | Emphase maximale |

---

## 🎨 Thèmes Prédéfinis

### Theme: Ocean (Bleu & Cyan)

```yaml
colors:
  model: '\e[96m'      # Bright cyan
  path: '\e[34m'       # Blue
  git_branch: '\e[36m' # Cyan
  git_clean: '\e[92m'  # Bright green
  git_dirty: '\e[93m'  # Bright yellow
  git_conflict: '\e[91m' # Bright red
  version: '\e[94m'    # Bright blue
  docker: '\e[96m'     # Bright cyan
  kubernetes: '\e[34m' # Blue
  token: '\e[33m'      # Yellow
  datetime: '\e[90m'   # Gray
```

**Aperçu:** ◉ Sonnet 4.5  ⌂ ~/path  ⎇ main  ⬢ 23.9  ◧ 3  ◉ tokens  ◫ date

---

### Theme: Forest (Vert & Terre)

```yaml
colors:
  model: '\e[92m'      # Bright green
  path: '\e[32m'       # Green
  git_branch: '\e[36m' # Cyan
  git_clean: '\e[32m'  # Green
  git_dirty: '\e[33m'  # Yellow
  git_conflict: '\e[31m' # Red
  version: '\e[36m'    # Cyan
  docker: '\e[34m'     # Blue
  kubernetes: '\e[35m' # Magenta
  token: '\e[93m'      # Bright yellow
  datetime: '\e[90m'   # Gray
```

**Style:** Naturel, apaisant, tons verts et terreux

---

### Theme: Sunset (Tons chauds)

```yaml
colors:
  model: '\e[93m'      # Bright yellow
  path: '\e[35m'       # Magenta
  git_branch: '\e[95m' # Bright magenta
  git_clean: '\e[92m'  # Bright green
  git_dirty: '\e[93m'  # Bright yellow
  git_conflict: '\e[91m' # Bright red
  version: '\e[33m'    # Yellow
  docker: '\e[35m'     # Magenta
  kubernetes: '\e[36m' # Cyan
  token: '\e[91m'      # Bright red
  datetime: '\e[90m'   # Gray
```

**Style:** Vibrant, énergique, tons chauds

---

### Theme: Monochrome (Gris)

```yaml
colors:
  model: '\e[97m'      # Bright white
  path: '\e[37m'       # White
  git_branch: '\e[37m' # White
  git_clean: '\e[92m'  # Bright green (seule couleur)
  git_dirty: '\e[93m'  # Bright yellow (seule couleur)
  git_conflict: '\e[91m' # Bright red (seule couleur)
  version: '\e[90m'    # Gray
  docker: '\e[37m'     # White
  kubernetes: '\e[37m' # White
  token: '\e[90m'      # Gray
  datetime: '\e[90m'   # Gray
```

**Style:** Minimaliste, discret, focus sur le contenu

---

## ⚙️ Configuration via Variables d'Environnement

### Test rapide sans modifier le config

```bash
# Tester une couleur spécifique
STATUSLINE_COLOR_MODEL='\e[93m' claude

# Tester plusieurs couleurs
STATUSLINE_COLOR_MODEL='\e[93m' \
STATUSLINE_COLOR_PATH='\e[35m' \
STATUSLINE_COLOR_GIT_BRANCH='\e[96m' \
claude
```

### Configuration permanente

Ajoutez dans `~/.zshrc` ou `~/.bashrc`:

```bash
# Couleurs statusline personnalisées
export STATUSLINE_COLOR_MODEL='\e[96m'      # Bright cyan
export STATUSLINE_COLOR_PATH='\e[34m'       # Blue
export STATUSLINE_COLOR_GIT_BRANCH='\e[95m' # Bright magenta
export STATUSLINE_COLOR_GIT_CLEAN='\e[32m'  # Green
export STATUSLINE_COLOR_GIT_DIRTY='\e[33m'  # Yellow
export STATUSLINE_COLOR_GIT_CONFLICT='\e[91m' # Bright red
export STATUSLINE_COLOR_VERSION='\e[36m'    # Cyan
export STATUSLINE_COLOR_DOCKER='\e[94m'     # Bright blue
export STATUSLINE_COLOR_K8S='\e[95m'        # Bright magenta
export STATUSLINE_COLOR_TOKEN='\e[93m'      # Bright yellow
export STATUSLINE_COLOR_DATETIME='\e[90m'   # Gray
```

Puis rechargez:
```bash
source ~/.zshrc  # ou source ~/.bashrc
```

---

## 🎯 Couleurs Dynamiques Git

Le statut Git change automatiquement de couleur selon l'état du repo :

| État Git | Couleur utilisée | Condition |
|----------|------------------|-----------|
| **Clean** | `git_clean` (vert) | Aucun changement |
| **Dirty** | `git_dirty` (jaune) | Fichiers modifiés/staged/untracked |
| **Conflict** | `git_conflict` (rouge vif) | Conflits de merge détectés |

**Exemple:**
- ⎇ main → Vert (repo propre)
- ⎇ main *2 !1 → Jaune (2 staged, 1 modified)
- ⎇ main ⚠CONFLICT → Rouge vif (conflit)

---

## 💡 Conseils & Astuces

### 1. Choisir des couleurs lisibles

- **Texte clair sur fond sombre:** Utilisez des couleurs brillantes (90-97)
- **Texte sombre sur fond clair:** Utilisez des couleurs de base (30-37)
- **Évitez:** Jaune sur blanc, cyan sur fond clair

### 2. Créer un contraste visuel

```yaml
# Bon contraste
model: '\e[96m'    # Bright cyan (attention)
path: '\e[34m'     # Blue (neutre)
datetime: '\e[90m' # Gray (secondaire)

# Mauvais contraste (tout pareil)
model: '\e[36m'
path: '\e[36m'
datetime: '\e[36m'
```

### 3. Hiérarchie visuelle

Priorité haute → Couleurs vives (bright colors)
Priorité moyenne → Couleurs normales
Priorité basse → Gris/noir

### 4. Accessibilité

- Testez avec différents terminaux
- Vérifiez la lisibilité avec votre schéma de couleurs terminal
- Considérez le daltonisme (rouge/vert)

---

## 🔧 Dépannage

### Les couleurs ne s'affichent pas

```bash
# 1. Vérifier que les couleurs sont dans le config
cat ~/.claude/statusline-config.yaml | grep -A 15 "^colors:"

# 2. Vérifier la syntaxe (guillemets et échappement)
# Correct: '\e[96m'
# Incorrect: \e[96m  (manque guillemets)
# Incorrect: "\e[96m" (mauvais type de guillemets)

# 3. Redémarrer Claude Code
# Les changements prennent effet au prochain démarrage
```

### Les couleurs sont bizarres

```bash
# Terminal ne supporte peut-être pas les couleurs ANSI
echo -e "\e[96mTest Couleur\e[0m"

# Si ça ne marche pas, votre terminal ne supporte pas les couleurs ANSI
# Solution: Utiliser un terminal moderne (iTerm2, Warp, Alacritty, etc.)
```

### Réinitialiser aux couleurs par défaut

```bash
# Option 1: Supprimer la section colors du config
# Éditez ~/.claude/statusline-config.yaml et supprimez la section colors:

# Option 2: Unset des variables d'environnement
unset STATUSLINE_COLOR_MODEL
unset STATUSLINE_COLOR_PATH
# ... (toutes les autres)

# Option 3: Utiliser le thème par défaut
# Commentez toute la section colors: dans le yaml
```

---

## 📚 Ressources

### Outils utiles

- **Preview script:** `~/.claude/test-colors.sh`
- **Config file:** `~/.claude/statusline-config.yaml`
- **Doc complète:** `~/.claude/STATUSLINE-README.md`
- **Référence:** `~/.claude/statusline-config-reference.md`

### Liens externes

- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [Terminal Color Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes)
- [Nerd Fonts](https://www.nerdfonts.com/)

---

## 🎨 Galerie de thèmes communautaires

**Partagez vos thèmes!** Si vous créez un thème sympa, partagez-le!

### Dracula

```yaml
colors:
  model: '\e[95m'      # Purple
  path: '\e[96m'       # Cyan
  git_branch: '\e[35m' # Magenta
  git_clean: '\e[92m'  # Green
  git_dirty: '\e[93m'  # Yellow
  git_conflict: '\e[91m' # Red
  version: '\e[96m'    # Cyan
  docker: '\e[34m'     # Blue
  kubernetes: '\e[95m' # Purple
  token: '\e[93m'      # Yellow
  datetime: '\e[90m'   # Gray
```

### Gruvbox

```yaml
colors:
  model: '\e[33m'      # Yellow
  path: '\e[34m'       # Blue
  git_branch: '\e[35m' # Magenta
  git_clean: '\e[32m'  # Green
  git_dirty: '\e[33m'  # Yellow
  git_conflict: '\e[31m' # Red
  version: '\e[36m'    # Cyan
  docker: '\e[34m'     # Blue
  kubernetes: '\e[35m' # Magenta
  token: '\e[33m'      # Yellow
  datetime: '\e[90m'   # Gray
```

---

**Version:** 3.1
**Dernière mise à jour:** 2025-10-07
