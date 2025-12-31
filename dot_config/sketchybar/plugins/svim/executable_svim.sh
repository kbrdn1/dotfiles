#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

if [ "$SENDER" = "svim_update" ]; then
  DRAWING=on
  DRAW_CMD=off
  COLOR=$WHITE
  case "$MODE" in
    "I") ICON="$MODE_INSERT" COLOR=$WHITE
    ;;
    "N") ICON="$MODE_NORMAL" COLOR=$BLUE
    ;;
    "V") ICON="$MODE_VISUAL" COLOR=$GREEN
    ;;
    "C") ICON="$MODE_CMD" DRAW_CMD=on COLOR=$ORANGE
    ;;
    "_") ICON="$MODE_PENDING"
    ;;
    *) DRAWING=off
    ;;
  esac

  sketchybar --set $NAME drawing="$DRAWING" \
                         label.drawing="$DRAW_CMD" \
                         icon="$ICON" \
                         icon.color="$COLOR" \
                         label="$CMDLINE"
fi