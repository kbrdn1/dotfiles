#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Obtenir la fenêtre focusée
FOCUSED_WINDOW=$(aerospace list-windows --focused 2>/dev/null)

if [ -z "$FOCUSED_WINDOW" ]; then
  # Pas de fenêtre focusée
  ICON_LAYOUT=$YABAI_GRID
else
  # Compter les fenêtres dans le workspace actuel
  WINDOW_COUNT=$(aerospace list-windows --workspace focused 2>/dev/null | wc -l | tr -d ' ')

  # Déterminer l'icône selon le contexte:
  # - Fullscreen: icône zoom (Ctrl+Alt+F)
  # - Une seule fenêtre: icône zoom
  # - Plusieurs fenêtres: icône grid (tiles)

  if [ "$WINDOW_COUNT" -eq 1 ]; then
    # Une seule fenêtre = icône fullscreen/zoom
    ICON_LAYOUT=$YABAI_FULLSCREEN_ZOOM
  elif [ "$WINDOW_COUNT" -gt 1 ]; then
    # Plusieurs fenêtres = icône grid (tiles)
    ICON_LAYOUT=$YABAI_GRID
  else
    # Défaut
    ICON_LAYOUT=$YABAI_GRID
  fi
fi

sketchybar --set $NAME icon="$ICON_LAYOUT"
