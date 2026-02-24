#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- Claude Dark theme (Zed port style) --
# Stacked: claude on top (width=0 first), copilot below (takes space second)
# Matches ram module pattern exactly

codexbar_claude=(
  icon="✻"
  icon.font="$FONT:Bold:11.0"
  icon.color=$ORANGE
  icon.padding_left=0
  icon.padding_right=2
  label="?%"
  label.font="$FONT:Heavy:9.0"
  label.color=$ORANGE
  label.padding_left=0
  label.padding_right=2
  width=0
  padding_right=10
  y_offset=6
  background.drawing=off
  script="$PLUGIN_DIR/codexbar_usage.sh"
  update_freq=120
  updates=on
)

codexbar_copilot=(
  icon="󰚩"
  icon.font="$FONT:Bold:11.0"
  icon.color=$MAGENTA
  icon.padding_left=0
  icon.padding_right=2
  label="?%"
  label.font="$FONT:Heavy:9.0"
  label.color=$MAGENTA
  label.padding_left=0
  label.padding_right=2
  y_offset=-4
  padding_right=10
  background.drawing=off
)

sketchybar --add item codexbar_claude right \
           --set codexbar_claude "${codexbar_claude[@]}" \
           \
           --add item codexbar_copilot right \
           --set codexbar_copilot "${codexbar_copilot[@]}"
