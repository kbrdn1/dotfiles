#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

update() {
  # Vérifier si blueutil est installé
  if ! command -v blueutil &> /dev/null; then
    sketchybar --set bluetooth \
      icon="$BLUETOOTH_OFF" \
      icon.color=$RED \
      label.drawing=off \
      drawing=off
    return
  fi

  # Obtenir le statut Bluetooth
  BLUETOOTH_STATUS=$(blueutil --power)

  if [ "$BLUETOOTH_STATUS" = "1" ]; then
    # Bluetooth activé
    CONNECTED_DEVICES=$(blueutil --connected 2>/dev/null)
    DEVICE_COUNT=$(echo "$CONNECTED_DEVICES" | grep -c "address:" 2>/dev/null || echo "0")

    if [ "$DEVICE_COUNT" -gt 0 ]; then
      # Appareils connectés - icône bleue avec count
      sketchybar --set bluetooth \
        icon="$BLUETOOTH" \
        icon.color=$BLUE \
        label="$DEVICE_COUNT" \
        label.drawing=on \
        drawing=on
    else
      # Bluetooth activé mais aucun appareil connecté
      sketchybar --set bluetooth \
        icon="$BLUETOOTH" \
        icon.color=$GREY \
        label.drawing=off \
        drawing=on
    fi
  else
    # Bluetooth désactivé - icône rouge
    sketchybar --set bluetooth \
      icon="$BLUETOOTH_OFF" \
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
