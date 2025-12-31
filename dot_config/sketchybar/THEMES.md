# 🎨 SketchyBar Theme System

Système de gestion de thèmes pour SketchyBar inspiré de vos thèmes Zed Editor.

## 🌈 Thèmes Disponibles (6 thèmes)

### 1. Claude Dark (défaut) ⭐
Thème chaleureux et élégant inspiré de l'IA Claude.

**Caractéristiques:**
- Palette de couleurs chaudes (tons terre)
- Orange cuivré signature (`#D4825D`)
- Parfait pour un usage prolongé
- Réduit la fatigue visuelle

**Couleurs principales:**
- Background: `#2d2622` (brun chaud foncé)
- Text: `#D4C4B8` (beige chaud)
- Accent: `#D4825D` (orange cuivré)

### 2. Claude Light ☀️
Version claire du thème Claude pour environnements lumineux.

**Caractéristiques:**
- Conserve la chaleur de Claude Dark
- Optimisé pour la lumière du jour
- Contraste adapté aux écrans lumineux

**Couleurs principales:**
- Background: `#F5EDE5` (beige clair)
- Text: `#342e29` (brun foncé)
- Accent: `#C15F3C` (orange cuivré saturé)

### 3. Blueberry Dark 🫐
Thème frais aux tons bleus et violets.

**Caractéristiques:**
- Palette bleue/violette élégante
- Accent vert menthe (`#27E8A7`)
- Look moderne et rafraîchissant
- Excellent contraste

**Couleurs principales:**
- Background: `#1d212f` (bleu-gris profond)
- Text: `#a6accd` (bleu clair lavande)
- Accent: `#27E8A7` (vert menthe)

### 4. Catppuccin 🎨
Thème pastel moderne et doux.

**Caractéristiques:**
- Palette bleue/violette pastel
- Look moderne et tech
- Tons froids apaisants
- Très populaire

**Couleurs principales:**
- Background: `#24273a` (bleu-gris foncé)
- Text: `#cad3f5` (bleu clair)
- Accent: `#8aadf4` (bleu)

### 5. DuoTone Dark 🌊
Thème profond inspiré des océans.

**Caractéristiques:**
- Tons bleus profonds
- Palette minimaliste
- Ambiance sous-marine
- Excellent pour la concentration

**Couleurs principales:**
- Background: `#1D262F` (bleu océan profond)
- Text: `#88b4e7` (bleu ciel)
- Accent: `#4fb4d7` (cyan océan)

### 6. Periwinkle Ember 💜
Thème violet/lavande unique.

**Caractéristiques:**
- Tons violets/lavande
- Palette chaude-froide
- Look distinctif et élégant
- Parfait pour se démarquer

**Couleurs principales:**
- Background: `#49495a` (violet-gris)
- Text: `#bebeef` (lavande clair)
- Accent: `#9AA7FF` (bleu pervenche)

## 🚀 Utilisation

### Méthode 1: Script Interactif (Recommandé)
```bash
cd ~/.config/sketchybar
./change_theme.sh
```

Menu interactif vous permettant de choisir le thème.

### Méthode 2: Commande Directe
```bash
# Changer de thème
~/.config/sketchybar/settings/theme.sh set claude-dark
~/.config/sketchybar/settings/theme.sh set claude-light
~/.config/sketchybar/settings/theme.sh set blueberry-dark
~/.config/sketchybar/settings/theme.sh set catppuccin
~/.config/sketchybar/settings/theme.sh set duotone-dark
~/.config/sketchybar/settings/theme.sh set periwinkle-ember

# Lister les thèmes
~/.config/sketchybar/settings/theme.sh list

# Voir le thème actuel
~/.config/sketchybar/settings/theme.sh current

# Réappliquer le thème actuel
~/.config/sketchybar/settings/theme.sh apply
```

### Méthode 3: Dans vos Scripts
```bash
# Charger les couleurs du thème actif
source ~/.config/sketchybar/settings/colors.sh

# Utiliser les variables
sketchybar --set my_item \
  background.color="$BACKGROUND_1" \
  icon.color="$ICON_COLOR" \
  label.color="$ACCENT_COLOR"
```

## 🎨 Variables de Couleurs Disponibles

Toutes les variables suivantes sont disponibles dans tous les thèmes:

### Couleurs de Base
- `$BLACK` - Noir du thème
- `$WHITE` - Blanc/texte principal
- `$TRANSPARENT` - Transparent

### Couleurs d'Accent
- `$RED` - Rouge
- `$GREEN` - Vert
- `$BLUE` - Bleu
- `$YELLOW` - Jaune
- `$PEACH` - Pêche
- `$ORANGE` - Orange (accent principal Claude)
- `$MAGENTA` - Magenta
- `$CYAN` - Cyan

### Couleurs UI
- `$GREY` - Gris principal
- `$GREY_DARK` - Gris foncé
- `$GREY_DARKER` - Gris très foncé

### Couleurs de Barre
- `$BAR_COLOR` - Couleur de fond de la barre
- `$ICON_COLOR` - Couleur des icônes
- `$LABEL_COLOR` - Couleur des labels
- `$BACKGROUND_1` - Fond niveau 1 (hover)
- `$BACKGROUND_2` - Fond niveau 2 (selected)

### Couleurs Popup
- `$POPUP_BACKGROUND_COLOR` - Fond des popups
- `$POPUP_BORDER_COLOR` - Bordure des popups

### Effets
- `$SHADOW_COLOR` - Couleur des ombres
- `$ACCENT_COLOR` - Couleur d'accent principale
- `$HIGHLIGHT_COLOR` - Surbrillance (avec transparence)

## 📝 Créer un Nouveau Thème

1. Éditer `~/.config/sketchybar/settings/theme.sh`
2. Ajouter une nouvelle fonction `load_mon_theme()`
3. Définir toutes les variables de couleurs
4. Ajouter le case dans la fonction `load_theme()`

Exemple:
```bash
load_mon_theme() {
  export BLACK=0xff000000
  export WHITE=0xffffffff
  # ... définir toutes les variables
  export ACCENT_COLOR=$BLUE
}
```

## 🔄 Persistance

Le thème choisi est automatiquement sauvegardé dans:
```
~/.config/sketchybar/.theme_preference
```

Le thème sera rechargé automatiquement au prochain démarrage de SketchyBar.

## 🎯 Intégration avec sketchybarrc

Pour que vos items utilisent les thèmes, assurez-vous que votre `sketchybarrc` source le fichier colors.sh:

```bash
# Dans sketchybarrc
source "$CONFIG_DIR/settings/colors.sh"

# Puis utiliser les variables
sketchybar --bar color="$BAR_COLOR"
```

## 💡 Conseils d'Utilisation par Thème

- **Claude Dark** 🌙: Parfait pour le soir et utilisation prolongée, réduit la fatigue visuelle
- **Claude Light** ☀️: Idéal pour le jour et environnements très lumineux
- **Blueberry Dark** 🫐: Look moderne et frais, excellent pour la productivité
- **Catppuccin** 🎨: Très populaire, tons doux et modernes
- **DuoTone Dark** 🌊: Minimaliste et profond, excellent pour la concentration
- **Periwinkle Ember** 💜: Unique et élégant, pour se démarquer

## 🐛 Dépannage

### Le thème ne change pas
```bash
# Recharger SketchyBar
sketchybar --reload
```

### Couleurs incorrectes
```bash
# Vérifier le thème actuel
~/.config/sketchybar/settings/theme.sh current

# Réappliquer le thème
~/.config/sketchybar/settings/theme.sh apply
```

### Reset au thème par défaut
```bash
rm ~/.config/sketchybar/.theme_preference
~/.config/sketchybar/settings/theme.sh set claude-dark
```

---

**Créé avec ❤️ inspiré par Claude AI et Zed Editor**
