#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# -- Claude Dark theme (Zed port style) --
# Active workspace: couleur thematique par space
# Inactive workspace: $GREY muted

SPACE_ICONS=(
  "󰋜"           # 1: Home (nerd font)
  ":music:"      # 2: Music
  ":zed:"        # 3: Zed
  "󰖟"           # 4: Helium (nerd font globe)
  ":discord:"    # 5: Chat
  "󰆼"           # 6: DB (nerd font database)
  ":obsidian:"   # 7: Obsidian
  ":claude:"     # 8: Claude AI
)

SPACE_FONTS=(
  "$FONT:Bold:15.0"                   # 1 nerd font
  "sketchybar-app-font:Regular:14.0"  # 2
  "sketchybar-app-font:Regular:14.0"  # 3
  "$FONT:Bold:14.0"                   # 4 nerd font
  "sketchybar-app-font:Regular:14.0"  # 5
  "$FONT:Bold:17.0"                   # 6 nerd font
  "sketchybar-app-font:Regular:14.0"  # 7
  "sketchybar-app-font:Regular:14.0"  # 8
)

SPACE_LABELS=(
  "Home"
  "Music"
  "Zed"
  "Helium"
  "Chat"
  "DB"
  "Obsidian"
  "Claude"
)

# Couleurs par workspace (palette claude dark compatible)
SPACE_COLORS=(
  "$BLUE"       # 1: Home
  "$RED"        # 2: Music
  "$GREEN"      # 3: Zed
  "$MAGENTA"    # 4: Helium
  "$PEACH"      # 5: Chat
  "$YELLOW"     # 6: DB
  "$CYAN"       # 7: Obsidian
  "$ORANGE"     # 8: Claude
)

sid=0
for i in "${!SPACE_ICONS[@]}"
do
  sid=$(($i+1))

  space=(
    icon="${SPACE_ICONS[i]}"
    icon.font="${SPACE_FONTS[i]}"
    icon.padding_left=8
    icon.padding_right=8
    icon.color=$GREY
    icon.highlight_color="${SPACE_COLORS[i]}"

    label="${SPACE_LABELS[i]}"
    label.font="$FONT:Semibold:10.0"
    label.padding_left=8
    label.padding_right=8
    label.color=$WHITE
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
    updates=on
  )

  sketchybar --add item space.$sid left \
             --set space.$sid "${space[@]}" \
             --subscribe space.$sid \
               aerospace_workspace_change \
               mouse.entered \
               mouse.exited \
               mouse.clicked
done

# Bracket englobant tous les workspaces
spaces_bracket=(
  background.color=$BAR_COLOR
  background.border_color=$HIGHLIGHT_COLOR
  background.border_width=1
  background.corner_radius=9
  background.height=28
  background.drawing=on
  background.padding_left=4
  background.padding_right=4
)

sketchybar --add bracket spaces '/space\..*/' \
           --set spaces "${spaces_bracket[@]}"
