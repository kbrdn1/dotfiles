#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- Claude Dark theme (Zed port style) --

calendar=(
  icon=cal
  icon.font="$FONT:Black:12.0"
  icon.color=$ORANGE
  icon.padding_right=0
  label.width=45
  label.align=right
  label.color=$WHITE
  label.font="$FONT:Semibold:12.0"
  padding_left=10
  update_freq=30
  script="$PLUGIN_DIR/calendar/calendar.sh"
  click_script="$PLUGIN_DIR/zen.sh"
)

sketchybar --add item calendar right       \
           --set calendar "${calendar[@]}" \
           --subscribe calendar system_woke
