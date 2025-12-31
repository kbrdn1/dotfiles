#!/bin/bash

# ════════════════════════════════════════════════════════════════════
# AeroSpace Config Switcher Item
# ════════════════════════════════════════════════════════════════════

source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

aerospace_switcher=(
  icon=$MACBOOK
  icon.font="SF Pro:Bold:16.0"
  icon.color=$ICON_COLOR
  icon.padding_left=3
  icon.padding_right=3

  label.drawing=off

  background.drawing=off

  padding_left=3
  padding_right=0

  script="$PLUGIN_DIR/aerospace/aerospace_switcher.sh"

  click_script="$PLUGIN_DIR/aerospace/aerospace_switcher.sh"
)

sketchybar --add item aerospace_switcher left \
           --set aerospace_switcher "${aerospace_switcher[@]}" \
           --subscribe aerospace_switcher \
             mouse.clicked
