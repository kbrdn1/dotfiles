#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Configuration AeroSpace avec icônes des apps (sketchybar-app-font)
SPACE_ICONS=(
  "􀉉"         # 1: Calendar
  ":postman:"   # 2: Postman
  ":zed:"       # 3: Zed
  ":arc:"       # 4: Arc Browser
  "􀌤"         # 5: Slack/Discord
  "􀢾"         # 6: TablePlus/Docker
  ":obsidian:"  # 7: Obsidian
  ":claude:"    # 8: Claude AI
)

SPACE_LABELS=(
  "Mail"
  "API"
  "Code"
  "Arc"
  "Chat"
  "DB"
  "Obsidian"
  "Claude"
)

# Couleurs thématiques par workspace
SPACE_COLORS=(
  "0xff4a90e2"  # Bleu Mail
  "0xffff6b35"  # Orange Postman
  "0xff00d084"  # Vert Code
  "0xffb362ff"  # Violet Arc
  "0xffe91e63"  # Rose Communication
  "0xffffb700"  # Jaune Database
  "0xff9b59b6"  # Mauve Obsidian
  "0xffff9d5c"  # Orange doux Claude AI
)

sid=0
for i in "${!SPACE_ICONS[@]}"
do
  sid=$(($i+1))

  space=(
    icon="${SPACE_ICONS[i]}"
    icon.font="sketchybar-app-font:Regular:14.0"
    icon.padding_left=8
    icon.padding_right=8
    icon.color=$ICON_COLOR
    icon.highlight_color="${SPACE_COLORS[i]}"

    label="${SPACE_LABELS[i]}"
    label.font="$FONT:Semibold:10.0"
    label.padding_left=8
    label.padding_right=8
    label.color=$LABEL_COLOR
    label.background.height=24
    label.background.color="${SPACE_COLORS[i]}"
    label.background.corner_radius=7
    label.background.y_offset=0
    label.background.drawing=off
    label.width=0
    label.y_offset=0

    background.color=$TRANSPARENT
    background.corner_radius=7
    background.height=24
    background.drawing=off

    padding_left=1
    padding_right=1

    script="$PLUGIN_DIR/spaces/spaces.sh"
  )

  sketchybar --add item space.$sid left \
             --set space.$sid "${space[@]}" update_freq=1 \
             --subscribe space.$sid \
               mouse.entered \
               mouse.exited \
               mouse.clicked
done

# Bracket englobant tous les workspaces
spaces_bracket=(
  background.color=$BACKGROUND_1
  background.border_color=$BACKGROUND_2
  background.border_width=2
  background.corner_radius=9
  background.height=28
  background.drawing=on
  background.padding_left=4
  background.padding_right=4
)

sketchybar --add bracket spaces '/space\..*/' \
           --set spaces "${spaces_bracket[@]}"
