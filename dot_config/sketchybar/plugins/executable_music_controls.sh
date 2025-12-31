#!/bin/bash

update() {
  # Vérifier si Music ou Spotify tourne
  MUSIC_RUNNING=$(pgrep -x "Music" || pgrep -x "Spotify")

  if [ -n "$MUSIC_RUNNING" ]; then
    PLAYER_STATE=$(osascript -e 'tell application "Music" to get player state as string' 2>/dev/null)

    if [ "$PLAYER_STATE" = "playing" ] || [ "$PLAYER_STATE" = "paused" ]; then
      # Musique disponible - afficher les contrôles

      # Icône play/pause selon l'état
      if [ "$PLAYER_STATE" = "playing" ]; then
        PLAY_ICON="􀊆 "  # play.fill
      else
        PLAY_ICON="􀊄 "  # music.note
      fi

      sketchybar --set music_prev drawing=on \
                 --set music_play icon="$PLAY_ICON" drawing=on \
                 --set music_next drawing=on
    else
      # Pas de musique - cacher les contrôles
      sketchybar --set music_prev drawing=off \
                 --set music_play drawing=off \
                 --set music_next drawing=off
    fi
  else
    # Pas d'app de musique - cacher les contrôles
    sketchybar --set music_prev drawing=off \
               --set music_play drawing=off \
               --set music_next drawing=off
  fi
}

mouse_clicked() {
  case "$NAME" in
    "music_prev")
      # Previous track
      osascript -e 'tell application "Music" to previous track' 2>/dev/null || \
      osascript -e 'tell application "Spotify" to previous track' 2>/dev/null
      ;;
    "music_play")
      # Play/Pause
      osascript -e 'tell application "Music" to playpause' 2>/dev/null || \
      osascript -e 'tell application "Spotify" to playpause' 2>/dev/null
      ;;
    "music_next")
      # Next track
      osascript -e 'tell application "Music" to next track' 2>/dev/null || \
      osascript -e 'tell application "Spotify" to next track' 2>/dev/null
      ;;
  esac

  # Force update après action
  sleep 0.3
  update
}

case "$SENDER" in
  "media_change") update ;;
  "mouse.clicked") mouse_clicked ;;
  *) update ;;
esac
