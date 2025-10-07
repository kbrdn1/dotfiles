#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

SPACE_ICONS=("󰇮" "󰖟" "󰨞" "󰖟" "󰭻" "󰆼")
SPACE_LABELS=("Mail" "Postman" "Code" "Arc" "Slack" "Database")
SPACE_KEYS=("1" "2" "3" "Q" "W" "E")

# Destroy space on right click, focus space on left click.
# Note: AeroSpace has static workspaces, so right-click won't destroy

sid=0
spaces=()
for i in "${!SPACE_ICONS[@]}"
do
  sid=$(($i+1))
  # Stop at 6 workspaces for our AZERTY configuration (1,2,3,Q,W,E)
  if [ $sid -gt 6 ]; then
    break
  fi

  space=(
    associated_space=$sid
    icon=${SPACE_ICONS[i]}
    label=${SPACE_LABELS[i]}
    icon.padding_left=8
    icon.padding_right=4
    padding_left=2
    padding_right=2
    label.padding_right=12
    label.padding_left=4
    icon.highlight_color=$MAGENTA
    label.font="sketchybar-app-font:Regular:12.0"
    label.background.height=24
    label.background.drawing=on
    label.background.color=$BACKGROUND_2
    label.background.corner_radius=6
    label.drawing=on
    script="$PLUGIN_DIR/aerospace/spaces.sh"
    click_script="aerospace workspace $sid"
  )

  sketchybar --add space space.$sid left    \
             --set space.$sid "${space[@]}" \
             --subscribe space.$sid mouse.clicked aerospace_workspace_change
done

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
  click_script='echo "AeroSpace workspaces: 1=Mail 2=Postman 3=Code Q=Arc W=Slack E=Database"'
  icon.color=$WHITE
)

sketchybar --add bracket spaces '/space\..*/' \
           --set spaces "${spaces[@]}"        \
                                              \
           --add item separator left          \
           --set separator "${separator[@]}"