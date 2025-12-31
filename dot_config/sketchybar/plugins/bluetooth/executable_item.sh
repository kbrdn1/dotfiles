#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Module Bluetooth simplifié
bluetooth=(
  script="$PLUGIN_DIR/bluetooth/bluetooth.sh"
  update_freq=5

  # Icon
  icon="$BLUETOOTH"
  icon.font="$FONT:Bold:14.0"
  icon.color=$BLUE
  icon.padding_left=$PADDINGS
  icon.padding_right=$PADDINGS

  # Label (nombre d'appareils connectés)
  label.drawing=off
  label.font="$FONT:Semibold:11.0"
  label.color=$WHITE
  label.padding_left=$PADDINGS
  label.padding_right=$PADDINGS

  # Background désactivé (dans le bracket status)
  background.drawing=off
)

sketchybar --add item bluetooth right \
           --set bluetooth "${bluetooth[@]}" \
           --subscribe bluetooth mouse.clicked
