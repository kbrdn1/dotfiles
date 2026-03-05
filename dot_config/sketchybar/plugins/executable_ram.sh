#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- RAM module with 3 graphs: active, wired, compressed --
# Same layout as CPU (sys/user)

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

ram_compressed=(
  width=0
  graph.color=$BLUE
  graph.fill_color=$BLUE
  label.drawing=off
  icon.drawing=off
  background.height=20
  background.drawing=on
  background.color=$TRANSPARENT
)

ram_wired=(
  width=0
  graph.color=$ORANGE
  graph.fill_color=$ORANGE
  label.drawing=off
  icon.drawing=off
  background.height=20
  background.drawing=on
  background.color=$TRANSPARENT
)

ram_active=(
  graph.color=$MAGENTA
  graph.fill_color=$MAGENTA
  label.drawing=off
  icon.drawing=off
  background.height=20
  background.drawing=on
  background.color=$TRANSPARENT
)

sketchybar --add item ram.top right                    \
           --set ram.top "${ram_top[@]}"                \
                                                        \
           --add item ram.percent right                 \
           --set ram.percent "${ram_percent[@]}"        \
                                                        \
           --add graph ram.compressed right 50          \
           --set ram.compressed "${ram_compressed[@]}"  \
                                                        \
           --add graph ram.wired right 50               \
           --set ram.wired "${ram_wired[@]}"            \
                                                        \
           --add graph ram.active right 50              \
           --set ram.active "${ram_active[@]}"
