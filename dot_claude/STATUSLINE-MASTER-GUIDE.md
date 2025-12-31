# 📊 StatusLine Claude Code - Guide Complet

Documentation consolidée de la statusline personnalisée avec couleurs dynamiques et modèle orange.

---

## 📑 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Installation & Configuration](#installation--configuration)
3. [Couleurs Dynamiques](#couleurs-dynamiques)
4. [Fonctionnalités](#fonctionnalités)
5. [Architecture Technique](#architecture-technique)
6. [Personnalisation](#personnalisation)
7. [Troubleshooting](#troubleshooting)
8. [Référence Complète](#référence-complète)

---

## Vue d'Ensemble

### Exemple de StatusLine

```
◉ Sonnet 4.5  ⌂ ◆ Perso/cv-exporter  ⬢ 23.9.0  ◉ ⇣1200 ⇡4990 • ≈ 178k tok/min • $5.21 • ⧗ 3h 49m  ◫ 12/10/25 ◷ 03:11
```

### Segments Principaux

| Segment | Description | Couleur |
|---------|-------------|---------|
| **◉ Sonnet 4.5** | Modèle Claude utilisé | 🟠 Orange (logo Claude) |
| **⌂ ◆ Perso/cv-exporter** | Chemin avec alias intelligent | 🔵 Bleu |
| **⬢ 23.9.0** | Version Node.js (détection auto) | 🔵 Cyan |
| **◉ ⇣1200 ⇡4990** | Input/Output tokens | 🟢 Vert (dynamique) |
| **≈ 178k tok/min** | Burn rate | 🟡 Jaune (dynamique) |
| **$5.21** | Coût du block actuel | 🟡 Jaune (dynamique) |
| **⧗ 3h 49m** | Temps de session restant (5h) | 🟢 Vert (dynamique) |
| **◫ 12/10/25 ◷ 03:11** | Date et heure | ⚪ Gris |

---

## Installation & Configuration

### Fichiers Principaux

```
~/.claude/
├── statusline-p10k.sh                 # ⭐ Script actif (utilisé par settings.json)
├── statusline-dynamic-colors.sh       # 🎨 Fonctions de couleurs dynamiques
├── statusline-config.yaml             # ⚙️ Configuration YAML
├── settings.json                      # 🔧 Configuration Claude Code
├── test-dynamic-colors.sh             # 🧪 Script de test
│
├── STATUSLINE-MASTER-GUIDE.md         # 📖 Ce guide complet
├── STATUSLINE-FINAL-SUMMARY.md        # ✅ Résumé des modifications
├── STATUSLINE-DYNAMIC-COLORS-README.md # 🌈 Guide couleurs dynamiques
├── STATUSLINE-UPDATE-SUMMARY.md       # 📊 Résumé seuils 5h
├── STATUSLINE-README.md               # 📚 Documentation générale
├── STATUSLINE-COLORS.md               # 🎨 Guide couleurs ANSI
├── statusline-config-reference.md     # 📋 Référence config complète
├── statusline-options.md              # 🎛️ Liste toutes les options
└── statusline-aliases.md              # 🔗 Guide des alias de chemins
```

### Configuration Claude Code

Dans `~/.claude/settings.json` :

```json
{
  "statusLine": {
    "type": "command",
    "command": "/bin/bash /Users/kbrdn1/.claude/statusline-p10k.sh",
    "padding": 0
  }
}
```

### Dépendances

```bash
# Installer les dépendances
brew install jq yq

# Tester ccusage
bunx ccusage --version

# Optionnel : Nerd Fonts pour les symboles
brew tap homebrew/cask-fonts
brew install --cask font-jetbrains-mono-nerd-font
```

---

## Couleurs Dynamiques

### 🎯 Système de Couleurs Intelligentes

Les couleurs changent automatiquement selon l'utilisation :

#### 🧩 Tokens (basé sur 200K max)

| Utilisation | Couleur | Seuil | Exemple |
|-------------|---------|-------|---------|
| < 50% | 🟢 **Vert** | < 100K | 50K tokens (25%) |
| 50-75% | 🟡 **Jaune** | 100-150K | 125K tokens (62%) |
| 75-90% | 🟠 **Orange** | 150-180K | 160K tokens (80%) |
| > 90% | 🔴 **Rouge** | > 180K | 185K tokens (92%) |

#### ⧗ Temps Restant (basé sur 5h)

| Temps | Couleur | Pourcentage | Seuil |
|-------|---------|-------------|-------|
| > 3h | 🟢 **Vert** | > 60% | > 180 min |
| 1.5h-3h | 🟡 **Jaune** | 30-60% | 90-180 min |
| 45min-1.5h | 🟠 **Orange** | 15-30% | 45-90 min |
| < 45min | 🔴 **Rouge** | < 15% | < 45 min |

#### ≈ Burn Rate (calibré pour ~190k)

| Burn Rate | Couleur | Description |
|-----------|---------|-------------|
| < 150K | 🟢 **Vert** | Usage faible |
| 150-250K | 🟡 **Jaune** | Usage normal (~190k) |
| 250-350K | 🟠 **Orange** | Usage élevé |
| > 350K | 🔴 **Rouge** | Usage critique |

#### 💰 Coût

| Coût | Couleur | Description |
|------|---------|-------------|
| < $5 | 🟢 **Vert** | Coût faible |
| $5-$15 | 🟡 **Jaune** | Coût modéré |
| $15-$30 | 🟠 **Orange** | Coût élevé |
| > $30 | 🔴 **Rouge** | Coût très élevé |

### 🎨 Codes Couleurs ANSI Utilisés

| Couleur | Code ANSI | RGB/Hex | Usage |
|---------|-----------|---------|-------|
| 🟠 **Orange** | `\e[38;5;208m` | #FF8700 | Model (logo Claude) |
| 🟢 **Vert** | `\e[92m` | #00FF00 | Bon état, sûr |
| 🟡 **Jaune** | `\e[93m` | #FFFF00 | Attention, modéré |
| 🟠 **Orange** | `\e[38;5;208m` | #FF8700 | Alerte modérée |
| 🔴 **Rouge** | `\e[91m` | #FF0000 | Critique, danger |
| 🔵 **Bleu** | `\e[34m` | #0000FF | Path, info |
| 🔵 **Cyan** | `\e[36m` | #00FFFF | Versions |
| ⚪ **Gris** | `\e[90m` | #808080 | Date/heure, secondaire |

### 📊 Exemple d'Évolution des Couleurs

| Métrique | Début Session | Mi-Session | Fin Session |
|----------|---------------|------------|-------------|
| **Temps (5h)** | 🟢 5h (100%) | 🟡 2h (40%) | 🔴 30m (10%) |
| **Burn Rate** | 🟢 100k | 🟡 180k | 🟠 280k |
| **Tokens** | 🟢 10K (5%) | 🟡 120K (60%) | 🔴 185K (92%) |
| **Coût** | 🟢 $2 | 🟡 $8 | 🟠 $22 |

---

## Fonctionnalités

### 1. 🤖 Modèle Claude (Orange)

```bash
# Configuré dans statusline-config.yaml
colors:
  model: '\e[38;5;208m'  # Orange (RGB 208) - comme le logo Claude
```

**Modèles supportés** :
- ◉ Sonnet 4.5
- ◉ Sonnet 3.5
- ◉ Opus 4.1 / Opus 4 / Opus 3
- ◉ Haiku 3.5 / Haiku

### 2. 📂 Alias de Chemins Intelligents

#### Projects

| Chemin | Alias | Symbole |
|--------|-------|---------|
| `~/Projects/Perso` | `◆ Perso` | ◆ (Diamant) |
| `~/Projects/Flippad` | `◈ Flippad` | ◈ (Fisheye) |
| `~/Projects/Pro` | `◇ Pro` | ◇ (Diamant vide) |
| `~/Projects/MNS` | `◈ MNS` | ◈ |
| `~/Projects/Labs` | `◉ Labs` | ◉ (Cercle) |
| `~/Projects/Learning` | `◎ Learn` | ◎ (Cible) |
| `~/Projects/Mehdi` | `◊ Mehdi` | ◊ (Losange) |
| `~/Projects` | `⬡ Proj` | ⬡ (Hexagone) |

#### Système

| Chemin | Alias | Symbole |
|--------|-------|---------|
| `~/Downloads` | `⇣ DL` | ⇣ (Flèche bas) |
| `~/Documents` | `◫ Docs` | ◫ (Calendrier) |
| `~/Desktop` | `◲ Desk` | ◲ (Carré) |
| `~/Scripts` | `⚙ Scripts` | ⚙ (Engrenage) |

### 3. 🔀 Git Status Détaillé (Style Powerlevel10k)

```
⎇ main *2 !5 ?1 ↑3 ↓2 ⊟1
```

- `*2` - 2 fichiers staged
- `!5` - 5 fichiers modifiés
- `?1` - 1 fichier untracked
- `↑3` - 3 commits en avance (ahead)
- `↓2` - 2 commits en retard (behind)
- `⊟1` - 1 stash disponible
- `⚠CONFLICT` - Conflits de merge

**Couleurs dynamiques Git** :
- 🟢 **Vert** : Repo propre (clean)
- 🟡 **Jaune** : Modifications/staged files
- 🔴 **Rouge** : Conflits de merge

### 4. 🔧 Détection Automatique des Runtimes

N'affiche **que les runtimes utilisés** par le projet actuel.

| Runtime | Symbole | Fichiers détectés |
|---------|---------|-------------------|
| **Node.js** | ⬢ | `package.json`, `yarn.lock`, `bun.lockb` |
| **PHP** | ◆ | `composer.json` |
| **Go** | ◈ | `go.mod`, `go.sum` |
| **Python** | ⊙ | `requirements.txt`, `pyproject.toml` |
| **Rust** | ⚙ | `Cargo.toml` |
| **Ruby** | ◊ | `Gemfile` |
| **Java** | ◈ | `pom.xml`, `build.gradle` |

**Priorité `.tool-versions`** : Si présent, utilise les versions définies dans `.tool-versions` (asdf/mise).

### 5. 🐳 Docker & Kubernetes

- **◧ 3** - 3 conteneurs Docker actifs
- **⎈ prod** - Contexte Kubernetes actuel
- **⎈ minikube** - Environnement local

### 6. 📊 Stats ccusage en Temps Réel

Intégration avec `bunx ccusage blocks --active` :

- **⇣ Input tokens** - Tokens d'entrée
- **⇡ Output tokens** - Tokens de sortie
- **≈ Burn rate** - Tokens par minute (avec couleur dynamique)
- **$ Coût** - Coût actuel du block 5h (avec couleur dynamique)
- **⧗ Temps restant** - Temps restant dans le block (avec couleur dynamique)

### 7. 🕐 Date & Heure

Format : `◫ DD/MM/YY ◷ HH:MM`

---

## Architecture Technique

### Script Actif : statusline-p10k.sh

```bash
#!/usr/bin/env bash

# ========== Source Dynamic Colors ==========
DYNAMIC_COLORS_SCRIPT="$HOME/.claude/statusline-dynamic-colors.sh"
if [[ -f "$DYNAMIC_COLORS_SCRIPT" ]]; then
  source "$DYNAMIC_COLORS_SCRIPT"
fi

# ========== Main Script Logic ==========
# 1. Parse JSON input from Claude Code
# 2. Extract model, cwd, git info
# 3. Get ccusage stats
# 4. Apply dynamic colors
# 5. Build statusline output
```

**Points clés d'intégration** :

1. **Lines 7-11** : Source des fonctions de couleurs dynamiques
2. **Lines 716-753** : Application des couleurs dynamiques aux tokens, burn rate, coût, temps

### Fichier : statusline-dynamic-colors.sh

```bash
#!/usr/bin/env bash

# ========== Color Definitions ==========
COLOR_GREEN='\e[92m'      # Bright green - good/safe
COLOR_YELLOW='\e[93m'     # Bright yellow - warning/medium
COLOR_ORANGE='\e[38;5;208m'  # Orange - high usage
COLOR_RED='\e[91m'        # Bright red - critical/danger
COLOR_RESET='\e[0m'

# ========== Dynamic Color Functions ==========

# Get color based on token usage percentage
# Args: $1 = current_tokens, $2 = max_tokens
get_token_color() {
  local current=$1
  local max=$2
  local percentage=$((current * 100 / max))

  if [[ $percentage -lt 50 ]]; then
    echo "$COLOR_GREEN"    # < 50% : Green
  elif [[ $percentage -lt 75 ]]; then
    echo "$COLOR_YELLOW"   # 50-75% : Yellow
  elif [[ $percentage -lt 90 ]]; then
    echo "$COLOR_ORANGE"   # 75-90% : Orange
  else
    echo "$COLOR_RED"      # > 90% : Red
  fi
}

# Get color based on remaining time (5h limit)
# Args: $1 = remaining_minutes
get_time_color() {
  local minutes=$1

  if [[ $minutes -gt 180 ]]; then
    echo "$COLOR_GREEN"    # > 3h (60% of 5h)
  elif [[ $minutes -gt 90 ]]; then
    echo "$COLOR_YELLOW"   # 1.5h-3h (30-60%)
  elif [[ $minutes -gt 45 ]]; then
    echo "$COLOR_ORANGE"   # 45min-1.5h (15-30%)
  else
    echo "$COLOR_RED"      # < 45min (<15%)
  fi
}

# Get color based on burn rate (calibrated for ~190k)
# Args: $1 = burn_rate
get_burn_rate_color() {
  local burn_rate=$1

  # Convert burn rate to numeric (handle K/k, M/m suffixes)
  local burn_numeric
  if [[ "$burn_rate" =~ ([0-9.]+)[Mm] ]]; then
    burn_numeric=$(echo "${BASH_REMATCH[1]} * 1000" | bc 2>/dev/null | cut -d'.' -f1)
  elif [[ "$burn_rate" =~ ([0-9.]+)[Kk] ]]; then
    burn_numeric=$(echo "${BASH_REMATCH[1]}" | bc 2>/dev/null | cut -d'.' -f1)
  else
    burn_numeric=$burn_rate
  fi

  if [[ $burn_numeric -lt 150 ]]; then
    echo "$COLOR_GREEN"    # < 150k
  elif [[ $burn_numeric -lt 250 ]]; then
    echo "$COLOR_YELLOW"   # 150-250k (includes ~190k)
  elif [[ $burn_numeric -lt 350 ]]; then
    echo "$COLOR_ORANGE"   # 250-350k
  else
    echo "$COLOR_RED"      # > 350k
  fi
}

# Get color based on cost
# Args: $1 = cost_usd
get_cost_color() {
  local cost=$1
  local cost_cents=$(echo "$cost * 100" | bc | cut -d'.' -f1)

  if [[ $cost_cents -lt 500 ]]; then
    echo "$COLOR_GREEN"    # < $5
  elif [[ $cost_cents -lt 1500 ]]; then
    echo "$COLOR_YELLOW"   # $5-$15
  elif [[ $cost_cents -lt 3000 ]]; then
    echo "$COLOR_ORANGE"   # $15-$30
  else
    echo "$COLOR_RED"      # > $30
  fi
}

# Export functions
export -f get_token_color
export -f get_time_color
export -f get_burn_rate_color
export -f get_cost_color
```

### Application des Couleurs (statusline-p10k.sh)

```bash
# Lines 716-753 in statusline-p10k.sh

# Apply dynamic colors to token info
if [ -n "$token_info" ]; then
  colored_token_info="$token_info"

  # Dynamic token color
  if type get_token_color &>/dev/null && [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
    total_tokens=$((input_tokens + output_tokens))
    token_color_dynamic=$(get_token_color "$total_tokens" 200000)
    colored_token_info=$(echo "$token_info" | sed "s|${token_icon}|${token_color_dynamic}${token_icon}${COLOR_RESET}|")
  fi

  # Dynamic burn rate color
  if type get_burn_rate_color &>/dev/null && [ -n "$burn_k" ]; then
    burn_color_dynamic=$(get_burn_rate_color "$burn_k")
    colored_token_info=$(echo "$colored_token_info" | sed "s|${burn_icon} ${burn_k}|${burn_color_dynamic}${burn_icon} ${burn_k}${COLOR_RESET}|")
  fi

  # Dynamic cost color
  if type get_cost_color &>/dev/null && [ -n "$total_cost" ]; then
    cost_value=$(echo "$total_cost" | tr -d '$')
    cost_color_dynamic=$(get_cost_color "$cost_value")
    colored_token_info=$(echo "$colored_token_info" | sed "s|${total_cost}|${cost_color_dynamic}${total_cost}${COLOR_RESET}|")
  fi

  # Dynamic time remaining color
  if type get_time_color &>/dev/null && [ -n "$time_remaining" ]; then
    hours=$(echo "$time_remaining" | grep -oE '[0-9]+h' | tr -d 'h')
    minutes=$(echo "$time_remaining" | grep -oE '[0-9]+m' | tr -d 'm')
    total_minutes=$((${hours:-0} * 60 + ${minutes:-0}))
    time_color_dynamic=$(get_time_color "$total_minutes")
    colored_token_info=$(echo "$colored_token_info" | sed "s|${remaining_icon} ${time_remaining}|${time_color_dynamic}${remaining_icon} ${time_remaining}${COLOR_RESET}|")
  fi

  output="${output}${colored_token_info}"
fi
```

---

## Personnalisation

### Modifier les Seuils de Couleurs

Éditez `~/.claude/statusline-dynamic-colors.sh` :

```bash
# Exemple: Changer les seuils de temps restant
# Base 5h = 300 minutes

if [[ $minutes -gt 180 ]]; then     # > 3h (60%) - Changer ce seuil
  echo "$COLOR_GREEN"
elif [[ $minutes -gt 90 ]]; then    # 1.5h-3h (30-60%) - Changer ce seuil
  echo "$COLOR_YELLOW"
elif [[ $minutes -gt 45 ]]; then    # 45min-1.5h (15-30%) - Changer ce seuil
  echo "$COLOR_ORANGE"
else                                # < 45min (<15%)
  echo "$COLOR_RED"
fi
```

### Modifier la Couleur du Model

Éditez `~/.claude/statusline-config.yaml` :

```yaml
colors:
  model: '\e[38;5;208m'  # Orange actuel (logo Claude)
  # model: '\e[38;5;214m'  # Orange plus clair
  # model: '\e[38;5;202m'  # Orange plus foncé
  # model: '\e[96m'        # Cyan (original)
  # model: '\e[93m'        # Jaune vif
```

### Ajouter un Nouvel Alias de Chemin

Éditez `~/.claude/statusline-p10k.sh` dans la section "Smart aliases" :

```bash
# IMPORTANT : Les chemins spécifiques AVANT les génériques
dir_path="${dir_path//~\/Projects\/MonProjet/◈ MonProjet}"  # Spécifique
dir_path="${dir_path//~\/Projects/⬡ Proj}"                  # Générique
```

### Configuration via YAML

Fichier `~/.claude/statusline-config.yaml` :

```yaml
# ══════════════════════════════════════════════
# FEATURES - Enable/Disable Functionality
# ══════════════════════════════════════════════
features:
  git:
    enabled: true
    show_ahead_behind: true    # ↑3 ↓2
    show_stash: true          # ⊟2
    show_conflict: true       # ⚠CONFLICT

  devops:
    docker: true              # ◧ 3
    kubernetes: true          # ⎈ prod

  tokens:
    enabled: true
    show_burn_rate: true      # ≈ 222k tok/min
    show_cost: true           # $6.32
    show_time_remaining: true # ⧗ 4h 2m

# ══════════════════════════════════════════════
# DISPLAY - Customize Output
# ══════════════════════════════════════════════
display:
  show_date: true             # ◫ 07/10/25
  show_time: true             # ◷ 14:30
  date_format: "%d/%m/%y"
  time_format: "%H:%M"
  max_path_length: 50

# ══════════════════════════════════════════════
# COLORS - ANSI Escape Codes
# ══════════════════════════════════════════════
colors:
  model: '\e[38;5;208m'       # Orange (Claude logo)
  path: '\e[34m'              # Blue
  git_branch: '\e[95m'        # Bright magenta
  git_clean: '\e[32m'         # Green
  git_dirty: '\e[33m'         # Yellow
  git_conflict: '\e[91m'      # Bright red
  version: '\e[36m'           # Cyan
  docker: '\e[94m'            # Bright blue
  kubernetes: '\e[95m'        # Bright magenta
  token: '\e[93m'             # Bright yellow
  datetime: '\e[90m'          # Gray
```

### Variables d'Environnement

Pour des changements rapides sans modifier le YAML :

```bash
# Dans ~/.zshrc ou ~/.bashrc

# Désactiver Docker/Kubernetes
export STATUSLINE_DOCKER=false
export STATUSLINE_KUBERNETES=false

# Désactiver Git avancé
export STATUSLINE_GIT_AHEAD_BEHIND=false
export STATUSLINE_GIT_STASH=false

# Masquer date/heure
export STATUSLINE_SHOW_DATE=false
export STATUSLINE_SHOW_TIME=false

# Changer couleurs
export STATUSLINE_COLOR_MODEL='\e[93m'   # Jaune
export STATUSLINE_COLOR_PATH='\e[35m'    # Magenta
```

---

## Troubleshooting

### La Statusline ne s'Affiche Pas

```bash
# 1. Vérifier que le script est exécutable
chmod +x ~/.claude/statusline-p10k.sh

# 2. Tester manuellement
echo '{}' | /bin/bash ~/.claude/statusline-p10k.sh

# 3. Vérifier la configuration
cat ~/.claude/settings.json | jq '.statusLine'
```

### Les Couleurs ne Changent Pas

```bash
# 1. Redémarrer Claude Code (requis après modifications)

# 2. Vérifier que le script dynamique est sourcé
grep "statusline-dynamic-colors.sh" ~/.claude/statusline-p10k.sh

# 3. Tester les fonctions de couleurs
bash -c 'source ~/.claude/statusline-dynamic-colors.sh && type get_time_color'
```

### Les Couleurs Affichent Mal

```bash
# 1. Tester le support des couleurs ANSI
echo -e "\e[38;5;208mTest Orange\e[0m"

# 2. Vérifier le terminal (iTerm2, Warp, Alacritty supportent 256 couleurs)

# 3. Installer une Nerd Font
brew install --cask font-jetbrains-mono-nerd-font
```

### Bug K/k (Burn Rate)

**Problème** : Le burn rate de "169k" retourne toujours vert au lieu de jaune.

**Cause** : Regex sensible à la casse `([0-9.]+)K` ne match pas "k" minuscule.

**Solution** : Changé en `([0-9.]+)[Kk]` (case insensitive) ✅

```bash
# Test avant fix
bash -c 'burn_rate="169k" && if [[ "$burn_rate" =~ ([0-9.]+)K ]]; then echo "match"; else echo "No match"; fi'
# Output: No match

# Test après fix
bash -c 'burn_rate="169k" && if [[ "$burn_rate" =~ ([0-9.]+)[Kk] ]]; then echo "match"; else echo "No match"; fi'
# Output: match
```

### ccusage ne Fonctionne Pas

```bash
# Vérifier bunx
bunx ccusage --version

# Si absent, installer bun
npm install -g bun
```

---

## Référence Complète

### Symboles Unicode Utilisés

#### Modèle & Système
- **◉** - Modèle Claude (cercle plein)
- **⌂** - Dossier/home
- **⎇** - Git branch
- **✓** - Git clean
- **✗** - Git modifié

#### Langages
- **⬢** - Node.js (hexagone)
- **◆** - PHP (diamant)
- **◈** - Go (fisheye)
- **⚙** - Rust (gear)
- **⊙** - Python (cercle point)
- **◊** - Ruby (losange)
- **◈** - Java (fisheye)

#### Git Avancé
- **↑** - Commits ahead
- **↓** - Commits behind
- **⊟** - Stash count
- **⚠** - Merge conflict

#### DevOps & Containers
- **◧** - Docker containers
- **⎈** - Kubernetes (helm)

#### Stats & Données
- **◉** - Tokens (jeton)
- **⇣** - Input (flèche bas)
- **⇡** - Output (flèche haut)
- **≈** - Burn rate (approximation)
- **⧗** - Temps restant (sablier)
- **◫** - Date (calendrier)
- **◷** - Heure (horloge)

### Codes Couleurs ANSI Complets

#### Couleurs de Base (30-37)

| Code | Couleur | Exemple | Usage recommandé |
|------|---------|---------|------------------|
| `\e[30m` | Noir | ◉ | Rarement utilisé |
| `\e[31m` | Rouge | ◉ | Erreurs, conflits |
| `\e[32m` | Vert | ◉ | Git clean, succès |
| `\e[33m` | Jaune | ◉ | Git dirty, warnings |
| `\e[34m` | Bleu | ◉ | Paths, info |
| `\e[35m` | Magenta | ◉ | Git, K8s |
| `\e[36m` | Cyan | ◉ | Versions |
| `\e[37m` | Blanc | ◉ | Texte général |

#### Couleurs Brillantes (90-97)

| Code | Couleur | Exemple | Usage recommandé |
|------|---------|---------|------------------|
| `\e[90m` | Gray | ◉ | Date/heure, secondaire |
| `\e[91m` | Bright Red | ◉ | Conflits Git critiques |
| `\e[92m` | Bright Green | ◉ | Succès, validations |
| `\e[93m` | Bright Yellow | ◉ | Tokens, highlights |
| `\e[94m` | Bright Blue | ◉ | Docker, services |
| `\e[95m` | Bright Magenta | ◉ | Git branch, K8s |
| `\e[96m` | Bright Cyan | ◉ | Modèle, titres |
| `\e[97m` | Bright White | ◉ | Emphase maximale |

#### Couleurs RGB 256 (38;5;N)

| Code | Couleur | Hex | Usage |
|------|---------|-----|-------|
| `\e[38;5;208m` | Orange | #FF8700 | Model (logo Claude) |
| `\e[38;5;214m` | Orange clair | #FFAF00 | Alternative model |
| `\e[38;5;202m` | Orange foncé | #FF5F00 | Alternative model |

### Thèmes de Couleurs Pré-définis

#### Theme: Ocean (Bleu & Cyan)

```yaml
colors:
  model: '\e[96m'           # Bright cyan
  path: '\e[34m'            # Blue
  git_branch: '\e[36m'      # Cyan
  git_clean: '\e[92m'       # Bright green
  git_dirty: '\e[93m'       # Bright yellow
  git_conflict: '\e[91m'    # Bright red
  version: '\e[94m'         # Bright blue
  docker: '\e[96m'          # Bright cyan
  kubernetes: '\e[34m'      # Blue
  token: '\e[33m'           # Yellow
  datetime: '\e[90m'        # Gray
```

#### Theme: Forest (Vert & Terre)

```yaml
colors:
  model: '\e[92m'           # Bright green
  path: '\e[32m'            # Green
  git_branch: '\e[36m'      # Cyan
  git_clean: '\e[32m'       # Green
  git_dirty: '\e[33m'       # Yellow
  git_conflict: '\e[31m'    # Red
  version: '\e[36m'         # Cyan
  docker: '\e[34m'          # Blue
  kubernetes: '\e[35m'      # Magenta
  token: '\e[93m'           # Bright yellow
  datetime: '\e[90m'        # Gray
```

#### Theme: Sunset (Tons Chauds)

```yaml
colors:
  model: '\e[93m'           # Bright yellow
  path: '\e[35m'            # Magenta
  git_branch: '\e[95m'      # Bright magenta
  git_clean: '\e[92m'       # Bright green
  git_dirty: '\e[93m'       # Bright yellow
  git_conflict: '\e[91m'    # Bright red
  version: '\e[33m'         # Yellow
  docker: '\e[35m'          # Magenta
  kubernetes: '\e[36m'      # Cyan
  token: '\e[91m'           # Bright red
  datetime: '\e[90m'        # Gray
```

#### Theme: Monochrome (Gris)

```yaml
colors:
  model: '\e[97m'           # Bright white
  path: '\e[37m'            # White
  git_branch: '\e[37m'      # White
  git_clean: '\e[92m'       # Bright green
  git_dirty: '\e[93m'       # Bright yellow
  git_conflict: '\e[91m'    # Bright red
  version: '\e[90m'         # Gray
  docker: '\e[37m'          # White
  kubernetes: '\e[37m'      # White
  token: '\e[90m'           # Gray
  datetime: '\e[90m'        # Gray
```

### Exemples de StatusLine par Contexte

#### Projet Node.js (avec Git)
```
◉ Sonnet 4.5  ⌂ ◆ Perso/app  ⎇ main *2 !1  ⬢ 23.9.0  ◉ ⇣850 ⇡3200 • ≈ 180k tok/min • $4.50 • ⧗ 3h 15m  ◫ 07/10/25 ◷ 14:30
```

#### Projet PHP Laravel
```
◉ Sonnet 4.5  ⌂ ◈ Flippad/api  ⎇ develop !5  ◆ 8.4  ◉ ⇣1200 ⇡4500 • ≈ 200k tok/min • $5.80 • ⧗ 2h 45m  ◫ 07/10/25 ◷ 15:45
```

#### Projet Go
```
◉ Sonnet 4.5  ⌂ ◇ Pro/microservice  ⎇ feat/auth  ◈ 1.24  ◉ ⇣600 ⇡2100 • ≈ 120k tok/min • $3.20 • ⧗ 4h 10m  ◫ 07/10/25 ◷ 16:00
```

#### Dossier sans Projet
```
◉ Sonnet 4.5  ⌂ ⇣ DL  ◉ ⇣450 ⇡1800 • ≈ 90k tok/min • $2.40 • ⧗ 4h 55m  ◫ 07/10/25 ◷ 10:15
```

---

## 🎯 Checklist de Vérification

- [x] Model affiché en orange
- [x] Temps restant avec couleur dynamique (vert pour >3h)
- [x] Burn rate avec couleur dynamique (jaune pour 150-250k)
- [x] Coût avec couleur dynamique (jaune pour $5-$15)
- [x] Tokens avec couleur dynamique (vert pour <50%)
- [x] Script de test fonctionnel
- [x] Documentation complète créée
- [x] Bug K/k résolu

---

## 🚀 Prochaines Étapes

**Aucune action requise** - Tout fonctionne ! ✅

Pour voir les changements :
1. **Redémarrez Claude Code**
2. Les couleurs s'appliqueront automatiquement
3. Surveillez comment elles évoluent pendant votre session

---

**Version:** 3.0 (Complete Master Guide)
**Date:** 2025-10-12
**Status:** ✅ Testé, Vérifié, Fonctionnel

**Fichiers de Documentation Complémentaires** :
- `STATUSLINE-FINAL-SUMMARY.md` - Résumé final des modifications
- `STATUSLINE-DYNAMIC-COLORS-README.md` - Guide complet des couleurs dynamiques
- `STATUSLINE-UPDATE-SUMMARY.md` - Résumé des seuils 5h
- `STATUSLINE-README.md` - Documentation générale
- `STATUSLINE-COLORS.md` - Guide couleurs ANSI
- `statusline-config-reference.md` - Référence configuration complète
- `statusline-options.md` - Liste de toutes les options
- `statusline-aliases.md` - Guide des alias de chemins

---

Profitez de votre statusline personnalisée avec couleurs dynamiques ! 🎉
