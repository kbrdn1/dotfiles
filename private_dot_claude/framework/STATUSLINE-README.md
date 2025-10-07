# 📊 Claude Code - StatusLine Avancée

Une statusline intelligente et élégante pour Claude Code avec détection automatique des runtimes, stats ccusage en temps réel, et alias de chemins personnalisés.

---

## 🎯 Aperçu

```
◉ Sonnet 4.5  ⌂ ◆ Perso/cv-exporter  ⬢ 23.9.0  ◉ ⇣1200 ⇡4990 • ≈ 222k tok/min • $6.32 • ⧗ 4h 2m  ◫ 07/10/25 ◷ 02:17
```

### Segments affichés :
1. **◉ Sonnet 4.5** - Modèle AI utilisé
2. **⌂ ◆ Perso/cv-exporter** - Chemin avec alias intelligent
3. **⬢ 23.9.0** - Version Node.js (détection auto)
4. **◉ ⇣1200 ⇡4990** - Input/Output tokens
5. **≈ 222k tok/min** - Burn rate
6. **$6.32** - Coût du block actuel
7. **⧗ 4h 2m** - Temps de session restant (5h block)
8. **◫ 07/10/25 ◷ 02:17** - Date et heure

---

## 📦 Installation

### Fichiers requis

```
~/.claude/
├── statusline-p10k.sh          # Script principal
├── settings.json               # Configuration Claude Code
├── STATUSLINE-README.md        # Ce fichier
├── statusline-options.md       # Liste de toutes les options
└── statusline-aliases.md       # Documentation des alias
```

### Configuration settings.json

```json
{
  "alwaysThinkingEnabled": true,
  "statusLine": {
    "type": "command",
    "command": "/bin/bash /Users/kbrdn1/.claude/statusline-p10k.sh",
    "padding": 0
  }
}
```

### Dépendances

- **jq** - Parsing JSON (installé via Homebrew)
- **bunx ccusage** - Stats de tokens Claude Code
- **Nerd Fonts** - Symboles Unicode (recommandé mais optionnel)

Installation des dépendances :
```bash
# Installer jq
brew install jq

# Tester ccusage
bunx ccusage --version
```

---

## ✨ Fonctionnalités

### 1. 🤖 **Détection du Modèle Claude**

- **Sonnet 4.5** - Claude Sonnet 4.5
- **Sonnet 3.5** - Claude Sonnet 3.5
- **Opus 4.1** - Claude Opus 4.1
- **Opus 4** - Claude Opus 4
- **Opus 3** - Claude Opus 3
- **Haiku 3.5** - Claude Haiku 3.5
- **Haiku** - Claude Haiku

Auto-détecté depuis le JSON input de Claude Code avec extraction de la version.

### 2. 📂 **Alias de Chemins Intelligents**

#### Projects
| Chemin | Alias | Symbole |
|--------|-------|---------|
| `~/Projects/Perso` | `◆ Perso` | ◆ |
| `~/Projects/Flippad` | `◈ Flippad` | ◈ |
| `~/Projects/Pro` | `◇ Pro` | ◇ |
| `~/Projects/MNS` | `◈ MNS` | ◈ |
| `~/Projects/Labs` | `◉ Labs` | ◉ |
| `~/Projects/Learning` | `◎ Learn` | ◎ |
| `~/Projects/Mehdi` | `◊ Mehdi` | ◊ |

#### Système
| Chemin | Alias | Symbole |
|--------|-------|---------|
| `~/Downloads` | `⇣ DL` | ⇣ |
| `~/Documents` | `◫ Docs` | ◫ |
| `~/Desktop` | `◲ Desk` | ◲ |
| `~/Scripts` | `⚙ Scripts` | ⚙ |

### 3. 🔀 **Git Status Détaillé**

Format Powerlevel10k :
```
⎇ main *2 !5 ?1 ↑3 ↓2 ⊟1
```

- `*2` - 2 fichiers staged
- `!5` - 5 fichiers modifiés
- `?1` - 1 fichier untracked
- `↑3` - 3 commits en avance (ahead)
- `↓2` - 2 commits en retard (behind)
- `⊟1` - 1 stash disponible
- `⚠CONFLICT` - Conflits de merge détectés

### 4. 🔧 **Détection Intelligente des Runtimes**

N'affiche **que les runtimes utilisés** par le projet actuel.

#### Détection par fichiers :
- **Node.js** ⬢ : `package.json`, `yarn.lock`, `bun.lockb`
- **PHP** ◆ : `composer.json`
- **Go** ◈ : `go.mod`, `go.sum`
- **Python** ⊙ : `requirements.txt`, `pyproject.toml`
- **Rust** ⚙ : `Cargo.toml`
- **Ruby** ◊ : `Gemfile`
- **Java** ◈ : `pom.xml`, `build.gradle`

#### Priorité `.tool-versions`
Si présent, utilise les versions définies dans `.tool-versions` (asdf/mise).

### 5. 🐳 **Docker & Kubernetes**

Intégration automatique avec vos environnements de développement :

- **◧ 3** - 3 conteneurs Docker actifs
- **⎈ prod** - Contexte Kubernetes actuel
- **⎈ minikube** - Environnement local détecté

Affichage automatique uniquement si les outils sont installés et actifs.

### 6. 📊 **Stats ccusage en Temps Réel**

Intégration avec `bunx ccusage blocks --active` :

- **⇣ Input tokens** - Tokens d'entrée
- **⇡ Output tokens** - Tokens de sortie
- **≈ Burn rate** - Tokens par minute
- **$ Coût** - Coût actuel du block (5h)
- **⧗ Temps restant** - Temps restant dans le block de 5h

### 7. 🕐 **Date & Heure**

Format : `◫ DD/MM/YY ◷ HH:MM`

---

## 🎨 Symboles Unicode Utilisés

### Modèle & Système
- **◉** - Modèle Claude (cercle plein)
- **⌂** - Dossier/home
- **⎇** - Git branch
- **✓** - Git clean
- **✗** - Git modifié

### Langages
- **⬢** - Node.js (hexagone)
- **◆** - PHP (diamant)
- **◈** - Go (fisheye)
- **⚙** - Rust (gear)
- **⊙** - Python (cercle point)
- **◊** - Ruby (losange)
- **◈** - Java (fisheye)

### Git Avancé
- **↑** - Commits ahead (en avance)
- **↓** - Commits behind (en retard)
- **⊟** - Stash count (empilés)
- **⚠** - Merge conflict (attention)

### DevOps & Containers
- **◧** - Docker containers (boîte)
- **⎈** - Kubernetes (helm)

### Stats & Données
- **◉** - Tokens (jeton)
- **⇣** - Input (flèche bas)
- **⇡** - Output (flèche haut)
- **≈** - Burn rate (approximation)
- **⧗** - Temps restant (sablier)
- **◫** - Date (calendrier)
- **◷** - Heure (horloge)

---

## ⚙️ Configuration

### Fichier de Configuration (Recommandé)

Créez `~/.claude/statusline-config.yaml` pour personnaliser le comportement :

```yaml
features:
  git_ahead_behind: true    # Afficher ↑3 ↓2
  git_stash: true          # Afficher ⊟2
  git_conflict: true       # Afficher ⚠CONFLICT
  docker: true             # Afficher ◧ 3
  kubernetes: true         # Afficher ⎈ prod

display:
  show_date: true          # Afficher la date
  show_time: true          # Afficher l'heure
  max_path_length: 50      # Longueur max du chemin
```

**Pré-requis** : Installer `yq` pour le parsing YAML
```bash
brew install yq
```

### Variables d'Environnement (Alternative)

Pour désactiver rapidement des fonctionnalités sans YAML :

```bash
# Désactiver Docker/Kubernetes
export STATUSLINE_DOCKER=false
export STATUSLINE_KUBERNETES=false

# Désactiver Git avancé
export STATUSLINE_GIT_AHEAD_BEHIND=false
export STATUSLINE_GIT_STASH=false

# Masquer date/heure
export STATUSLINE_SHOW_DATE=false
export STATUSLINE_SHOW_TIME=false
```

Ajoutez ces lignes à votre `~/.zshrc` ou `~/.bashrc` pour les rendre permanentes.

### Priorité de Configuration

1. **Variables d'environnement** (priorité maximale)
2. **Fichier YAML** (`~/.claude/statusline-config.yaml`)
3. **Valeurs par défaut** (tout activé)

## 🛠️ Personnalisation

### Ajouter un Nouvel Alias

Édite `~/.claude/statusline-p10k.sh` dans la section "Smart aliases" :

```bash
# IMPORTANT : Les chemins spécifiques AVANT les génériques
dir_path="${dir_path//~\/Projects\/MonProjet/◈ MonProjet}"
dir_path="${dir_path//~\/Projects/⬡ Proj}"
```

### Modifier le Style du Modèle

Dans la section "Claude Model" :

```bash
if [[ "$model_json" =~ sonnet ]]; then
  model_display="Claude 4.5"  # Modifier ici
fi
```

### Changer les Symboles

Section "Icons (Unicode Symbols)" :

```bash
model_icon="◉"    # Changer le symbole du modèle
folder_icon="⌂"   # Changer le symbole de dossier
# etc...
```

### Désactiver des Fonctionnalités

#### Masquer le modèle
```bash
# Commenter dans la section "Build Status Line"
# if [ -n "$model_display" ]; then
#   output="${output}${model_icon} ${model_display}  "
# fi
```

#### Masquer la date/heure
```bash
# Commenter la ligne datetime_info
# output="${output}${datetime_info}"
```

#### Masquer les versions de langages
```bash
# Commenter la ligne version_info
# output="${output}${version_info}"
```

---

## 📝 Exemples par Contexte

### Projet Node.js (avec Git)
```
◉ Sonnet 4.5  ⌂ ◆ Perso/app  ⎇ main *2 !1  ⬢ 23.9.0  ◉ ⇣850 ⇡3200 • ≈ 180k tok/min • $4.50 • ⧗ 3h 15m  ◫ 07/10/25 ◷ 14:30
```

### Projet PHP Laravel
```
◉ Sonnet 4.5  ⌂ ◈ Flippad/api  ⎇ develop !5  ◆ 8.4  ◉ ⇣1200 ⇡4500 • ≈ 200k tok/min • $5.80 • ⧗ 2h 45m  ◫ 07/10/25 ◷ 15:45
```

### Projet Go
```
◉ Sonnet 4.5  ⌂ ◇ Pro/microservice  ⎇ feat/auth  ◈ 1.24  ◉ ⇣600 ⇡2100 • ≈ 120k tok/min • $3.20 • ⧗ 4h 10m  ◫ 07/10/25 ◷ 16:00
```

### Dossier sans projet
```
◉ Sonnet 4.5  ⌂ ⇣ DL  ◉ ⇣450 ⇡1800 • ≈ 90k tok/min • $2.40 • ⧗ 4h 55m  ◫ 07/10/25 ◷ 10:15
```

---

## 🔍 Troubleshooting

### La statusline ne s'affiche pas

Vérifiez que le script est exécutable :
```bash
chmod +x ~/.claude/statusline-p10k.sh
```

Testez manuellement :
```bash
echo '{}' | /bin/bash ~/.claude/statusline-p10k.sh
```

### Les symboles ne s'affichent pas correctement

Installez une **Nerd Font** compatible :
```bash
# Recommandations
brew tap homebrew/cask-fonts
brew install --cask font-jetbrains-mono-nerd-font
brew install --cask font-fira-code-nerd-font
```

Puis configurez votre terminal pour utiliser cette police.

### ccusage ne fonctionne pas

Vérifiez que bunx est installé :
```bash
bunx ccusage --version
```

Si non installé :
```bash
npm install -g bun
```

### Les versions de langages ne s'affichent pas

Vérifiez que les fichiers de détection existent :
```bash
ls package.json    # Node.js
ls go.mod          # Go
ls composer.json   # PHP
ls Cargo.toml      # Rust
```

Ou créez un `.tool-versions` :
```bash
echo "nodejs 23.9.0" > .tool-versions
echo "golang 1.24.4" >> .tool-versions
```

### Le chemin n'est pas raccourci

Vérifiez l'ordre des alias (spécifique avant générique) :
```bash
# BON
dir_path="${dir_path//~\/Projects\/Perso/◆ Perso}"
dir_path="${dir_path//~\/Projects/⬡ Proj}"

# MAUVAIS (générique écrase spécifique)
dir_path="${dir_path//~\/Projects/⬡ Proj}"
dir_path="${dir_path//~\/Projects\/Perso/◆ Perso}"
```

---

## 📚 Documentation Complémentaire

- **statusline-config-reference.md** - ⭐ **NOUVEAU** Référence complète de configuration
- **statusline-options.md** - Liste complète de toutes les options disponibles
- **statusline-aliases.md** - Guide détaillé des alias de chemins
- **statusline-config.yaml** - Fichier de configuration avec tous les exemples
- **test-icons.sh** - Script pour tester les symboles

---

## 🚀 Performance

### Optimisations implémentées

1. **Détection conditionnelle** - Les runtimes ne sont vérifiés que si utilisés
2. **Cache ccusage** - Utilise `--compact` pour moins de données
3. **Git optimisé** - Utilise `--no-optional-locks` pour éviter les blocages
4. **Parsing efficace** - Utilise `grep` et `awk` au lieu de regex complexes

### Temps d'exécution moyen
- **Sans Git** : ~100-150ms
- **Avec Git** : ~200-300ms
- **Avec ccusage** : +150ms (cache après premier appel)

---

## 🤝 Contribution

Pour ajouter de nouvelles fonctionnalités :

1. Éditer `~/.claude/statusline-p10k.sh`
2. Tester avec : `echo '{}' | bash ~/.claude/statusline-p10k.sh`
3. Documenter dans ce README

---

## 📄 Licence

Configuration personnelle - Libre d'utilisation et modification.

---

## 🎯 Roadmap

Fonctionnalités implémentées (v3.0) :

- [x] Support Docker (afficher si containers running)
- [x] Support Kubernetes (afficher context actuel)
- [x] Afficher le nombre de commits ahead/behind
- [x] Support des stash Git
- [x] Indicateur de merge conflict
- [x] Configuration via fichier YAML
- [x] Variables d'environnement pour configuration rapide

Fonctionnalités futures :

- [ ] Support Vim mode indicator (limitation Claude Code)
- [ ] Thèmes de couleurs (si support ajouté par Claude Code)
- [ ] Support d'autres systèmes de containers (Podman)
- [ ] Indicateur de CI/CD status
- [ ] Support AWS/GCP/Azure context

---

**Dernière mise à jour** : 07/10/2025
**Version** : 3.0 - Édition DevOps & Configuration
