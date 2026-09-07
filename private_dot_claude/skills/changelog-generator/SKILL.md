---
name: changelog-generator
description: Generate changelogs from Git history -- extract git logs, split CHANGELOG.md into individual version files, calculate working days with French holidays. Triggers on "generate changelog", "split changelog", "working days", "changelog for version X"
allowed-tools: Bash, Read, Write, Grep, Glob
---

# Changelog Generator

CLI Go tool + skill for generating and managing changelogs from git history.

## When to Use

- "generate the changelog for version X.Y.Z"
- "split the changelog into individual files"
- "extract the git log"
- "calculate working days for this release"
- "prepare changelog for the release"

## Architecture

```
~/.claude/skills/changelog-generator/
├── cmd/changelog-generator/main.go    # CLI entry point
├── internal/
│   ├── parser/parser.go               # CHANGELOG.md + git log parsing
│   ├── splitter/splitter.go           # split into individual version files
│   └── calendar/calendar.go           # working days (FR holidays, course weeks)
├── config/changelog.config.json       # default exclusions config
├── templates/generate_changelog.md    # prompt template for redaction
└── scripts/setup.sh                   # build + install
```

## Setup (one time)

```bash
cd ~/.claude/skills/changelog-generator
bash scripts/setup.sh
```

Or build manually:
```bash
cd ~/.claude/skills/changelog-generator
go build -o bin/changelog-generator ./cmd/changelog-generator
```

## Subcommands

### extract -- git log to file

Extracts git history between two branches into `git-log.txt` using a structured format parsable by the tool.

```bash
changelog-generator extract --base main --compare dev --limit 400
```

Output: `<project-root>/git-log.txt`

### split -- CHANGELOG.md to individual files

Parses `CHANGELOG.md` and generates one file per version in `changelogs/`:
- Release versions: `changelogs/vX.Y.Z.md`
- Pre-releases (major 0 or `-beta`/`-rc` suffix): `changelogs/pre-releases/vX.Y.Z.md`

Uses SHA-256 hash comparison to only write files that actually changed. Reports created/updated/unchanged counts.

```bash
changelog-generator split --output-dir ./changelogs --clean
```

Flags:
- `--changelog`: path to main CHANGELOG.md (default: CHANGELOG.md)
- `--output-dir`: output directory (default: ./changelogs)
- `--clean`: remove orphaned files not present in CHANGELOG.md

### metrics -- working days calculation

Calculates development productivity metrics per version:
- calendar days, working days (excluding weekends, French holidays, course weeks)
- unique days with commits, commits per day efficiency
- outputs JSON report

```bash
changelog-generator metrics --changelog CHANGELOG.md
```

Configuration via `changelog.config.json`:
```json
{
  "country": "FR",
  "course_weeks": [
    {"start": "2025-01-20", "end": "2025-01-24"},
    {"start": "2025-02-17", "end": "2025-02-21"}
  ]
}
```

French holidays are calculated automatically (11 fixed + 3 Easter-dependent via computus algorithm).

### generate -- full pipeline

Runs extract + prompts for redaction + split in sequence.

```bash
changelog-generator generate --version v1.2.0 --base main --compare dev
```

Steps:
1. Extract git log from `base..compare`
2. Print instructions for changelog redaction (via `/generate_changelog` Claude command or manual edit)
3. Split existing CHANGELOG.md into individual files

## Workflow

The recommended workflow for a new release:

```
1. changelog-generator extract --base main --compare dev
   -> generates git-log.txt

2. /generate_changelog   (Claude command using templates/generate_changelog.md)
   -> Claude reads CHANGELOG.md + git-log.txt and appends the new version

3. changelog-generator split --output-dir ./changelogs --clean
   -> splits into changelogs/vX.Y.Z.md files

4. (optional) changelog-generator metrics
   -> generates working_days_report.json
```

Or use `make` targets if the project has them:
```bash
make generate-git-log       # step 1
make generate-changelogs    # step 3
make calculate-working-days # step 4
```

## CHANGELOG.md Format

The parser supports two header formats:
- `# Version X.Y.Z - YYYY-MM-DD` (Flippad convention)
- `## [X.Y.Z] - YYYY-MM-DD` (Keep a Changelog standard)

Entry format:
```markdown
- **Feat** : #<issue> ([#<pr>](url)) Description
  > Detailed description with technical context
  > DD/MM/YYYY - @author
```

Entries are auto-categorized into Features, Fixes, and Chores based on bold level markers (`**Feat**`, `**Fix**`, `**Chore**`, etc.) or inferred from keywords.

## Pre-release Detection

A version is considered pre-release when:
- Major version is 0 (e.g. `0.42.0`) -- semver convention
- Version has a pre-release suffix: `-alpha`, `-beta`, `-rc.1`, `-dev`

This replaces the previous hardcoded logic (`major == "0" && minor == "23"`).

## Improvements Over Original Tools

| Issue in original | Fix |
|---|---|
| `isPreRelease()` hardcoded for v0.23.0 only | Proper semver: major 0 or `-beta`/`-rc` suffix |
| Course weeks hardcoded in Go source | Configurable via `changelog.config.json` |
| Output dirs hardcoded as `../changelogs/` | Configurable via `--output-dir` flag |
| Always overwrites files | SHA-256 hash comparison, only writes if changed |
| No orphan cleanup | `--clean` flag removes files not in CHANGELOG |
| Only one header format supported | Supports both `# Version X.Y.Z` and `## [X.Y.Z]` |
| No structured git log format | Uses `---COMMIT---` separator with field delimiters |
| Working days report only in markdown | JSON output for programmatic use |

## Error Handling

| Error | Cause | Fix |
|---|---|---|
| "not inside a git repository" | Running outside a git repo | `cd` into the project |
| "parse changelog: open..." | CHANGELOG.md not found | Check `--changelog` path |
| "git log failed" | Branch doesn't exist or no commits in range | Verify branches with `git branch -a` |
| config not found | No `changelog.config.json` | Copy from skill: `config/changelog.config.json` |

## Boundaries

**Will**: extract git logs, parse changelogs, split into files, calculate working days, provide prompt for redaction

**Will not**: automatically write changelog content (that's the human/AI redaction step), push to git, create releases, interact with GitHub API
