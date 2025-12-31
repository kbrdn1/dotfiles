#!/bin/bash

# SketchyBar Theme Manager
# Themes inspired by Zed Editor color schemes

# Get the directory of this script
THEME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default theme
CURRENT_THEME="${SKETCHYBAR_THEME:-claude-dark}"

# Theme loader function
load_theme() {
  local theme_name="$1"
  
  case "$theme_name" in
    "claude-dark")
      load_claude_dark_theme
      ;;
    "claude-light")
      load_claude_light_theme
      ;;
    "blueberry-dark")
      load_blueberry_dark_theme
      ;;
    "catppuccin")
      load_catppuccin_theme
      ;;
    "duotone-dark")
      load_duotone_dark_theme
      ;;
    "periwinkle-ember")
      load_periwinkle_ember_theme
      ;;
    *)
      echo "Unknown theme: $theme_name"
      echo "Available themes: claude-dark, claude-light, blueberry-dark, catppuccin, duotone-dark, periwinkle-ember"
      load_claude_dark_theme
      ;;
  esac
}

# Claude Dark Theme (Warm, elegant)
load_claude_dark_theme() {
  # Base Colors
  export BLACK=0xff2a2520
  export WHITE=0xffD4C4B8
  export TRANSPARENT=0x00000000
  
  # Accent Colors
  export RED=0xffFF7A7A
  export GREEN=0xff86E89A
  export BLUE=0xff7AB8FF
  export YELLOW=0xffFFDF61
  export PEACH=0xffF4C895
  export ORANGE=0xffD4825D
  export MAGENTA=0xffC79BFF
  export CYAN=0xff8ABFB8
  
  # UI Element Colors
  export GREY=0xff8a7a70
  export GREY_DARK=0xff4a3f35
  export GREY_DARKER=0xff5a4a40
  
  # General bar colors
  export BAR_COLOR=0xcc2d2622
  export ICON_COLOR=$WHITE
  export LABEL_COLOR=$WHITE
  export BACKGROUND_1=0xcc4a3f35
  export BACKGROUND_2=0xcc5a4a40
  
  # Popup colors
  export POPUP_BACKGROUND_COLOR=0xf02d2622
  export POPUP_BORDER_COLOR=$ORANGE
  
  # Effects
  export SHADOW_COLOR=$BLACK
  export ACCENT_COLOR=$ORANGE
  export HIGHLIGHT_COLOR=0x4dD4825D
  
  # Borders (JankyBorders)
  export BORDER_ACTIVE=$ORANGE
  export BORDER_INACTIVE=0x775a4a40
}

# Claude Light Theme
load_claude_light_theme() {
  # Base Colors
  export BLACK=0xff2a2520
  export WHITE=0xff342e29
  export TRANSPARENT=0x00000000
  
  # Accent Colors
  export RED=0xffE85D5D
  export GREEN=0xff5DC66A
  export BLUE=0xff5D9FE8
  export YELLOW=0xffE8C75D
  export PEACH=0xffE8A05D
  export ORANGE=0xffC15F3C
  export MAGENTA=0xffA87BE8
  export CYAN=0xff5D9F99
  
  # UI Element Colors
  export GREY=0xff6a5a50
  export GREY_DARK=0xffa09080
  export GREY_DARKER=0xff8a7a70
  
  # General bar colors
  export BAR_COLOR=0xccF5EDE5
  export ICON_COLOR=$WHITE
  export LABEL_COLOR=$WHITE
  export BACKGROUND_1=0xccE8DDD0
  export BACKGROUND_2=0xccD4C4B8
  
  # Popup colors
  export POPUP_BACKGROUND_COLOR=0xf0F5EDE5
  export POPUP_BORDER_COLOR=$ORANGE
  
  # Effects
  export SHADOW_COLOR=0x40000000
  export ACCENT_COLOR=$ORANGE
  export HIGHLIGHT_COLOR=0x4dC15F3C
  
  # Borders (JankyBorders)
  export BORDER_ACTIVE=$ORANGE
  export BORDER_INACTIVE=0x778a7a70
}

# Blueberry Dark Theme (Cool blues/purples)
load_blueberry_dark_theme() {
  # Base Colors
  export BLACK=0xff191d28
  export WHITE=0xffa6accd
  export TRANSPARENT=0x00000000
  
  # Accent Colors
  export RED=0xffff5370
  export GREEN=0xffc3e88d
  export BLUE=0xff82aaff
  export YELLOW=0xffffcb6b
  export PEACH=0xffffcb6b
  export ORANGE=0xff32AE85
  export MAGENTA=0xffc792ea
  export CYAN=0xff89ddff
  
  # UI Element Colors
  export GREY=0xff676e95
  export GREY_DARK=0xff393f59
  export GREY_DARKER=0xff506477
  
  # General bar colors
  export BAR_COLOR=0xcc1d212f
  export ICON_COLOR=$WHITE
  export LABEL_COLOR=$WHITE
  export BACKGROUND_1=0xcc393f59
  export BACKGROUND_2=0xcc506477
  
  # Popup colors
  export POPUP_BACKGROUND_COLOR=0xf01d212f
  export POPUP_BORDER_COLOR=0xff27E8A7
  
  # Effects
  export SHADOW_COLOR=$BLACK
  export ACCENT_COLOR=0xff27E8A7
  export HIGHLIGHT_COLOR=0x4d27E8A7
  
  # Borders (JankyBorders)
  export BORDER_ACTIVE=0xff27E8A7
  export BORDER_INACTIVE=0x77506477
}

# Catppuccin Theme
load_catppuccin_theme() {
  # Base Colors
  export BLACK=0xff181926
  export WHITE=0xffcad3f5
  export TRANSPARENT=0x00000000
  
  # Accent Colors
  export RED=0xffed8796
  export GREEN=0xffa6da95
  export BLUE=0xff8aadf4
  export YELLOW=0xffeed49f
  export PEACH=0xfff5a97f
  export ORANGE=0xfff5a97f
  export MAGENTA=0xffc6a0f6
  export CYAN=0xff91d7e3
  
  # UI Element Colors
  export GREY=0xff939ab7
  export GREY_DARK=0xff494d64
  export GREY_DARKER=0xff3c3e4f
  
  # General bar colors
  export BAR_COLOR=0xcc24273a
  export ICON_COLOR=$WHITE
  export LABEL_COLOR=$WHITE
  export BACKGROUND_1=0xcc3c3e4f
  export BACKGROUND_2=0xcc494d64
  
  # Popup colors
  export POPUP_BACKGROUND_COLOR=0xf024273a
  export POPUP_BORDER_COLOR=$BLUE
  
  # Effects
  export SHADOW_COLOR=$BLACK
  export ACCENT_COLOR=$BLUE
  export HIGHLIGHT_COLOR=0x4d8aadf4
  
  # Borders (JankyBorders)
  export BORDER_ACTIVE=$BLUE
  export BORDER_INACTIVE=0x77494d64
}

# DuoTone Dark Theme (Deep sea blues)
load_duotone_dark_theme() {
  # Base Colors
  export BLACK=0xff1D262F
  export WHITE=0xff88b4e7
  export TRANSPARENT=0x00000000
  
  # Accent Colors
  export RED=0xffff6b9d
  export GREEN=0xff6fb6d0
  export BLUE=0xff4fb4d7
  export YELLOW=0xffffcc66
  export PEACH=0xffff9966
  export ORANGE=0xffff9966
  export MAGENTA=0xffb6a0ff
  export CYAN=0xff5ccfe6
  
  # UI Element Colors
  export GREY=0xff5b6881
  export GREY_DARK=0xff2e3847
  export GREY_DARKER=0xff3d4759
  
  # General bar colors
  export BAR_COLOR=0xcc1D262F
  export ICON_COLOR=$WHITE
  export LABEL_COLOR=$WHITE
  export BACKGROUND_1=0xcc2e3847
  export BACKGROUND_2=0xcc3d4759
  
  # Popup colors
  export POPUP_BACKGROUND_COLOR=0xf01D262F
  export POPUP_BORDER_COLOR=$BLUE
  
  # Effects
  export SHADOW_COLOR=$BLACK
  export ACCENT_COLOR=$BLUE
  export HIGHLIGHT_COLOR=0x4d4fb4d7
  
  # Borders (JankyBorders)
  export BORDER_ACTIVE=$BLUE
  export BORDER_INACTIVE=0x773d4759
}

# Periwinkle Ember Theme (Purple/lavender tones)
load_periwinkle_ember_theme() {
  # Base Colors
  export BLACK=0xff49495a
  export WHITE=0xffbebeef
  export TRANSPARENT=0x00000000
  
  # Accent Colors
  export RED=0xffff6b9d
  export GREEN=0xff86E89A
  export BLUE=0xff9AA7FF
  export YELLOW=0xffffdf80
  export PEACH=0xffffb380
  export ORANGE=0xffffb380
  export MAGENTA=0xffD4A5FF
  export CYAN=0xff8ABFB8
  
  # UI Element Colors
  export GREY=0xff8a8aa0
  export GREY_DARK=0xff5e5e70
  export GREY_DARKER=0xff6a6a7a
  
  # General bar colors
  export BAR_COLOR=0xcc49495a
  export ICON_COLOR=$WHITE
  export LABEL_COLOR=$WHITE
  export BACKGROUND_1=0xcc5e5e70
  export BACKGROUND_2=0xcc6a6a7a
  
  # Popup colors
  export POPUP_BACKGROUND_COLOR=0xf049495a
  export POPUP_BORDER_COLOR=0xff9AA7FF
  
  # Effects
  export SHADOW_COLOR=$BLACK
  export ACCENT_COLOR=0xff9AA7FF
  export HIGHLIGHT_COLOR=0x4d9AA7FF
  
  # Borders (JankyBorders)
  export BORDER_ACTIVE=0xff9AA7FF
  export BORDER_INACTIVE=0x776a6a7a
}

# Apply theme colors to SketchyBar and Borders
apply_theme() {
  # Reload SketchyBar with new colors
  sketchybar --bar \
    color="$BAR_COLOR" \
    shadow.color="$SHADOW_COLOR"
  
  # Update all items
  sketchybar --update
  
  # Update JankyBorders with new colors (live update without restart)
  if command -v borders &> /dev/null; then
    borders active_color="$BORDER_ACTIVE" inactive_color="$BORDER_INACTIVE" &> /dev/null
  fi
}

# Save current theme preference
save_theme_preference() {
  local theme_name="$1"
  echo "export SKETCHYBAR_THEME='$theme_name'" > "$HOME/.config/sketchybar/.theme_preference"
}

# Load theme preference
load_theme_preference() {
  if [[ -f "$HOME/.config/sketchybar/.theme_preference" ]]; then
    source "$HOME/.config/sketchybar/.theme_preference"
    CURRENT_THEME="$SKETCHYBAR_THEME"
  fi
}

# CLI interface
case "${1:-load}" in
  "load")
    load_theme_preference
    load_theme "$CURRENT_THEME"
    ;;
  "set")
    if [[ -z "$2" ]]; then
      echo "Usage: theme.sh set <theme-name>"
      echo "Available themes: claude-dark, claude-light, blueberry-dark, catppuccin, duotone-dark, periwinkle-ember"
      exit 1
    fi
    load_theme "$2"
    save_theme_preference "$2"
    apply_theme
    echo "Theme changed to: $2"
    ;;
  "apply")
    load_theme_preference
    load_theme "$CURRENT_THEME"
    apply_theme
    ;;
  "list")
    echo "Available themes:"
    echo "  - claude-dark (warm, elegant)"
    echo "  - claude-light (soft, bright)"
    echo "  - blueberry-dark (cool blues/purples)"
    echo "  - catppuccin (modern pastels)"
    echo "  - duotone-dark (deep sea blues)"
    echo "  - periwinkle-ember (purple/lavender)"
    echo ""
    echo "Current theme: $CURRENT_THEME"
    ;;
  "current")
    load_theme_preference
    echo "$CURRENT_THEME"
    ;;
  *)
    echo "SketchyBar Theme Manager"
    echo ""
    echo "Usage: theme.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  load              Load saved theme preference (default)"
    echo "  set <theme>       Set and apply a new theme"
    echo "  apply             Apply current theme to SketchyBar"
    echo "  list              List available themes"
    echo "  current           Show current theme name"
    echo ""
    echo "Examples:"
    echo "  theme.sh set claude-dark"
    echo "  theme.sh set blueberry-dark"
    echo "  theme.sh list"
    ;;
esac
