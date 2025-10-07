#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │                    Plugin CPU Moderne                       │
# │              Monitoring CPU pour SketchyBar                 │
# ╰─────────────────────────────────────────────────────────────╯

# Couleurs modernes (Catppuccin Mocha)
GREEN="0xffa6e3a1"      # Faible utilisation (< 30%)
YELLOW="0xfff9e2af"     # Utilisation modérée (30-70%)
RED="0xfff38ba8"        # Forte utilisation (> 70%)
TEXT_COLOR="0xffcdd6f4"
MUTED_COLOR="0xff6c7086"

# Fonction pour obtenir l'utilisation CPU
get_cpu_usage() {
    # Utilise iostat pour obtenir l'utilisation CPU
    cpu_usage=$(iostat -c 1 2 | tail -n +4 | head -1 | awk '{print 100 - $6}' 2>/dev/null)
    
    # Fallback avec top si iostat échoue
    if [[ -z "$cpu_usage" ]] || [[ "$cpu_usage" == "100" ]]; then
        cpu_usage=$(top -l 1 -s 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' 2>/dev/null)
    fi
    
    # Fallback final avec ps
    if [[ -z "$cpu_usage" ]]; then
        cpu_usage=$(ps -A -o %cpu | awk '{s+=$1} END {printf "%.1f", s}' 2>/dev/null)
    fi
    
    # Assurer qu'on a une valeur numérique valide
    if [[ ! "$cpu_usage" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        cpu_usage="0.0"
    fi
    
    echo "$cpu_usage"
}

# Fonction pour obtenir l'icône selon l'utilisation
get_cpu_icon() {
    local usage=$1
    
    if (( $(echo "$usage < 25" | bc -l) )); then
        echo "󰘚"  # CPU calme
    elif (( $(echo "$usage < 50" | bc -l) )); then
        echo "󰓅"  # CPU modéré
    elif (( $(echo "$usage < 75" | bc -l) )); then
        echo "󰀪"  # CPU actif
    else
        echo "󰀫"  # CPU intense
    fi
}

# Fonction pour obtenir la couleur selon l'utilisation
get_cpu_color() {
    local usage=$1
    
    if (( $(echo "$usage < 30" | bc -l) )); then
        echo "$GREEN"
    elif (( $(echo "$usage < 70" | bc -l) )); then
        echo "$YELLOW"
    else
        echo "$RED"
    fi
}

# Fonction principale
update_cpu() {
    local cpu_usage=$(get_cpu_usage)
    local cpu_icon=$(get_cpu_icon "$cpu_usage")
    local cpu_color=$(get_cpu_color "$cpu_usage")
    
    # Formater l'affichage
    local cpu_formatted=$(printf "%.1f%%" "$cpu_usage")
    
    # Mettre à jour SketchyBar
    sketchybar --set "$NAME" \
        icon="$cpu_icon" \
        icon.color="$cpu_color" \
        label="$cpu_formatted" \
        label.color="$TEXT_COLOR"
}

# Gestion des événements
case "$SENDER" in
    "routine"|"forced")
        update_cpu
        ;;
    *)
        update_cpu
        ;;
esac

exit 0