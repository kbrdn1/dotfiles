# Migration Yabai → AeroSpace + Karabiner

## 📅 Timeline

- **Date**: Août-Septembre 2025
- **Statut**: ✅ Migration complète et fonctionnelle
- **Ancien**: Yabai + skhd
- **Nouveau**: AeroSpace + Karabiner + skhd

---

## 🎯 Motivations

### Problèmes avec Yabai
1. **Conflits macOS**: Alt+Tab capturé par le système
2. **SIP Required**: Nécessite désactivation System Integrity Protection
3. **Stabilité**: Crashes occasionnels
4. **Permissions**: Complexité des permissions d'accessibilité

### Avantages AeroSpace
1. **Pas de SIP**: Fonctionne avec SIP activé
2. **Stable**: Window manager pur, moins de bugs
3. **Architecture propre**: Séparation window manager / raccourcis
4. **Karabiner Integration**: Gestion intelligente des raccourcis

---

## 🏗 Architecture Finale

```
┌─────────────────────────────────────────────────────────┐
│                    AEROSPACE                             │
│  • Window Manager pur (pas de raccourcis)               │
│  • 10 workspaces statiques                              │
│  • Gère uniquement le layout des fenêtres              │
│  • Config: ~/.config/aerospace/aerospace.toml           │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                      SKHD                                │
│  • TOUS les raccourcis window manager                   │
│  • Alt DROITE uniquement (ralt)                         │
│  • Envoie commandes à AeroSpace                         │
│  • Config: ~/.config/skhd/skhdrc                        │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   KARABINER                              │
│  • Désactive Alt droite dans les IDEs                   │
│  • Préserve raccourcis IDE (Alt+J/K, Alt+Tab, etc.)    │
│  • Laisse passer Alt droite hors IDEs                   │
│  • Config: ~/.config/karabiner/karabiner.json           │
└─────────────────────────────────────────────────────────┘
```

---

## ⌨️ Raccourcis Clavier

### Navigation (Alt Droite)
| Raccourci | Action | Commentaire |
|-----------|--------|-------------|
| `⌥→ + 1-0` | Workspace 1-10 | 10 workspaces au lieu de 5 |
| `⌥→ + H/J/K/L` | Focus directionnel | Style vim |
| `⌥→ + Tab` | Workspace précédent | Comme Alt+Tab |

### Manipulation Fenêtres (Alt Droite)
| Raccourci | Action | Commentaire |
|-----------|--------|-------------|
| `⌥→ + F` | Toggle fullscreen | |
| `⌥→ + Space` | Toggle floating/tiling | |
| `⌥→ + ⇧ + H/J/K/L` | Déplacer fenêtre | |
| `⌥→ + ⇧ + 1-0` | Déplacer vers workspace | |

### IDEs (Alt Gauche ou Droite - Karabiner désactive)
| Raccourci | Action | Commentaire |
|-----------|--------|-------------|
| `⌥ + Tab` | Switch dans IDE | Fonctionne normalement |
| `⌥ + J/K` | Navigation IDE | Fonctionne normalement |
| `⌥ + 1-9` | Fonctions IDE | Fonctionne normalement |

---

## 📁 Organisation Workspaces

| # | Fonction | Applications Typiques |
|---|----------|----------------------|
| **1** | 💻 Développement | VS Code, Zed, Xcode |
| **2** | 🖥 Terminal | Terminal, iTerm2, Ghostty |
| **3** | 🌐 Web | Chrome, Safari, Firefox |
| **4** | 📧 Communication | Mail, Messages |
| **5** | 🤝 Réunions | Zoom, Teams, Slack |
| **6** | 🎨 Design | Figma, Sketch, Photoshop |
| **7** | 📄 Documents | Office, PDF, Notes |
| **8** | 🔧 Utilitaires | Monitoring, outils système |
| **9** | 🎵 Média | Spotify, VLC, Music |
| **10** | 🎮 Gaming | Steam, jeux |

---

## 🛠 Installation

### 1. Installer AeroSpace
```bash
brew install --cask aerospace
```

### 2. Installer Karabiner-Elements
```bash
brew install --cask karabiner-elements
```

### 3. Configuration (via chezmoi)
```bash
# Appliquer les configs depuis dotfiles
chezmoi apply

# OU manuellement
cp ~/.local/share/chezmoi/dot_config/aerospace/* ~/.config/aerospace/
cp ~/.local/share/chezmoi/dot_config/karabiner/* ~/.config/karabiner/
```

### 4. Permissions
1. **Système > Confidentialité > Accessibilité**
2. Ajouter:
   - AeroSpace
   - skhd
   - Karabiner-Elements

### 5. Démarrage
```bash
# AeroSpace démarre automatiquement (configured in aerospace.toml)
# skhd via Homebrew services
brew services start skhd

# Karabiner via application
open -a "Karabiner-Elements"
```

---

## 🧪 Tests

### Vérifier AeroSpace
```bash
aerospace list-workspaces
aerospace list-windows
```

### Vérifier skhd
```bash
~/.config/aerospace/diagnostic-skhd.sh
```

### Vérifier Karabiner
```bash
~/.config/karabiner/test-config.sh
```

---

## 📊 Comparaison

| Aspect | Yabai | AeroSpace |
|--------|-------|-----------|
| **SIP** | ❌ Requiert désactivation | ✅ Fonctionne avec SIP |
| **Stabilité** | ⚠️ Crashes occasionnels | ✅ Très stable |
| **Workspaces** | 5 dynamiques | 10 statiques |
| **Raccourcis** | Intégrés | Séparés (skhd) |
| **Conflits macOS** | ⚠️ Alt+Tab problématique | ✅ Karabiner gère |
| **IDE Support** | ❌ Conflits raccourcis | ✅ Exclusion intelligente |
| **Documentation** | Moyenne | ✅ 1762 lignes! |
| **Intégration Sketchybar** | ✅ Bonne | ✅ Excellente |

---

## 📚 Documentation

- **AeroSpace**: `~/.config/aerospace/README.md` (281 lignes)
- **Architecture**: `~/.config/aerospace/ARCHITECTURE.md` (237 lignes)
- **Shortcuts**: `~/.config/aerospace/SHORTCUTS.md` (128 lignes)
- **Karabiner**: `~/.config/karabiner/README.md` (205 lignes)
- **Sketchybar Integration**: `~/.config/sketchybar/AEROSPACE_INTEGRATION.md`

---

## ⚙️ Fichiers Modifiés

### Ajoutés
```
~/.config/aerospace/         # Nouveau window manager
~/.config/karabiner/         # Nouveau keyboard remapping
```

### Modifiés
```
~/.config/skhd/skhdrc        # Raccourcis Alt droite uniquement
~/.config/sketchybar/        # Intégration AeroSpace
```

### Conservés (backup)
```
~/.config/yabai/yabairc      # Ancien config (17 lignes)
```

---

## 🎓 Scripts Utilitaires

### AeroSpace Manager
```bash
~/.config/aerospace/aerospace-manager.sh
```
Fonctionnalités:
- Validation configuration
- Sauvegarde/restauration
- Diagnostic
- Test Sketchybar

### Diagnostic skhd
```bash
~/.config/aerospace/diagnostic-skhd.sh
```

### Test Karabiner
```bash
~/.config/karabiner/test-config.sh
```

---

## ✅ État Actuel

- **✅** AeroSpace installé et configuré
- **✅** Karabiner configuré avec exclusion IDE
- **✅** skhd avec raccourcis Alt droite
- **✅** Sketchybar intégré
- **✅** Documentation complète
- **✅** Scripts utilitaires fonctionnels
- **⏳** Synchronisation dotfiles GitHub (en cours)

---

## 🔮 Améliorations Futures

- [ ] Profils de configuration par activité
- [ ] Scripts d'automatisation workspace
- [ ] Thèmes gaps personnalisables
- [ ] Intégration Alfred/Raycast
- [ ] Workspaces dynamiques conditionnels

---

**Date de migration**: Août-Septembre 2025  
**Statut**: Production  
**Stabilité**: Excellente ✅
