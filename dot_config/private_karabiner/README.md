# Karabiner Configuration - AeroSpace + IDE Friendly

A clean, optimized Karabiner configuration that allows AeroSpace window manager shortcuts to work everywhere **except** in IDEs, where IDE shortcuts are preserved.

## ✨ Overview

This configuration provides the best of both worlds:
- **In IDEs**: All `Alt` shortcuts work as expected (Alt+Tab, Alt+J/K, etc.)
- **Outside IDEs**: AeroSpace shortcuts are active for window management

## 🎯 Behavior

### In IDEs (VSCode, Zed, JetBrains, etc.)
All Alt combinations work normally:
- `Alt+Tab` - IDE's application/tab switching
- `Alt+J/K/H/L` - IDE's navigation commands
- `Alt+1/2/3...` - IDE's specific functions
- `Alt+Arrow keys` - IDE's navigation

### Outside IDEs (Finder, Terminal, Browser, etc.)
AeroSpace shortcuts are active:

#### Workspace Switching
- `Alt+1` - Workspace 1 (Mail)
- `Alt+2` - Workspace 2 (Postman)
- `Alt+3` - Workspace 3 (Code)
- `Alt+Q` - Workspace 4 (Arc Browser)
- `Alt+W` - Workspace 5 (Messages/Slack)
- `Alt+E` - Workspace 6 (OrbStack/Docker)

#### Window Navigation
- `Alt+H` - Focus left window
- `Alt+J` - Focus down window
- `Alt+K` - Focus up window
- `Alt+L` - Focus right window

#### Special Commands
- `Alt+Tab` - Switch to previous workspace
- `Alt+F` - Toggle fullscreen
- `Alt+Space` - Toggle floating window

## 🏷️ Supported IDEs

The following applications are automatically detected as IDEs:
- **Visual Studio Code** (`com.microsoft.VSCode`)
- **Zed** (`dev.zed.Zed`)
- **Zed Preview** (`dev.zed.Zed-Preview`)
- **JetBrains IDEs** (`com.jetbrains.*`)
  - IntelliJ IDEA
  - WebStorm
  - PyCharm
  - PhpStorm
  - etc.
- **Sublime Text** (`com.sublimetext.*`)
- **Atom** (`com.github.atom`)
- **Xcode** (`com.apple.dt.Xcode`)
- **Nova** (`com.panic.Nova`)
- **VSCodium** (`com.visualstudio.code.oss`)

## 🚀 Installation

### Prerequisites
1. **AeroSpace** window manager installed and running
2. **Karabiner-Elements** installed

### Setup
1. **Copy configuration**: This directory should be at `~/.config/karabiner/`
2. **Open Karabiner-Elements** application
3. **Go to "Complex Modifications"** tab
4. **Click "Add rule"**
5. **Find "AeroSpace + IDE Friendly Configuration"**
6. **Click "Enable All"** to activate all rules
7. **Restart Karabiner** (optional but recommended)

## 📁 File Structure

```
~/.config/karabiner/
├── karabiner.json                              # Main configuration
├── README.md                                   # This documentation
├── STRUCTURE.md                                # Directory structure info
├── test-config.sh                             # Configuration test script
├── cleanup-karabiner.sh                       # Cleanup utility
├── complex_modifications/
│   └── aerospace-ide-friendly.json            # AeroSpace rules
├── backups/                                    # Recent backups (max 3)
├── automatic_backups/                         # Karabiner auto-backups
└── archive/                                    # Old configurations
```

## 🧪 Testing

Run the test script to verify everything is working:
```bash
cd ~/.config/karabiner
./test-config.sh
```

The script will check:
- Karabiner service status
- Configuration files
- Current application detection
- AeroSpace integration

## 🛠 Management

### Test Configuration
```bash
./test-config.sh
```

### Clean Up Old Files
```bash
./cleanup-karabiner.sh
```

### Restart Karabiner
```bash
launchctl stop org.pqrs.karabiner.karabiner_console_user_server
launchctl start org.pqrs.karabiner.karabiner_console_user_server
```

## 🔧 Troubleshooting

### IDE Shortcuts Not Working
1. **Check if your IDE is supported**: Run `./test-config.sh` to see current app detection
2. **Add new IDE**: Edit `karabiner.json` and add the bundle identifier to the `bundle_identifiers` arrays
3. **Find bundle ID**: `osascript -e 'id of app "YourIDE"'`

### AeroSpace Shortcuts Not Working
1. **Ensure AeroSpace is running**: `open -a AeroSpace`
2. **Check workspace switching**: Try `aerospace workspace 1` in terminal
3. **Verify you're not in an IDE**: The rules only work outside IDEs

### General Issues
1. **Restart Karabiner** using the command above
2. **Check Karabiner-Elements** app for rule status
3. **Run test script** for detailed diagnostics
4. **Check logs**: Open Console.app and search for "karabiner"

## 📝 Adding New IDEs

To add support for a new IDE:

1. **Find the bundle identifier**:
   ```bash
   osascript -e 'id of app "YourIDE"'
   ```

2. **Edit configuration**: Add the bundle ID to each rule's `bundle_identifiers` array in `karabiner.json`

3. **Restart Karabiner** to apply changes

Example bundle ID patterns:
- `^com\.yourcompany\.yourapp$` - Exact match
- `^com\.jetbrains\.` - Match all JetBrains apps

## 💾 Backups

- **Automatic backups**: Created before configuration changes
- **Manual backups**: Stored in `backups/` (max 3 kept)
- **Archive**: Old configurations in `archive/`

To restore a backup:
```bash
cp backups/karabiner_TIMESTAMP.json karabiner.json
```

## 🎨 Customization

### Change Workspace Assignments
Edit the `shell_command` values in `karabiner.json`:
```json
"to": [{ "shell_command": "aerospace workspace 1" }]
```

### Modify Key Bindings
Change the `key_code` values in the `from` sections:
```json
"from": {
    "key_code": "1",  # Change this key
    "modifiers": { "mandatory": ["left_option"] }
}
```

### Add New Commands
Add new manipulators to the rules array with:
- `from`: Key combination to trigger
- `to`: AeroSpace command to execute
- `conditions`: When to apply (exclude IDEs)

## 📚 Resources

- [Karabiner-Elements Documentation](https://karabiner-elements.pqrs.org/)
- [AeroSpace Documentation](https://github.com/nikitabobko/AeroSpace)
- [Bundle Identifier Reference](https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleidentifier)

## 📄 License

This configuration is provided as-is for personal use. Feel free to modify and share.

---

**Status**: ✅ Clean, optimized, and fully functional
**Last Updated**: $(date +%Y-%m-%d)
**Version**: Final Clean Configuration