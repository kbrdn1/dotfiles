#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"

svim=(
  script="$PLUGIN_DIR/svim/svim.sh"
  icon=$INSERT_MODE
  icon.font.size=20
  updates=on
  drawing=on
)

sketchybar --add event svim_update \
           --add item svim right   \
           --set svim "${svim[@]}" \
           --subscribe svim svim_update