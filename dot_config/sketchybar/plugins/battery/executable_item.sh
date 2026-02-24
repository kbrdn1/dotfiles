#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- Claude Dark theme (Zed port style) --

battery=(
  script="$PLUGIN_DIR/battery/battery.sh"
  icon.font="$FONT:Regular:19.0"
  icon.color=$GREY
  label.color=$WHITE
  label.font="$FONT:Semibold:11.0"
  padding_right=5
  label.drawing=on
  update_freq=120
  updates=on
)

sketchybar --add item battery right      \
           --set battery "${battery[@]}" \
           --subscribe battery power_source_change system_woke
