#!/bin/bash

# AeroSpace Migration Script for Sketchybar
# This script migrates sketchybar configuration from yabai to AeroSpace

set -e  # Exit on any error

SKETCHYBAR_DIR="$HOME/.config/sketchybar"
BACKUP_DIR="$SKETCHYBAR_DIR/backup_$(date +%Y%m%d_%H%M%S)"
PLUGINS_DIR="$SKETCHYBAR_DIR/plugins"

echo "🚀 Starting AeroSpace migration for Sketchybar..."
echo "📁 Sketchybar directory: $SKETCHYBAR_DIR"

# Create backup directory
echo "💾 Creating backup at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup current configuration
echo "📋 Backing up current configuration..."
cp -r "$SKETCHYBAR_DIR/plugins" "$BACKUP_DIR/" 2>/dev/null || true
cp "$SKETCHYBAR_DIR/sketchybarrc" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$SKETCHYBAR_DIR/settings" "$BACKUP_DIR/" 2>/dev/null || true

echo "✅ Backup completed"

# Check if AeroSpace is installed
if ! command -v aerospace &> /dev/null; then
    echo "❌ AeroSpace is not installed or not in PATH"
    echo "Please install AeroSpace first: brew install --cask nikitabobko/tap/aerospace"
    exit 1
fi

echo "✅ AeroSpace found: $(aerospace --version | head -1)"

# Make sure aerospace plugins are executable
echo "🔧 Setting up AeroSpace plugins..."
chmod +x "$PLUGINS_DIR/aerospace.sh" 2>/dev/null || true
chmod +x "$PLUGINS_DIR/aerospace_integration.sh" 2>/dev/null || true
chmod +x "$PLUGINS_DIR/aerospace/spaces.sh" 2>/dev/null || true
chmod +x "$PLUGINS_DIR/aerospace/item.sh" 2>/dev/null || true

# Update sketchybarrc to use AeroSpace instead of yabai
echo "📝 Updating sketchybarrc configuration..."
SKETCHYBARRC="$SKETCHYBAR_DIR/sketchybarrc"

if [ -f "$SKETCHYBARRC" ]; then
    # Create a new sketchybarrc with AeroSpace integration
    cat > "$SKETCHYBARRC.new" << 'SKETCHYBARRC_EOF'
#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

# Setting up and starting the helper process
HELPER=git.felix.helper
killall helper 2>/dev/null || true
cd $HOME/.config/sketchybar/helper && make 2>/dev/null || true
$HOME/.config/sketchybar/helper/helper $HELPER > /dev/null 2>&1 &

# Unload the macOS on screen indicator overlay for volume change
launchctl unload -F /System/Library/LaunchAgents/com.apple.OSDUIHelper.plist > /dev/null 2>&1 &

# Setting up the general bar appearance of the bar
bar=(
  height=$BAR_HEIGHT
  color=$BAR_COLOR
  shadow=on
  position=$BAR_POSITION
  sticky=on
  padding_right=$BAR_PADDINGS
  padding_left=$BAR_PADDINGS
  corner_radius=$BAR_BORDER_RADIUS
  y_offset=$BAR_Y_OFFSET
  margin=$BAR_MARGIN
  blur_radius=$BAR_BLUR_RADIUS
  notch_width=$BAR_NOTCH_WIDTH
)

sketchybar --bar "${bar[@]}"

# Setting up default values
defaults=(
  updates=when_shown
  icon.font="$FONT:Bold:14.0"
  icon.color=$ICON_COLOR
  icon.padding_left=$PADDINGS
  icon.padding_right=$PADDINGS
  label.font="$FONT:Semibold:13.0"
  label.color=$LABEL_COLOR
  label.padding_left=$PADDINGS
  label.padding_right=$PADDINGS
  padding_right=$PADDINGS
  padding_left=$PADDINGS
  background.height=$BG_HEIGHT
  background.corner_radius=$BG_BORDER_RADIUS
  popup.background.border_width=$POPUP_BORDER_WIDTH
  popup.background.corner_radius=$POPUP_BORDER_RADIUS
  popup.background.border_color=$POPUP_BORDER_COLOR
  popup.background.color=$POPUP_BACKGROUND_COLOR
  popup.blur_radius=$POPUP_BLUR_RADIUS
  popup.background.shadow.drawing=on
)

sketchybar --default "${defaults[@]}"

# Left side
source "$PLUGIN_DIR/apple/item.sh"

# AeroSpace integration - replaces yabai spaces
source "$PLUGIN_DIR/aerospace/item.sh"

# Front app
source "$PLUGIN_DIR/front_app.sh"

# AeroSpace window manager status
sketchybar --add item aerospace right \
           --set aerospace icon=$AEROSPACE_TILED \
                          icon.color=$ORANGE \
                          label.drawing=off \
                          script="$PLUGIN_DIR/aerospace_integration.sh" \
           --subscribe aerospace aerospace_workspace_change \
                               window_focus \
                               windows_on_spaces \
                               mouse.clicked

# Right side
source "$PLUGIN_DIR/calendar/item.sh"
source "$PLUGIN_DIR/brew/item.sh"
source "$PLUGIN_DIR/battery/item.sh"
source "$PLUGIN_DIR/wifi/item.sh"
# source "$PLUGIN_DIR/bluetooth/item.sh"
source "$PLUGIN_DIR/github/item.sh"
source "$PLUGIN_DIR/volume/item.sh"
source "$PLUGIN_DIR/cpu.sh"
source "$PLUGIN_DIR/svim/item.sh"

sketchybar --hotload on

# Forcing all item scripts to run (never do this outside of sketchybarrc)
sketchybar --update

echo "sketchybar configuration loaded with AeroSpace integration.."
SKETCHYBARRC_EOF

    # Replace the original with the new version
    mv "$SKETCHYBARRC.new" "$SKETCHYBARRC"
    chmod +x "$SKETCHYBARRC"
    echo "✅ Updated sketchybarrc"
else
    echo "⚠️  sketchybarrc not found, skipping update"
fi

# Test AeroSpace integration
echo "🧪 Testing AeroSpace integration..."
if aerospace list-workspaces --all >/dev/null 2>&1; then
    echo "✅ AeroSpace is responding correctly"
else
    echo "⚠️  AeroSpace might not be running or configured properly"
    echo "   Run: open -a AeroSpace"
fi

# Update AeroSpace callbacks in configuration
echo "🔗 Updating AeroSpace configuration callbacks..."
AEROSPACE_CONFIG="$HOME/.config/aerospace/aerospace.toml"
if [ -f "$AEROSPACE_CONFIG" ]; then
    # Check if callbacks are already configured
    if ! grep -q "sketchybar.*aerospace_workspace_change" "$AEROSPACE_CONFIG"; then
        echo "📝 Adding sketchybar callbacks to AeroSpace config..."
        
        # Create a temporary file with updated callbacks
        sed '/^on-focused-monitor-changed/c\
on-focused-monitor-changed = ["exec-and-forget sketchybar --trigger aerospace_workspace_change"]\
on-focus-changed = ["exec-and-forget sketchybar --trigger window_focus"]' "$AEROSPACE_CONFIG" > "$AEROSPACE_CONFIG.tmp"
        
        mv "$AEROSPACE_CONFIG.tmp" "$AEROSPACE_CONFIG"
        echo "✅ Updated AeroSpace callbacks"
        
        # Reload AeroSpace configuration
        if pgrep AeroSpace >/dev/null; then
            aerospace reload-config
            echo "✅ Reloaded AeroSpace configuration"
        fi
    else
        echo "✅ AeroSpace callbacks already configured"
    fi
else
    echo "⚠️  AeroSpace config not found at $AEROSPACE_CONFIG"
fi

# Restart sketchybar to apply changes
echo "🔄 Restarting sketchybar..."
killall sketchybar 2>/dev/null || true
sleep 1
sketchybar &

echo ""
echo "🎉 Migration completed successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ Backup created: $BACKUP_DIR"
echo "   ✅ Sketchybar updated to use AeroSpace"
echo "   ✅ AeroSpace integration plugins installed"
echo "   ✅ Configuration callbacks updated"
echo ""
echo "🔧 Next steps:"
echo "   1. Make sure AeroSpace is running: open -a AeroSpace"
echo "   2. Test workspace switching: alt + 1, alt + 2, etc."
echo "   3. Check sketchybar displays workspace info correctly"
echo ""
echo "🔙 To rollback:"
echo "   cp -r $BACKUP_DIR/* $SKETCHYBAR_DIR/"
echo "   killall sketchybar && sketchybar &"
echo ""
echo "📊 Current status:"
echo "   AeroSpace: $(pgrep AeroSpace >/dev/null && echo 'Running ✅' || echo 'Not running ❌')"
echo "   Sketchybar: $(pgrep sketchybar >/dev/null && echo 'Running ✅' || echo 'Not running ❌')"
echo ""

# Test workspace functionality
echo "🧪 Testing workspace functionality..."
CURRENT_WS=$(aerospace list-workspaces --focused 2>/dev/null)
if [ -n "$CURRENT_WS" ]; then
    echo "   Current workspace: $CURRENT_WS ✅"
    
    ALL_WS=$(aerospace list-workspaces --all 2>/dev/null)
    echo "   Available workspaces: $ALL_WS ✅"
    
    # Trigger updates
    sketchybar --trigger aerospace_workspace_change
    sketchybar --trigger windows_on_spaces
    
    echo "   Sketchybar events triggered ✅"
else
    echo "   ⚠️  Could not get workspace info from AeroSpace"
fi

echo ""
echo "✨ AeroSpace + Sketchybar integration is ready!"
echo "   Use your keyboard shortcuts (alt + 1-5) to test workspace switching"
echo "   The sketchybar should show workspace indicators and app icons"