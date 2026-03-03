#!/bin/bash

# ════════════════════════════════════════════════════════════════════
# AeroSpace Config Switcher Item
# -- Claude Dark theme (Zed port style) --
# ════════════════════════════════════════════════════════════════════

source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

aerospace_switcher=(
  icon=$MACBOOK
  icon.font="SF Pro:Bold:16.0"
  icon.color=$GREY
  icon.highlight_color=$ORANGE
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

# ════════════════════════════════════════════════════════════════════
# AeroSpace Mode Indicator
# Affiche un badge (A/R/S) quand un mode non-main est actif
# ════════════════════════════════════════════════════════════════════

sketchybar --add item aerospace_mode left \
           --set aerospace_mode \
             updates=on \
             drawing=off \
             icon.font="$FONT:Bold:20.0" \
             icon.padding_left=3 \
             icon.padding_right=3 \
             label.drawing=off \
             background.drawing=off \
             padding_left=3 \
             padding_right=0 \
             script="$PLUGIN_DIR/aerospace/mode.sh" \
           --subscribe aerospace_mode \
             aerospace_mode_change
