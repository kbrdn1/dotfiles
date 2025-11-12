# 🚀 Configuration AeroSpace Améliorée

Une configuration complète et optimisée pour AeroSpace, le gestionnaire de fenêtres en mosaïque pour macOS.

## 📋 Vue d'ensemble

Cette configuration transforme votre expérience AeroSpace avec :

- ✨ **10 workspaces organisés** par fonction
- 🎯 **Raccourcis intuitifs** style vim
- 🔄 **Intégration Sketchybar** complète
- 📱 **Règles automatiques** pour applications
- 🎛 **Modes spécialisés** (resize, service)
- 🎨 **Gaps et animations** optimisés

## 🆕 Améliorations Principales

### 🎯 Navigation Avancée
- **Navigation vim-style** : `H/J/K/L` pour le focus
- **10 workspaces** au lieu de 5
- **Basculement rapide** avec `⌥ + Tab`
- **Multi-moniteurs** supporté

### 🔧 Gestion des Fenêtres
- **Modes de layout** : tiles, floating, accordion
- **Joindre les fenêtres** au lieu de split
- **Équilibrage automatique** des tailles
- **Redimensionnement précis** en mode resize

### 📱 Règles d'Applications Intelligentes
- **Assignation automatique** par workspace
- **Mode floating** pour utilitaires
- **Règles spécifiques** par type d'app

### 🎨 Esthétique
- **Gaps configurables** (12px inner, 10px outer)
- **Démarrage automatique** au login
- **Callbacks optimisés** pour Sketchybar

## 🏠 Organisation des Workspaces

| # | 🎯 Fonction | 📱 Applications Typiques |
|---|-------------|---------------------------|
| **1** | 📧 **Mail/Calendar** | Mail, Outlook, Calendar |
| **2** | 📮 **Postman/API** | Postman, Insomnia |
| **3** | 💻 **Code Editors** | Zed, VS Code, Terminal |
| **4** | 🌐 **Arc Browser** | Arc (navigation principale) |
| **5** | 💬 **Communication** | Slack, Discord, Messages |
| **6** | 🗄️ **Database/Docker** | TablePlus, OrbStack |
| **7** | 📝 **Obsidian** | Obsidian (notes) |

| # | 🎯 Fonction | 📱 Applications Typiques |
|---|-------------|---------------------------|
| **1** | 💻 **Développement** | VS Code, Zed, Xcode |
| **2** | 🖥 **Terminal** | Terminal, iTerm2, Ghostty |
| **3** | 🌐 **Web** | Chrome, Safari, Firefox |
```
Ctrl+Alt+1,2,3,Q,W,E,O  →  Workspaces 1-7
Ctrl+Alt+H/J/K/L    →  Focus directionnel
Ctrl+Alt+B           →  Workspace précédent (Back)
Ctrl+Alt+N           →  Workspace suivant (Next)
```

### Manipulation des Fenêtres (Alt Droite UNIQUEMENT)
```
Ctrl+Alt+F           →  Plein écran
Ctrl+Alt+Shift+Space →  Toggle floating/tiling
Ctrl+Alt+Shift+H/J/K/L  →  Déplacer fenêtre
Ctrl+Alt+Shift+1/2/3/Q/W/E/O  →  Déplacer vers workspace
```

### Organisation (Alt Droite UNIQUEMENT)
```
⌥→ + ⇧ + S       →  Joindre en bas
⌥→ + ⌃ + S       →  Joindre à droite
⌥→ + ⌃ + E       →  Équilibrer tailles
```

## 🛠 Scripts Utilitaires

### 📋 AeroSpace Manager
Script interactif pour gérer votre configuration :

```bash
# Lancer le gestionnaire
~/.config/aerospace/aerospace-manager.sh
```

**Fonctionnalités :**
- ✅ Validation de configuration
- 💾 Sauvegarde/restauration
- 📊 Informations système
- 🔧 Diagnostic et dépannage
- 📡 Test intégration Sketchybar

### 🎯 Actions Rapides
```bash
# Recharger la configuration
aerospace reload-config

# Lister les workspaces actifs
aerospace list-workspaces

# Voir les fenêtres ouvertes
aerospace list-windows
```

## 📡 Intégration Sketchybar

### Callbacks Automatiques
La configuration déclenche automatiquement :
- `aerospace_workspace_change` : Changement de workspace
- `window_focus` : Changement de fenêtre active

### Architecture de Configuration
**🚨 IMPORTANT : Configuration Alt Droite Exclusive**

- **AeroSpace** (`aerospace.toml`) : AUCUN raccourci configuré
- **skhd** (`skhdrc`) : TOUS les raccourcis avec `ralt` (Alt droite)
- **Résultat** : Seule l'Alt droite fonctionne, aucun conflit macOS

### Configuration Sketchybar
Ajoutez dans `~/.config/sketchybar/sketchybarrc` :
```bash
# Plugin AeroSpace
sketchybar --add item aerospace left \
           --set aerospace update_freq=1 \
           --set aerospace script="~/.config/sketchybar/plugins/aerospace.sh"
```

## 📦 Installation

### 1. Prérequis
```bash
# Installer AeroSpace
brew install --cask aerospace

# Installer Sketchybar (optionnel)
brew tap FelixKratz/formulae
brew install sketchybar
```

### 2. Configuration
```bash
# La configuration est déjà en place dans ~/.config/aerospace/
# Recharger AeroSpace (configuration sans raccourcis)
aerospace reload-config

# Recharger skhd (configuration avec Alt droite uniquement)
skhd --reload

# Donner les permissions d'accessibilité pour BOTH AeroSpace ET skhd
# Aller dans : Système > Confidentialité > Accessibilité
# Ajouter AeroSpace ET skhd
```

### 3. Démarrage Automatique
AeroSpace démarre automatiquement (configuré dans `aerospace.toml`)

## 🔧 Personnalisation

### Modifier les Gaps
```toml
[gaps]
inner.horizontal = 12  # Espace entre fenêtres
inner.vertical = 12
outer.left = 10        # Marge écran
outer.bottom = 10
outer.top = 10
outer.right = 10
```

### Ajouter des Règles d'Applications
```toml
[[on-window-detected]]
if.app-id = "com.example.app"
run = "move-node-to-workspace 5"
```

### Personnaliser les Raccourcis
**Éditer dans `~/.config/skhd/skhdrc` UNIQUEMENT :**
```bash
# Tous les raccourcis utilisent ralt (Alt droite)
ralt - w : aerospace workspace 5  # Exemple : aller au workspace 5

# JAMAIS dans aerospace.toml - tous les raccourcis sont désactivés
```

## 📚 Documentation

- **[DOCUMENTATION.md](./DOCUMENTATION.md)** : Guide complet
- **[SHORTCUTS.md](./SHORTCUTS.md)** : Référence des raccourcis
- **[aerospace-manager.sh](./aerospace-manager.sh)** : Script utilitaire

## 🔍 Dépannage

### Configuration ne se charge pas
```bash
# Valider la syntaxe
aerospace reload-config

# Vérifier les logs
tail -f ~/.local/share/aerospace/aerospace.log
```

### Raccourcis ne fonctionnent pas
1. Vérifier les permissions d'accessibilité
2. Système > Confidentialité > Accessibilité
3. Ajouter AeroSpace à la liste

### Applications ne suivent pas les règles
```bash
# Identifier l'app-id correct
aerospace list-windows

# Puis ajouter la règle dans aerospace.toml (règles uniquement)
# Les raccourcis restent dans skhd exclusivement
```

## 🎯 Workflows Recommandés

### Développement Web
```
Workspace 1: VS Code
Workspace 2: Terminal (serveurs, git)
Workspace 3: Navigateur (tests)
```

### Design/Creative
```
Workspace 6: Figma/Sketch
Workspace 3: Navigateur (références)
Workspace 7: Documentation
```

### Productivité
```
Workspace 4: Mail
Workspace 5: Slack/Teams
Workspace 7: Documents/Notes
```

## 📊 Statistiques Configuration

- **Raccourcis configurés** : 50+
- **Règles d'applications** : 25+
- **Workspaces** : 10
- **Modes spéciaux** : 2 (resize, service)
- **Callbacks Sketchybar** : 2

## 🚀 Futures Améliorations

- [ ] Scripts d'automatisation workspace
- [ ] Thèmes de couleurs pour gaps
- [ ] Profiles de configuration
- [ ] Intégration Alfred/Raycast
- [ ] Workspace dynamiques

## 🤝 Contributions

Cette configuration est conçue pour être facilement personnalisable. N'hésitez pas à :

1. Modifier les règles d'applications (dans `aerospace.toml`)
2. Ajuster les raccourcis selon vos préférences (dans `skhdrc` avec `ralt`)
3. Personnaliser l'organisation des workspaces
4. Améliorer l'intégration Sketchybar

**⚠️ RAPPEL : Tous les raccourcis doivent utiliser `ralt` dans skhd**

## 📞 Support

- **Documentation officielle** : [AeroSpace GitHub](https://github.com/nikitabobko/AeroSpace)
- **Configuration de base** : `~/.config/aerospace/aerospace.toml`
- **Script de gestion** : `~/.config/aerospace/aerospace-manager.sh`

---

**Version** : 1.0 Enhanced  
**Compatible** : AeroSpace v0.19.2-Beta+  
**macOS** : 13.0+ (Ventura et plus récent)  

*Configuration optimisée pour un workflow de développement efficace* 🚀