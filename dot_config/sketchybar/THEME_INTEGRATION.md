# 🎨 SketchyBar Theme System - Integration Complete

## ✅ Installation Terminée

Le système de thèmes inspiré de Claude Dark (Zed Editor) est maintenant complètement intégré à votre SketchyBar !

## 📦 Fichiers Créés

### Scripts Principaux
- ✅ `settings/theme.sh` - Gestionnaire de thèmes (3 thèmes inclus)
- ✅ `settings/colors.sh` - Chargeur de couleurs automatique
- ✅ `change_theme.sh` - Interface de changement de thème avec dialog macOS
- ✅ `preview_theme.sh` - Aperçu visuel des couleurs
- ✅ `test_theme_button.sh` - Script de test complet

### Documentation
- ✅ `THEMES.md` - Documentation complète du système de thèmes

### Intégration
- ✅ `plugins/apple/item.sh` - Bouton "Change Theme" ajouté au menu Apple

## 🎨 Thèmes Disponibles

1. **Claude Dark** (par défaut) ⭐
   - Palette chaude et élégante
   - Orange cuivré signature (#D4825D)
   - Parfait pour usage prolongé

2. **Claude Light** ☀️
   - Version claire du thème Claude
   - Tons chauds conservés
   - Idéal pour environnements lumineux

3. **Catppuccin** 🌊
   - Thème original moderne
   - Tons bleus/violets
   - Look tech et professionnel

## 🚀 Utilisation

### Méthode 1: Via SketchyBar (GUI) - Recommandé
1. Cliquez sur le logo Apple  en haut à gauche
2. Sélectionnez "🎨 Change Theme" dans le menu
3. Choisissez votre thème dans la boîte de dialogue
4. SketchyBar se recharge automatiquement avec le nouveau thème

### Méthode 2: Script Direct
```bash
cd ~/.config/sketchybar
./change_theme.sh
```

### Méthode 3: Ligne de Commande
```bash
# Changer vers Claude Dark
~/.config/sketchybar/settings/theme.sh set claude-dark

# Changer vers Claude Light
~/.config/sketchybar/settings/theme.sh set claude-light

# Changer vers Catppuccin
~/.config/sketchybar/settings/theme.sh set catppuccin

# Voir le thème actuel
~/.config/sketchybar/settings/theme.sh current

# Lister tous les thèmes
~/.config/sketchybar/settings/theme.sh list
```

## 🔍 Preview des Couleurs

Pour voir toutes les couleurs du thème actif:
```bash
cd ~/.config/sketchybar
./preview_theme.sh
```

## 🧪 Tests

Pour vérifier que tout fonctionne:
```bash
cd ~/.config/sketchybar
./test_theme_button.sh
```

## 📊 Variables de Couleurs

Toutes vos configurations SketchyBar peuvent maintenant utiliser:

**Couleurs de Base:**
- `$BLACK`, `$WHITE`, `$TRANSPARENT`

**Accents:**
- `$RED`, `$GREEN`, `$BLUE`, `$YELLOW`
- `$PEACH`, `$ORANGE`, `$MAGENTA`, `$CYAN`

**UI:**
- `$GREY`, `$GREY_DARK`, `$GREY_DARKER`
- `$BAR_COLOR`, `$ICON_COLOR`, `$LABEL_COLOR`
- `$BACKGROUND_1`, `$BACKGROUND_2`
- `$POPUP_BACKGROUND_COLOR`, `$POPUP_BORDER_COLOR`

**Effets:**
- `$SHADOW_COLOR`, `$ACCENT_COLOR`, `$HIGHLIGHT_COLOR`

## 🎯 Persistance

Le thème choisi est automatiquement sauvegardé dans:
```
~/.config/sketchybar/.theme_preference
```

Il sera rechargé à chaque démarrage de SketchyBar.

## 💡 Conseils d'Utilisation

### Quand utiliser chaque thème?

**Claude Dark** 🌙
- Utilisation en soirée
- Sessions de travail prolongées
- Environnements sombres
- Réduction de la fatigue visuelle

**Claude Light** ☀️
- Travail en journée
- Environnements très lumineux
- Bureaux avec fenêtres
- Présentations/partages d'écran

**Catppuccin** 🎨
- Look moderne et tech
- Si vous préférez les tons froids
- Alternative au thème original

## 🔧 Personnalisation

Pour créer votre propre thème, éditez `settings/theme.sh`:

```bash
load_mon_theme() {
  export BLACK=0xff000000
  export WHITE=0xffffffff
  export ORANGE=0xffFF6600
  # ... définir toutes les variables
  export ACCENT_COLOR=$ORANGE
}
```

Puis ajoutez-le dans la fonction `load_theme()`:
```bash
case "$theme_name" in
  "mon-theme")
    load_mon_theme
    ;;
  # ...
esac
```

## 📱 Notifications

Le système affiche des notifications macOS:
- ✅ Confirmation du changement de thème
- ❌ Erreurs de configuration
- 🔄 Rechargement de SketchyBar

## 🆘 Support

### Problème: Le thème ne change pas
```bash
# Vérifier le thème actuel
~/.config/sketchybar/settings/theme.sh current

# Forcer le rechargement
sketchybar --reload
```

### Problème: Couleurs incorrectes
```bash
# Réinitialiser au thème par défaut
rm ~/.config/sketchybar/.theme_preference
~/.config/sketchybar/settings/theme.sh set claude-dark
sketchybar --reload
```

### Problème: Script non exécutable
```bash
chmod +x ~/.config/sketchybar/change_theme.sh
chmod +x ~/.config/sketchybar/settings/theme.sh
```

## 📖 Documentation Complète

Pour plus de détails, consultez:
```bash
cat ~/.config/sketchybar/THEMES.md
```

---

**🎨 Profitez de votre nouveau système de thèmes !**

*Inspiré par Claude AI et Zed Editor avec ❤️*
