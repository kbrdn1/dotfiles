#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

render_bar_item() {
	if [ "$BLUETOOTH_STATUS" = "off" ]; then
		args+=(--set "$NAME" icon="$BLUETOOTH_OFF" alias.color="$RED")
	else
		args+=(--set "$NAME" icon="$BLUETOOTH" alias.color="$GREEN")
	fi

	if [ "$PAIRED" = "" ]; then
		args+=(--set "$NAME" label.drawing=on)
	else
		args+=(--set "$NAME" label="$COUNT_PAIRED" label.drawing=off)
	fi

	sketchybar -m "${args[@]}"
}

add_paired_header() {
	bluetooth_details=(
		label="$(echo -e 'Paired Devices')"
		label.align=left
		icon=$PAIR
		icon.drawing=on
		click_script="sketchybar --set bluetooth.paired.details popup.drawing=toggle"
	)

	sketchybar -m --set bluetooth.paired.details "${bluetooth_details[@]}"
}

add_connected_header() {
	bluetooth_details=(
		label="$(echo -e 'Connected Devices')"
		label.align=left
		icon=$CONNECT
		icon.drawing=on
		click_script="sketchybar --set bluetooth.connected.details popup.drawing=toggle"
	)

	sketchybar -m --set bluetooth.connected.details "${bluetooth_details[@]}"
}

add_recent_header() {
	bluetooth_details=(
		label="$(echo -e 'Recent Devices')"
		label.align=left
		icon=$IRECENT
		icon.drawing=on
		click_script="sketchybar --set bluetooth.recent.details popup.drawing=toggle"
	)

	sketchybar -m --set bluetooth.recent.details "${bluetooth_details[@]}"
}

render_popup() {
	add_paired_header
	COUNTER=0

	if [ "$COUNT_PAIRED" -lt "$PREV_COUNT" ]; then
		sketchybar -m --remove '/bluetooth.device\.*/'
	fi

	while IFS= read -r device; do

		if [ "$COUNT_PAIRED" -gt "$PREV_COUNT" ]; then
			sketchybar -m --add item bluetooth.device."$COUNTER" popup.bluetooth.paired.details
		fi

		if [ "$COUNT_PAIRED" -lt "$PREV_COUNT" ]; then
			sketchybar -m --remove bluetooth.device."$COUNTER"
		fi

		ICON_LEFT=$BLUETOOTH

		if echo "$device" | grep -q 'AirPods'; then
			ICON_LEFT=$AIRPODS
		elif echo "$device" | grep -q 'Magic Keyboard'; then
			ICON_LEFT=$MAGIC_KEYBOARD
		elif echo "$device" | grep -q 'Magic Trackpad'; then
			ICON_LEFT=$MAGIC_TRACKPAD
		elif echo "$device" | grep -q 'MacBook'; then
			ICON_LEFT=$MACBOOK
		elif echo "$device" | grep -q 'Mac mini'; then
			ICON_LEFT=$MAC_MINI
		elif echo "$device" | grep -q 'Mac Pro'; then
			ICON_LEFT=$MACPRO
		elif echo "$device" | grep -q 'iMac'; then
			ICON_LEFT=$IMAC
		elif echo "$device" | grep -q 'Magic Mouse'; then
			ICON_LEFT=$MAGIC_MOUSE
		elif echo "$device" | grep -q 'iPhone\|iK'; then
			ICON_LEFT=$IPHONE
		elif echo "$device" | grep -q 'iPad'; then
			ICON_LEFT=$IPAD
		elif echo "$device" | grep -q 'Watch'; then
			ICON_LEFT=$WATCH
		else
			ICON_LEFT=$BLUETOOTH
		fi

		if [ "$COUNT_PAIRED" -gt "$PREV_COUNT" ]; then
      bluetooth_device=(
        label="$(echo "$device" | grep -Eo '".*."' | tr -d '"')"
        label.align=right
        icon="$ICON_LEFT"
        icon.drawing=on
        click_script="sketchybar --set $NAME connect_device $COUNTER;sketchybar --set $NAME popup.drawing=off"
      )

      sketchybar -m --set bluetooth.device."$COUNTER" "${bluetooth_device[@]}"
    fi

		COUNTER=$((COUNTER + 1))

	done <<<"$(echo -e "$PAIRED")"

	add_connected_header
	COUNTER=0

	while IFS= read -r device; do

		if [ "$COUNT_CONNECTED" -gt "$PREV_COUNT" ]; then
			sketchybar -m --add item bluetooth.connected.device."$COUNTER" popup.bluetooth.connected.details
		fi

		if [ "$COUNT_CONNECTED" -lt "$PREV_COUNT" ]; then
			sketchybar -m --remove bluetooth.connected.device."$COUNTER"
		fi

		ICON_LEFT=$BLUETOOTH

		if echo "$device" | grep -q 'AirPods'; then
			ICON_LEFT=$AIRPODS
		elif echo "$device" | grep -q 'Magic Keyboard'; then
			ICON_LEFT=$MAGIC_KEYBOARD
		elif echo "$device" | grep -q 'Magic Trackpad'; then
			ICON_LEFT=$MAGIC_TRACKPAD
		elif echo "$device" | grep -q 'MacBook'; then
			ICON_LEFT=$MACBOOK
		elif echo "$device" | grep -q 'Mac mini'; then
			ICON_LEFT=$MAC_MINI
		elif echo "$device" | grep -q 'Mac Pro'; then
			ICON_LEFT=$MACPRO
		elif echo "$device" | grep -q 'iMac'; then
			ICON_LEFT=$IMAC
		elif echo "$device" | grep -q 'Magic Mouse'; then
			ICON_LEFT=$MAGIC_MOUSE
		elif echo "$device" | grep -q 'iPhone\|iK'; then
			ICON_LEFT=$IPHONE
		elif echo "$device" | grep -q 'iPad'; then
			ICON_LEFT=$IPAD
		elif echo "$device" | grep -q 'Watch'; then
			ICON_LEFT=$WATCH
		else
			ICON_LEFT=$BLUETOOTH
		fi

		if [ "$COUNT_CONNECTED" -gt "$PREV_COUNT" ]; then
      bluetooth_device=(
        label="$(echo "$device" | grep -Eo '".*."' | tr -d '"')"
        label.align=right
        icon="$ICON_LEFT"
        icon.drawing=on
        click_script="sketchybar --set $NAME connect_device $COUNTER;sketchybar --set $NAME popup.drawing=off"
      )

      sketchybar -m --set bluetooth.connected.device."$COUNTER" "${bluetooth_device[@]}"
    fi

		COUNTER=$((COUNTER + 1))

	done <<<"$(echo -e "$CONNECTED")"

	add_recent_header
	COUNTER=0

	while IFS= read -r device; do

		if [ "$COUNT_RECENT" -gt "$PREV_COUNT" ]; then
			sketchybar -m --add item bluetooth.recent.device."$COUNTER" popup.bluetooth.recent.details
		fi

		if [ "$COUNT_RECENT" -lt "$PREV_COUNT" ]; then
			sketchybar -m --remove bluetooth.recent.device."$COUNTER"
		fi

		ICON_LEFT=$BLUETOOTH

		if echo "$device" | grep -q 'AirPods'; then
			ICON_LEFT=$AIRPODS
		elif echo "$device" | grep -q 'Magic Keyboard'; then
			ICON_LEFT=$MAGIC_KEYBOARD
		elif echo "$device" | grep -q 'Magic Trackpad'; then
			ICON_LEFT=$MAGIC_TRACKPAD
		elif echo "$device" | grep -q 'MacBook'; then
			ICON_LEFT=$MACBOOK
		elif echo "$device" | grep -q 'Mac mini'; then
			ICON_LEFT=$MAC_MINI
		elif echo "$device" | grep -q 'Mac Pro'; then
			ICON_LEFT=$MACPRO
		elif echo "$device" | grep -q 'iMac'; then
			ICON_LEFT=$IMAC
		elif echo "$device" | grep -q 'Magic Mouse'; then
			ICON_LEFT=$MAGIC_MOUSE
		elif echo "$device" | grep -q 'iPhone\|iK'; then
			ICON_LEFT=$IPHONE
		elif echo "$device" | grep -q 'iPad'; then
			ICON_LEFT=$IPAD
		elif echo "$device" | grep -q 'Watch'; then
			ICON_LEFT=$WATCH
		else
			ICON_LEFT=$BLUETOOTH
		fi

		if [ "$COUNT_RECENT" -gt "$PREV_COUNT" ]; then
      bluetooth_device=(
        label="$(echo "$device" | grep -Eo '".*."' | tr -d '"')"
        label.align=right
        icon="$ICON_LEFT"
        icon.drawing=on
        click_script="sketchybar --set $NAME connect_device $COUNTER;sketchybar --set $NAME popup.drawing=off"
      )

      sketchybar -m --set bluetooth.recent.device."$COUNTER" "${bluetooth_device[@]}"
    fi

		COUNTER=$((COUNTER + 1))

	done <<<"$(echo -e "$RECENT")"
}

update() {
	args=()

	BLUETOOTH_STATUS="$(blueutil --power)"
	PAIRED="$(blueutil --paired)"
	CONNECTED="$(blueutil --connected)"
	RECENT="$(blueutil --recent)"
	COUNT_PAIRED="$(echo "$PAIRED" | grep "^.*$" -c)"
	COUNT_CONNECTED="$(echo "$CONNECTED" | grep "^.*$" -c)"
	COUNT_RECENT="$(echo "$RECENT" | grep "^.*$" -c)"
	PREV_COUNT=$(sketchybar --query bluetooth.alias | jq -r .popup.items | grep ".device*" -c)

	render_bar_item
	render_popup

	if [ "$COUNT_PAIRED" -ne "$PREV_COUNT" ] 2>/dev/null || [ "$SENDER" = "forced" ]; then
		sketchybar --animate tanh 15 --set "$NAME" label.y_offset=5 label.y_offset=0
	fi
}

popup() {
	sketchybar --set "$NAME" popup.drawing="$1"
}

connect_device() {
	DEVICE_ID=$1
	blueutil --connect "$DEVICE_ID"
}

case "$SENDER" in
"routine" | "forced")
	update
	;;
"mouse.entered")
	popup on
	;;
"mouse.exited" | "mouse.exited.global")
	popup off
	;;
"mouse.clicked")
	popup toggle
	;;
esac