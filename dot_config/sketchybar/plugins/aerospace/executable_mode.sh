#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

update() {
  MODE="${MODE:-main}"

  if [ "$MODE" = "main" ]; then
    sketchybar --set "$NAME" drawing=off
    return
  fi

  DRAWING=on
  case "$MODE" in
    aero)    ICON="$AERO_NORMAL"  COLOR=$BLUE ;;
    resize)  ICON="$AERO_RESIZE"  COLOR=$ORANGE ;;
    service) ICON="$AERO_SERVICE" COLOR=$GREEN ;;
    *)       ICON="$MODE_PENDING" COLOR=$MAGENTA ;;
  esac

  sketchybar --set "$NAME" \
    drawing=on \
    icon="$ICON" \
    icon.drawing=on \
    icon.color="$COLOR" \
    label.drawing=off
}

case "$SENDER" in
  "aerospace_mode_change") update ;;
  "forced") update ;;
  *) update ;;
esac
