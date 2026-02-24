#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Single unified script for all music items
MUSIC_SCRIPT="$PLUGIN_DIR/music.sh"

# -- Claude Dark theme (Zed port style) --
# No separate bracket - music items join the status bracket

# Previous button
music_prev=(
  icon="􀊉"
  icon.font="$FONT:Bold:12.0"
  icon.color=$GREY
  icon.highlight_color=$ORANGE
  icon.padding_left=6
  icon.padding_right=0
  label.drawing=off
  background.drawing=off
  script="$MUSIC_SCRIPT"
  drawing=off
)

# Play/Pause button
music_play=(
  icon="􀊄"
  icon.font="$FONT:Bold:14.0"
  icon.color=$ORANGE
  icon.padding_left=0
  icon.padding_right=2
  label.drawing=off
  background.drawing=off
  script="$MUSIC_SCRIPT"
  drawing=off
)

# Next button
music_next=(
  icon="􀊋"
  icon.font="$FONT:Bold:12.0"
  icon.color=$GREY
  icon.highlight_color=$ORANGE
  icon.padding_left=0
  icon.padding_right=6
  label.drawing=off
  background.drawing=off
  script="$MUSIC_SCRIPT"
  drawing=off
)

# Track info (title - artist)
music=(
  script="$MUSIC_SCRIPT"
  update_freq=3

  icon.drawing=off

  label="♫ No Music"
  label.font="$FONT:Semibold:11.0"
  label.color=$WHITE
  label.max_chars=35
  label.padding_left=0
  label.padding_right=0

  background.drawing=off

  updates=on
  drawing=off

  padding_left=3
  padding_right=5
)

sketchybar --add item music right \
           --set music "${music[@]}" \
           --subscribe music \
             media_change \
             mouse.entered \
             mouse.exited \
             mouse.clicked \
           \
           --add item music_next right \
           --set music_next "${music_next[@]}" \
           --subscribe music_next \
             mouse.clicked \
           \
           --add item music_play right \
           --set music_play "${music_play[@]}" \
           --subscribe music_play \
             mouse.clicked \
           \
           --add item music_prev right \
           --set music_prev "${music_prev[@]}" \
           --subscribe music_prev \
             mouse.clicked
