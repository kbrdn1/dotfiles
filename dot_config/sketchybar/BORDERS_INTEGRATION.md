# 🖼️ JankyBorders Integration

## 🎨 Intégration Complète avec le Système de Thèmes

Les couleurs des bordures JankyBorders sont maintenant **automatiquement synchronisées** avec les thèmes SketchyBar !

## ✨ Fonctionnement

### Synchronisation Automatique

Quand vous changez de thème SketchyBar :
1. Les couleurs de bordures sont mises à jour
2. JankyBorders est automatiquement rechargé
3. Les bordures actives/inactives reflètent le thème choisi

### Couleurs par Thème

| Thème | Bordure Active | Bordure Inactive |
|-------|----------------|------------------|
| ⭐ Claude Dark | `#D4825D` (orange cuivré) | `#5a4a40` (46% opacité) |
| ☀️ Claude Light | `#C15F3C` (orange saturé) | `#8a7a70` (46% opacité) |
| 🫐 Blueberry Dark | `#27E8A7` (vert menthe) | `#506477` (46% opacité) |
| 🎨 Catppuccin | `#8aadf4` (bleu) | `#494d64` (46% opacité) |
| 🌊 DuoTone Dark | `#4fb4d7` (cyan océan) | `#3d4759` (46% opacité) |
| 💜 Periwinkle Ember | `#9AA7FF` (bleu pervenche) | `#6a6a7a` (46% opacité) |

## 📁 Fichiers Modifiés

### `/Users/kbrdn1/.config/borders/`

**bordersrc** - Configuration principale
```bash
#!/bin/bash
# Charge automatiquement les couleurs du thème
source "$HOME/.config/borders/colors.sh"

options=(
  style="$BORDER_STYLE"
  width="$BORDER_WIDTH"
  hidpi="$BORDER_HIDPI"
  active_color="$BORDER_ACTIVE_COLOR"
  inactive_color="$BORDER_INACTIVE_COLOR"
  background_color="$BORDER_BACKGROUND_COLOR"
)

borders "${options[@]}"
```

**colors.sh** - Couleurs synchronisées
```bash
# Charge les couleurs du thème SketchyBar
source "$HOME/.config/sketchybar/settings/colors.sh"

# Utilise les variables BORDER_ACTIVE et BORDER_INACTIVE
export BORDER_ACTIVE_COLOR="${BORDER_ACTIVE:-0xFFB7BDF8}"
export BORDER_INACTIVE_COLOR="${BORDER_INACTIVE:-0x77494D64}"
```

### `/Users/kbrdn1/.config/sketchybar/settings/theme.sh`

Chaque thème définit maintenant :
```bash
# Borders (JankyBorders)
export BORDER_ACTIVE=$ORANGE      # Couleur accent du thème
export BORDER_INACTIVE=0x775a4a40 # Gris avec 46% opacité
```

Fonction `apply_theme()` mise à jour :
```bash
# ⚡ Mise à jour INSTANTANÉE sans redémarrage de service !
if command -v borders &> /dev/null; then
  borders active_color="$BORDER_ACTIVE" inactive_color="$BORDER_INACTIVE" &> /dev/null
fi
```

**✨ Avantages de la mise à jour live :**
- 🚀 Changement instantané (pas de délai de redémarrage)
- 🔇 Silencieux (pas de notification de service)
- ⚡ Performant (pas de kill/restart du daemon)

## 🚀 Utilisation

### Changement de Thème (Automatique)

```bash
# Via GUI
Cliquez  (Apple) → 􀎔 Change Theme
# ✨ Bordures changent INSTANTANÉMENT !

# Via CLI
./change_theme.sh
# ✨ Bordures changent INSTANTANÉMENT !

# Via commande directe
./settings/theme.sh set blueberry-dark
# ✨ Bordures changent INSTANTANÉMENT !
```

**Note :** Les changements sont maintenant instantanés grâce à la mise à jour live des bordures.

### Rechargement Manuel (Si Nécessaire)

```bash
# Recharger JankyBorders manuellement
brew services restart borders

# Ou via bordersrc
~/.config/borders/bordersrc
```

## 🧪 Tests

### Tester les Couleurs de Bordures

```bash
# Voir les couleurs de bordures pour tous les thèmes
cd ~/.config/sketchybar
./test_borders_colors.sh
```

### Vérifier l'Intégration

```bash
# 1. Changer de thème
./change_theme.sh

# 2. Vérifier que borders s'est rechargé
brew services list | grep borders
# Devrait montrer "started"

# 3. Ouvrir une fenêtre
# Les bordures devraient avoir la couleur du thème actif
```

## 🎨 Personnalisation

### Modifier le Style des Bordures

Éditez `/Users/kbrdn1/.config/borders/colors.sh` :

```bash
# Changer l'épaisseur
export BORDER_WIDTH="7.0"  # Par défaut: 5.0

# Changer le style
export BORDER_STYLE="square"  # round, square

# Désactiver HiDPI
export BORDER_HIDPI="off"  # Par défaut: on
```

### Ajuster la Transparence

Les bordures inactives utilisent 46% d'opacité (`0x77` = 119/255).

Pour modifier, éditez `theme.sh` :
```bash
# Exemple avec 60% d'opacité (0x99 = 153/255)
export BORDER_INACTIVE=0x995a4a40
```

## 🔧 Dépannage

### Les bordures ne changent pas de couleur

```bash
# Recharger manuellement
brew services restart borders

# Vérifier que borders fonctionne
brew services list | grep borders

# Si arrêté, démarrer
brew services start borders
```

### Les couleurs sont incorrectes

```bash
# Vérifier les variables
source ~/.config/borders/colors.sh
echo "Active: $BORDER_ACTIVE_COLOR"
echo "Inactive: $BORDER_INACTIVE_COLOR"

# Recharger le thème
~/.config/sketchybar/settings/theme.sh apply
```

### Bordersrc ne trouve pas colors.sh

```bash
# Vérifier le chemin
ls -la ~/.config/borders/colors.sh

# Rendre exécutable si nécessaire
chmod +x ~/.config/borders/bordersrc
chmod +x ~/.config/borders/colors.sh
```

## 📊 Variables Disponibles

Dans `colors.sh`, vous avez accès à toutes les variables de thème :

```bash
# Couleurs de base
$BLACK, $WHITE, $TRANSPARENT

# Couleurs d'accent
$RED, $GREEN, $BLUE, $YELLOW, $ORANGE, $MAGENTA, $CYAN

# Couleurs UI
$GREY, $GREY_DARK, $GREY_DARKER
$ACCENT_COLOR, $HIGHLIGHT_COLOR

# Couleurs de bordures (recommandées)
$BORDER_ACTIVE
$BORDER_INACTIVE
```

## 🎯 Recommandations

### Bordure Active
Utilise toujours la couleur accent du thème pour cohérence visuelle :
- Claude Dark/Light : Orange cuivré
- Blueberry Dark : Vert menthe distinctif
- Catppuccin/DuoTone : Bleu
- Periwinkle Ember : Bleu pervenche

### Bordure Inactive
Utilise un gris du thème avec **46% d'opacité** pour être visible mais discrète.

### Opacité Recommandée
- Active : `0xff` (100%) - Toujours opaque
- Inactive : `0x77` (46%) - Semi-transparent

## 💡 Astuces

1. **Cohérence Visuelle** : Les bordures actives utilisent toujours l'accent du thème
2. **Feedback Visuel** : L'opacité différencie fenêtre active/inactive
3. **Rechargement Auto** : Pas besoin de redémarrer manuellement
4. **Test Rapide** : `./test_borders_colors.sh` pour voir toutes les couleurs

## 🔄 Workflow Complet

```bash
# 1. Changer de thème
./change_theme.sh
  ↓
# 2. SketchyBar se recharge
  ↓
# 3. JankyBorders se recharge automatiquement
  ↓
# 4. Nouvelles couleurs appliquées partout !
```

---

**✨ Profitez de vos bordures synchronisées !**

*Documentation mise à jour : 2025-11-08*
