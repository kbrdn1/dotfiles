#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings

sketchybar --set $NAME icon="$(date '+%a %d. %b')" label="$(date $TIME_FORMAT)"
