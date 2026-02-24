#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# -- Claude Dark theme (Zed port style) --

brew=(
  icon=$BREW
  icon.color=$GREY
  label="?"
  label.color=$WHITE
  padding_right=5
  script="$PLUGIN_DIR/brew/brew.sh"
  click_script="$PLUGIN_DIR/brew/upgrade.sh &"
  update_freq=300
  updates=on
  popup.align=right
)

sketchybar --add item brew right \
           --set brew "${brew[@]}" \
           --subscribe brew mouse.entered \
                            mouse.exited \
                            mouse.exited.global
