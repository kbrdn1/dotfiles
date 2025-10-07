#!/bin/bash

# AeroSpace Workspace Integration for Sketchybar
# This script creates and manages workspace display items that integrate with AeroSpace

# Load configuration
source "$HOME/.config/sketchybar/settings/settings.sh" 2>/dev/null || true
source "$HOME/.config/sketchybar/settings/colors.sh" 2>/dev/null || true
source "$HOME/.config/sketchybar/settings/icons.sh" 2>/dev/null || true

# Fallback colors if settings not loaded
BACKGROUND_1=${BACKGROUND_1:-0xff24273a}
BACKGROUND_2=${BACKGROUND_2:-0x90494d64}
MAGENTA=${MAGENTA:-0xffc6a0f6}
WHITE=${WHITE:-0xffcad3f5}
SEPARATOR=${SEPARATOR:-"｜"}
FONT=${FONT:-"SF Pro"}

# Workspace configuration
SPACE_ICONS=("󰇮" "󰖟" "󰨞" "󰖟" "󰭻" "󰆼")
SPACE_LABELS=("Mail" "Postman" "Code" "Arc" "Slack" "Database")

# Initialize workspaces
setup_workspaces() {
    echo "Setting up AeroSpace workspaces..."
    
    # Remove existing workspace items
    for i in {1..6}; do
        sketchybar --remove workspace.$i 2>/dev/null || true
    done
    sketchybar --remove workspaces 2>/dev/null || true
    sketchybar --remove workspace_separator 2>/dev/null || true
    
    # Create workspace items
    for i in {1..6}; do
        sketchybar --add item workspace.$i left \
                   --set workspace.$i \
                         icon="${SPACE_ICONS[$((i-1))]}" \
                         label="${SPACE_LABELS[$((i-1))]}" \
                         icon.font="$FONT:Bold:14.0" \
                         icon.color=$WHITE \
                         icon.padding_left=8 \
                         icon.padding_right=4 \
                         label.font="sketchybar-app-font:Regular:12.0" \
                         label.color=$WHITE \
                         label.padding_left=4 \
                         label.padding_right=12 \
                         label.background.height=24 \
                         label.background.drawing=on \
                         label.background.color=$BACKGROUND_2 \
                         label.background.corner_radius=6 \
                         padding_left=2 \
                         padding_right=2 \
                         click_script="$0 click $i" \
                         script="$0"
    done
    
    # Create bracket around workspaces
    sketchybar --add bracket workspaces '/workspace\..*/' \
               --set workspaces background.color=$BACKGROUND_1 \
                              background.border_color=$BACKGROUND_2 \
                              background.border_width=2 \
                              background.corner_radius=9 \
                              background.drawing=on
    
    # Add separator
    sketchybar --add item workspace_separator left \
               --set workspace_separator icon="$SEPARATOR" \
                                       icon.font="$FONT:Heavy:16.0" \
                                       icon.color=$WHITE \
                                       padding_left=15 \
                                       padding_right=15 \
                                       label.drawing=off \
                                       click_script='echo "AeroSpace: 1=Mail 2=Postman 3=Code 4=Arc(Q) 5=Slack(W) 6=Database(E)"'
    
    # Add custom event for workspace changes
    sketchybar --add event aerospace_workspace_change 2>/dev/null || true
    
    # Subscribe all workspaces to the event
    for i in {1..6}; do
        sketchybar --subscribe workspace.$i aerospace_workspace_change
    done
    
    # Initial update
    update_workspaces
}

# Update workspace appearance based on current focus
update_workspaces() {
    # Get current focused workspace from AeroSpace
    FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
    
    # Update each workspace
    for i in {1..6}; do
        if [ "$i" = "$FOCUSED_WORKSPACE" ]; then
            # Highlight focused workspace
            sketchybar --set workspace.$i \
                             icon.highlight_color=$MAGENTA \
                             icon.highlight=on \
                             label.width=0
        else
            # Normal appearance for unfocused workspaces
            sketchybar --set workspace.$i \
                             icon.highlight=off \
                             label.width=dynamic
        fi
    done
}

# Handle workspace clicks
handle_click() {
    WORKSPACE_ID=$1
    if [ -n "$WORKSPACE_ID" ] && [ "$WORKSPACE_ID" -ge 1 ] && [ "$WORKSPACE_ID" -le 6 ]; then
        echo "Switching to workspace $WORKSPACE_ID"
        aerospace workspace $WORKSPACE_ID 2>/dev/null
        
        # Trigger update after a brief delay to ensure AeroSpace has switched
        sleep 0.1
        sketchybar --trigger aerospace_workspace_change
    fi
}

# Monitor AeroSpace for workspace changes
monitor_aerospace() {
    # This function can be called periodically to check for workspace changes
    CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
    
    # Store the last known workspace to detect changes
    LAST_WORKSPACE_FILE="/tmp/sketchybar_aerospace_workspace"
    
    if [ -f "$LAST_WORKSPACE_FILE" ]; then
        LAST_WORKSPACE=$(cat "$LAST_WORKSPACE_FILE")
    else
        LAST_WORKSPACE=""
    fi
    
    # If workspace changed, update display
    if [ "$CURRENT_WORKSPACE" != "$LAST_WORKSPACE" ]; then
        echo "$CURRENT_WORKSPACE" > "$LAST_WORKSPACE_FILE"
        update_workspaces
    fi
}

# Main script logic
case "${1:-}" in
    "setup")
        setup_workspaces
        ;;
    "update")
        update_workspaces
        ;;
    "click")
        handle_click "$2"
        ;;
    "monitor")
        monitor_aerospace
        ;;
    "aerospace_workspace_change"|"forced")
        update_workspaces
        ;;
    *)
        # Default behavior when called as script for workspace items
        case "$SENDER" in
            "aerospace_workspace_change"|"forced")
                update_workspaces
                ;;
            *)
                update_workspaces
                ;;
        esac
        ;;
esac