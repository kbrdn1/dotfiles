# AeroSpace Integration for Sketchybar

## Overview

This document describes the complete integration of AeroSpace window manager with Sketchybar, replacing the previous yabai integration. The integration provides workspace indicators, window state visualization, and app icons in the status bar.

## 📋 Analysis of Original Yabai Integration

### Original Yabai Plugin (`plugins/yabai.sh`)

The original yabai plugin provided:

1. **Window State Detection**:
   - Stack detection with counter display `[current/total]`
   - Floating window detection
   - Fullscreen zoom detection
   - Parent zoom detection
   - Tiled window indication

2. **Visual Indicators**:
   - Different icons for each window state
   - Color-coded borders and icons
   - Dynamic border color changes

3. **Workspace Management**:
   - App icons displayed in workspace indicators
   - Dynamic workspace creation/destruction
   - Window distribution across spaces

4. **Interactive Features**:
   - Mouse click to toggle float/tile
   - Right-click to destroy spaces

### Original Spaces Integration (`plugins/spaces/`)

- Dynamic space creation with separator click
- App icon mapping for each workspace
- Visual highlighting of active workspace
- Mouse interactions for space switching

## 🚀 AeroSpace Integration Architecture

### Core Components

#### 1. Main Integration Plugin (`plugins/aerospace_integration.sh`)

**Purpose**: Central coordinator for all AeroSpace-sketchybar interactions

**Key Functions**:
```bash
window_state()           # Updates window manager state indicator
windows_on_spaces()      # Updates app icons in workspace indicators  
workspace_change()       # Handles workspace switching events
mouse_clicked()          # Toggles floating/tiling layout
reload_aerospace()       # Reloads AeroSpace configuration
```

**Event Handling**:
- `window_focus` - Updates when window focus changes
- `windows_on_spaces` - Updates when windows move between workspaces
- `aerospace_workspace_change` - Updates when workspace changes
- `mouse.clicked` - Handles user interactions

#### 2. AeroSpace Spaces Plugin (`plugins/aerospace/`)

**spaces.sh**: Handles individual space interactions
- Left click: Switch to workspace
- Right click: Display notification (AeroSpace uses static workspaces)

**item.sh**: Creates and configures workspace indicators
- Sets up spaces 1-5 (AeroSpace default)
- Configures visual appearance and click handlers
- Removes dynamic workspace creation (not supported by AeroSpace)

#### 3. Legacy AeroSpace Plugin (`plugins/aerospace.sh`)

**Purpose**: Direct AeroSpace equivalent of yabai.sh (simplified version)

## 🔄 Key Differences: Yabai vs AeroSpace

| Feature | Yabai | AeroSpace | Implementation |
|---------|-------|-----------|----------------|
| **Window States** | Stack, Float, Zoom, Tiled | Tiled, Floating | Simplified state detection |
| **Workspace Management** | Dynamic creation/destruction | Static workspaces 1-5 | No separator click creation |
| **Window Detection** | Rich JSON API | Simple text output | Custom parsing required |
| **Floating Detection** | Per-window floating state | Layout-based | Heuristic-based detection |
| **Border Colors** | Dynamic border control | No border control | Removed border updates |
| **Stack Windows** | Stack index tracking | No stacking concept | Removed stack indicators |

## 📁 File Structure

```
.config/sketchybar/
├── plugins/
│   ├── aerospace.sh                    # Legacy direct replacement
│   ├── aerospace_integration.sh        # Main integration plugin
│   └── aerospace/
│       ├── spaces.sh                   # Space interaction handler
│       └── item.sh                     # Space configuration
├── settings/
│   └── icons.sh                        # Added AeroSpace icons
├── migrate_to_aerospace.sh             # Migration script
├── test_aerospace_integration.sh       # Testing script
└── AEROSPACE_INTEGRATION.md            # This documentation
```

## 🛠️ Installation & Setup

### Prerequisites

1. **AeroSpace installed and running**:
   ```bash
   brew install --cask nikitabobko/tap/aerospace
   open -a AeroSpace
   ```

2. **AeroSpace configured** with sketchybar callbacks:
   ```toml
   # In ~/.config/aerospace/aerospace.toml
   on-focused-monitor-changed = ["exec-and-forget sketchybar --trigger aerospace_workspace_change"]
   on-focus-changed = ["exec-and-forget sketchybar --trigger window_focus"]
   ```

3. **Sketchybar running**:
   ```bash
   sketchybar &
   ```

### Automatic Migration

Run the migration script to automatically update your configuration:

```bash
chmod +x ~/.config/sketchybar/migrate_to_aerospace.sh
~/.config/sketchybar/migrate_to_aerospace.sh
```

### Manual Integration

1. **Add AeroSpace item to sketchybarrc**:
   ```bash
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
   ```

2. **Replace spaces configuration**:
   ```bash
   # Replace yabai spaces with AeroSpace spaces
   source "$PLUGIN_DIR/aerospace/item.sh"
   ```

3. **Update callbacks in AeroSpace config**:
   ```bash
   aerospace reload-config
   ```

## 🎨 Visual Customization

### Icons

New AeroSpace-specific icons added to `settings/icons.sh`:

```bash
# AeroSpace Icons
AEROSPACE_TILED=􀧍        # Tiled layout indicator
AEROSPACE_FLOATING=􀢌     # Floating layout indicator  
AEROSPACE_FULLSCREEN=􀏜   # Fullscreen indicator
AEROSPACE_WORKSPACE=􀏭    # Workspace indicator
AEROSPACE_SPLIT_V=􀤋      # Vertical split
AEROSPACE_SPLIT_H=􀤊      # Horizontal split
AEROSPACE_JOIN=􀫸         # Join indicator
```

### Colors

The integration reuses existing color scheme:
- `$ORANGE` - Active/tiled windows
- `$GREY` - Inactive state
- `$MAGENTA` - Workspace highlighting
- `$WHITE` - Default text/icons

### Customization Options

**Window State Colors**:
```bash
# In aerospace_integration.sh window_state()
args+=(--set $NAME icon=$AEROSPACE_TILED icon.color=$ORANGE)  # Tiled
args+=(--set $NAME icon=$AEROSPACE_FLOATING icon.color=$MAGENTA)  # Floating
```

**Workspace Indicators**:
```bash
# In aerospace/item.sh
icon.highlight_color=$MAGENTA    # Active workspace highlight
label.background.color=$BACKGROUND_2    # App icon background
```

## 🔧 Configuration Reference

### AeroSpace Integration Events

| Event | Trigger | Purpose |
|-------|---------|---------|
| `aerospace_workspace_change` | Workspace switch | Updates workspace highlighting |
| `window_focus` | Window focus change | Updates window state indicator |
| `windows_on_spaces` | Windows move/close | Updates app icons in spaces |
| `mouse.clicked` | User clicks aerospace item | Toggles floating/tiling |

### Workspace Configuration

```bash
# Static workspaces (AeroSpace default)
WORKSPACES="1 2 3 4 5"

# Workspace icons
SPACE_ICONS=("1" "2" "3" "4" "5")

# Workspace highlighting
icon.highlight_color=$MAGENTA
```

### App Icon Integration

Uses existing `icon_map.sh` for app icon mapping:
```bash
# Extract app names from AeroSpace
apps=$(aerospace list-windows --workspace "$workspace" 2>/dev/null | awk '{print $3}' | sort -u)

# Map to icons
icon_strip+=" $($HOME/.config/sketchybar/plugins/icon_map.sh "$app")"
```

## 🧪 Testing & Validation

### Test Script

Run the comprehensive test script:
```bash
chmod +x ~/.config/sketchybar/test_aerospace_integration.sh
~/.config/sketchybar/test_aerospace_integration.sh
```

### Manual Testing

1. **Workspace Switching**:
   ```bash
   # Switch workspaces and verify sketchybar updates
   aerospace workspace 1
   aerospace workspace 2
   ```

2. **Window State**:
   ```bash
   # Toggle layout and check indicator
   aerospace layout floating tiling
   ```

3. **App Icons**:
   ```bash
   # Open apps and verify icons appear in workspace indicators
   open -a Arc
   open -a Terminal
   ```

### Debugging

**Check AeroSpace API**:
```bash
aerospace list-workspaces --all
aerospace list-windows --all
aerospace list-workspaces --focused
```

**Check Sketchybar Events**:
```bash
# Manually trigger events
sketchybar --trigger aerospace_workspace_change
sketchybar --trigger window_focus
sketchybar --trigger windows_on_spaces
```

**Plugin Execution**:
```bash
# Test plugins directly
~/.config/sketchybar/plugins/aerospace_integration.sh
```

## 🔍 Troubleshooting

### Common Issues

1. **Sketchybar not updating workspace indicators**:
   - Check AeroSpace is running: `pgrep AeroSpace`
   - Verify callbacks in AeroSpace config
   - Test manual triggers: `sketchybar --trigger aerospace_workspace_change`

2. **App icons not showing**:
   - Verify `icon_map.sh` exists and is executable
   - Check app name extraction: `aerospace list-windows --workspace 1`
   - Test icon mapping: `~/.config/sketchybar/plugins/icon_map.sh "Arc"`

3. **Mouse clicks not working**:
   - Check plugin permissions: `chmod +x ~/.config/sketchybar/plugins/aerospace_integration.sh`
   - Verify subscription in sketchybarrc: `--subscribe aerospace mouse.clicked`

4. **Workspace switching doesn't update sketchybar**:
   - Ensure AeroSpace callbacks are configured
   - Check skhd integration triggers events
   - Verify AeroSpace configuration reload: `aerospace reload-config`

### Log Analysis

**Sketchybar logs** (if logging enabled):
```bash
tail -f /tmp/sketchybar.log
```

**AeroSpace logs**:
```bash
# Check system logs for AeroSpace
log show --predicate 'process == "AeroSpace"' --last 5m
```

### Rollback Procedure

To restore yabai integration:
```bash
# Restore from backup
cp -r ~/.config/sketchybar/backup_*/plugins ~/.config/sketchybar/
cp ~/.config/sketchybar/backup_*/sketchybarrc ~/.config/sketchybar/
killall sketchybar && sketchybar &
```

## 📊 Performance Considerations

### Response Times

- **AeroSpace API calls**: ~10-50ms per query
- **Sketchybar updates**: ~5-10ms per trigger
- **Plugin execution**: ~20-100ms total

### Optimization Tips

1. **Reduce API calls**:
   - Cache workspace lists when possible
   - Batch multiple queries
   - Use focused workspace query instead of listing all

2. **Efficient app icon updates**:
   - Only update changed workspaces
   - Use `sort -u` to deduplicate app names
   - Skip empty workspaces

3. **Event throttling**:
   - Add small delays to prevent rapid-fire updates
   - Use sketchybar's built-in update throttling

## 🔮 Future Enhancements

### Potential Improvements

1. **Enhanced Window State Detection**:
   - Parse AeroSpace layout information
   - Detect fullscreen mode more accurately
   - Show window count per workspace

2. **Dynamic Workspace Support**:
   - Monitor AeroSpace for workspace changes
   - Support workspace creation if AeroSpace adds API

3. **Advanced Visual Indicators**:
   - Layout-specific icons (tiles, floating, etc.)
   - Window arrangement previews
   - Workspace thumbnails

4. **Performance Optimizations**:
   - Async API calls
   - Event batching
   - Selective updates

### Contributing

To extend the integration:

1. **Add new events**: Extend event handling in `aerospace_integration.sh`
2. **Enhance visuals**: Modify icon/color logic in `window_state()`
3. **Add features**: Create new functions following existing patterns
4. **Test thoroughly**: Use the test script and manual validation

## 📚 References

- [AeroSpace Documentation](https://github.com/nikitabobko/AeroSpace)
- [Sketchybar Documentation](https://felixkratz.github.io/SketchyBar/)
- [Original Yabai Integration](https://github.com/FelixKratz/SketchyBar/discussions)

---

**Last Updated**: January 2025  
**Integration Version**: 1.0  
**Compatible with**: AeroSpace 0.19.2+, Sketchybar 2.21.0+