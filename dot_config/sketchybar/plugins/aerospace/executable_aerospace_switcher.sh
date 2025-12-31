#!/bin/bash

# ════════════════════════════════════════════════════════════════════
# AeroSpace Config Switcher Plugin
# ════════════════════════════════════════════════════════════════════
# Permet de basculer entre deux configurations AeroSpace :
# - Configuration sans top padding (outer.top = 8)
# - Configuration avec top padding (outer.top = 44)

AEROSPACE_CONFIG="$HOME/.config/aerospace/aerospace.toml"
STATE_FILE="$HOME/.config/sketchybar/.aerospace_padding_state"

# Initialiser l'état si le fichier n'existe pas
if [ ! -f "$STATE_FILE" ]; then
  # Détecter l'état actuel depuis la config
  if grep -q "^outer.top = 44" "$AEROSPACE_CONFIG"; then
    echo "with_padding" > "$STATE_FILE"
  else
    echo "no_padding" > "$STATE_FILE"
  fi
fi

# Lire l'état actuel
CURRENT_STATE=$(cat "$STATE_FILE")

# Fonction pour basculer la configuration
toggle_config() {
  if [ "$CURRENT_STATE" = "no_padding" ]; then
    # Passer à la configuration avec padding (44)
    sed -i '' 's/^outer.top = 8$/# outer.top = 8/' "$AEROSPACE_CONFIG"
    sed -i '' 's/^# outer.top = 44$/outer.top = 44/' "$AEROSPACE_CONFIG"
    echo "with_padding" > "$STATE_FILE"
    NEW_STATE="with_padding"
  else
    # Passer à la configuration sans padding (8)
    sed -i '' 's/^outer.top = 44$/# outer.top = 44/' "$AEROSPACE_CONFIG"
    sed -i '' 's/^# outer.top = 8$/outer.top = 8/' "$AEROSPACE_CONFIG"
    echo "no_padding" > "$STATE_FILE"
    NEW_STATE="no_padding"
  fi

  # Recharger la configuration AeroSpace
  aerospace reload-config

  # Mettre à jour l'affichage Sketchybar
  update_display "$NEW_STATE"
}

# Fonction pour mettre à jour l'affichage Sketchybar
update_display() {
  local state="$1"

  if [ "$state" = "no_padding" ]; then
    # Mode Macbook (padding 8)
    sketchybar --set aerospace_switcher \
      icon="􀟛"
  else
    # Mode Normal screen (padding 44)
    sketchybar --set aerospace_switcher \
      icon="􀙗"
  fi
}

# Gestion des événements
case "$SENDER" in
  "mouse.clicked")
    toggle_config
    ;;
  *)
    # Initialisation : afficher l'état actuel
    update_display "$CURRENT_STATE"
    ;;
esac
