#!/bin/bash

update() {
  # Get media info from macOS Now Playing
  PLAYER_STATE="$(echo "$INFO" | jq -r '.state' 2>/dev/null)"
  TRACK_TITLE="$(echo "$INFO" | jq -r '.title' 2>/dev/null)"
  TRACK_ARTIST="$(echo "$INFO" | jq -r '.artist' 2>/dev/null)"
  TRACK_ALBUM="$(echo "$INFO" | jq -r '.album' 2>/dev/null)"

  # Fallback si jq n'est pas disponible ou INFO est vide
  if [ -z "$PLAYER_STATE" ] || [ "$PLAYER_STATE" = "null" ]; then
    # Vérifier si Music.app ou Spotify tourne
    MUSIC_RUNNING=$(pgrep -x "Music" || pgrep -x "Spotify")

    if [ -n "$MUSIC_RUNNING" ]; then
      PLAYER_STATE=$(osascript -e 'tell application "Music" to get player state as string' 2>/dev/null || echo "stopped")
      TRACK_TITLE=$(osascript -e 'tell application "Music" to get name of current track' 2>/dev/null)
      TRACK_ARTIST=$(osascript -e 'tell application "Music" to get artist of current track' 2>/dev/null)
      TRACK_ALBUM=$(osascript -e 'tell application "Music" to get album of current track' 2>/dev/null)
    else
      PLAYER_STATE="stopped"
    fi
  fi

  # Formater le label
  if [ -n "$TRACK_TITLE" ] && [ "$TRACK_TITLE" != "null" ]; then
    if [ -n "$TRACK_ARTIST" ] && [ "$TRACK_ARTIST" != "null" ]; then
      CURRENT_SONG="$TRACK_TITLE - $TRACK_ARTIST"
    else
      CURRENT_SONG="$TRACK_TITLE"
    fi
  else
    CURRENT_SONG=""
  fi

  # Icônes selon l'état du lecteur
  if [ "$PLAYER_STATE" = "playing" ]; then
    ICON="􀊆 "  # play.fill avec espace
    DRAWING=on
  elif [ "$PLAYER_STATE" = "paused" ]; then
    ICON="􀊄 "  # music.note avec espace
    DRAWING=on
  else
    ICON="􀊄 "  # music.note avec espace
    DRAWING=off
    CURRENT_SONG=""
  fi

  # Animation fluide
  sketchybar --animate sin 10 \
             --set "$NAME" \
             label="$CURRENT_SONG" \
             icon="$ICON" \
             drawing="$DRAWING"
}

mouse_clicked() {
  case "$BUTTON" in
    "left")
      # Play/Pause
      osascript -e 'tell application "Music" to playpause' 2>/dev/null || \
      osascript -e 'tell application "Spotify" to playpause' 2>/dev/null
      ;;
    "right")
      # Next track
      osascript -e 'tell application "Music" to next track' 2>/dev/null || \
      osascript -e 'tell application "Spotify" to next track' 2>/dev/null
      ;;
    "middle")
      # Previous track
      osascript -e 'tell application "Music" to previous track' 2>/dev/null || \
      osascript -e 'tell application "Spotify" to previous track' 2>/dev/null
      ;;
  esac

  # Force update après action
  sleep 0.3
  update
}

mouse_entered() {
  # Récupérer les infos actuelles pour le survol
  MUSIC_RUNNING=$(pgrep -x "Music" || pgrep -x "Spotify")

  if [ -n "$MUSIC_RUNNING" ]; then
    PLAYER_STATE=$(osascript -e 'tell application "Music" to get player state as string' 2>/dev/null || echo "stopped")

    if [ "$PLAYER_STATE" = "playing" ] || [ "$PLAYER_STATE" = "paused" ]; then
      TRACK_TITLE=$(osascript -e 'tell application "Music" to get name of current track' 2>/dev/null)
      TRACK_ARTIST=$(osascript -e 'tell application "Music" to get artist of current track' 2>/dev/null)
      TRACK_ALBUM=$(osascript -e 'tell application "Music" to get album of current track' 2>/dev/null)

      # Construire le label de base
      if [ -n "$TRACK_TITLE" ] && [ "$TRACK_TITLE" != "null" ]; then
        if [ -n "$TRACK_ARTIST" ] && [ "$TRACK_ARTIST" != "null" ]; then
          CURRENT_LABEL="$TRACK_TITLE - $TRACK_ARTIST"
        else
          CURRENT_LABEL="$TRACK_TITLE"
        fi
      else
        CURRENT_LABEL=""
      fi

      # Ajouter l'album au survol si disponible
      if [ -n "$TRACK_ALBUM" ] && [ "$TRACK_ALBUM" != "null" ] && [ -n "$CURRENT_LABEL" ]; then
        HOVER_LABEL="$CURRENT_LABEL • $TRACK_ALBUM"
      else
        HOVER_LABEL="$CURRENT_LABEL"
      fi

      sketchybar --animate sin 8 --set "$NAME" label="$HOVER_LABEL"
    fi
  fi
}

mouse_exited() {
  # Récupérer les infos actuelles pour revenir à l'état normal
  MUSIC_RUNNING=$(pgrep -x "Music" || pgrep -x "Spotify")

  if [ -n "$MUSIC_RUNNING" ]; then
    PLAYER_STATE=$(osascript -e 'tell application "Music" to get player state as string' 2>/dev/null || echo "stopped")

    if [ "$PLAYER_STATE" = "playing" ] || [ "$PLAYER_STATE" = "paused" ]; then
      TRACK_TITLE=$(osascript -e 'tell application "Music" to get name of current track' 2>/dev/null)
      TRACK_ARTIST=$(osascript -e 'tell application "Music" to get artist of current track' 2>/dev/null)

      # Construire le label normal (sans album)
      if [ -n "$TRACK_TITLE" ] && [ "$TRACK_TITLE" != "null" ]; then
        if [ -n "$TRACK_ARTIST" ] && [ "$TRACK_ARTIST" != "null" ]; then
          NORMAL_LABEL="$TRACK_TITLE - $TRACK_ARTIST"
        else
          NORMAL_LABEL="$TRACK_TITLE"
        fi
      else
        NORMAL_LABEL=""
      fi

      sketchybar --animate sin 8 --set "$NAME" label="$NORMAL_LABEL"
    fi
  fi
}

case "$SENDER" in
  "media_change") update ;;
  "mouse.clicked") mouse_clicked ;;
  "mouse.entered") mouse_entered ;;
  "mouse.exited") mouse_exited ;;
  *) update ;;
esac
