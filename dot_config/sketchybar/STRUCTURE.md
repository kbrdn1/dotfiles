# SketchyBar Configuration Structure

## Directory Layout
```
.config/sketchybar/
├── sketchybarrc              # Main configuration
├── icon_map.sh               # Icon mapping helper
├── manage.sh                 # Management script
├── README.md                 # Documentation
├── AEROSPACE_INTEGRATION.md # AeroSpace integration docs
├── plugins/
│   ├── spaces/
│   │   ├── items.sh         # Workspace configuration
│   │   └── handler.sh       # Event handler
│   ├── aerospace.sh         # Window state handler
│   ├── front_app_aerospace.sh # Front app display
│   ├── cpu.sh               # CPU monitor
│   ├── apple/               # Apple menu
│   ├── battery/             # Battery indicator
│   ├── calendar/            # Date & time
│   ├── volume/              # Volume control
│   └── wifi/                # WiFi status
├── settings/
│   ├── settings.sh          # General settings
│   ├── colors.sh            # Color definitions
│   └── icons.sh             # Icon definitions
├── helper/                  # Helper binary
└── archive/                 # Archived files
```

## Active Components
- **Workspaces**: 6 AeroSpace workspaces with app icons
- **System Info**: CPU, Battery, WiFi
- **Time**: Calendar and clock
- **Audio**: Volume control

## Management Commands
- `./manage.sh reload` - Reload configuration
- `./manage.sh status` - Check status
- `./manage.sh backup` - Create backup
