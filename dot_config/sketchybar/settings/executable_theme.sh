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

# Claude Dark Theme (Pure dark surfaces, warm accents)
load_claude_dark_theme() {
  # Base Colors (pure dark from palette surfaces)
  export BLACK=0xff1a1a1a
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
  export GREY_DARK=0xff383838
  export GREY_DARKER=0xff444444

  # General bar colors
  export BAR_COLOR=0xcc1a1a1a
  export ICON_COLOR=$WHITE
  export LABEL_COLOR=$WHITE
  export BACKGROUND_1=0xcc2a2a2a
  export BACKGROUND_2=0xcc383838

  # Popup colors
  export POPUP_BACKGROUND_COLOR=0xf01a1a1a
  export POPUP_BORDER_COLOR=$ORANGE

  # Effects
  export SHADOW_COLOR=$BLACK
  export ACCENT_COLOR=$ORANGE
  export HIGHLIGHT_COLOR=0x4dD4825D

  # Borders (JankyBorders)
  export BORDER_ACTIVE=$ORANGE
  export BORDER_INACTIVE=0x77444444
}

# Claude Light Theme (Warm cream surfaces, dark text, saturated accents)
load_claude_light_theme() {
  # Base Colors
  export BLACK=0xffF5EDE5
  export WHITE=0xff2a2520
  export TRANSPARENT=0x00000000

  # Accent Colors (slightly deeper for contrast on light bg)
  export RED=0xffD04040
  export GREEN=0xff3DA653
  export BLUE=0xff4080D0
  export YELLOW=0xffC9A030
  export PEACH=0xffD08040
  export ORANGE=0xffC15F3C
  export MAGENTA=0xff8B5DC0
  export CYAN=0xff3D8A80

  # UI Element Colors
  export GREY=0xff8a7a70
  export GREY_DARK=0xffC4B8AC
  export GREY_DARKER=0xffB0A498

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
  export SHADOW_COLOR=0x20000000
  export ACCENT_COLOR=$ORANGE
  export HIGHLIGHT_COLOR=0x4dC15F3C

  # Borders (JankyBorders)
  export BORDER_ACTIVE=$ORANGE
  export BORDER_INACTIVE=0x55B0A498
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

# Generate flat cache file with all color exports for fast loading
generate_cache() {
  local cache_file="$THEME_DIR/.theme_cache.sh"
  cat > "$cache_file" << CACHE
#!/bin/bash
# Auto-generated theme cache -- do not edit manually
# Theme: $CURRENT_THEME
# Generated: $(date)
export BLACK=$BLACK
export WHITE=$WHITE
export TRANSPARENT=$TRANSPARENT
export RED=$RED
export GREEN=$GREEN
export BLUE=$BLUE
export YELLOW=$YELLOW
export PEACH=$PEACH
export ORANGE=$ORANGE
export MAGENTA=$MAGENTA
export CYAN=$CYAN
export GREY=$GREY
export GREY_DARK=$GREY_DARK
export GREY_DARKER=$GREY_DARKER
export BAR_COLOR=$BAR_COLOR
export ICON_COLOR=$ICON_COLOR
export LABEL_COLOR=$LABEL_COLOR
export BACKGROUND_1=$BACKGROUND_1
export BACKGROUND_2=$BACKGROUND_2
export POPUP_BACKGROUND_COLOR=$POPUP_BACKGROUND_COLOR
export POPUP_BORDER_COLOR=$POPUP_BORDER_COLOR
export SHADOW_COLOR=$SHADOW_COLOR
export ACCENT_COLOR=$ACCENT_COLOR
export HIGHLIGHT_COLOR=$HIGHLIGHT_COLOR
export BORDER_ACTIVE=$BORDER_ACTIVE
export BORDER_INACTIVE=$BORDER_INACTIVE
CACHE
}

# Apply theme colors to SketchyBar and Borders
apply_theme() {
  # Reload SketchyBar with new colors
  sketchybar --bar \
    color="$BAR_COLOR" \
    border_color="$HIGHLIGHT_COLOR" \
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
    generate_cache
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
  "_generate_cache")
    load_theme_preference
    load_theme "$CURRENT_THEME"
    generate_cache
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
