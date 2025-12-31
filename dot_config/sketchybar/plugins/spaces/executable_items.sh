#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

SPACE_ICONS=(":mail:" ":postman:" ":zed:" ":arc:" ":messages:" ":orbstack:")

# AeroSpace integration - hybrid items with FIXED dimensions
# Only background.drawing and icon.color change between states

sid=0
spaces=()
for i in "${!SPACE_ICONS[@]}"
do
  sid=$(($i+1))
  # Stop at 6 workspaces for AZERTY configuration (1,2,3,Q,W,E)
  if [ $sid -gt 6 ]; then
    break
  fi

  # Create items with ALL properties fixed from the start
  space=(
    icon="${SPACE_ICONS[i]}"
    icon.font="sketchybar-app-font:Regular:16.0"
    icon.padding_left=7
    icon.padding_right=6
    icon.color=0xffcad3f5  # Default unselected color
    icon.highlight_color=$MAGENTA
    padding_left=1
    padding_right=0
    width=30  # Fixed width for all states
    label.drawing=off
    background.drawing=off  # Default off
    background.color=0xffc6a0f6
    background.corner_radius=11
    background.height=22
    background.padding_left=0  # No background padding
    background.padding_right=0  # No background padding
    drawing=on
    script="$PLUGIN_DIR/spaces/handler.sh"
    click_script="SID=$sid $PLUGIN_DIR/spaces/handler.sh click"
    update_freq=1
  )

  sketchybar --add item aerospace_space.$sid left    \
             --set aerospace_space.$sid "${space[@]}" \
             --subscribe aerospace_space.$sid aerospace_workspace_change
done

# Add the bracket around all aerospace spaces (same as original)
spaces=(
  background.color=$BACKGROUND_1
  background.border_color=$BACKGROUND_2
  background.border_width=2
  background.drawing=on
)

separator=(
  icon=$SEPARATOR
  icon.font="$FONT:Heavy:16.0"
  padding_left=15
  padding_right=15
  label.drawing=off
  associated_display=active
  click_script='echo "AeroSpace workspaces: 1=Mail 2=Postman 3=Code 4=Arc(Q) 5=Slack(W) 6=Database(E)"'
  icon.color=$WHITE
)

sketchybar --add bracket aerospace_spaces '/aerospace_space\..*/' \
           --set aerospace_spaces "${spaces[@]}"        \
                                              \
           --add item separator left          \
           --set separator "${separator[@]}"

# Add automatic workspace monitoring for focus updates
sketchybar --add item aerospace_monitor left \
           --set aerospace_monitor \
                 icon.drawing=off \
                 label.drawing=off \
                 width=0 \
                 script="$PLUGIN_DIR/spaces/handler.sh monitor" \
                 update_freq=0.2

# Subscribe monitor to workspace changes
sketchybar --subscribe aerospace_monitor aerospace_workspace_change

# Initial workspace highlighting
"$PLUGIN_DIR/spaces/handler.sh" monitor

# Trigger initial update to highlight current workspace
sketchybar --trigger aerospace_workspace_change