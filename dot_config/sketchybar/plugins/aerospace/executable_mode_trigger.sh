#!/bin/bash

# Script pour détecter les changements de mode AeroSpace et notifier Sketchybar
# Ce script doit être exécuté en boucle en arrière-plan

LAST_MODE=""

while true; do
  # Récupérer le mode actuel
  CURRENT_MODE=$(aerospace list-modes 2>/dev/null | grep -v "^main$" | head -1)

  # Si le mode a changé, notifier Sketchybar
  if [ "$CURRENT_MODE" != "$LAST_MODE" ]; then
    sketchybar --trigger aerospace_mode_change
    LAST_MODE="$CURRENT_MODE"
  fi

  # Attendre un peu avant la prochaine vérification
  sleep 0.5
done
