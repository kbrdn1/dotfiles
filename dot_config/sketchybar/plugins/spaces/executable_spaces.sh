#!/bin/bash

source "$HOME/.config/sketchybar/settings/colors.sh"

# -- Claude Dark theme (Zed port style) --
# Couleurs par workspace (meme ordre que item.sh)
SPACE_COLORS=(
  "$BLUE"       # 1: Home
  "$RED"        # 2: Music
  "$GREEN"      # 3: Zed
  "$MAGENTA"    # 4: Helium
  "$PEACH"      # 5: Chat
  "$YELLOW"     # 6: DB
  "$CYAN"       # 7: Obsidian
  "$ORANGE"     # 8: Claude
)

update() {
  FOCUSED="${FOCUSED_WORKSPACE:-$(aerospace list-workspaces --focused 2>/dev/null)}"
  WORKSPACE_ID="${NAME#*.}"
  WORKSPACE_COLOR="${SPACE_COLORS[$((WORKSPACE_ID-1))]}"
  # bg subtil a 20% opacite
  WORKSPACE_BG="0x33${WORKSPACE_COLOR:4}"

  if [ "$FOCUSED" = "$WORKSPACE_ID" ]; then
    sketchybar --animate sin 8 \
               --set "$NAME" \
               icon.highlight=on \
               icon.color="$WORKSPACE_COLOR" \
               background.drawing=on \
               background.color="$WORKSPACE_BG" \
               label.width=0 \
               label.drawing=off
  else
    sketchybar --animate sin 8 \
               --set "$NAME" \
               icon.highlight=off \
               icon.color=$GREY \
               background.drawing=off \
               label.width=0 \
               label.drawing=off
  fi
}

mouse_entered() {
  FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null)
  WORKSPACE_ID="${NAME#*.}"

  if [ "$FOCUSED" != "$WORKSPACE_ID" ]; then
    WORKSPACE_COLOR="${SPACE_COLORS[$((WORKSPACE_ID-1))]}"
    WORKSPACE_BG="0x22${WORKSPACE_COLOR:4}"

    sketchybar --set "$NAME" \
               label.drawing=on \
               label.color=$BLACK \
               label.background.drawing=on \
               label.background.color="$WORKSPACE_COLOR" \
               background.drawing=on \
               background.color="$WORKSPACE_BG" \
               --animate sin 10 --set "$NAME" label.width=dynamic
  fi
}

mouse_exited() {
  WORKSPACE_ID="${NAME#*.}"
  FOCUSED="${FOCUSED_WORKSPACE:-$(aerospace list-workspaces --focused 2>/dev/null)}"

  sketchybar --animate sin 10 --set "$NAME" label.width=0 \
             --set "$NAME" \
             label.drawing=off \
             label.background.drawing=off

  if [ "$FOCUSED" != "$WORKSPACE_ID" ]; then
    sketchybar --set "$NAME" background.drawing=off label.color=$WHITE
  fi
}

mouse_clicked() {
  WORKSPACE_ID="${NAME#*.}"

  case "$BUTTON" in
    "left")
      aerospace workspace "$WORKSPACE_ID"
      sketchybar --trigger aerospace_workspace_change FOCUSED_WORKSPACE="$WORKSPACE_ID"
      ;;
    "right")
      aerospace workspace-back-and-forth
      sketchybar --trigger aerospace_workspace_change
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
