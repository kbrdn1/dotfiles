#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# -- Claude Dark theme (Zed port style) --
# Active/connected: $ORANGE accent
# Idle/no devices: $GREY muted
# Disabled: $RED semantic

bluetooth=(
  script="$PLUGIN_DIR/bluetooth/bluetooth.sh"
  update_freq=30

  icon="󰂯"
  icon.font="Liga SFMono Nerd Font:Bold:16.0"
  icon.color=$GREY
  icon.padding_left=$PADDINGS
  icon.padding_right=$PADDINGS

  label.drawing=off
  label.font="$FONT:Semibold:11.0"
  label.color=$WHITE
  label.padding_left=$PADDINGS
  label.padding_right=$PADDINGS

  background.drawing=off
)

sketchybar --add item bluetooth right \
           --set bluetooth "${bluetooth[@]}" \
           --subscribe bluetooth mouse.clicked
