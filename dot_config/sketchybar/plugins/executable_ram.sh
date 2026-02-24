#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- Claude Dark theme (Zed port style) --
# Graph style matching CPU module

ram_top=(
  label.font="$FONT:Semibold:7"
  label=RAM
  label.color=$GREY
  icon.drawing=off
  width=0
  padding_right=10
  y_offset=6
)

ram_percent=(
  label.font="$FONT:Heavy:10"
  label="0%"
  label.color=$WHITE
  y_offset=-4
  padding_left=0
  padding_right=10
  width=40
  icon.drawing=off
  script="$PLUGIN_DIR/ram_usage.sh"
  update_freq=4
  updates=on
)

ram_graph=(
  graph.color=$MAGENTA
  graph.fill_color=$MAGENTA
  label.drawing=off
  icon.drawing=off
  background.height=20
  background.drawing=on
  background.color=$TRANSPARENT
)

sketchybar --add item ram.top right               \
           --set ram.top "${ram_top[@]}"           \
                                                   \
           --add item ram.percent right            \
           --set ram.percent "${ram_percent[@]}"   \
                                                   \
           --add graph ram.graph right 35          \
           --set ram.graph "${ram_graph[@]}"
