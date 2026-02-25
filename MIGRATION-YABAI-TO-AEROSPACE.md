# Migration Yabai → AeroSpace + Karabiner

## Timeline

- **Date**: Aout-Septembre 2025
- **Statut**: Production
- **Ancien**: Yabai + skhd
- **Nouveau**: AeroSpace + Karabiner-Elements

---

## Motivations

### Problemes avec Yabai
1. **Conflits macOS**: Alt+Tab capture par le systeme
2. **SIP Required**: Necessite desactivation System Integrity Protection
3. **Stabilite**: Crashes occasionnels
4. **Permissions**: Complexite des permissions d'accessibilite

### Avantages AeroSpace
1. **Pas de SIP**: Fonctionne avec SIP active
2. **Stable**: Window manager pur, moins de bugs
3. **Raccourcis natifs**: Keybindings directement dans `aerospace.toml` (plus besoin de skhd)
4. **Karabiner Integration**: Remapping intelligent de la touche Option droite

---

## Architecture Finale

```
+-------------------------------------------------------------+
|                    KARABINER-ELEMENTS                        |
|  - Mappe Option DROITE -> Ctrl+Alt                          |
|  - Preserve Option GAUCHE pour caracteres AZERTY            |
|  - Config: ~/.config/karabiner/karabiner.json               |
+-------------------------------------------------------------+
                         |
+-------------------------------------------------------------+
|                      AEROSPACE                               |
|  - Window Manager avec raccourcis natifs (ctrl-alt-*)       |
|  - 8 workspaces specialises                                 |
|  - Integration Sketchybar                                   |
|  - Config: ~/.config/aerospace/aerospace.toml               |
+-------------------------------------------------------------+
                         |
+-------------------------------------------------------------+
|                     SKETCHYBAR                               |
|  - Notification changements workspace                       |
|  - Affichage workspace actif dans la barre                  |
|  - Trigger: aerospace_workspace_change                      |
+-------------------------------------------------------------+
```

> **Note**: skhd n'est plus necessaire. AeroSpace gere directement tous les raccourcis dans `aerospace.toml` avec le modificateur `ctrl-alt` (envoye par Karabiner depuis la touche Option droite).

---

## Configuration Clavier (AZERTY)

### Probleme AZERTY
AeroSpace ne supporte que `qwerty`/`dvorak`/`colemak` (pas azerty natif).
Sur AZERTY, **Alt gauche** (AltGr) est essentiel pour : `{ } [ ] @ # | \` etc.

### Solution Karabiner-Elements
1. La touche **Option droite** est remappee vers `Ctrl+Alt` par Karabiner
2. La touche **Option gauche** reste intacte pour les caracteres speciaux AZERTY
3. AeroSpace utilise `ctrl-alt-*` comme modificateur pour tous ses raccourcis

**Resultat** : `Option DROITE` = AeroSpace, `Option GAUCHE` = caracteres speciaux

---

## Raccourcis Clavier

> Tous les raccourcis utilisent `ctrl-alt` comme modificateur, envoye par Karabiner quand on appuie sur la touche **Option droite**.

### Navigation Workspaces

| Raccourci (physique) | Binding AeroSpace | Workspace | Applications |
|---------------------|-------------------|-----------|-------------|
| `Option droite + 1` | `ctrl-alt-1` | 1 - Home | Mail, Calendar, Canary Mail |
| `Option droite + 2` | `ctrl-alt-2` | 2 - Music | Apple Music, Spotify, Tidal |
| `Option droite + 3` | `ctrl-alt-3` | 3 - Development | Zed, Ghostty, VS Code, JetBrains, Postman |
| `Option droite + Q` | `ctrl-alt-q` | 4 - Web | Helium, Dia/Arc, Chrome, Safari |
| `Option droite + W` | `ctrl-alt-w` | 5 - Communication | Slack, Discord, Messages, Teams, Zoom |
| `Option droite + E` | `ctrl-alt-e` | 6 - Server Tools | TablePlus, OrbStack, Docker |
| `Option droite + O` | `ctrl-alt-o` | 7 - Notes | Obsidian |
| `Option droite + C` | `ctrl-alt-c` | 8 - Claude AI | Claude |
| `Option droite + Tab` | `ctrl-alt-tab` | Back and forth | Workspace precedent |

### Manipulation Fenetres

| Raccourci | Binding | Action |
|-----------|---------|--------|
| `Option droite + H/J/K/L` | `ctrl-alt-h/j/k/l` | Focus directionnel (vim-style) |
| `Option droite + Fleches` | `ctrl-alt-arrows` | Focus directionnel (fleches) |
| `Option droite + Shift + H/J/K/L` | `ctrl-alt-shift-h/j/k/l` | Deplacer fenetre |
| `Option droite + Shift + Fleches` | `ctrl-alt-shift-arrows` | Deplacer fenetre (fleches) |
| `Option droite + Shift + 1/2/3` | `ctrl-alt-shift-1/2/3` | Deplacer vers workspace 1/2/3 |
| `Option droite + Shift + Q/W/E` | `ctrl-alt-shift-q/w/e` | Deplacer vers workspace 4/5/6 |
| `Option droite + Shift + O/C` | `ctrl-alt-shift-o/c` | Deplacer vers workspace 7/8 |

### Layout & Affichage

| Raccourci | Binding | Action |
|-----------|---------|--------|
| `Option droite + /` | `ctrl-alt-slash` | Toggle tiles (horizontal/vertical) |
| `Option droite + ,` | `ctrl-alt-comma` | Toggle accordion (cascade) |
| `Option droite + Shift + Space` | `ctrl-alt-shift-space` | Toggle floating/tiling |
| `Option droite + F` | `ctrl-alt-f` | Toggle fullscreen |
| `Option droite + -/=` | `ctrl-alt-minus/equal` | Resize smart (-50/+50) |
| `Option droite + R` | `ctrl-alt-r` | Mode resize |

### Utilitaires

| Raccourci | Binding | Action |
|-----------|---------|--------|
| `Option droite + Enter` | `ctrl-alt-enter` | Ouvrir Ghostty |
| `Option droite + Shift + X` | `ctrl-alt-shift-x` | Fermer fenetre |
| `Option droite + Shift + =` | `ctrl-alt-shift-equal` | Balance tailles |
| `Option droite + Shift + R` | `ctrl-alt-shift-r` | Reload config |
| `Option droite + Shift + ;` | `ctrl-alt-shift-semicolon` | Mode service |

### Mode Service (actions avancees)

| Raccourci | Action |
|-----------|--------|
| `Esc` | Quitter mode service + reload config |
| `R` | Reset layout (flatten) |
| `F` | Toggle floating/tiling |
| `H/V` | Layout horizontal/vertical |
| `S` | Stack (accordion vertical) |
| `W` | Wide tabs (accordion horizontal) |
| `T` | Tiles auto |
| `Backspace` | Fermer toutes les fenetres sauf active |
| `Ctrl+Alt+Shift + H/J/K/L` | Join containers |

### Mode Resize

| Raccourci | Action |
|-----------|--------|
| `H/J/K/L` | Resize (-/+50) |
| `Shift + H/J/K/L` | Resize fin (-/+10) |
| `-/=` | Smart resize (-/+50) |
| `Shift + -/=` | Smart resize fin (-/+10) |
| `Enter` ou `Esc` | Quitter mode resize |

---

## Installation

### 1. Installer AeroSpace
```bash
brew install --cask nikitabobko/tap/aerospace
```

### 2. Installer Karabiner-Elements
```bash
brew install --cask karabiner-elements
```

### 3. Configuration (via Chezmoi)
```bash
# Appliquer les configs depuis dotfiles
chezmoi apply

# OU manuellement
cp ~/.local/share/chezmoi/dot_config/aerospace/* ~/.config/aerospace/
cp ~/.local/share/chezmoi/dot_config/karabiner/* ~/.config/karabiner/
```

### 4. Permissions
1. **Systeme > Confidentialite > Accessibilite**
2. Ajouter:
   - AeroSpace
   - Karabiner-Elements

### 5. Demarrage
```bash
# AeroSpace demarre automatiquement (start-at-login = true dans aerospace.toml)
# Karabiner via application
open -a "Karabiner-Elements"
```

---

## Comparaison

| Aspect | Yabai + skhd | AeroSpace + Karabiner |
|--------|-------------|----------------------|
| **SIP** | Requiert desactivation | Fonctionne avec SIP |
| **Stabilite** | Crashes occasionnels | Tres stable |
| **Workspaces** | 5 dynamiques | 8 statiques specialises |
| **Raccourcis** | Separes (skhd) | Natifs dans aerospace.toml |
| **Conflits macOS** | Alt+Tab problematique | Karabiner gere (Option droite exclusif) |
| **IDE Support** | Conflits raccourcis | Pas de conflit (Option gauche libre) |
| **Integ. Sketchybar** | Bonne | Excellente (triggers natifs) |
| **Config** | 2 fichiers (yabairc + skhdrc) | 1 fichier (aerospace.toml) + Karabiner |

---

## Fichiers

### Actifs
```
~/.config/aerospace/aerospace.toml    # Window manager + raccourcis
~/.config/karabiner/karabiner.json    # Remapping Option droite -> Ctrl+Alt
```

### Supprimes
```
~/.config/yabai/yabairc               # Ancien window manager
~/.config/skhd/skhdrc                 # Ancien raccourcis (plus necessaire)
```

---

**Date de migration**: Aout-Septembre 2025
**Statut**: Production
**Stabilite**: Excellente
