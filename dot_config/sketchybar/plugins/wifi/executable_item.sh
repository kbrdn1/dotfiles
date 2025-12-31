#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

POPUP_OFF="sketchybar --set wifi popup.drawing=off"

wifi=(
  "${menu_defaults[@]}"
  icon.padding_right=0
  label.drawing=off
  popup.align=left
  update_freq=5
  script="$PLUGIN_DIR/wifi/wifi.sh"
  --subscribe wifi wifi_change \
                   mouse.clicked \
                   mouse.exited \
                   mouse.exited.global \
                   mouse.entered \
                   forced \
                   routine
)

sketchybar --add item wifi right \
           --set wifi "${wifi[@]}" \
           --add item wifi.ssid popup.wifi \
           --set wifi.ssid icon=$WIFI_INFO \
                           label="SSID" \
                           "${menu_item_defaults[@]}" \
                           click_script="open 'x-apple.systempreferences:com.apple.preference.network?Wi-Fi';$POPUP_OFF" \
           --add item wifi.ipaddress popup.wifi \
           --set wifi.ipaddress icon=$WIFI_IP \
                               label="IP Address" \
                               "${menu_item_defaults[@]}" \
                               click_script="echo \"$IP_ADDRESS\" | pbcopy; $POPUP_OFF"
