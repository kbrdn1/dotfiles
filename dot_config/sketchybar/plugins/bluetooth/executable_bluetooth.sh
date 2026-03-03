#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

NERD="Liga SFMono Nerd Font"
BT_ON="󰂯"
BT_OFF="󰂲"

update() {
  # Verifier si blueutil est installe
  if ! command -v blueutil &> /dev/null; then
    sketchybar --set bluetooth \
      icon="$BT_OFF" \
      icon.font="$NERD:Bold:16.0" \
      icon.color=$RED \
      label.drawing=off \
      drawing=off
    return
  fi

  # Obtenir le statut Bluetooth
  BLUETOOTH_STATUS=$(blueutil --power)

  if [ "$BLUETOOTH_STATUS" = "1" ]; then
    CONNECTED_DEVICES=$(blueutil --connected 2>/dev/null)
    DEVICE_COUNT=$(echo "$CONNECTED_DEVICES" | grep -c "address:" 2>/dev/null || echo "0")

    if [ "$DEVICE_COUNT" -gt 0 ]; then
      sketchybar --set bluetooth \
        icon="$BT_ON" \
        icon.font="$NERD:Bold:16.0" \
        icon.color=$ORANGE \
        label="$DEVICE_COUNT" \
        label.drawing=on \
        drawing=on
    else
      sketchybar --set bluetooth \
        icon="$BT_ON" \
        icon.font="$NERD:Bold:16.0" \
        icon.color=$GREY \
        label.drawing=off \
        drawing=on
    fi
  else
    sketchybar --set bluetooth \
      icon="$BT_OFF" \
      icon.font="$NERD:Bold:16.0" \
      icon.color=$RED \
      label.drawing=off \
      drawing=on
  fi
}

mouse_clicked() {
  # Toggle Bluetooth on/off
  CURRENT_STATE=$(blueutil --power)

  if [ "$CURRENT_STATE" = "1" ]; then
    blueutil --power 0
  else
    blueutil --power 1
  fi

  # Force update après changement
  sleep 0.5
  update
}

case "$SENDER" in
  "routine" | "forced") update ;;
  "mouse.clicked") mouse_clicked ;;
  *) update ;;
esac
