#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │              Plugin AeroSpace Fix pour Sketchybar           │
# │                    Version Simplifiée                       │
# ╰─────────────────────────────────────────────────────────────╯

# Couleurs Catppuccin Mocha
ACTIVE="0xffa6e3a1"      # Green - workspace actif
INACTIVE="0xff6c7086"    # Gray - workspace inactif  
OCCUPIED="0xff89b4fa"    # Blue - workspace avec apps
TEXT="0xffcdd6f4"        # Text color

# Configuration des workspaces
declare -A WORKSPACE_ICONS=(
    [1]="󰇮"   # Mail
    [2]="󰖟"   # Postman
    [3]="󰨞"   # Code
    [4]="󰖟"   # Arc (Q)
    [5]="󰭻"   # Slack (W)
    [6]="󰆼"   # Database (E)
)

declare -A WORKSPACE_NAMES=(
    [1]="Mail"
    [2]="Postman"
    [3]="Code"
    [4]="Arc"
    [5]="Slack"
    [6]="Database"
)

# Fonction pour obtenir le workspace actuel
get_current_workspace() {
    aerospace list-workspaces --focused 2>/dev/null || echo "1"
}

# Fonction pour vérifier si un workspace a des fenêtres
workspace_has_windows() {
    local workspace=$1
    local count=$(aerospace list-windows --workspace "$workspace" 2>/dev/null | wc -l)
    [[ $count -gt 0 ]]
}

# Fonction pour mettre à jour tous les workspaces
update_all_workspaces() {
    local current=$(get_current_workspace)
    
    # Debug
    echo "Current workspace: $current" >> /tmp/aerospace-debug.log
    
    for ws in 1 2 3 4 5 6; do
        local icon="${WORKSPACE_ICONS[$ws]}"
        local name="${WORKSPACE_NAMES[$ws]}"
        local color="$INACTIVE"
        local bg_color="0x00000000"  # Transparent
        local bg_drawing="off"
        
        # Déterminer l'état du workspace
        if [[ "$ws" == "$current" ]]; then
            # Workspace actif
            color="$ACTIVE"
            bg_color="0xff313244"
            bg_drawing="on"
        elif workspace_has_windows "$ws"; then
            # Workspace occupé
            color="$OCCUPIED"
        fi
        
        # Mettre à jour l'élément
        sketchybar --set "workspace.$ws" \
            icon="$icon" \
            icon.color="$color" \
            label="$name" \
            label.color="$color" \
            background.color="$bg_color" \
            background.drawing="$bg_drawing" \
            2>/dev/null || true
            
        echo "Updated workspace $ws: color=$color, current=$current" >> /tmp/aerospace-debug.log
    done
}

# Fonction pour gérer les clics
handle_click() {
    if [[ -n "$NAME" ]]; then
        # Extraire le numéro du workspace depuis le nom de l'item
        local workspace=$(echo "$NAME" | grep -o '[1-6]' | head -1)
        if [[ -n "$workspace" ]]; then
            echo "Clicking workspace: $workspace" >> /tmp/aerospace-debug.log
            aerospace workspace "$workspace" 2>/dev/null || true
            sleep 0.1
            update_all_workspaces
        fi
    fi
}

# Fonction de debug
debug_info() {
    echo "=== AeroSpace Debug $(date) ===" >> /tmp/aerospace-debug.log
    echo "Current workspace: $(get_current_workspace)" >> /tmp/aerospace-debug.log
    echo "All workspaces: $(aerospace list-workspaces --all 2>/dev/null)" >> /tmp/aerospace-debug.log
    echo "SENDER: $SENDER" >> /tmp/aerospace-debug.log
    echo "NAME: $NAME" >> /tmp/aerospace-debug.log
    echo "===============================" >> /tmp/aerospace-debug.log
}

# Initialisation au premier lancement
init_workspaces() {
    echo "Initializing workspaces..." >> /tmp/aerospace-debug.log
    update_all_workspaces
}

# Gestion des événements
case "$SENDER" in
    "aerospace_workspace_change")
        debug_info
        update_all_workspaces
        ;;
    "workspace_change")
        debug_info  
        update_all_workspaces
        ;;
    "mouse.clicked")
        debug_info
        handle_click
        ;;
    "routine"|"forced"|"")
        debug_info
        update_all_workspaces
        ;;
    *)
        debug_info
        update_all_workspaces
        ;;
esac

exit 0