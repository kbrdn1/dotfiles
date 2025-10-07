# SketchyBar Configuration with AeroSpace Integration

A clean, minimal macOS menu bar configuration using SketchyBar with AeroSpace window manager integration.

## ✨ Features

- **6 Workspace Icons**: Visual workspace indicators with app-specific icons
- **Dynamic Selection**: Purple background highlights the active workspace
- **System Monitoring**: CPU usage, battery status, WiFi connectivity
- **Clean Design**: Minimal and efficient configuration
- **AeroSpace Integration**: Seamless window manager integration

## 🎯 Workspace Configuration

| Workspace | Key | Icon | Application |
|-----------|-----|------|-------------|
| 1 | `1` | `:mail:` | Mail |
| 2 | `2` | `:postman:` | Postman |
| 3 | `3` | `:zed:` | Zed Editor |
| 4 | `Q` | `:arc:` | Arc Browser |
| 5 | `W` | `:messages:` | Messages/Slack |
| 6 | `E` | `:orbstack:` | OrbStack/Docker |

## 📁 File Structure

```
.config/sketchybar/
├── sketchybarrc              # Main configuration
├── manage.sh                 # Management utility
├── icon_map.sh              # Icon mapping helper
├── plugins/
│   ├── spaces/
│   │   ├── items.sh         # Workspace items setup
│   │   └── handler.sh       # Event handler
│   ├── aerospace.sh        # Window state monitor
│   ├── front_app_aerospace.sh # Current app display
│   ├── cpu.sh              # CPU usage monitor
│   ├── apple/              # Apple menu
│   ├── battery/            # Battery indicator
│   ├── calendar/           # Date & time
│   ├── volume/             # Volume control
│   └── wifi/               # Network status
├── settings/
│   ├── settings.sh         # Core settings
│   ├── colors.sh           # Color scheme
│   └── icons.sh            # Icon definitions
└── helper/                 # Helper binary
```

## 🚀 Installation

### Prerequisites

1. **Install SketchyBar**:
```bash
brew install sketchybar
brew services start sketchybar
```

2. **Install AeroSpace**:
```bash
brew install --cask aerospace
```

3. **Install App Font**:
```bash
curl -L https://github.com/kvndrsslr/sketchybar-app-font/releases/download/v2.0.5/sketchybar-app-font.ttf -o ~/Library/Fonts/sketchybar-app-font.ttf
```

### Setup

1. Clone this configuration:
```bash
git clone <your-repo> ~/.config/sketchybar
```

2. Make scripts executable:
```bash
chmod +x ~/.config/sketchybar/manage.sh
chmod +x ~/.config/sketchybar/plugins/**/*.sh
```

3. Reload SketchyBar:
```bash
sketchybar --reload
```

## 🛠 Management Commands

Use the included management script for easy control:

```bash
# Check status
./manage.sh status

# Reload configuration
./manage.sh reload

# Restart SketchyBar
./manage.sh restart

# Create backup
./manage.sh backup

# Test workspaces
./manage.sh test
```

## 🎨 Customization

### Change Workspace Icons

Edit `plugins/spaces/items.sh`:
```bash
SPACE_ICONS=(":mail:" ":firefox:" ":code:" ":terminal:" ":slack:" ":docker:")
```

### Adjust Colors

Edit workspace selection colors in `plugins/spaces/handler.sh`:
- Selected background: `0xffc6a0f6` (purple)
- Selected text: `0xff1e1e2e` (dark)
- Unselected text: `0xffcad3f5` (light gray)

### Modify Bar Appearance

Edit `sketchybarrc` bar configuration:
```bash
sketchybar --bar \
  height=33 \              # Bar height
  blur_radius=20 \         # Background blur
  corner_radius=9 \        # Corner rounding
  y_offset=5 \             # Distance from top
  margin=10                # Side margins
```

## 🔧 Troubleshooting

### Workspaces not updating
```bash
# Restart AeroSpace
open -a AeroSpace

# Reload SketchyBar
sketchybar --reload
```

### Icons not displaying correctly
- Ensure `sketchybar-app-font` is installed in `~/Library/Fonts/`
- Restart SketchyBar after font installation

### Check configuration
```bash
# Run status check
./manage.sh status

# View logs
tail -f /tmp/sketchybar*.log
```

## 📝 Key Files

- **`sketchybarrc`**: Main configuration file
- **`manage.sh`**: Management and maintenance script
- **`plugins/spaces/items.sh`**: Workspace configuration
- **`plugins/spaces/handler.sh`**: Workspace event handling
- **`settings/colors.sh`**: Color definitions

## 🎯 Design Principles

1. **Minimal**: Only essential items in the menu bar
2. **Fixed Layout**: Icons don't move when switching workspaces
3. **Visual Feedback**: Clear indication of active workspace
4. **Performance**: Efficient event-driven updates
5. **Clean Code**: Organized and documented configuration

## 📚 Resources

- [SketchyBar Documentation](https://felixkratz.github.io/SketchyBar/)
- [AeroSpace Documentation](https://github.com/nikitabobko/AeroSpace)
- [App Font Icons](https://github.com/kvndrsslr/sketchybar-app-font)

## 📄 License

This configuration is provided as-is for personal use.