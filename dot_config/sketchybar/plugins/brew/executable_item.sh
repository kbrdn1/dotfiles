#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/icons.sh"

POPUP_OFF="sketchybar --set $NAME brew.popup.drawing=off"

brew=(
  icon=$BREW
  label=?
  padding_right=10
  script="$PLUGIN_DIR/brew/brew.sh"
  click_script="$POPUP_OFF"
  update_freq=300
  popup.align=right
)

sketchybar --add item brew right \
           --set brew "${brew[@]}" \
           --subscribe brew brew_update \
                            mouse.clicked \
                            mouse.entered \
                            mouse.exited \
                            mouse.exited.global \
           --add item brew_popup popup \
            --set brew_popup \
                            background.corner_radius=12 \
                            background.padding_left=7 \
                            background.padding_right=7 \
                            background.drawing=on