#!/bin/bash

# Window Status Indicator for AeroSpace + SketchyBar
# Changes icon and color based on focused window state

# Colors for different states
COLOR_TILED="0xff94e2d5"      # Teal - for tiled windows
COLOR_FLOATING="0xff89b4fa"   # Blue - for floating windows  
COLOR_FULLSCREEN="0xfff38ba8" # Red - for fullscreen windows
COLOR_NO_WINDOW="0xff6c7086"  # Gray - no window focused

# Icons for different states
ICON_TILED="󰙀"      # Grid/tiled layout
ICON_FLOATING="󰕰"   # Floating window
ICON_FULLSCREEN="󰝘" # Fullscreen
ICON_NO_WINDOW="󱗼"  # Empty/no window

update_window_status() {
    # Get focused window information from AeroSpace
    FOCUSED_WINDOW=$(aerospace list-windows --focused --format "%{window-id}" 2>/dev/null)
    
    if [ -z "$FOCUSED_WINDOW" ] || [ "$FOCUSED_WINDOW" = "" ]; then
        # No window focused
        sketchybar --set window_status \
                   icon="$ICON_NO_WINDOW" \
                   icon.color="$COLOR_NO_WINDOW"
        return
    fi
    
    # Get window state information
    WINDOW_INFO=$(aerospace list-windows --focused --format "%{window-id}|%{app-name}" 2>/dev/null)
    
    # Check if window is in fullscreen mode
    # Note: AeroSpace doesn't have direct fullscreen detection, so we'll use app patterns
    APP_NAME=$(echo "$WINDOW_INFO" | cut -d'|' -f2)
    
    # Check for fullscreen apps (common patterns)
    case "$APP_NAME" in
        "Keynote"|"PowerPoint"|"VLC"|"IINA"|"QuickTime Player"|"Photos")
            # Likely fullscreen apps
            sketchybar --set window_status \
                       icon="$ICON_FULLSCREEN" \
                       icon.color="$COLOR_FULLSCREEN"
            ;;
        *)
            # Check if window is floating vs tiled
            # AeroSpace primarily uses tiling, so most windows will be tiled
            # We can check window position/size to determine if it's likely floating
            
            # For now, assume most windows are tiled in AeroSpace
            # In future versions, we could add more sophisticated detection
            sketchybar --set window_status \
                       icon="$ICON_TILED" \
                       icon.color="$COLOR_TILED"
            ;;
    esac
}

# Handle mouse clicks for additional functionality
mouse_clicked() {
    if [ "$BUTTON" = "right" ]; then
        # Right click: show window info
        WINDOW_INFO=$(aerospace list-windows --focused --format "App: %{app-name} | Workspace: %{workspace}" 2>/dev/null)
        if [ -n "$WINDOW_INFO" ]; then
            echo "$WINDOW_INFO"
        else
            echo "No window focused"
        fi
    else
        # Left click: cycle through layout modes (if needed)
        # For now, just show current state
        update_window_status
    fi
}

# Handle different events
case "$SENDER" in
    "mouse.clicked")
        mouse_clicked
        ;;
    "aerospace_workspace_change"|"window_focus"|"front_app_switched"|"forced"|*)
        update_window_status
        ;;
esac