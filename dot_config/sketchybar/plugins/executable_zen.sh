#!/bin/bash

# ════════════════════════════════════════════════════════════════════
# Zen Mode - Affiche uniquement les informations essentielles
# ════════════════════════════════════════════════════════════════════
# En mode zen, seuls ces éléments restent visibles :
#   • Date et heure (calendar)
#   • Application courante (front_app)
#   • Espaces de travail (space.1-6 + spaces bracket)
#   • Icône fenêtre courante (aerospace_icon)
# ════════════════════════════════════════════════════════════════════

zen_on() {
  sketchybar \
    --set apple.logo drawing=off \
    --set apple.prefs drawing=off \
    --set apple.activity drawing=off \
    --set apple.lock drawing=off \
    --set aerospace_switcher drawing=off \
    --set aerospace_separator drawing=off \
    --set brew drawing=off \
    --set battery drawing=off \
    --set wifi drawing=off \
    --set bluetooth drawing=off \
    --set github.bell drawing=off \
    --set volume_icon drawing=off \
    --set music.play drawing=off \
    --set music.cover drawing=off \
    --set '/cpu.*/' drawing=off \
    --set svim drawing=off
}

zen_off() {
  sketchybar \
    --set apple.logo drawing=on \
    --set apple.prefs drawing=on \
    --set apple.activity drawing=on \
    --set apple.lock drawing=on \
    --set aerospace_switcher drawing=on \
    --set aerospace_separator drawing=on \
    --set brew drawing=on \
    --set battery drawing=on \
    --set wifi drawing=on \
    --set bluetooth drawing=on \
    --set github.bell drawing=on \
    --set volume_icon drawing=on \
    --set music.play drawing=on \
    --set music.cover drawing=on \
    --set '/cpu.*/' drawing=on \
    --set svim drawing=on
}

# Toggle ou activation explicite
if [ "$1" = "on" ]; then
  zen_on
elif [ "$1" = "off" ]; then
  zen_off
else
  # Toggle automatique basé sur l'état actuel
  if [ "$(sketchybar --query apple.logo | jq -r ".geometry.drawing")" = "on" ]; then
    zen_on
  else
    zen_off
  fi
fi

