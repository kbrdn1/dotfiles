# Formatter & Linter Expert

**Universal code formatter and linter for multi-ecosystem projects**

Intelligent meta-formatter/linter that automatically detects your project's ecosystem, respects asdf version management, and provides flexible formatting/linting workflows across 9+ development environments.

---

## Features

✨ **Multi-Ecosystem Support**
- Laravel/PHP (Pint, PHP-CS-Fixer, PHPStan)
- JavaScript/TypeScript (Prettier, Biome, ESLint)
- React, Vue, Astro, Nuxt frameworks
- Go (gofmt, goimports, golangci-lint)
- Rust (rustfmt, clippy)
- Deno (deno fmt, deno lint)

🎯 **Intelligent Detection**
- Automatic ecosystem detection from file markers
- Framework identification for JS/TS projects
- Configuration auto-discovery

📦 **asdf Integration**
- Respects `.tool-versions` for version consistency
- Multiple modes: strict, fallback, warn
- Validates tool versions before execution

⚙️ **Flexible Modes**
- **Analyze:** Report issues without modifications
- **Format:** Auto-fix all formatting issues
- **Interactive:** Review and approve changes file-by-file

📊 **Comprehensive Reporting**
- Markdown reports (human-readable)
- JSON exports (CI/CD integration)
- Console summaries with color-coded output

---

## Quick Start

### Installation

```bash
# 1. Navigate to your personal Claude skills directory
mkdir -p ~/.claude/skills
cd ~/.claude/skills

# 2. Copy the skill
cp -r /tmp/formatter-linter-expert .

# 3. Make scripts executable
chmod +x formatter-linter-expert/scripts/*.py

# 4. Verify installation
python3 formatter-linter-expert/scripts/main.py --help
```

### Prerequisites

**Required:**
- Python 3.9+
- Ecosystem-specific tools (see below)

**Optional but Recommended:**
- asdf version manager

**Tool Installation:**

```bash
# PHP/Laravel
composer global require laravel/pint friendsofphp/php-cs-fixer phpstan/phpstan

# JavaScript/TypeScript
npm install -g prettier eslint @biomejs/biome
# OR
bun add -g prettier eslint @biomejs/biome

# Go
go install golang.org/x/tools/cmd/goimports@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Rust (included with rustup)
rustup component add rustfmt clippy

# Deno
curl -fsSL https://deno.land/install.sh | sh
```

---

## Usage

### In Claude Code

Simply invoke naturally:

```
"Analyze this Laravel project"
"Format all TypeScript files"
"Lint and report on src/ directory"
"Interactive format for Go code"
"Generate quality report with JSON export"
```

### Manual CLI Usage

```bash
# Navigate to skill directory
cd ~/.claude/skills/formatter-linter-expert

# Analyze project
python scripts/main.py --mode analyze --project-root /path/to/project

# Format files
python scripts/main.py --mode format --project-root .

# Interactive mode
python scripts/main.py --mode interactive

# Custom config
python scripts/main.py --mode format --config my-pint.json

# Specific scope
python scripts/main.py --mode analyze --scope src/

# Export JSON
python scripts/main.py --mode analyze --export-json --report-name report
```

---

## Configuration

### asdf Integration

Create `.tool-versions` in your project root:

```
php 8.2.0
nodejs 20.10.0
golang 1.21.0
rust 1.75.0
```

**Modes:**
- `--asdf-mode strict` - Use only asdf versions, fail if not installed
- `--asdf-mode fallback` - Try asdf, fallback to system (default)
- `--asdf-mode warn` - Warn about mismatches but continue
- `--asdf-mode ignore` - Skip asdf completely

### Custom Configurations

The skill auto-detects configs like:
- `pint.json`, `.php-cs-fixer.php`
- `.prettierrc`, `.eslintrc`, `biome.json`
- `.golangci.yml`
- `rustfmt.toml`
- `deno.json`

Or use `--config` to specify custom path.

### Default Configurations

If no config found, skill uses sensible defaults from:
- `configs/defaults/php/pint.json`
- `configs/defaults/js/.prettierrc`
- etc.

---

## Examples

### Example 1: Analyze Laravel Project

```bash
# In Claude Code
"Analyze and generate quality report for this Laravel API"

# Manual CLI
cd ~/.claude/skills/formatter-linter-expert
python scripts/main.py \
  --mode analyze \
  --project-root ~/Projects/my-laravel-api \
  --export-json

# Output:
# ✅ Detected: Laravel (95% confidence)
# ✅ php: 8.2.0 (asdf)
# ✅ Laravel config: pint.json (detected)
# 📊 Files analyzed: 127
# 🔍 Issues found: 42 (5 errors, 15 warnings, 22 info)
# 📄 Markdown report: code-quality-report.md
# 📄 JSON report: code-quality-report.json
```

### Example 2: Format TypeScript with Biome

```bash
"Format all TypeScript files using Biome"

# Skill automatically:
# - Detects TypeScript project
# - Uses Node 20.10.0 from .tool-versions
# - Finds biome.json config
# - Runs: biome format --write src/
# - Reports: ✅ Formatted 45 files
```

### Example 3: Interactive Go Formatting

```bash
"Interactive format for Go files in cmd/ directory"

# For each .go file:
# - Shows gofmt diff
# - Prompts: Apply? [y/n/s/q]
# - Applies only if 'y'
```

### Example 4: Multi-Ecosystem Project

```bash
"Full project format - both backend and frontend"

# Detects:
# - Laravel (PHP 8.2.0)
# - Vue.js (Node 20.10.0)
#
# Runs:
# 1. PHP formatting (Pint on app/, routes/, database/)
# 2. Vue formatting (Prettier on resources/js/)
#
# Combined report for both ecosystems
```

---

## Architecture

```
formatter-linter-expert/
├── SKILL.md                     # Claude Code skill definition
├── README.md                    # This file
│
├── scripts/
│   ├── main.py                  # Entry point
│   ├── detectors/               # Environment detection
│   ├── formatters/              # Formatters by ecosystem
│   ├── linters/                 # Linters by ecosystem
│   ├── reporters/               # Report generation
│   └── utils/                   # Utilities
│
├── configs/
│   ├── defaults/                # Default configurations
│   └── settings.json            # Skill settings
│
├── resources/
│   └── ...                      # Documentation
│
└── logs/                        # Execution logs
```

---

## Extending the Skill

### Adding a New Ecosystem

1. **Add ecosystem marker** in `detectors/environment_detector.py`:
```python
MARKERS = {
    "my-ecosystem": {
        "required": ["marker-file"],
        "extensions": [".ext"],
        "required_tools": ["tool-name"]
    }
}
```

2. **Create formatter** in `formatters/my_ecosystem_formatter.py`:
```python
class MyEcosystemFormatter(BaseFormatter):
    # Implement abstract methods
    pass
```

3. **Create linter** in `linters/my_ecosystem_linter.py`:
```python
class MyEcosystemLinter(BaseLinter):
    # Implement abstract methods
    pass
```

4. **Update main.py** to import new classes in `_get_formatter_class()` and `_get_linter_class()`.

---

## Troubleshooting

### "No ecosystem detected"

**Cause:** Project lacks recognizable file markers

**Fix:**
```bash
# Use --env flag to specify manually
python scripts/main.py --mode analyze --env laravel
```

### "asdf: command not found"

**Cause:** asdf not installed or not in PATH

**Fix:**
```bash
# Install asdf
git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0
echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
source ~/.bashrc

# OR use --asdf-mode ignore
python scripts/main.py --mode analyze --asdf-mode ignore
```

### "Tool not found: pint"

**Cause:** Formatter not installed

**Fix:**
```bash
# Install Laravel Pint
composer global require laravel/pint

# Verify
pint --version
```

---

## Roadmap

- [x] Multi-ecosystem support (9 environments)
- [x] asdf integration
- [x] Interactive mode
- [x] JSON export for CI/CD
- [ ] Python support (black, ruff)
- [ ] Swift support (swift-format)
- [ ] GitHub Actions integration
- [ ] Parallel execution for large projects
- [ ] VS Code extension

---

## Contributing

This is a personal skill. To modify:

1. Edit files in `~/.claude/skills/formatter-linter-expert/`
2. Test changes with `python scripts/main.py --help`
3. Update version in `SKILL.md` and `configs/settings.json`

---

## License

Personal use only.

## Author

Created for cross-project personal use
Version: 1.0.0
Date: 2025-10-30

---

## Support

**Need Help?**
- Check [SKILL.md](SKILL.md) for detailed instructions
- Review tool installation: `which pint`, `which prettier`, etc.
- Verify asdf setup: `asdf current`
- Test manually: `vendor/bin/pint --test`, `prettier --check src/`
