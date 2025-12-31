#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

FRONT_APP_SCRIPT='sketchybar --set $NAME label="$INFO"'

# Get focused window information from AeroSpace
FOCUSED_WINDOW=$(aerospace list-windows --focused --format "%{app-name}|%{window-id}" 2>/dev/null)
APP_NAME=$(echo "$FOCUSED_WINDOW" | cut -d'|' -f1)
WINDOW_ID=$(echo "$FOCUSED_WINDOW" | cut -d'|' -f2)

# Determine window state based on app and context
if [[ -z "$WINDOW_ID" || -z "$APP_NAME" ]]; then
  # No window focused
  ICON_AEROSPACE=$AEROSPACE_TILED
elif [[ "$APP_NAME" =~ ^(Keynote|PowerPoint|VLC|IINA|QuickTime Player|Photos|Preview)$ ]]; then
  # Apps that commonly go fullscreen
  ICON_AEROSPACE=$AEROSPACE_FULLSCREEN
elif [[ "$APP_NAME" =~ ^(Calculator|Activity Monitor|System Preferences|System Settings|Finder|TextEdit)$ ]]; then
  # Apps that are often floating/small windows
  ICON_AEROSPACE=$AEROSPACE_FLOATING
else
  # Default to tiled (AeroSpace's primary mode)
  ICON_AEROSPACE=$AEROSPACE_TILED
fi

# Set icon color based on state
if [[ "$ICON_AEROSPACE" == "$AEROSPACE_FULLSCREEN" ]]; then
  ICON_COLOR=$RED
elif [[ "$ICON_AEROSPACE" == "$AEROSPACE_FLOATING" ]]; then
  ICON_COLOR=$BLUE
else
  ICON_COLOR=$ORANGE
fi

aerospace_indicator=(
  script="$PLUGIN_DIR/aerospace_window_state.sh"
  icon.font="$FONT:Bold:16.0"
  label.drawing=off
  icon.width=30
  icon=$ICON_AEROSPACE
  icon.color=$ICON_COLOR
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

sketchybar --add event aerospace_workspace_change \
           --add event window_focus              \
           --add item aerospace_window_state left \
           --set aerospace_window_state "${aerospace_indicator[@]}" \
           --subscribe aerospace_window_state aerospace_workspace_change \
                                            window_focus \
                                            front_app_switched \
                                            mouse.clicked \
                                               \
           --add item front_app left           \
           --set front_app "${front_app[@]}"   \
           --subscribe front_app front_app_switched