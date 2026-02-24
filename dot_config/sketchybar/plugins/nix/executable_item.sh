#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- Claude Dark theme (Zed port style) --

nix=(
  icon="󱄅"
  icon.font="$FONT:Bold:14.0"
  icon.color=$GREY
  label="?"
  label.color=$WHITE
  padding_right=5
  script="$PLUGIN_DIR/nix/nix.sh"
  click_script="$PLUGIN_DIR/nix/upgrade.sh &"
  update_freq=600
  popup.align=right
)

sketchybar --add item nix right \
           --set nix "${nix[@]}" \
           --subscribe nix mouse.entered \
                           mouse.exited \
                           mouse.exited.global
