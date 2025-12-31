# StatusLine - Toutes les Options Disponibles

## 📊 CCUSAGE BLOCKS (bunx ccusage blocks --active)

### Temps
- **Block Started** : Heure de début du block (`10/7/2025, 1:00:00 AM`)
- **Block Started (ago)** : Il y a combien de temps (`0h 58m ago`)
- **Time Remaining** : Temps restant dans le block (`4h 2m`) ⭐
- **Time Elapsed** : Temps écoulé (`0h 58m`)

### Tokens
- **Input Tokens** : Tokens d'entrée (`792`)
- **Output Tokens** : Tokens de sortie (`4,721`)
- **Total Tokens** : Tokens totaux (`5,513`)
- **Token Limit** : Limite de tokens (`127,629,056`)
- **Token Usage %** : Pourcentage utilisé (`4.3%`)

### Coûts
- **Total Cost** : Coût actuel du block (`$3.81`) ⭐
- **Burn Rate ($/hr)** : Coût par heure (`$6.46/hr`)
- **Projected Cost** : Coût projeté fin de block (`$29.93`)

### Vitesse
- **Burn Rate (tokens/min)** : Tokens par minute (`195,409`)
- **Projected Tokens** : Tokens projetés (`54,283,038`)

## 🔀 GIT STATUS

### Basique
- **Branch Name** : Nom de la branche (`main`, `feat/new-feature`)
- **Git Icon** :  (icône git)
- **Clean Status** : ✔ (propre) ou ✗ (modifié)

### Détaillé (comme Powerlevel10k)
- **Staged Files** : Fichiers staged (`*2`) ✅
- **Modified Files** : Fichiers modifiés (`!5`) ✅
- **Untracked Files** : Nouveaux fichiers (`?1`) ✅
- **Deleted Files** : Fichiers supprimés
- **Renamed Files** : Fichiers renommés
- **Ahead/Behind** : Commits en avance/retard (`↑3 ↓2`) ✅ **NOUVEAU v3.0**
- **Stash Count** : Nombre de stash (`⊟2`) ✅ **NOUVEAU v3.0**

### État du repo
- **Merge Conflict** : En cours de merge (`⚠CONFLICT`) ✅ **NOUVEAU v3.0**
- **Rebase** : En cours de rebase
- **Cherry-pick** : En cours de cherry-pick

## 🖥️ SYSTÈME

### OS & Machine
- **OS Icon** :  (macOS),  (Linux), 󰖳 (Windows)
- **Hostname** : Nom de la machine
- **Username** : Nom utilisateur
- **Current Directory** : Dossier actuel
  - **Full Path** : Chemin complet (`~/Projects/Perso/app`)
  - **Basename** : Juste le nom (`app`)
  - **Folder Icon** :  (dossier)

### Temps & Date
- **Current Time** : Heure actuelle (`14:30`)
- **Current Date** : Date (`07/10/2025`)
- **Day of Week** : Jour de la semaine (`Monday`)

## 🔧 VERSIONS LANGAGES

### Runtime (actuellement disponibles)
- **Node.js** :  + version (`23.9.0`)
- **Python** :  + version (`3.13`)
- **PHP** :  + version (`8.4`)
- **Go** :  + version (`1.24`)

### Autres disponibles
- **Rust** :  + version
- **Ruby** :  + version
- **Java** :  + version
- **Bun** :  + version
- **Deno** :  + version

## 🐳 OUTILS & SERVICES

### Containers & Orchestration ✅ **NOUVEAU v3.0**
- **Docker** : ◧ 3 (containers actifs) ✅
- **Docker Compose** : Nombre de containers actifs
- **Kubernetes** : ⎈ prod (context actuel) ✅

### Package Managers
- **npm** : Version ou nombre de packages
- **yarn** : Version
- **pnpm** : Version
- **composer** : Version (PHP)
- **cargo** : Version (Rust)

### Build Tools
- **Vite** : Si présent dans package.json
- **Webpack** : Si présent
- **Turbo** : Si présent

## 🔋 SYSTÈME (avancé)

### Ressources
- **CPU Usage** : Pourcentage CPU (`45%`)
- **Memory Usage** : RAM utilisée (`8GB/16GB`)
- **Disk Space** : Espace disque (`120GB free`)
- **Battery** : Niveau batterie (macOS) (`85% 󰂁`)

### Réseau
- **IP Address** : Adresse IP locale
- **WiFi Status** : Connecté/Déconnecté
- **VPN Status** : Actif/Inactif

## 📦 PROJET (package.json)

### Informations
- **Project Name** : Nom du projet
- **Project Version** : Version (`1.2.3`)
- **Scripts Available** : Nombre de scripts

### Dependencies
- **Dependency Count** : Nombre de dépendances
- **Outdated Packages** : Nombre de packages obsolètes

## 🎨 SYMBOLES & SÉPARATEURS

### Séparateurs
- ` ` : Espaces
- `│` : Barre verticale
- `╱` : Slash diagonal
- `•` : Bullet point
- `·` : Point centré
- `→` : Flèche
- `` : Triangle powerline

### Indicateurs
- `✔` : Success/Clean
- `✗` : Error/Modified
- `⚠` : Warning
- `🔥` : Burn rate/Hot
- `⚡` : Performance/Fast
- `📊` : Stats/Chart
- `💰` : Money/Cost
- `⏱️` : Time
- `🚀` : Rocket/Launch

---

## ⚙️ CONFIGURATION

### Variables d'Environnement
```bash
# Git Advanced Features
STATUSLINE_GIT_AHEAD_BEHIND=true|false    # Afficher ↑3 ↓2
STATUSLINE_GIT_STASH=true|false          # Afficher ⊟2
STATUSLINE_GIT_CONFLICT=true|false       # Afficher ⚠CONFLICT

# Docker & Kubernetes
STATUSLINE_DOCKER=true|false             # Afficher ◧ 3
STATUSLINE_KUBERNETES=true|false         # Afficher ⎈ prod

# Display Options
STATUSLINE_SHOW_DATE=true|false          # Afficher date
STATUSLINE_SHOW_TIME=true|false          # Afficher heure
STATUSLINE_MAX_PATH_LENGTH=50            # Longueur max chemin
```

### Fichier YAML
```yaml
# ~/.claude/statusline-config.yaml
features:
  git_ahead_behind: true
  git_stash: true
  git_conflict: true
  docker: true
  kubernetes: true

display:
  show_date: true
  show_time: true
  max_path_length: 50
```

---

## ⭐ RECOMMANDATIONS

### Statusline Minimale (rapide)
```
 ~/path   branch   version
```

### Statusline Optimale (équilibrée) - v3.0
```
 ~/path   branch *2 !5 ↑3   version   ◧ 2   4h2m • $3.81
```

### Statusline Complète (max info) - v3.0
```
 user@host   ~/path   main *2 !5 ?1 ↑3 ↓2 ⊟1   23.9.0   ◧ 3   ⎈ prod   4h2m • $3.81 • 195k/min
```

### Statusline DevOps Focus - v3.0
```
 ~/path   branch ↑3   ◧ 5   ⎈ production   4h2m • $3.81
```

### Statusline Performance Focus
```
 ~/path   version   3.7% • 4h2m • $3.81 • 195k tok/min • $6.46/hr
```

---

## 📦 NOUVELLES FONCTIONNALITÉS v3.0

### Git Advanced
- ✅ Ahead/Behind commits (`↑3 ↓2`)
- ✅ Stash count (`⊟2`)
- ✅ Merge conflict indicator (`⚠CONFLICT`)

### DevOps Integration
- ✅ Docker running containers (`◧ 3`)
- ✅ Kubernetes context (`⎈ prod`)

### Configuration
- ✅ YAML configuration file support
- ✅ Environment variables override
- ✅ Feature toggles (enable/disable individually)
