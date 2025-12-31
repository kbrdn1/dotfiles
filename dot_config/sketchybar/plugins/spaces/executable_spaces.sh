#!/bin/bash

source "$HOME/.config/sketchybar/settings/colors.sh"

# Couleurs thématiques par workspace (doit correspondre à item.sh)
SPACE_COLORS=(
  "0xff4a90e2"  # Bleu Mail
  "0xffff6b35"  # Orange Postman
  "0xff00d084"  # Vert Code
  "0xffb362ff"  # Violet Arc
  "0xffe91e63"  # Rose Communication
  "0xffffb700"  # Jaune Database
  "0xff9b59b6"  # Mauve Obsidian
  "0xffff9d5c"  # Orange doux Claude AI
)

update() {
  # Get current focused workspace from AeroSpace
  FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null)

  # Extract workspace number from NAME (format: space.1, space.2, etc.)
  WORKSPACE_ID="${NAME#*.}"

  # Get the color for this workspace
  WORKSPACE_COLOR="${SPACE_COLORS[$((WORKSPACE_ID-1))]}"
  WORKSPACE_BG="0x33${WORKSPACE_COLOR:4}"

  # Check if this workspace is focused
  if [ "$FOCUSED" = "$WORKSPACE_ID" ]; then
    # Animation workspace actif - rapide et fluide
    sketchybar --animate sin 8 \
               --set "$NAME" \
               icon.highlight=on \
               icon.color="$WORKSPACE_COLOR" \
               background.drawing=on \
               background.color="$WORKSPACE_BG" \
               label.width=0 \
               label.drawing=off
  else
    # Animation workspace inactif - rapide et fluide
    sketchybar --animate sin 8 \
               --set "$NAME" \
               icon.highlight=off \
               icon.color="$ICON_COLOR" \
               background.drawing=off \
               label.width=0 \
               label.drawing=off
  fi
}

mouse_entered() {
  # Get current focused workspace
  FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null)
  WORKSPACE_ID="${NAME#*.}"

  # Effet hover : afficher le label seulement si pas actif
  if [ "$FOCUSED" != "$WORKSPACE_ID" ]; then
    WORKSPACE_COLOR="${SPACE_COLORS[$((WORKSPACE_ID-1))]}"
    WORKSPACE_BG="0x22${WORKSPACE_COLOR:4}"

    sketchybar --set "$NAME" \
               label.drawing=on \
               label.background.drawing=on \
               background.drawing=on \
               background.color="$WORKSPACE_BG" \
               --animate sin 10 --set "$NAME" label.width=dynamic
  fi
}

mouse_exited() {
  # Get current focused workspace
  FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null)
  WORKSPACE_ID="${NAME#*.}"

  # Retirer le hover seulement si pas actif
  if [ "$FOCUSED" != "$WORKSPACE_ID" ]; then
    sketchybar --animate sin 10 --set "$NAME" label.width=0 \
               --set "$NAME" \
               label.drawing=off \
               label.background.drawing=off \
               background.drawing=off
  fi
}

mouse_clicked() {
  # Extract workspace number from NAME
  WORKSPACE_ID="${NAME#*.}"

  # Switching avec AeroSpace
  case "$BUTTON" in
    "left")
      # Focus workspace
      aerospace workspace "$WORKSPACE_ID"
      ;;
    "right")
      # Retour au workspace précédent
      aerospace workspace-back-and-forth
      ;;
  esac
}

case "$SENDER" in
  "mouse.entered") mouse_entered ;;
  "mouse.exited") mouse_exited ;;
  "mouse.clicked") mouse_clicked ;;
  "aerospace_workspace_change") update ;;
  *) update ;;
esac
