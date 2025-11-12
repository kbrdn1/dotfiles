# Plan de Migration Dotfiles → Nix Configuration

**Date** : 2025-11-12
**Repo** : https://github.com/kbrdn1/dotfiles
**Clone local** : `/Users/kbrdn1/Projects/Labs/dotfiles-migration`
**Config locale actuelle** : `/Users/kbrdn1/nix-config` + `~/.config/`

---

## 📊 État des Lieux

### Repo Actuel (Ancien)
- **Gestionnaire** : Chezmoi
- **Package Manager** : Homebrew + ASDF
- **Structure** : `dot_config/`, `dot_zshrc`, `dot_tool-versions`
- **Taille** : ~50+ fichiers de configuration
- **Dernière mise à jour** : Migration Yabai → Aerospace (août 2025)

### Config Locale Actuelle (Nouveau)
- **Gestionnaire** : Nix Home Manager 24.11
- **Package Manager** : Nix (62 packages) + Homebrew (GUI uniquement)
- **Structure** : `~/nix-config/home.nix` + `~/.config/`
- **Environnement** : 100% Nix pour CLI tools
- **Espace libéré** : 2.2 GB (nettoyage Homebrew)

---

## 🎯 Objectifs de la Migration

### 1. Remplacer ASDF par Nix
- ✅ ASDF désinstallé (2 GB libérés)
- ✅ Nix gère : nodejs, python, php, go, rust, bun, deno, pnpm
- ❌ Retirer `.tool-versions` du repo
- ❌ Documenter migration ASDF → Nix

### 2. Intégrer nix-config dans dotfiles
- ❌ Ajouter `nix-config/` comme sous-module ou copie
- ❌ Documenter structure Nix
- ❌ Ajouter alias `reload-nix`, `edit-nix`

### 3. Nettoyer Configurations Obsolètes
- ❌ Retirer `dot_config/nvim/` (migré vers Zed)
- ❌ Retirer `dot_config/nvim-lazyvim/` si existe
- ❌ Retirer `dot_config/yabai/` (migré vers Aerospace)
- ❌ Mettre à jour README avec nouveau stack

### 4. Mettre à Jour .zshrc
- ❌ Intégrer configuration Nix (daemon, PATH)
- ❌ Ajouter alias Nix (`reload-nix`, `edit-nix`)
- ❌ Retirer références ASDF
- ❌ Mettre à jour versions des outils

### 5. Documenter Nouveau Workflow
- ❌ Installation avec Nix first
- ❌ Guide migration Homebrew → Nix
- ❌ Nouveaux alias et commandes
- ❌ Stack complet Kubernetes

---

## 📁 Structure Actuelle vs Nouvelle

### Structure Actuelle (Chezmoi)
```
dotfiles/
├── dot_config/
│   ├── aerospace/          # ✅ Conserver
│   ├── bat/                # ✅ Conserver
│   ├── borders/            # ✅ Conserver
│   ├── gh/                 # ✅ Conserver
│   ├── ghostty/            # ✅ Conserver
│   ├── neofetch/           # ✅ Conserver
│   ├── nvim/               # ❌ RETIRER (obsolète)
│   ├── karabiner/          # ✅ Conserver
│   ├── sketchybar/         # ✅ Conserver
│   ├── skhd/               # ✅ Conserver
│   ├── yabai/              # ❌ RETIRER (obsolète)
│   ├── yazi/               # ✅ Conserver
│   └── zed/                # ✅ Conserver
├── dot_zshrc               # 🔄 METTRE À JOUR (Nix)
├── dot_tool-versions       # ❌ RETIRER (ASDF obsolète)
├── dot_p10k.zsh            # ✅ Conserver
├── dot_tmux.conf           # ✅ Conserver
├── private_dot_claude/     # ✅ Conserver
├── install.sh              # 🔄 METTRE À JOUR
└── README.md               # 🔄 METTRE À JOUR
```

### Nouvelle Structure Proposée
```
dotfiles/
├── nix-config/             # ➕ AJOUTER
│   ├── home.nix            # Configuration Home Manager
│   ├── flake.nix           # Flake configuration
│   └── flake.lock          # Lockfile
├── dot_config/
│   ├── aerospace/          # ✅ Conserver
│   ├── bat/                # ✅ Config managed par Nix
│   ├── borders/            # ✅ Conserver
│   ├── gh/                 # ✅ Conserver
│   ├── ghostty/            # ✅ Conserver
│   ├── sketchybar/         # ✅ Conserver
│   ├── skhd/               # ✅ Conserver
│   ├── yazi/               # ✅ Conserver
│   └── zed/                # ✅ Conserver
├── dot_zshrc               # 🔄 Nix + Oh-My-Zsh hybrid
├── dot_p10k.zsh            # ✅ Conserver
├── dot_tmux.conf           # ✅ Conserver
├── private_dot_claude/     # ✅ Conserver
├── install.sh              # 🔄 Nix-first installation
├── README.md               # 🔄 Documentation complète
├── MIGRATION_NIX.md        # ➕ Guide migration ASDF → Nix
└── MIGRATION_HOMEBREW.md   # ➕ Guide nettoyage Homebrew
```

---

## 🗂️ Fichiers à Modifier

### 1. dot_zshrc (MISE À JOUR MAJEURE)

**Changements** :
- ✅ Ajouter chargement Nix daemon
- ✅ Ajouter alias `reload-nix`, `edit-nix`
- ❌ Retirer configuration ASDF
- ❌ Retirer export ASDF_DATA_DIR
- ✅ Mettre à jour PATH pour Nix
- ✅ Conserver Oh-My-Zsh, Powerlevel10k, plugins

**Section Nix à ajouter** :
```zsh
# -------------------------- Nix Configuration --------------------------
# Nix daemon (multi-user mode)
if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
  . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
fi

# Nix aliases
alias reload-nix="nix run home-manager/release-24.11 -- switch --flake ~/nix-config"
alias edit-nix="$EDITOR ~/nix-config/home.nix"
```

**Section ASDF à retirer** :
```zsh
# ASDF
export ASDF_DATA_DIR="/opt/homebrew/opt/asdf/"
export ASDF_PYTHON_PATCH_URL="https://github.com/python/cpython/commit/8ea6353.patch?full_index=1"
export PATH="$ASDF_DATA_DIR/shims:$PATH"
```

### 2. README.md (RÉÉCRITURE PARTIELLE)

**Section "CLI Tools" à mettre à jour** :
```markdown
### CLI Tools 🛠

Our essential command-line tools (managed by Nix):

- **Package Management**
  - [Nix](https://nixos.org/): Declarative package manager
  - [Home Manager](https://github.com/nix-community/home-manager): User environment management
  - [Homebrew](https://brew.sh/): GUI apps and system tools (complementary)

- **Programming Languages & Runtimes** (via Nix)
  - [Node.js](https://nodejs.org/) 24.11.0
  - [Python](https://www.python.org/) 3.13.8
  - [PHP](https://www.php.net/) 8.4.14 (with pcov, redis extensions)
  - [Go](https://golang.org/) 1.25.2
  - [Rust](https://www.rust-lang.org/) 1.89.0
  - [Bun](https://bun.sh/) 1.3.1
  - [Deno](https://deno.land/) 2.5.6
  - [pnpm](https://pnpm.io/) 10.20.0

- **Kubernetes Tools** (via Nix)
  - [kubectl](https://kubernetes.io/) 1.34.1
  - [helm](https://helm.sh/)
  - [minikube](https://minikube.sigs.k8s.io/) 1.37.0
  - [argocd](https://argoproj.github.io/cd/)
  - [k9s](https://k9scli.io/)
  - [kubectx](https://github.com/ahmetb/kubectx) 0.9.5
  - [stern](https://github.com/stern/stern) 1.33.0
  - [kustomize](https://kustomize.io/) 5.7.1
  - [kubecolor](https://github.com/hidetatz/kubecolor) 0.5.2
  - [dive](https://github.com/wagoodman/dive) 0.13.1
  - [popeye](https://popeyecli.io/) 0.22.1

- **Development Tools** (via Nix)
  - [Git](https://git-scm.com/)
  - [GitHub CLI](https://cli.github.com/)
  - [Lazygit](https://github.com/jesseduffield/lazygit)
  - [Lazydocker](https://github.com/jesseduffield/lazydocker)
  - [Redis](https://redis.io/) 8.2.2
  - [Pandoc](https://pandoc.org/) 3.7.0.2
  - [Neovim](https://neovim.io/) 0.11.5

- **Homebrew Exclusives** (not in Nix)
  - [Lazykube](https://github.com/TNK-Studio/lazykube) - Kubernetes TUI
  - [Dashlane CLI](https://cli.dashlane.com/) - Password manager
  - [Composer](https://getcomposer.org/) - PHP dependency manager
```

**Nouvelle section "Nix Management"** :
```markdown
### Nix Management 📦

| Alias | Command | Description |
|-------|---------|-------------|
| `reload-nix` | `nix run home-manager/release-24.11 -- switch --flake ~/nix-config` | Reload Nix configuration |
| `edit-nix` | `$EDITOR ~/nix-config/home.nix` | Edit Nix configuration |
```

### 3. install.sh (RÉÉCRITURE COMPLÈTE)

**Nouveau workflow** :
```bash
#!/bin/zsh

echo "🚀 Installation - Nix First Approach"

# 1. Install xCode CLI tools
echo "📦 Installing xCode CLI tools..."
xcode-select --install

# 2. Install Nix (multi-user)
echo "❄️  Installing Nix package manager..."
sh <(curl -L https://nixos.org/nix/install) --daemon

# 3. Install Homebrew (for GUI apps and system tools)
echo "🍺 Installing Homebrew..."
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew analytics off

# 4. Tap Homebrew repositories
echo "🔧 Tapping Homebrew repos..."
brew tap FelixKratz/formulae
brew tap koekeishiya/formulae

# 5. Install system dependencies (Homebrew only)
echo "🛠️  Installing system dependencies..."
brew install gd bison openssl blueutil

# 6. Install GUI applications (Homebrew casks)
echo "📲 Installing GUI applications..."
brew install --cask \
  arc raycast zed ghostty warp postman \
  slack discord figma docker whatsapp \
  obsidian setapp sf-symbols

# 7. Install window management tools (Homebrew only)
echo "🪟 Installing window management tools..."
brew install sketchybar borders svim koekeishiya/formulae/yabai skhd

# 8. Install Homebrew exclusive tools (not in nixpkgs)
echo "📦 Installing Homebrew exclusive tools..."
brew install lazykube dashlane-cli composer

# 9. Clone nix-config
echo "❄️  Cloning nix-config..."
git clone https://github.com/kbrdn1/nix-config.git ~/nix-config

# 10. Install Oh My Zsh
echo "🐚 Installing Oh My Zsh..."
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# 11. Clone and apply dotfiles
echo "📂 Applying dotfiles..."
chezmoi init https://github.com/kbrdn1/dotfiles.git
chezmoi apply

# 12. Install Home Manager and apply Nix configuration
echo "❄️  Installing Home Manager..."
nix run home-manager/release-24.11 -- switch --flake ~/nix-config

# 13. macOS System Settings
echo "⚙️  Configuring macOS settings..."
# Keyboard
defaults write NSGlobalDomain KeyRepeat -int 1

# Screenshots
mkdir -p ~/Screenshots
defaults write com.apple.screencapture location ~/Screenshots
defaults write com.apple.screencapture type png
defaults write com.apple.screencapture disable-shadow -bool true

# Menu Bar
defaults write NSGlobalDomain _HIHideMenuBar -bool true

# Dock
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-time-modifier -float 0.15

# 14. Start services
echo "🚀 Starting services..."
brew services start sketchybar
brew services start borders

echo "✅ Installation complete! Please restart your terminal."
echo ""
echo "📝 Next steps:"
echo "1. Restart your terminal: exec zsh"
echo "2. Check Nix packages: nix profile list"
echo "3. Configure Aerospace: aerospace --reload"
echo "4. Install SetApp applications manually"
```

### 4. Nouveaux Fichiers de Documentation

#### MIGRATION_NIX.md (NOUVEAU)
Documentation complète de la migration ASDF → Nix.

#### MIGRATION_HOMEBREW.md (NOUVEAU)
Guide du nettoyage Homebrew et liste des doublons éliminés.

#### nix-config/ (NOUVEAU DOSSIER)
Copie de `/Users/kbrdn1/nix-config/` dans le repo dotfiles.

---

## 🔧 Configurations à Conserver

### ✅ Configs Actives (À Garder)

1. **Window Management**
   - `dot_config/aerospace/` - Window manager principal
   - `dot_config/borders/` - JankyBorders
   - `dot_config/sketchybar/` - Status bar
   - `dot_config/skhd/` - Hotkey daemon
   - `dot_config/private_karabiner/` - Keyboard customization

2. **Terminal & Shell**
   - `dot_zshrc` - Shell configuration (METTRE À JOUR)
   - `dot_p10k.zsh` - Powerlevel10k theme
   - `dot_tmux.conf` - Terminal multiplexer
   - `tmux_custom_modules/` - Tmux extensions

3. **Editor & Tools**
   - `dot_config/zed/` - Primary editor
   - `dot_config/ghostty/` - Terminal emulator
   - `dot_config/yazi/` - File manager
   - `dot_config/bat/` - Cat replacement

4. **Dev Tools**
   - `dot_config/gh/` - GitHub CLI
   - `dot_config/gh-copilot/` - GitHub Copilot
   - `dot_config/gh-dash/` - GitHub dashboard
   - `dot_config/neofetch/` - System info

5. **Claude Framework**
   - `private_dot_claude/` - SuperClaude framework complet

### ❌ Configs Obsolètes (À Retirer)

1. **Editors**
   - `dot_config/nvim/` - Migré vers Zed
   - `dot_config/svim/` - Plus utilisé

2. **Window Managers**
   - `dot_config/yabai/` - Remplacé par Aerospace

3. **Build Tools**
   - `dot_tool-versions` - ASDF remplacé par Nix

---

## 📊 Comparaison Versions

### Versions Repo Actuel (.tool-versions)
```
neovim 0.10.4       → Nix: 0.11.5 ✅
bun 1.2.22          → Nix: 1.3.1 ✅
nodejs 24.0.1       → Nix: 24.11.0 ✅
pnpm 10.7.1         → Nix: 10.20.0 ✅
rust 1.84.1         → Nix: 1.89.0 ✅
golang 1.23.6       → Nix: 1.25.2 ✅
stripe-cli 1.26.1   → Nix: Latest ✅
chezmoi 2.62.4      → Homebrew (keep)
deno 2.3.1          → Nix: 2.5.6 ✅
```

### Nouveaux Packages (absents du repo)
```
python 3.13.8       ➕ Nouveau
php 8.4.14          ➕ Nouveau (avec extensions)
symfony-cli 5.15.1  ➕ Nouveau
awscli2             ➕ Nouveau
redis 8.2.2         ➕ Nouveau
pandoc 3.7.0.2      ➕ Nouveau
kubectl 1.34.1      ➕ Nouveau
helm                ➕ Nouveau
minikube 1.37.0     ➕ Nouveau
argocd              ➕ Nouveau
k9s                 ➕ Nouveau
kubectx 0.9.5       ➕ Nouveau
stern 1.33.0        ➕ Nouveau
kustomize 5.7.1     ➕ Nouveau
kubecolor 0.5.2     ➕ Nouveau
dive 0.13.1         ➕ Nouveau
popeye 0.22.1       ➕ Nouveau
```

---

## 🚀 Plan d'Exécution

### Phase 1 : Préparation (30 min)
1. ✅ Cloner repo dans Labs : `dotfiles-migration/`
2. ❌ Créer branche migration : `git checkout -b feature/nix-migration`
3. ❌ Backup du repo actuel
4. ❌ Analyser tous les fichiers dot_config/

### Phase 2 : Nettoyage (1h)
1. ❌ Retirer `dot_tool-versions`
2. ❌ Retirer `dot_config/nvim/`
3. ❌ Retirer `dot_config/yabai/`
4. ❌ Retirer `dot_config/svim/` si existe
5. ❌ Nettoyer références ASDF dans scripts

### Phase 3 : Intégration Nix (2h)
1. ❌ Copier `~/nix-config/` → `nix-config/`
2. ❌ Créer `.chezmoiignore` pour exclure nix-config/ si besoin
3. ❌ Mettre à jour `dot_zshrc` avec config Nix
4. ❌ Ajouter alias Nix
5. ❌ Tester .zshrc localement

### Phase 4 : Documentation (2h)
1. ❌ Réécrire README.md
2. ❌ Créer MIGRATION_NIX.md
3. ❌ Créer MIGRATION_HOMEBREW.md
4. ❌ Mettre à jour install.sh
5. ❌ Créer CHANGELOG.md pour migration

### Phase 5 : Validation (1h)
1. ❌ Tester install.sh sur machine propre (VM ou container)
2. ❌ Vérifier tous les alias
3. ❌ Tester reload-nix
4. ❌ Valider chemins et configurations

### Phase 6 : Déploiement (30 min)
1. ❌ Commit tous les changements
2. ❌ Push branche feature/nix-migration
3. ❌ Créer Pull Request
4. ❌ Review et merge
5. ❌ Tag release v2.0.0 (Nix Migration)

---

## ⚠️ Points d'Attention

### Chezmoi vs Nix Home Manager

**Cohabitation** :
- ✅ **Chezmoi** : Gère les dotfiles spécifiques (~/.config/, .zshrc, .tmux.conf)
- ✅ **Nix Home Manager** : Gère les packages et certains configs (git, bat, zsh plugins)
- ⚠️ **Risque** : Configuration .zshrc peut être override par Home Manager

**Solution** :
- Garder Chezmoi pour configs custom (~/.config/)
- Utiliser Nix Home Manager pour packages + .zshrc de base
- Merge des deux approches dans dot_zshrc

### Homebrew vs Nix

**Ce qui reste dans Homebrew** :
- ✅ GUI Applications (Arc, Raycast, Zed, etc.)
- ✅ System tools (sketchybar, borders, blueutil)
- ✅ Outils non disponibles dans Nix (lazykube, dashlane-cli, composer)

**Ce qui est maintenant dans Nix** :
- ✅ Tous les CLI tools (fd, fzf, bat, ripgrep, etc.)
- ✅ Programming languages (node, python, php, go, rust)
- ✅ Kubernetes tools (kubectl, helm, k9s, stern, etc.)
- ✅ Dev tools (git, gh, lazygit, redis, pandoc)

### Migration Utilisateurs Existants

**Pour utilisateurs avec ancien dotfiles** :
1. Désinstaller ASDF : `brew uninstall asdf`
2. Installer Nix : `sh <(curl -L https://nixos.org/nix/install) --daemon`
3. Nettoyer doublons Homebrew (voir MIGRATION_HOMEBREW.md)
4. Appliquer nouvelle config : `chezmoi update`
5. Installer Home Manager : `reload-nix`

---

## 📋 Checklist Complète

### Fichiers à Modifier
- [ ] `dot_zshrc` - Intégrer Nix, retirer ASDF
- [ ] `README.md` - Mettre à jour stack et versions
- [ ] `install.sh` - Nix-first workflow
- [ ] `.chezmoiignore` - Gérer exclusions si nécessaire

### Fichiers à Retirer
- [ ] `dot_tool-versions` - ASDF obsolète
- [ ] `dot_config/nvim/` - Migré vers Zed
- [ ] `dot_config/yabai/` - Remplacé par Aerospace

### Fichiers à Ajouter
- [ ] `nix-config/home.nix` - Configuration Nix
- [ ] `nix-config/flake.nix` - Flake configuration
- [ ] `nix-config/flake.lock` - Lockfile
- [ ] `MIGRATION_NIX.md` - Guide migration
- [ ] `MIGRATION_HOMEBREW.md` - Guide nettoyage
- [ ] `CHANGELOG.md` - Historique migration

### Documentation
- [ ] Sections CLI Tools mises à jour
- [ ] Versions actuelles documentées
- [ ] Nouveaux alias Nix ajoutés
- [ ] Guide installation Nix-first
- [ ] Workflow Homebrew + Nix expliqué

### Validation
- [ ] Test installation fraîche
- [ ] Tous les alias fonctionnent
- [ ] reload-nix fonctionne
- [ ] Pas de références ASDF restantes
- [ ] Configurations window management intactes

---

## 🎯 Résultat Attendu

### Avant Migration
- **Package Manager** : Homebrew + ASDF (mix complexe)
- **CLI Tools** : Répartis entre Homebrew et ASDF
- **Taille** : ~250 packages Homebrew
- **Gestion** : Manuelle, .tool-versions

### Après Migration
- **Package Manager** : Nix (CLI) + Homebrew (GUI/System)
- **CLI Tools** : 62 packages Nix, 0 doublons
- **Taille** : ~199 packages Homebrew (-51 packages)
- **Gestion** : Déclarative, home.nix
- **Espace libéré** : 2.2 GB
- **Versions** : Toutes à jour

---

## 📚 Références

- **Nix Documentation** : https://nixos.org/manual/nix/stable/
- **Home Manager** : https://nix-community.github.io/home-manager/
- **Chezmoi** : https://www.chezmoi.io/
- **Repo actuel** : https://github.com/kbrdn1/dotfiles
- **Nix Config** : ~/nix-config/
- **Obsidian Docs** : ~/Library/Mobile Documents/.../03 - Resources/01 - Nix Configuration/

---

**Prêt pour exécution** : OUI ✅
**Estimation totale** : 6-7 heures
**Complexité** : Moyenne-Haute
**Risque** : Faible (backup + branche feature)
