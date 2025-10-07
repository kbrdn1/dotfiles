#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │              Plugin AeroSpace Moderne pour SketchyBar       │
# │           Support workspaces 1,2,3,Q,W,E (1,2,3,4,5,6)     │
# ╰─────────────────────────────────────────────────────────────╯

# Couleurs modernes (Catppuccin Mocha)
ACTIVE_COLOR="0xffa6e3a1"      # Green - workspace actif
INACTIVE_COLOR="0xff6c7086"     # Subtext0 - workspace inactif
OCCUPIED_COLOR="0xff89b4fa"     # Blue - workspace avec apps
URGENT_COLOR="0xfff38ba8"       # Red - notifications
TEXT_COLOR="0xffcdd6f4"         # Text
BACKGROUND_ACTIVE="0xff313244"  # Surface0
BACKGROUND_INACTIVE="0x00000000" # Transparent

# Configuration workspaces
declare -A WORKSPACE_ICONS=(
    ["1"]="󰇮"   # Mail/Calendar
    ["2"]="󰖟"   # Postman/Tests  
    ["3"]="󰨞"   # Code/Terminal
    ["4"]="󰖟"   # Arc Browser (Q)
    ["5"]="󰭻"   # Communication (W)
    ["6"]="󰆼"   # Database/Docker (E)
)

declare -A WORKSPACE_NAMES=(
    ["1"]="Mail"
    ["2"]="Postman"
    ["3"]="Code"
    ["4"]="Arc"
    ["5"]="Slack"
    ["6"]="Database"
)

declare -A WORKSPACE_KEYS=(
    ["1"]="1"
    ["2"]="2"
    ["3"]="3"
    ["4"]="q"
    ["5"]="w"
    ["6"]="e"
)

# Fonction pour obtenir les apps dans un workspace
get_workspace_apps() {
    local workspace=$1
    local apps=""
    
    # Obtenir la liste des fenêtres dans ce workspace
    local windows=$(aerospace list-windows --workspace "$workspace" 2>/dev/null)
    
    if [[ -n "$windows" ]]; then
        # Extraire les noms d'apps uniques (3ème colonne)
        apps=$(echo "$windows" | awk '{print $3}' | sort -u | head -5)
    fi
    
    echo "$apps"
}

# Fonction pour mapper les noms d'apps vers des icônes
get_app_icon() {
    local app="$1"
    case "$app" in
        "Mail" | "Microsoft Outlook") echo "󰇮" ;;
        "Arc" | "Google Chrome" | "Safari") echo "󰖟" ;;
        "Zed" | "Visual Studio Code" | "Xcode") echo "󰨞" ;;
        "Ghostty" | "iTerm2" | "Terminal") echo "󰆍" ;;
        "Slack") echo "󰒱" ;;
        "Discord") echo "󰙯" ;;
        "Postman" | "Insomnia") echo "󰖟" ;;
        "TablePlus") echo "󰆼" ;;
        "OrbStack" | "Docker Desktop") echo "󰡨" ;;
        "Finder") echo "󰀶" ;;
        "System Preferences" | "System Settings") echo "󰒓" ;;
        *) echo "󰘔" ;;
    esac
}

# Fonction principale de mise à jour
update_workspaces() {
    # Obtenir le workspace actuellement focusé
    local current_workspace=$(aerospace list-workspaces --focused 2>/dev/null)
    
    # Obtenir tous les workspaces disponibles
    local all_workspaces=$(aerospace list-workspaces --all 2>/dev/null)
    
    # Mettre à jour chaque workspace
    for workspace in 1 2 3 4 5 6; do
        local icon="${WORKSPACE_ICONS[$workspace]}"
        local name="${WORKSPACE_NAMES[$workspace]}"
        local key="${WORKSPACE_KEYS[$workspace]}"
        
        # Vérifier si ce workspace existe et a des fenêtres
        local apps=$(get_workspace_apps "$workspace")
        local app_count=$(echo "$apps" | wc -w)
        
        # Construire la représentation des apps
        local app_icons=""
        if [[ $app_count -gt 0 ]]; then
            while IFS= read -r app; do
                if [[ -n "$app" ]]; then
                    app_icons+="$(get_app_icon "$app") "
                fi
            done <<< "$apps"
            app_icons=${app_icons% } # Retirer le dernier espace
        fi
        
        # Déterminer l'état visuel
        local icon_color="$INACTIVE_COLOR"
        local label_color="$INACTIVE_COLOR"
        local bg_color="$BACKGROUND_INACTIVE"
        local bg_drawing="off"
        
        if [[ "$workspace" == "$current_workspace" ]]; then
            # Workspace actif
            icon_color="$ACTIVE_COLOR"
            label_color="$ACTIVE_COLOR"
            bg_color="$BACKGROUND_ACTIVE"
            bg_drawing="on"
        elif [[ $app_count -gt 0 ]]; then
            # Workspace occupé
            icon_color="$OCCUPIED_COLOR"
            label_color="$TEXT_COLOR"
        fi
        
        # Construire le label final
        local label="$name"
        if [[ -n "$app_icons" ]]; then
            label="$name │ $app_icons"
        fi
        
        # Mettre à jour l'élément SketchyBar
        sketchybar --set "workspace.$workspace" \
            icon="$icon" \
            icon.color="$icon_color" \
            label="$label" \
            label.color="$label_color" \
            background.color="$bg_color" \
            background.drawing="$bg_drawing"
    done
}

# Fonction pour gérer les clics
handle_click() {
    local workspace="$1"
    if [[ -n "$workspace" ]] && [[ "$workspace" =~ ^[1-6]$ ]]; then
        aerospace workspace "$workspace" 2>/dev/null
        sleep 0.1
        update_workspaces
    fi
}

# Fonction pour gérer les changements de focus
handle_focus_change() {
    update_workspaces
}

# Fonction pour obtenir des informations de debug
debug_info() {
    echo "🔧 AeroSpace Debug Info:"
    echo "Current workspace: $(aerospace list-workspaces --focused 2>/dev/null)"
    echo "All workspaces: $(aerospace list-workspaces --all 2>/dev/null)"
    echo "Focused window: $(aerospace list-windows --focused 2>/dev/null)"
    echo ""
}

# Gestion des événements
case "$SENDER" in
    "aerospace_workspace_change")
        update_workspaces
        ;;
    "workspace_change")
        update_workspaces
        ;;
    "window_focus") 
        handle_focus_change
        ;;
    "mouse.clicked")
        # Extraire le numéro du workspace depuis le nom de l'élément
        workspace_num=$(echo "$NAME" | grep -o '[1-6]')
        handle_click "$workspace_num"
        ;;
    "forced"|"routine")
        update_workspaces
        ;;
    "debug")
        debug_info
        ;;
    *)
        # Mise à jour par défaut
        update_workspaces
        ;;
esac

exit 0