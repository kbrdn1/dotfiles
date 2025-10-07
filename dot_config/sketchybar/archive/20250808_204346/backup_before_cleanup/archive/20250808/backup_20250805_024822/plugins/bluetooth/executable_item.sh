#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

bluetooth_alias=(
	icon.drawing=on
	alias.color="$PEACH"
	background.padding_right=0
	align=right
	click_script="$PLUGIN_DIR/bluetooth/actions/click.sh"
	script="$PLUGIN_DIR/bluetooth/bluetooth.sh"
	popup.height=30
	update_freq=1
)

bluetooth_details=(
	background.corner_radius=12
	background.padding_left=5
	background.padding_right=10
)

sketchybar --add alias  "Control Center,Bluetooth" right                                    \
           --rename     "Control Center,Bluetooth" bluetooth.alias                          \
           --set        bluetooth.alias  "${bluetooth_alias[@]}"                            \
           --subscribe  bluetooth.alias  mouse.entered                                      \
                                         mouse.exited                                       \
                                         mouse.exited.global                                \
                                                                                            \
            --add       item              bluetooth.paired.details popup.bluetooth.alias    \
            --set       bluetooth.paired.details "${bluetooth_details[@]}"                  \
                                          click_script="sketchybar --set bluetooth.paired.details popup.drawing=toggle" \
                                                                                            \
            --add       item              bluetooth.connected.details popup.bluetooth.alias \
            --set       bluetooth.connected.details "${bluetooth_details[@]}"               \
                                          click_script="sketchybar --set bluetooth.connected.details popup.drawing=toggle" \
                                                                                            \
            --add       item              bluetooth.recent.details popup.bluetooth.alias    \
            --set       bluetooth.recent.details "${bluetooth_details[@]}"                  \
                                          click_script="sketchybar --set bluetooth.recent.details popup.drawing=toggle"