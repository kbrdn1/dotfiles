#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

SPACE_ICONS=("󰇮" "󰖟" "󰨞" "󰖟" "󰭻" "󰆼")
SPACE_LABELS=("Mail" "Postman" "Code" "Arc" "Slack" "Database")

# Create workspace items (not spaces)
for i in {1..6}; do
    sketchybar --add item workspace.$i left \
               --set workspace.$i \
                     icon="${SPACE_ICONS[$((i-1))]}" \
                     label="${SPACE_LABELS[$((i-1))]}" \
                     icon.padding_left=8 \
                     icon.padding_right=4 \
                     padding_left=2 \
                     padding_right=2 \
                     label.padding_right=12 \
                     label.padding_left=4 \
                     label.font="sketchybar-app-font:Regular:12.0" \
                     label.background.height=24 \
                     label.background.drawing=on \
                     label.background.color=$BACKGROUND_2 \
                     label.background.corner_radius=6 \
                     label.drawing=on \
                     click_script="aerospace workspace $i && sketchybar --trigger workspace_change" \
               --subscribe workspace.$i workspace_change
done

# Add bracket around all workspaces
sketchybar --add bracket workspaces '/workspace\..*/' \
           --set workspaces background.color=$BACKGROUND_1 \
                          background.border_color=$BACKGROUND_2 \
                          background.border_width=2 \
                          background.drawing=on

# Add separator
sketchybar --add item workspace_separator left \
           --set workspace_separator icon=$SEPARATOR \
                                   icon.font="$FONT:Heavy:16.0" \
                                   padding_left=15 \
                                   padding_right=15 \
                                   label.drawing=off \
                                   icon.color=$WHITE

# Add custom event
sketchybar --add event workspace_change

# Update function to highlight current workspace
update_workspaces() {
    FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
    
    for i in {1..6}; do
        if [ "$i" = "$FOCUSED_WORKSPACE" ]; then
            sketchybar --set workspace.$i icon.highlight_color=$MAGENTA \
                                        icon.highlight=on \
                                        label.width=0
        else
            sketchybar --set workspace.$i icon.highlight=off \
                                        label.width=dynamic
        fi
    done
}

# Handle events
case "$SENDER" in
    "workspace_change")
        update_workspaces
        ;;
esac

# Initial update
update_workspaces