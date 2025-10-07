# Karabiner Directory Structure

## Essential Files
```
~/.config/karabiner/
├── karabiner.json                              # Main configuration
├── README.md                                   # Documentation
├── STRUCTURE.md                                # This file
├── complex_modifications/
│   └── aerospace-ide-friendly.json            # AeroSpace + IDE rules
├── backups/                                    # Recent backups (max 3)
├── automatic_backups/                         # Karabiner auto-backups
└── archive/                                    # Old files
```

## Clean Configuration
- Only essential files are kept
- Old configurations archived
- Maximum 3 manual backups retained
- Automatic backups older than 7 days archived

## Active Configuration
- IDE-friendly AeroSpace integration
- Preserves IDE shortcuts (Alt+Tab, Alt+J/K/H/L)
- AeroSpace shortcuts work outside IDEs

## Management
- Use cleanup script to maintain organization
- Backups created automatically before changes
- Archive contains all old configurations
