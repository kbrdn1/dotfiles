#!/bin/bash

source "$HOME/.config/sketchybar/settings/colors.sh"

# Couleurs par mode
MODE_COLORS=(
  ["resize"]="0xffff6b35"    # Orange
  ["service"]="0xff00d084"   # Vert
)

update() {
  # Récupérer le mode actuel d'AeroSpace
  CURRENT_MODE=$(aerospace list-modes 2>/dev/null | grep -v "^main$" | head -1)

  # Si aucun mode ou mode main, ne rien afficher
  if [ -z "$CURRENT_MODE" ] || [ "$CURRENT_MODE" = "main" ]; then
    sketchybar --set "$NAME" \
               label="" \
               drawing=off
    exit 0
  fi

  # Première lettre en majuscule
  MODE_LETTER=$(echo "${CURRENT_MODE:0:1}" | tr '[:lower:]' '[:upper:]')

  # Couleur du mode
  MODE_COLOR="${MODE_COLORS[$CURRENT_MODE]}"
  if [ -z "$MODE_COLOR" ]; then
    MODE_COLOR="0xffb362ff"  # Violet par défaut
  fi

  # Afficher le mode
  sketchybar --set "$NAME" \
             label="$MODE_LETTER" \
             label.color="$WHITE" \
             label.font="$FONT:Black:14.0" \
             background.color="$MODE_COLOR" \
             background.corner_radius=6 \
             background.height=24 \
             background.padding_left=8 \
             background.padding_right=8 \
             drawing=on
}

case "$SENDER" in
  "aerospace_mode_change") update ;;
  "forced") update ;;
  *) update ;;
esac
