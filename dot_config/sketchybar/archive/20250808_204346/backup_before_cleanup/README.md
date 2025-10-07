# SketchyBar Configuration with AeroSpace Integration

## Overview
This configuration integrates SketchyBar with AeroSpace window manager to provide a clean, visual workspace indicator with app-specific icons.

## Features
- **Workspace Icons**: Each workspace displays its designated app icon using `sketchybar-app-font`
- **Visual Selection**: Selected workspace shows a purple circular background with dark text
- **Fixed Positioning**: Icons maintain consistent positions without movement during state changes
- **Responsive Updates**: Automatically syncs with AeroSpace workspace changes

## Workspace Configuration
| Workspace | Icon | Application |
|-----------|------|-------------|
| 1 | `:mail:` | Mail |
| 2 | `:postman:` | Postman |
| 3 | `:zed:` | Zed (Code Editor) |
| 4 | `:arc:` | Arc Browser |
| 5 | `:messages:` | Messages/Slack |
| 6 | `:orbstack:` | OrbStack (Database/Docker) |

## File Structure
```
.config/sketchybar/
├── sketchybarrc                    # Main configuration file
├── icon_map.sh                     # Icon mapping helper
├── AEROSPACE_INTEGRATION.md        # Integration documentation
├── helper/                         # Helper binaries
├── plugins/
│   ├── spaces/
│   │   ├── items.sh               # Workspace items configuration
│   │   └── handler.sh             # Event handler for workspace changes
│   ├── aerospace.sh               # AeroSpace window state handler
│   ├── front_app_aerospace.sh     # Front app display
│   └── [other plugins...]         # Battery, WiFi, etc.
└── settings/                       # Colors, fonts, and general settings
```

## Visual States

### Selected Workspace
- Background: Purple circle (`0xffc6a0f6`)
- Icon color: Dark (`0xff1e1e2e`)
- Background visible with rounded corners

### Unselected Workspace
- Background: Hidden
- Icon color: Light (`0xffcad3f5`)
- Same dimensions as selected state (no movement)

## Technical Details

### Fixed Dimensions
All workspace items maintain consistent dimensions to prevent icon movement:
- Width: 30px (fixed)
- Icon padding: 7px left, 6px right
- Item padding: 1px left, 0px right
- Background: 22px height, 11px corner radius

### Update Mechanism
1. Monitor watches for AeroSpace workspace changes (0.2s interval)
2. Handler updates only `background.drawing` and `icon.color` properties
3. All other properties remain constant to prevent visual shifts

## Dependencies
- **SketchyBar**: Main bar application
- **AeroSpace**: Window manager
- **sketchybar-app-font**: Font for application icons
- **SF Pro**: System font for text elements

## Installation
1. Ensure SketchyBar and AeroSpace are installed
2. Install sketchybar-app-font: `brew install --cask sf-symbols`
3. Clone this configuration to `~/.config/sketchybar/`
4. Reload SketchyBar: `sketchybar --reload`

## Customization
To modify workspace icons or applications, edit:
- `plugins/spaces/items.sh` - Update the `SPACE_ICONS` array
- Workspace assignments are managed through AeroSpace configuration

## Troubleshooting
- If icons appear to move: Check that all width and padding values are consistent
- If workspace doesn't update: Verify AeroSpace is running and `handler.sh` has execute permissions
- For debugging: Check `/tmp/sketchybar_aerospace_workspace` for current workspace state

## Archive
Previous configurations and test scripts are stored in `archive/` directory for reference.