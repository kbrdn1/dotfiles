#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │                  Plugin DateTime Moderne                    │
# │            Date et Heure pour SketchyBar                    │
# ╰─────────────────────────────────────────────────────────────╯

# Couleurs modernes (Catppuccin Mocha)
ACTIVE_COLOR="0xffa6e3a1"      # Green - actif
ACCENT_COLOR="0xff89b4fa"      # Blue - accent  
TEXT_COLOR="0xffcdd6f4"        # Text principal
MUTED_COLOR="0xff6c7086"       # Subtext0
YELLOW_COLOR="0xfff9e2af"     # Yellow - jour
PURPLE_COLOR="0xffcba6f7"     # Mauve - soir
ORANGE_COLOR="0xfffab387"     # Peach - matin

# Fonction pour obtenir l'icône selon l'heure
get_time_icon() {
    local hour=$(date +%H)
    local hour_num=$((10#$hour))  # Forcer l'interprétation décimale
    
    if [[ $hour_num -ge 6 && $hour_num -lt 12 ]]; then
        echo "󰖙"  # Matin (6h-12h)
    elif [[ $hour_num -ge 12 && $hour_num -lt 18 ]]; then
        echo "󰖜"  # Après-midi (12h-18h)
    elif [[ $hour_num -ge 18 && $hour_num -lt 22 ]]; then
        echo "󰖛"  # Soirée (18h-22h)
    else
        echo "󰖔"  # Nuit (22h-6h)
    fi
}

# Fonction pour obtenir la couleur selon l'heure
get_time_color() {
    local hour=$(date +%H)
    local hour_num=$((10#$hour))
    
    if [[ $hour_num -ge 6 && $hour_num -lt 12 ]]; then
        echo "$ORANGE_COLOR"  # Matin
    elif [[ $hour_num -ge 12 && $hour_num -lt 18 ]]; then
        echo "$YELLOW_COLOR"  # Après-midi
    elif [[ $hour_num -ge 18 && $hour_num -lt 22 ]]; then
        echo "$PURPLE_COLOR"  # Soirée
    else
        echo "$ACCENT_COLOR"  # Nuit
    fi
}

# Fonction pour obtenir l'icône du jour de la semaine
get_day_icon() {
    local day=$(date +%u)  # 1=Lundi, 7=Dimanche
    
    case $day in
        1) echo "󰨞" ;;  # Lundi - début de semaine active
        2|3|4) echo "󰀪" ;;  # Mardi-Jeudi - semaine active
        5) echo "󰓎" ;;  # Vendredi - fin de semaine
        6|7) echo "󰽰" ;;  # Weekend
    esac
}

# Fonction pour formater la date en français
get_french_date() {
    local day_num=$(date +%d)
    local month_num=$(date +%m)
    local day_name=$(date +%A)
    local month_name=$(date +%B)
    
    # Traduction des jours (optionnel)
    case $(date +%u) in
        1) day_fr="Lun" ;;
        2) day_fr="Mar" ;;
        3) day_fr="Mer" ;;
        4) day_fr="Jeu" ;;
        5) day_fr="Ven" ;;
        6) day_fr="Sam" ;;
        7) day_fr="Dim" ;;
    esac
    
    # Traduction des mois (optionnel)
    case $month_num in
        01) month_fr="Jan" ;;
        02) month_fr="Fév" ;;
        03) month_fr="Mar" ;;
        04) month_fr="Avr" ;;
        05) month_fr="Mai" ;;
        06) month_fr="Juin" ;;
        07) month_fr="Juil" ;;
        08) month_fr="Août" ;;
        09) month_fr="Sep" ;;
        10) month_fr="Oct" ;;
        11) month_fr="Nov" ;;
        12) month_fr="Déc" ;;
    esac
    
    echo "$day_fr $day_num $month_fr"
}

# Fonction principale
update_datetime() {
    local current_time=$(date +"%H:%M")
    local current_date=$(get_french_date)
    local time_icon=$(get_time_icon)
    local time_color=$(get_time_color)
    local day_icon=$(get_day_icon)
    
    # Format avec icônes et couleurs
    local datetime_label="$current_time │ $current_date"
    
    # Version compacte pour économiser l'espace
    local datetime_compact="$current_time"
    
    # Déterminer si on affiche la version complète ou compacte
    # Vous pouvez ajuster cette logique selon vos préférences
    local show_full=true
    
    if [[ "$show_full" == true ]]; then
        label_text="$datetime_label"
    else
        label_text="$datetime_compact"
    fi
    
    # Mettre à jour SketchyBar
    sketchybar --set "$NAME" \
        icon="$time_icon" \
        icon.color="$time_color" \
        label="$label_text" \
        label.color="$TEXT_COLOR"
}

# Fonction pour basculer entre format court/long
toggle_format() {
    # Cette fonction pourrait être utilisée pour basculer l'affichage
    # via un clic sur l'élément
    update_datetime
}

# Fonction de debug
debug_datetime() {
    echo "🔧 DateTime Debug Info:"
    echo "Current time: $(date +"%H:%M:%S")"
    echo "Current date: $(date +"%Y-%m-%d")"
    echo "French date: $(get_french_date)"
    echo "Hour: $(date +%H) -> Icon: $(get_time_icon), Color: $(get_time_color)"
    echo "Day of week: $(date +%u) -> Icon: $(get_day_icon)"
}

# Gestion des événements
case "$SENDER" in
    "routine"|"forced")
        update_datetime
        ;;
    "mouse.clicked")
        toggle_format
        ;;
    "debug")
        debug_datetime
        ;;
    *)
        update_datetime
        ;;
esac

exit 0