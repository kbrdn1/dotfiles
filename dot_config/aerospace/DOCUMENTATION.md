# 🚀 AeroSpace Configuration Documentation

Une configuration complète et optimisée pour AeroSpace, le gestionnaire de fenêtres en mosaïque pour macOS.

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Installation et Configuration](#installation-et-configuration)
- [Raccourcis Clavier](#raccourcis-clavier)
- [Organisation des Workspaces](#organisation-des-workspaces)
- [Règles d'Applications](#règles-dapplications)
- [Modes Spéciaux](#modes-spéciaux)
- [Intégration Sketchybar](#intégration-sketchybar)
- [Conseils et Astuces](#conseils-et-astuces)
- [Dépannage](#dépannage)

## 🎯 Vue d'ensemble

Cette configuration AeroSpace offre :
- **Navigation intuitive** avec des raccourcis vim-style
- **10 workspaces** organisés par fonction
- **Règles automatiques** pour les applications
- **Modes spécialisés** pour le redimensionnement et la maintenance
- **Intégration complète** avec Sketchybar
- **Animations fluides** et transitions améliorées

### Caractéristiques Principales

- ✅ **Démarrage automatique** au login
- ✅ **Gestion multi-moniteurs** avancée
- ✅ **Layouts adaptatifs** (tiles, floating, accordion)
- ✅ **Callbacks événementiels** pour Sketchybar
- ✅ **Gaps configurables** pour une esthétique soignée

## 🛠 Installation et Configuration

### Prérequis

```bash
# Installer AeroSpace via Homebrew
brew install --cask aerospace

# Donner les permissions d'accessibilité
# Aller dans : Préférences Système > Sécurité > Accessibilité
# Ajouter AeroSpace à la liste des applications autorisées
```

### Activation

```bash
# Recharger la configuration
aerospace reload-config

# Vérifier le statut
aerospace list-workspaces
```

## ⌨️ Raccourcis Clavier

### 🧭 Navigation dans les Workspaces

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + 1-0` | Aller au workspace 1-10 | Navigation directe |
| `⌥ + Tab` | Workspace précédent | Bascule rapide |
| `⌥ + [` | Workspace précédent | Navigation séquentielle |
| `⌥ + ]` | Workspace suivant | Navigation séquentielle |

### 🎯 Navigation des Fenêtres

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + H` | Focus à gauche | Style vim |
| `⌥ + J` | Focus en bas | Style vim |
| `⌥ + K` | Focus en haut | Style vim |
| `⌥ + L` | Focus à droite | Style vim |
| `⌥ + N` | Fenêtre suivante | Ordre de création |
| `⌥ + P` | Fenêtre précédente | Ordre de création |

### 🔄 Manipulation des Fenêtres

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + F` | Plein écran AeroSpace | Plein écran tiling |
| `⌥ + ⇧ + F` | Plein écran natif macOS | Plein écran système |
| `⌥ + Space` | Basculer floating/tiling | Change le mode |
| `⌥ + ⇧ + Space` | Changer layout tiles | H_tiles ↔ V_tiles |
| `⌥ + ⇧ + X` | Fermer fenêtre | Équivalent ⌘+Q |
| `⌥ + M` | Minimiser | Dans le Dock |

### 📦 Déplacement des Fenêtres

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + ⇧ + H` | Déplacer à gauche | Dans l'espace actuel |
| `⌥ + ⇧ + J` | Déplacer en bas | Dans l'espace actuel |
| `⌥ + ⇧ + K` | Déplacer en haut | Dans l'espace actuel |
| `⌥ + ⇧ + L` | Déplacer à droite | Dans l'espace actuel |

### 🚀 Déplacement vers Workspaces

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + ⇧ + 1-0` | Déplacer vers workspace 1-10 | Fenêtre reste active |
| `⌥ + ⌃ + ⇧ + 1-5` | Déplacer et suivre | Déplace + va au workspace |

### 🔧 Organisation des Fenêtres

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + ⇧ + S` | Joindre en bas | Grouper verticalement |
| `⌥ + ⌃ + S` | Joindre à droite | Grouper horizontalement |
| `⌥ + ⇧ + V` | Joindre en bas | Alternative vim-style |
| `⌥ + ⇧ + B` | Joindre à droite | Alternative vim-style |
| `⌥ + ⌃ + E` | Équilibrer | Tailles égales |
| `⌥ + =` | Équilibrer | Raccourci alternatif |

### 📺 Gestion Multi-Moniteurs

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + ←` | Focus moniteur gauche | Navigation moniteurs |
| `⌥ + →` | Focus moniteur droit | Navigation moniteurs |
| `⌥ + ↑` | Focus moniteur haut | Navigation moniteurs |
| `⌥ + ↓` | Focus moniteur bas | Navigation moniteurs |
| `⌥ + ⇧ + ←` | Déplacer vers moniteur gauche | Déplace fenêtre |
| `⌥ + ⇧ + →` | Déplacer vers moniteur droit | Déplace fenêtre |
| `⌥ + ⌃ + ←` | Workspace vers moniteur gauche | Déplace workspace |
| `⌥ + ⌃ + →` | Workspace vers moniteur droit | Déplace workspace |

### 🎛 Modes Spéciaux

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `⌥ + ⌃ + R` | Mode Resize | Redimensionnement |
| `⌥ + ⌃ + ;` | Mode Service | Opérations avancées |

## 🏠 Organisation des Workspaces

Cette configuration organise automatiquement vos applications sur 10 workspaces thématiques :

### 📊 Répartition des Workspaces

| Workspace | 🎯 Fonction | 📱 Applications | 🎨 Layout |
|-----------|-------------|-----------------|-----------|
| **1** | 💻 **Développement** | VS Code, Zed, Xcode | Tiles |
| **2** | 🖥 **Terminal** | Terminal, iTerm2, Ghostty | Tiles |
| **3** | 🌐 **Web** | Chrome, Safari, Firefox | Tiles |
| **4** | 📧 **Communication** | Mail, Messages | Tiles |
| **5** | 🤝 **Réunions** | Zoom, Teams, Slack | Mixed |
| **6** | 🎨 **Design** | Figma, Sketch, Photoshop | Tiles |
| **7** | 📄 **Documents** | Office, PDF, Notes | Tiles |
| **8** | 🔧 **Utilitaires** | Outils système, monitoring | Mixed |
| **9** | 🎵 **Média** | Spotify, VLC, Music | Floating |
| **10** | 🎮 **Gaming** | Steam, jeux | Mixed |

### 🚀 Navigation Rapide par Workspace

```
⌥ + 1  →  💻 Code         ⌥ + 6  →  🎨 Design
⌥ + 2  →  🖥 Terminal     ⌥ + 7  →  📄 Docs  
⌥ + 3  →  🌐 Web          ⌥ + 8  →  🔧 Utils
⌥ + 4  →  📧 Mail         ⌥ + 9  →  🎵 Media
⌥ + 5  →  🤝 Meet         ⌥ + 0  →  🎮 Games
```

## 📱 Règles d'Applications

### 🎯 Applications en Mode Floating

Ces applications s'ouvrent automatiquement en mode flottant :

#### 🏢 **Système macOS**
- 🧮 Calculatrice
- ⚙️ Préférences Système
- 📊 Moniteur d'activité
- 🎨 ColorSync Utility
- 🔍 Loupe numérique

#### 🛠 **Utilitaires**
- 🔍 Alfred / Raycast
- 🔐 1Password
- 🧹 CleanMyMac
- ✂️ PopClip
- 🛒 App Store

#### 🎥 **Média**
- 🎬 VLC Media Player
- 📺 Picture in Picture
- 🎵 Spotify (workspace 9)
- 🎶 Apple Music (workspace 9)

#### 💬 **Communication**
- 📹 Zoom
- 👥 Microsoft Teams (workspace 5)

### 🏠 Assignation Automatique de Workspaces

#### 💻 **Workspace 1 - Développement**
```toml
VS Code → Workspace 1
Zed → Workspace 1  
Xcode → Workspace 1
```

#### 🖥 **Workspace 2 - Terminal**
```toml
Terminal.app → Workspace 2
iTerm2 → Workspace 2
Ghostty → Workspace 2
```

#### 🌐 **Workspace 3 - Navigateurs**
```toml
Google Chrome → Workspace 3
Safari → Workspace 3
Firefox → Workspace 3
```

#### 📧 **Workspace 4 - Communication**
```toml
Apple Mail → Workspace 4
```

#### 🤝 **Workspace 5 - Réunions**
```toml
Slack → Workspace 5
Microsoft Teams → Workspace 5 (floating)
```

## 🎛 Modes Spéciaux

### 📏 Mode Resize (`⌥ + ⌃ + R`)

Une fois en mode resize, utilisez :

| Raccourci | Action | Ajustement |
|-----------|--------|------------|
| `H` | Réduire largeur | -50px |
| `J` | Augmenter hauteur | +50px |
| `K` | Réduire hauteur | -50px |
| `L` | Augmenter largeur | +50px |
| `⇧ + H` | Réduire largeur (gros) | -100px |
| `⇧ + J` | Augmenter hauteur (gros) | +100px |
| `⇧ + K` | Réduire hauteur (gros) | -100px |
| `⇧ + L` | Augmenter largeur (gros) | +100px |

**Sortie du mode :** `Entrée`, `Échap`, `Q`, ou `⌥ + ⌃ + R`

### 🔧 Mode Service (`⌥ + ⌃ + ;`)

Mode avancé pour la maintenance et le debugging :

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `R` | Recharger config | Applique les changements |
| `H` | Layout horizontal | Force H_tiles |
| `V` | Layout vertical | Force V_tiles |
| `S` | Layout stack | V_accordion |
| `W` | Layout wide | H_accordion |
| `F` | Layout floating | Mode flottant |
| `D` | Debug windows | Liste les fenêtres |
| `M` | Debug monitors | Liste les moniteurs |
| `W` | Debug workspaces | Liste les workspaces |

**Sortie du mode :** `Échap` ou `Q`

## 📊 Intégration Sketchybar

### 🔄 Callbacks Automatiques

La configuration déclenche automatiquement des mises à jour Sketchybar :

```toml
# Changement de workspace
on-workspace-changed = [
    "sketchybar --trigger aerospace_workspace_change"
]

# Changement de focus
on-focus-changed = [
    "sketchybar --trigger window_focus",
    "~/.config/sketchybar/plugins/window_title.sh"
]

# Changement de moniteur
on-focused-monitor-changed = [
    "sketchybar --trigger aerospace_workspace_change",
    "~/.config/sketchybar/plugins/aerospace.sh"
]
```

### 📡 Triggers Disponibles

- `aerospace_workspace_change` : Changement de workspace
- `window_focus` : Changement de fenêtre active
- Scripts personnalisés dans `~/.config/sketchybar/plugins/`

## 💡 Conseils et Astuces

### 🚀 Workflow Recommandé

1. **Démarrage de journée :**
   ```
   ⌥ + 1  →  Ouvrir code
   ⌥ + 2  →  Ouvrir terminal  
   ⌥ + 3  →  Ouvrir navigateur
   ```

2. **Organisation projet :**
   - Workspace 1 : Éditeur principal
   - Workspace 2 : Terminaux et outils CLI
   - Workspace 3 : Documentation/tests web

3. **Gestion des réunions :**
   - Workspace 5 : Dédié aux calls
   - Applications en floating pour plus de flexibilité

### ⚡️ Raccourcis Power User

```bash
# Rechargement rapide de la config
⌥ + ⌃ + ; → R

# Navigation ultra-rapide
⌥ + Tab  # Dernier workspace utilisé

# Déplacement et suivi
⌥ + ⌃ + ⇧ + [1-5]  # Déplace et suit la fenêtre

# Équilibrage rapide  
⌥ + =  # Balance toutes les fenêtres
```

### 🎯 Optimisations Performances

- **Gaps réduits** (12px) pour plus d'espace écran
- **Unhide automatique** des apps masquées
- **Callbacks optimisés** pour Sketchybar
- **Règles spécifiques** par type d'application

## 🔧 Dépannage

### ❌ Problèmes Courants

#### **AeroSpace ne démarre pas**
```bash
# Vérifier les permissions
ls -la /Applications/AeroSpace.app

# Relancer manuellement
/Applications/AeroSpace.app/Contents/MacOS/AeroSpace
```

#### **Raccourcis ne fonctionnent pas**
```bash
# Vérifier les permissions d'accessibilité
# Système > Confidentialité > Accessibilité
# Ajouter AeroSpace

# Recharger la configuration  
aerospace reload-config
```

#### **Applications ne suivent pas les règles**
```bash
# Identifier l'app-id correct
aerospace list-windows

# Vérifier la syntaxe dans aerospace.toml
aerospace reload-config
```

### 🔍 Debug et Monitoring

```bash
# Lister toutes les fenêtres
aerospace list-windows

# Lister les workspaces
aerospace list-workspaces  

# Lister les moniteurs
aerospace list-monitors

# Vérifier la configuration
aerospace list-apps
```

### 📝 Logs et Diagnostics

```bash
# Logs AeroSpace
tail -f ~/.local/share/aerospace/aerospace.log

# Test de configuration
aerospace reload-config --dry-run
```

## 🚀 Commandes Utiles

### 📋 Gestion Configuration

```bash
# Recharger la configuration
aerospace reload-config

# Valider la configuration  
aerospace validate-config

# Afficher la configuration active
aerospace list-config
```

### 🔍 Inspection Système

```bash
# État des workspaces
aerospace list-workspaces

# Fenêtres par workspace
aerospace list-windows --workspace 1

# Applications détectées
aerospace list-apps
```

### 🎯 Actions Rapides

```bash
# Basculer en mode floating
aerospace layout floating

# Équilibrer toutes les fenêtres
aerospace balance-sizes

# Fermer workspace vide
aerospace close-all-windows-but-current
```

---

## 📚 Ressources

- **Documentation officielle :** [AeroSpace Docs](https://github.com/nikitabobko/AeroSpace)
- **Configuration Sketchybar :** `~/.config/sketchybar/`
- **Scripts personnalisés :** `~/.config/aerospace/scripts/`

---

*Configuration créée et optimisée pour un workflow de développement efficace sur macOS* 🚀