#!/bin/bash

# Kill existing sketchybar
killall sketchybar 2>/dev/null
sleep 1

# Load settings
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$HOME/.config/sketchybar/settings/colors.sh" 
source "$HOME/.config/sketchybar/settings/icons.sh"

# Basic bar setup
sketchybar --bar height=33 \
                 color=0xff1e1e2e \
                 position=top \
                 sticky=on \
                 padding_left=10 \
                 padding_right=10

# Default settings
sketchybar --default updates=when_shown \
                    icon.font="SF Pro:Bold:14.0" \
                    icon.color=0xffcad3f5 \
                    label.font="SF Pro:Semibold:13.0" \
                    label.color=0xffcad3f5

# AeroSpace workspaces as items
SPACE_ICONS=("󰇮" "󰖟" "󰨞" "󰖟" "󰭻" "󰆼")
SPACE_LABELS=("Mail" "Postman" "Code" "Arc" "Slack" "Database")

for i in {1..6}; do
    sketchybar --add item workspace.$i left \
               --set workspace.$i \
                     icon="${SPACE_ICONS[$((i-1))]}" \
                     label="${SPACE_LABELS[$((i-1))]}" \
                     icon.padding_left=8 \
                     icon.padding_right=4 \
                     label.padding_left=4 \
                     label.padding_right=12 \
                     label.background.color=0x90494d64 \
                     label.background.corner_radius=6 \
                     label.background.height=24 \
                     label.background.drawing=on \
                     click_script="aerospace workspace $i"
done

# Get focused workspace and highlight it
FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")

for i in {1..6}; do
    if [ "$i" = "$FOCUSED" ]; then
        sketchybar --set workspace.$i icon.highlight_color=0xffc6a0f6 \
                                    icon.highlight=on \
                                    label.width=0
    else
        sketchybar --set workspace.$i icon.highlight=off \
                                    label.width=dynamic
    fi
done

echo "Simple sketchybar test started with 6 AeroSpace workspaces"