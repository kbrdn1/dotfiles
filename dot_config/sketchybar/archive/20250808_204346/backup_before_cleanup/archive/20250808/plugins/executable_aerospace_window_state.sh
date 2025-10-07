#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

update_window_state() {
    # Get focused window information from AeroSpace
    FOCUSED_WINDOW=$(aerospace list-windows --focused --format "%{app-name}|%{window-id}" 2>/dev/null)
    APP_NAME=$(echo "$FOCUSED_WINDOW" | cut -d'|' -f1)
    WINDOW_ID=$(echo "$FOCUSED_WINDOW" | cut -d'|' -f2)
    
    if [[ -z "$WINDOW_ID" || -z "$APP_NAME" ]]; then
        # No window focused - default tiled state
        ICON=$AEROSPACE_TILED
        COLOR=$ORANGE
    else
        # Determine window state based on app patterns
        case "$APP_NAME" in
            "Keynote"|"PowerPoint"|"VLC"|"IINA"|"QuickTime Player"|"Photos"|"Preview"|"Simulator")
                # Apps that commonly use fullscreen
                ICON=$AEROSPACE_FULLSCREEN
                COLOR=$RED
                ;;
            "Calculator"|"Activity Monitor"|"System Preferences"|"System Settings"|"Finder"|"TextEdit"|"AppStore"|"Font Book")
                # Apps that often appear as floating/dialog windows
                ICON=$AEROSPACE_FLOATING
                COLOR=$BLUE
                ;;
            *)
                # Default to tiled (AeroSpace's primary mode)
                ICON=$AEROSPACE_TILED
                COLOR=$ORANGE
                ;;
        esac
    fi
    
    # Update the indicator
    sketchybar --set $NAME icon=$ICON icon.color=$COLOR
}

mouse_clicked() {
    if [ "$BUTTON" = "right" ]; then
        # Right click: show current window info
        WINDOW_INFO=$(aerospace list-windows --focused --format "App: %{app-name} | Workspace: %{workspace}" 2>/dev/null)
        if [ -n "$WINDOW_INFO" ]; then
            echo "$WINDOW_INFO"
        else
            echo "No window focused"
        fi
    else
        # Left click: cycle layout or refresh state
        update_window_state
    fi
}

case "$SENDER" in
    "mouse.clicked") 
        mouse_clicked
        ;;
    "aerospace_workspace_change"|"window_focus"|"front_app_switched"|"forced"|*)
        update_window_state
        ;;
esac