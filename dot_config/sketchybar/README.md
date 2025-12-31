# 🎨 SketchyBar Theme System v2.0

> Système de gestion de thèmes complet avec synchronisation automatique JankyBorders

## 🌟 Vue d'Ensemble

Un système de thèmes unifié qui synchronise automatiquement **SketchyBar** et **JankyBorders** avec vos 6 thèmes Zed Editor préférés.

### ✨ Fonctionnalités Principales

- 🎨 **6 thèmes complets** inspirés de vos configurations Zed
- 🔄 **Synchronisation automatique** SketchyBar + JankyBorders
- 🖱️ **Interface GUI** intégrée au menu Apple
- 📱 **Notifications macOS** natives
- 💾 **Persistance** des préférences
- 🎯 **Icône SF Symbols** (􀎔) professionnelle

## 📦 Thèmes Disponibles

| Icône | Nom | Couleur Accent | Style |
|-------|-----|----------------|-------|
| ⭐ | **Claude Dark** | Orange cuivré `#D4825D` | Chaud, élégant (défaut) |
| ☀️ | **Claude Light** | Orange saturé `#C15F3C` | Lumineux, doux |
| 🫐 | **Blueberry Dark** | Vert menthe `#27E8A7` | Frais, moderne |
| 🎨 | **Catppuccin** | Bleu `#8aadf4` | Pastel, populaire |
| 🌊 | **DuoTone Dark** | Cyan `#4fb4d7` | Profond, océanique |
| 💜 | **Periwinkle Ember** | Bleu pervenche `#9AA7FF` | Unique, lavande |

## 🚀 Utilisation Rapide

### Méthode GUI (Recommandée)
```
1. Cliquez sur  (Apple logo) en haut à gauche
2. Sélectionnez "􀎔 Change Theme"
3. Choisissez votre thème
4. SketchyBar + Borders se rechargent automatiquement ! 🎉
```

### Méthode CLI
```bash
cd ~/.config/sketchybar

# Interactive
./change_theme.sh

# Direct
./settings/theme.sh set claude-dark
./settings/theme.sh set blueberry-dark
```

## 📁 Structure des Fichiers

```
~/.config/sketchybar/
├── settings/
│   ├── theme.sh              # Gestionnaire de thèmes (6 thèmes)
│   ├── colors.sh             # Chargeur automatique
│   └── icons.sh              # Icônes (avec THEME=􀎔)
├── plugins/
│   └── apple/
│       └── item.sh           # Menu Apple avec bouton thème
├── change_theme.sh           # Interface de changement
├── preview_theme.sh          # Aperçu couleurs
├── test_all_themes.sh        # Test visuel 6 thèmes
├── test_borders_colors.sh    # Test couleurs bordures
└── docs/
    ├── THEMES.md             # Documentation complète
    ├── BORDERS_INTEGRATION.md # Guide intégration borders
    ├── THEME_INTEGRATION.md   # Guide intégration
    └── CHANGELOG_THEMES.md    # Historique v2.0

~/.config/borders/
├── bordersrc                 # Config JankyBorders
└── colors.sh                 # Couleurs synchronisées
```

## 🔧 Scripts Disponibles

| Script | Description |
|--------|-------------|
| `change_theme.sh` | Dialog macOS pour changer de thème |
| `preview_theme.sh` | Affiche toutes les couleurs du thème actif |
| `test_all_themes.sh` | Test visuel des 6 thèmes |
| `test_borders_colors.sh` | Aperçu des couleurs de bordures |
| `settings/theme.sh list` | Liste tous les thèmes disponibles |
| `settings/theme.sh current` | Affiche le thème actuel |

## 🎨 Variables de Couleurs

Chaque thème expose les variables suivantes :

### Couleurs de Base
```bash
$BLACK, $WHITE, $TRANSPARENT
```

### Couleurs d'Accent
```bash
$RED, $GREEN, $BLUE, $YELLOW
$PEACH, $ORANGE, $MAGENTA, $CYAN
```

### Couleurs UI
```bash
$GREY, $GREY_DARK, $GREY_DARKER
$BAR_COLOR, $ICON_COLOR, $LABEL_COLOR
$BACKGROUND_1, $BACKGROUND_2
$POPUP_BACKGROUND_COLOR, $POPUP_BORDER_COLOR
```

### Effets et Bordures
```bash
$SHADOW_COLOR, $ACCENT_COLOR, $HIGHLIGHT_COLOR
$BORDER_ACTIVE, $BORDER_INACTIVE
```

## 🖼️ Intégration JankyBorders

Les bordures se synchronisent **automatiquement** avec le thème :

- **Bordure Active** : Utilise la couleur accent du thème (100% opacité)
- **Bordure Inactive** : Gris du thème (46% opacité)
- **Rechargement** : Automatique via `brew services restart borders`

### Couleurs de Bordures par Thème

| Thème | Active | Inactive |
|-------|--------|----------|
| Claude Dark | `#D4825D` | `#5a4a40` (46%) |
| Claude Light | `#C15F3C` | `#8a7a70` (46%) |
| Blueberry Dark | `#27E8A7` | `#506477` (46%) |
| Catppuccin | `#8aadf4` | `#494d64` (46%) |
| DuoTone Dark | `#4fb4d7` | `#3d4759` (46%) |
| Periwinkle Ember | `#9AA7FF` | `#6a6a7a` (46%) |

## 📚 Documentation Complète

- **[THEMES.md](THEMES.md)** - Guide complet des 6 thèmes
- **[BORDERS_INTEGRATION.md](BORDERS_INTEGRATION.md)** - Intégration JankyBorders
- **[THEME_INTEGRATION.md](THEME_INTEGRATION.md)** - Guide d'intégration
- **[CHANGELOG_THEMES.md](CHANGELOG_THEMES.md)** - Historique v2.0

## 🧪 Tests et Validation

```bash
# Tester tous les thèmes
./test_all_themes.sh

# Tester les couleurs de bordures
./test_borders_colors.sh

# Prévisualiser le thème actuel
./preview_theme.sh

# Lister les thèmes
./settings/theme.sh list
```

## 🔄 Workflow Complet

```
Utilisateur clique "Change Theme"
         ↓
Dialog macOS avec 6 choix
         ↓
Sélection du thème
         ↓
theme.sh charge les couleurs
         ↓
SketchyBar se recharge
         ↓
JankyBorders redémarre
         ↓
Notification de succès
         ↓
Thème appliqué partout ! ✨
```

## 💡 Recommandations d'Utilisation

### Par Moment de la Journée
- **Matin/Jour** : Claude Light, Blueberry Dark
- **Après-midi** : Claude Dark, Catppuccin
- **Soir/Nuit** : Claude Dark, DuoTone Dark

### Par Usage
- **Travail prolongé** : Claude Dark (réduit fatigue)
- **Productivité** : Blueberry Dark (frais et moderne)
- **Concentration** : DuoTone Dark (minimaliste)
- **Originalité** : Periwinkle Ember (unique)

### Par Préférence
- **Tons chauds** : Claude Dark, Claude Light
- **Tons froids** : Blueberry, Catppuccin, DuoTone
- **Tons mixtes** : Periwinkle Ember

## 🐛 Dépannage

### Le thème ne change pas
```bash
# Recharger manuellement
sketchybar --reload
brew services restart borders
```

### Les couleurs sont incorrectes
```bash
# Vérifier le thème actuel
./settings/theme.sh current

# Réappliquer
./settings/theme.sh apply
```

### Bordures non synchronisées
```bash
# Vérifier JankyBorders
brew services list | grep borders

# Recharger manuellement
brew services restart borders
```

## 🎯 Fonctionnalités v2.0

### Nouveautés
✅ 6 thèmes Zed complets  
✅ Icône SF Symbols (􀎔)  
✅ Intégration JankyBorders automatique  
✅ Rechargement intelligent  
✅ Palettes 100% fidèles à Zed  
✅ Tests automatisés  

### Améliorations
✅ Dialog macOS natif  
✅ Notifications système  
✅ Documentation complète  
✅ Scripts de test visuels  

## 🙏 Crédits

**Thèmes Inspirés de :**
- Claude AI - Design signature
- Blueberry Dark by peymanslh
- Catppuccin - Communauté
- DuoTone - Simurai
- Periwinkle Ember - Original

**Outils Utilisés :**
- [SketchyBar](https://github.com/FelixKratz/SketchyBar)
- [JankyBorders](https://github.com/FelixKratz/JankyBorders)
- [Zed Editor](https://zed.dev)

## 📝 Licence

Configuration personnelle - Libre d'utilisation et modification

---

**Version** : 2.0  
**Date** : 2025-11-08  
**Auteur** : kbrdn1  

✨ **Profitez de vos thèmes synchronisés !** ✨
