#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │                    Plugin RAM Moderne                       │
# │              Monitoring RAM pour SketchyBar                 │
# ╰─────────────────────────────────────────────────────────────╯

# Couleurs modernes (Catppuccin Mocha)
GREEN="0xffa6e3a1"      # Faible utilisation (< 60%)
YELLOW="0xfff9e2af"     # Utilisation modérée (60-80%)
RED="0xfff38ba8"        # Forte utilisation (> 80%)
TEXT_COLOR="0xffcdd6f4"
MUTED_COLOR="0xff6c7086"

# Fonction pour obtenir l'utilisation RAM
get_ram_usage() {
    # Utiliser vm_stat pour obtenir les statistiques mémoire
    local vm_stat=$(vm_stat)
    
    # Extraire les valeurs (pages de 4KB chacune)
    local pages_free=$(echo "$vm_stat" | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
    local pages_active=$(echo "$vm_stat" | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
    local pages_inactive=$(echo "$vm_stat" | grep "Pages inactive" | awk '{print $3}' | sed 's/\.//')
    local pages_speculative=$(echo "$vm_stat" | grep "Pages speculative" | awk '{print $3}' | sed 's/\.//')
    local pages_wired=$(echo "$vm_stat" | grep "Pages wired down" | awk '{print $4}' | sed 's/\.//')
    local pages_compressed=$(echo "$vm_stat" | grep "Pages occupied by compressor" | awk '{print $5}' | sed 's/\.//')
    
    # Convertir en MB (pages * 4KB / 1024)
    local page_size=4096
    local mb_divisor=1048576  # 1024*1024
    
    local ram_free=$(( (pages_free + pages_speculative) * page_size / mb_divisor ))
    local ram_used=$(( (pages_active + pages_inactive + pages_wired + pages_compressed) * page_size / mb_divisor ))
    local ram_total=$(( ram_free + ram_used ))
    
    # Calculer le pourcentage d'utilisation
    local ram_percentage=0
    if [[ $ram_total -gt 0 ]]; then
        ram_percentage=$(( (ram_used * 100) / ram_total ))
    fi
    
    echo "$ram_percentage:$ram_used:$ram_total"
}

# Fonction pour obtenir l'icône selon l'utilisation
get_ram_icon() {
    local usage=$1
    
    if [[ $usage -lt 40 ]]; then
        echo "󰍛"  # RAM faible
    elif [[ $usage -lt 70 ]]; then
        echo "󰍜"  # RAM modérée
    elif [[ $usage -lt 85 ]]; then
        echo "󰍝"  # RAM élevée
    else
        echo "󰍞"  # RAM critique
    fi
}

# Fonction pour obtenir la couleur selon l'utilisation
get_ram_color() {
    local usage=$1
    
    if [[ $usage -lt 60 ]]; then
        echo "$GREEN"
    elif [[ $usage -lt 80 ]]; then
        echo "$YELLOW"
    else
        echo "$RED"
    fi
}

# Fonction pour formater la taille en unités lisibles
format_size() {
    local size_mb=$1
    
    if [[ $size_mb -lt 1024 ]]; then
        echo "${size_mb}M"
    else
        local size_gb=$(( size_mb / 1024 ))
        local remainder=$(( (size_mb * 10 / 1024) % 10 ))
        if [[ $remainder -eq 0 ]]; then
            echo "${size_gb}G"
        else
            echo "${size_gb}.${remainder}G"
        fi
    fi
}

# Fonction principale
update_ram() {
    local ram_info=$(get_ram_usage)
    local ram_percentage=$(echo "$ram_info" | cut -d: -f1)
    local ram_used=$(echo "$ram_info" | cut -d: -f2)
    local ram_total=$(echo "$ram_info" | cut -d: -f3)
    
    local ram_icon=$(get_ram_icon "$ram_percentage")
    local ram_color=$(get_ram_color "$ram_percentage")
    
    # Formater l'affichage
    local ram_used_formatted=$(format_size "$ram_used")
    local ram_total_formatted=$(format_size "$ram_total")
    local ram_label="${ram_used_formatted}/${ram_total_formatted} (${ram_percentage}%)"
    
    # Version courte pour économiser l'espace
    local ram_label_short="${ram_percentage}% (${ram_used_formatted})"
    
    # Mettre à jour SketchyBar
    sketchybar --set "$NAME" \
        icon="$ram_icon" \
        icon.color="$ram_color" \
        label="$ram_label_short" \
        label.color="$TEXT_COLOR"
}

# Fonction de debug
debug_ram() {
    echo "🔧 RAM Debug Info:"
    vm_stat | head -10
    echo ""
    local ram_info=$(get_ram_usage)
    echo "Parsed: $ram_info"
}

# Gestion des événements
case "$SENDER" in
    "routine"|"forced")
        update_ram
        ;;
    "debug")
        debug_ram
        ;;
    *)
        update_ram
        ;;
esac

exit 0