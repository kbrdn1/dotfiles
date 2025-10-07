#!/bin/bash

# AeroSpace Focus Updater for SketchyBar
# Updates workspace highlighting based on currently focused workspace

update_focus() {
    # Get current focused workspace from AeroSpace
    FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
    
    # Update all workspace items (1-6)
    for i in {1..6}; do
        if [ "$i" = "$FOCUSED_WORKSPACE" ]; then
            # Highlight the focused workspace
            sketchybar --set aerospace_space.$i icon.highlight=on
        else
            # Remove highlight from non-focused workspaces
            sketchybar --set aerospace_space.$i icon.highlight=off
        fi
    done
}

# Store last workspace to detect changes
LAST_WORKSPACE_FILE="/tmp/sketchybar_aerospace_last_workspace"

monitor_changes() {
    CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
    
    if [ -f "$LAST_WORKSPACE_FILE" ]; then
        LAST_WORKSPACE=$(cat "$LAST_WORKSPACE_FILE")
    else
        LAST_WORKSPACE=""
    fi
    
    # Update if workspace changed
    if [ "$CURRENT_WORKSPACE" != "$LAST_WORKSPACE" ]; then
        echo "$CURRENT_WORKSPACE" > "$LAST_WORKSPACE_FILE"
        update_focus
    fi
}

# Handle different calls
case "${1:-update}" in
    "monitor")
        monitor_changes
        ;;
    "update"|*)
        update_focus
        ;;
esac