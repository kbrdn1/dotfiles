#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

FRONT_APP_SCRIPT='sketchybar --set $NAME label="$INFO"'

WINDOW=$(yabai -m query --windows --window)
CURRENT=$(echo "$WINDOW" | jq '.["stack-index"]')

if [[ $CURRENT -gt 0 ]]; then
  ICON_YABAI=$YABAI_STACK
elif [[ $(echo "$WINDOW" | jq '.["is-floating"]') == "true" ]]; then
  ICON_YABAI=$YABAI_FLOAT
else
  ICON_YABAI=$YABAI_GRID
fi

yabai=(
  script="$PLUGIN_DIR/yabai.sh"
  icon.font="$FONT:Bold:16.0"
  label.drawing=off
  icon.width=30
  icon=$ICON_YABAI
  icon.color=$ORANGE
  associated_display=active
)

front_app=(
  script="$FRONT_APP_SCRIPT"
  icon.drawing=off
  padding_left=0
  label.color=$WHITE
  label.font="$FONT:Black:12.0"
  associated_display=active
)

sketchybar --add event window_focus            \
           --add event windows_on_spaces       \
           --add item yabai left               \
           --set yabai "${yabai[@]}"           \
           --subscribe yabai window_focus      \
                             windows_on_spaces \
                             mouse.clicked     \
                                               \
           --add item front_app left           \
           --set front_app "${front_app[@]}"   \
           --subscribe front_app front_app_switched

