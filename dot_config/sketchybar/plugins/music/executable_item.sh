#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Bracket pour grouper tous les éléments
music_bracket=(
  background.color=$BACKGROUND_1
  background.border_color=$BACKGROUND_2
  background.border_width=2
  background.corner_radius=9
  background.height=25
  background.drawing=on
  padding_right=10
)

# Bouton Previous
music_prev=(
  icon="􀊉"
  icon.font="$FONT:Bold:12.0"
  icon.color=$MAGENTA
  icon.padding_left=6
  icon.padding_right=0
  label.drawing=off
  background.drawing=off
  script="$PLUGIN_DIR/music_controls.sh"
  drawing=off
)

# Bouton Play/Pause
music_play=(
  icon="􀊄"
  icon.font="$FONT:Bold:14.0"
  icon.color=$MAGENTA
  icon.padding_left=0
  icon.padding_right=2
  label.drawing=off
  background.drawing=off
  script="$PLUGIN_DIR/music_controls.sh"
  drawing=off
)

# Bouton Next
music_next=(
  icon="􀊋"
  icon.font="$FONT:Bold:12.0"
  icon.color=$MAGENTA
  icon.padding_left=0
  icon.padding_right=6
  label.drawing=off
  background.drawing=off
  script="$PLUGIN_DIR/music_controls.sh"
  drawing=off
)

# Infos musique (titre - artiste)
music=(
  script="$PLUGIN_DIR/music.sh"
  update_freq=5

  icon.drawing=off

  # Label (titre - artiste)
  label="♫ No Music"
  label.font="$FONT:Semibold:11.0"
  label.color=$WHITE
  label.max_chars=35
  label.padding_left=0
  label.padding_right=0
  label.scroll_texts=on

  background.drawing=off

  # Updates
  updates=on
  drawing=off

  # Positioning
  padding_left=5
  padding_right=10
)

sketchybar --add item music right \
           --set music "${music[@]}" \
           --subscribe music \
             media_change \
             mouse.entered \
             mouse.exited \
           \
           --add item music_next right \
           --set music_next "${music_next[@]}" \
           --subscribe music_next \
             media_change \
             mouse.clicked \
           \
           --add item music_play right \
           --set music_play "${music_play[@]}" \
           --subscribe music_play \
             media_change \
             mouse.clicked \
           \
           --add item music_prev right \
           --set music_prev "${music_prev[@]}" \
           --subscribe music_prev \
             media_change \
             mouse.clicked \
           \
           --add bracket music_bracket \
             music_prev \
             music_play \
             music_next \
             music \
           --set music_bracket "${music_bracket[@]}"
