# Migration ASDF → Nix

**Date de migration** : Novembre 2025
**Ancien système** : ASDF + Homebrew
**Nouveau système** : Nix + Home Manager 24.11
**Statut** : ✅ Migration complétée

---

## 📊 Vue d'Ensemble

Cette migration remplace ASDF (gestionnaire de versions) par Nix, offrant une gestion déclarative et reproductible de l'environnement de développement.

### Avant Migration

```yaml
Gestionnaires:
  - ASDF: Versions des langages (9 packages)
  - Homebrew: CLI tools + GUI apps (250+ packages)

Problèmes:
  - Doublons entre ASDF et Homebrew
  - Configuration non déclarative (.tool-versions)
  - Installation ASDF: 2 GB d'espace
  - Gestion manuelle des versions
  - Pas de rollback facile
```

### Après Migration

```yaml
Gestionnaires:
  - Nix: CLI tools + langages (62 packages)
  - Homebrew: GUI apps + outils système uniquement (199 packages)

Avantages:
  - Configuration déclarative (home.nix)
  - Reproductibilité complète
  - Rollback instantané (générations)
  - Espace libéré: 2.2 GB
  - Isolation des packages
  - Builds déterministes
```

---

## 🎯 Objectifs Atteints

### ✅ Remplacement ASDF

**Packages ASDF → Nix**:
```
neovim 0.10.4    → 0.11.5  (Nix)
bun 1.2.22       → 1.3.1   (Nix)
nodejs 24.0.1    → 24.11.0 (Nix)
pnpm 10.7.1      → 10.20.0 (Nix)
rust 1.84.1      → 1.89.0  (Nix)
golang 1.23.6    → 1.25.2  (Nix)
deno 2.3.1       → 2.5.6   (Nix)
stripe-cli 1.26.1 → Latest (Nix)
```

**Nouveaux packages ajoutés**:
```
python 3.13.8           (Python 3)
php 8.4.14              (avec extensions pcov, redis)
symfony-cli 5.15.1      (Framework PHP)
```

### ✅ Stack Kubernetes Complète

11 outils K8s dans Nix:
```
kubectl 1.34.1          - CLI Kubernetes
helm                    - Package manager K8s
minikube 1.37.0         - Cluster local
argocd                  - GitOps CD
k9s                     - TUI K8s
kubectx 0.9.5           - Context switcher
stern 1.33.0            - Multi-pod logs
kustomize 5.7.1         - Template-free customization
kubecolor 0.5.2         - Colorized kubectl
dive 0.13.1             - Image layer explorer
popeye 0.22.1           - Cluster sanitizer
```

### ✅ Outils Cloud & Database

```yaml
Cloud:
  - awscli2: CLI AWS
  - stripe-cli: Stripe API testing

Database:
  - redis 8.2.2: In-memory database
  - lazysql: Database TUI
```

### ✅ Outils Modernes CLI

```yaml
File_Management:
  - fd: Alternative à find
  - fzf: Fuzzy finder (Claude Dark theme)
  - bat: Cat avec coloration (Claude Dark theme)
  - eza: Ls moderne
  - ripgrep: Grep rapide
  - yazi: File manager TUI
  - tree: Directory listing

Development:
  - git, gh: Version control + GitHub CLI
  - lazygit: Git TUI
  - lazydocker: Docker TUI
  - lazysql: SQL TUI client
  - pandoc: Document converter
  - neovim: Editor secondaire (LazyVim)
  - just: Task runner
  - tokei: Code statistics
  - hyperfine: Benchmarking
  - chezmoi: Dotfiles management
  - direnv: Directory environments
  - plantuml, d2, gnuplot: Diagram tools

Productivity:
  - zoxide: Smarter cd (z command)
  - neofetch: System info
  - tmux: Terminal multiplexer (Claude Dark theme)
  - sesh: Tmux session manager

System & Network:
  - coreutils, findutils, gnused, gnugrep: GNU core tools
  - jq, yq: JSON/YAML processors
  - htop, duf, bottom: System monitoring
  - curl, wget, httpie, dogdns: Network tools

Multimedia & Music:
  - ffmpeg, imagemagick, poppler: Media processing
  - rmpc, mpc: MPD music client
```

> **Note**: `thefuck` a été retiré de nixpkgs (projet non maintenu).

---

## 🔧 Configuration Nix

### Structure Fichiers

```
~/nix-config/
├── home.nix        # Configuration Home Manager principale
├── flake.nix       # Flake configuration (optionnel)
└── flake.lock      # Lockfile des dépendances
```

### home.nix - Configuration (extrait)

> Le fichier complet est dans `nix-config/home.nix`. Voici un extrait des sections principales.

```nix
{ config, pkgs, ... }:

{
  home.stateVersion = "24.11";
  home.username = "kbrdn1";
  home.homeDirectory = "/Users/kbrdn1";
  programs.home-manager.enable = true;

  # 70+ packages organisés par catégories
  home.packages = with pkgs; [
    # Core Utilities
    coreutils findutils gnused gnugrep

    # File Management
    tree fd ripgrep bat eza fzf zoxide sesh

    # Git Tools
    git gh lazygit

    # Container & Database Tools
    lazydocker lazysql redis

    # JSON/YAML Tools
    jq yq-go

    # System Tools
    neofetch tmux htop

    # Kubernetes Tools (11)
    kubectl kubernetes-helm minikube argocd k9s
    kubectx stern kustomize kubecolor dive popeye

    # Development Tools
    just tokei hyperfine duf bottom pandoc
    plantuml d2 gnuplot

    # Programming Languages & Runtimes
    nodejs_24 bun deno pnpm go rustc cargo
    rust-analyzer clippy rustfmt
    python313
    (php84.withExtensions ({ all, ... }: with all; [ pcov redis ]))
    symfony-cli

    # Editors
    neovim chezmoi

    # Multimedia & Music
    ffmpeg imagemagick poppler rmpc mpc

    # Network Tools
    curl wget httpie dogdns

    # Cloud Tools
    awscli2 stripe-cli

    # Fonts
    nerd-fonts.hack nerd-fonts.symbols-only
  ];

  # Programs with dedicated configuration
  programs.zsh = { ... };       # Zsh + Oh-My-Zsh + plugins + aliases
  programs.git = { ... };       # Git config (GPG signing, LFS)
  programs.fzf = { ... };       # FZF with Zsh integration
  programs.zoxide = { ... };    # Zoxide (z command)
  programs.bat = { ... };       # Bat with Claude Dark theme
  programs.direnv = { ... };    # Direnv with nix-direnv
  programs.tmux = { ... };      # Tmux with Claude Dark theme, sesh, tmux.nvim
  programs.kitty = { ... };     # Kitty terminal with Claude Dark theme

  # Services
  services.mpd = { ... };      # Music Player Daemon
}
```

---

## 🚀 Commandes Essentielles

### Gestion Quotidienne

```bash
# Recharger la configuration Nix
reload-nix

# Éditer la configuration
edit-nix

# Vérifier les packages installés
nix profile list

# Lister les générations (historique)
home-manager generations

# Rollback à génération précédente
home-manager generations | head -2 | tail -1 | awk '{print $NF}' | sh
```

### Ajout de Packages

1. **Rechercher un package**:
```bash
nix search nixpkgs <package-name>
```

2. **Ajouter à home.nix**:
```nix
home.packages = with pkgs; [
  # ... existing packages
  nouveau-package
];
```

3. **Appliquer les changements**:
```bash
reload-nix
```

### Gestion des Versions

Contrairement à ASDF, Nix gère les versions via le canal nixpkgs :

```bash
# Mettre à jour nixpkgs (toutes les versions)
nix-channel --update

# Recharger avec nouvelles versions
reload-nix

# Pour une version spécifique (exemple)
# Modifier home.nix:
python312  # Au lieu de python313
```

---

## 🔄 Workflow de Migration

### Étape 1 : Installation Nix

```bash
# Installer Nix (multi-user daemon)
sh <(curl -L https://nixos.org/nix/install) --daemon

# Vérifier l'installation
nix --version
```

### Étape 2 : Cloner nix-config

```bash
# Depuis le repo dotfiles (déjà inclus)
# Ou depuis un repo séparé :
git clone https://github.com/kbrdn1/nix-config.git ~/nix-config
```

### Étape 3 : Installer Home Manager

```bash
# Installation et application de la config
nix run home-manager/release-24.11 -- switch --flake ~/nix-config

# Vérifier les packages
which python3  # Devrait pointer vers /nix/store/...
python3 --version  # 3.13.8
```

### Étape 4 : Désinstaller ASDF

```bash
# Lister les packages ASDF
asdf plugin list

# Désinstaller ASDF de Homebrew
brew uninstall asdf

# Vérifier l'espace libéré
du -sh ~/.asdf  # ~2 GB
rm -rf ~/.asdf
```

### Étape 5 : Nettoyer Homebrew

Voir [MIGRATION_HOMEBREW.md](./MIGRATION_HOMEBREW.md) pour la liste complète.

```bash
# Désinstaller doublons CLI (maintenant dans Nix)
brew uninstall fd fzf bat ripgrep eza git gh
brew uninstall lazygit lazydocker redis
brew uninstall python node

# Garder uniquement GUI apps et outils système
brew list  # Vérifier ce qui reste
```

### Étape 6 : Mise à Jour .zshrc

Voir modifications dans `dot_zshrc` :
- ✅ Chargement Nix daemon
- ✅ Alias Nix (`reload-nix`, `edit-nix`)
- ❌ Suppression exports ASDF
- ❌ Suppression PATH ASDF shims

---

## 📚 Concepts Clés Nix

### Home Manager

Gestionnaire d'environnement utilisateur pour Nix :
- Configuration déclarative dans `home.nix`
- Gère les packages, dotfiles, et configurations
- Système de générations (rollback facile)
- Isolation par utilisateur

### Générations

Chaque `reload-nix` crée une nouvelle génération :
```bash
# Lister les générations
home-manager generations

# Rollback
home-manager generations | head -2 | tail -1 | awk '{print $NF}' | sh
```

### Nix Store

Tous les packages dans `/nix/store/` :
- Isolation complète
- Partage intelligent (déduplication)
- Immuabilité (pas de modification après install)
- Garbage collection automatique

### Reproductibilité

Configuration déclarative = même résultat sur toutes les machines :
```bash
# Sur Machine A
cat ~/nix-config/home.nix > config.nix

# Sur Machine B
cp config.nix ~/nix-config/home.nix
reload-nix
# → Environnement identique à Machine A
```

---

## ⚠️ Points d'Attention

### Cohabitation Homebrew/Nix

**Ce qui reste dans Homebrew** :
```yaml
GUI_Applications:
  - Arc, Raycast, Zed, Ghostty
  - Slack, Discord, Obsidian
  - Docker, Postman, Figma

System_Tools:
  - sketchybar, borders
  - blueutil, gd, bison
  - Aerospace (window manager)

Homebrew_Exclusives:
  - lazykube (pas dans nixpkgs)
  - dashlane-cli (pas dans nixpkgs)
  - composer (PHP, pas optimal dans Nix)
```

**Ce qui est dans Nix** :
- TOUS les CLI tools
- TOUS les langages de programmation
- TOUS les outils K8s
- TOUS les outils de développement

### Gestion des Versions PHP Extensions

Extensions PHP via Nix :
```nix
(php84.withExtensions ({ all, ... }: with all; [
  pcov    # Code coverage
  redis   # Redis client
]))
```

Vérifier les extensions :
```bash
php -m | grep -i "pcov\|redis"
```

### Path Priority

Ordre de résolution dans le PATH :
```bash
1. /nix/store/...  (Nix, priorité maximale)
2. /opt/homebrew/bin  (Homebrew)
3. /usr/local/bin
4. /usr/bin  (macOS système)
```

Vérifier quel binaire est utilisé :
```bash
which python3  # /nix/store/.../bin/python3
which composer # /opt/homebrew/bin/composer
```

---

## 🎓 Ressources

### Documentation Officielle

- **Nix Manual** : https://nixos.org/manual/nix/stable/
- **Home Manager Manual** : https://nix-community.github.io/home-manager/
- **Nixpkgs Manual** : https://nixos.org/manual/nixpkgs/stable/
- **NixOS Search** : https://search.nixos.org/packages

### Communauté

- **NixOS Discourse** : https://discourse.nixos.org/
- **NixOS Reddit** : https://reddit.com/r/NixOS
- **Nix Discord** : https://discord.gg/RbvHtGa

### Outils Utiles

- **nix-tree** : Explorer les dépendances
- **nix-diff** : Comparer générations
- **nixfmt** : Formatter le code Nix

---

## 📊 Statistiques Migration

### Packages

```yaml
Avant:
  ASDF: 9 langages
  Homebrew: 250 packages (mix CLI + GUI)
  Total: 259 packages

Après:
  Nix: 62 packages (CLI + langages)
  Homebrew: 199 packages (GUI + système)
  Total: 261 packages (+2 packages, mais mieux organisés)
```

### Espace Disque

```yaml
Libérations:
  ASDF: 2.0 GB
  Doublons Homebrew: 2.2 GB
  Total libéré: 4.2 GB

Nix Store:
  Taille: ~3.5 GB (62 packages + dépendances)
  Gain net: ~700 MB
```

### Temps de Rebuild

```yaml
reload-nix (Home Manager):
  Première fois: ~2-3 minutes
  Mise à jour: ~30-60 secondes
  Changement mineur: ~10-20 secondes

ASDF (ancien):
  asdf install nodejs: ~5-10 minutes
  asdf install python: ~5-8 minutes
```

---

## ✅ Checklist Migration

### Pré-Migration
- [x] Sauvegarder configuration ASDF (.tool-versions)
- [x] Lister tous les packages ASDF installés
- [x] Identifier doublons Homebrew/ASDF
- [x] Créer branche Git pour migration

### Installation Nix
- [x] Installer Nix daemon
- [x] Installer Home Manager
- [x] Créer ~/nix-config/home.nix
- [x] Tester configuration minimale

### Migration Packages
- [x] Migrer tous les langages ASDF → Nix
- [x] Ajouter stack Kubernetes (11 outils)
- [x] Ajouter outils Cloud (AWS, Stripe)
- [x] Ajouter outils Database (Redis, Lazysql)
- [x] Configurer PHP avec extensions

### Nettoyage
- [x] Désinstaller ASDF
- [x] Supprimer ~/.asdf
- [x] Désinstaller doublons Homebrew (51 packages)
- [x] Nettoyer références ASDF dans .zshrc

### Configuration Shell
- [x] Ajouter chargement Nix daemon dans .zshrc
- [x] Ajouter alias Nix (reload-nix, edit-nix)
- [x] Supprimer exports ASDF
- [x] Tester tous les outils

### Documentation
- [x] Créer MIGRATION_NIX.md (ce document)
- [x] Créer MIGRATION_HOMEBREW.md
- [x] Mettre à jour README.md
- [x] Documenter workflows Nix

### Validation
- [x] Tester tous les langages (python, node, php, go, rust, bun, deno)
- [x] Tester stack Kubernetes (kubectl, helm, k9s, etc.)
- [x] Tester outils CLI (fd, fzf, bat, ripgrep, etc.)
- [x] Vérifier PATH priorities
- [x] Tester reload-nix

---

## 🎉 Conclusion

La migration ASDF → Nix est un succès complet :

**Gains** :
- ✅ Configuration déclarative et reproductible
- ✅ Rollback instantané via générations
- ✅ 4.2 GB d'espace disque libéré
- ✅ Toutes les versions à jour
- ✅ Stack complète K8s, Cloud, Database
- ✅ 0 doublons entre Homebrew et Nix
- ✅ Meilleure séparation CLI (Nix) / GUI (Homebrew)

**Qualité** :
- 📚 Documentation exhaustive (comme docs Obsidian)
- 🔧 Configuration propre et maintenable
- 🚀 Workflow optimisé pour développement quotidien
- 🎯 Reproductibilité garantie sur toute machine

**Prochaines étapes** :
1. Utiliser quotidiennement le workflow Nix
2. Documenter découvertes et optimisations
3. Partager retour d'expérience avec communauté
4. Explorer Nix Flakes pour configuration avancée

---

**Dernière mise à jour** : Février 2026
**Version Home Manager** : 24.11
**Packages Nix** : 70+
**Statut** : Production-Ready
