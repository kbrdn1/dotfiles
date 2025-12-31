#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Script pour afficher l'app courante (compatible AeroSpace)
FRONT_APP_SCRIPT='
APP_NAME="$INFO"
if [ -z "$APP_NAME" ]; then
  # Fallback: obtenir le nom de l app active via osascript
  APP_NAME=$(osascript -e "tell application \"System Events\" to get name of first application process whose frontmost is true" 2>/dev/null)
fi
sketchybar --set $NAME label="$APP_NAME"
'

# Déterminer l'icône de layout (AeroSpace)
WINDOW_LAYOUT=$(aerospace list-windows --focused --format "%{window-id}" 2>/dev/null)
if [ -n "$WINDOW_LAYOUT" ]; then
  # Par défaut, icône grid pour AeroSpace
  ICON_LAYOUT=$YABAI_GRID
else
  ICON_LAYOUT=$YABAI_GRID
fi

aerospace_icon=(
  script="$PLUGIN_DIR/aerospace_icon.sh"
  icon.font="$FONT:Bold:16.0"
  label.drawing=off
  icon.width=30
  icon=$ICON_LAYOUT
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

aerospace_mode=(
  script="$PLUGIN_DIR/aerospace/mode.sh"
  icon.drawing=off
  label.drawing=off
  padding_left=8
  padding_right=0
  background.drawing=off
  update_freq=1
  associated_display=active
)

sketchybar --add event window_focus \
           --add event aerospace_mode_change \
           --add item aerospace_icon left \
           --set aerospace_icon "${aerospace_icon[@]}" \
           --subscribe aerospace_icon window_focus aerospace_workspace_change \
           \
           --add item front_app left \
           --set front_app "${front_app[@]}" \
           --subscribe front_app front_app_switched \
           \
           --add item aerospace_mode left \
           --set aerospace_mode "${aerospace_mode[@]}" \
           --subscribe aerospace_mode aerospace_mode_change

