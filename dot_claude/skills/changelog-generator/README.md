# Changelog Generator

**Intelligent Git History Analyzer for Dual-Format Changelogs**

Automatically generate comprehensive changelogs from Git history with:
- 📊 **Working days calculation** (French holidays, course weeks, weekends)
- 🎯 **Feature consolidation** (temporal clustering of related changes)
- 🔗 **GitHub enrichment** (PRs, Issues, contributors metadata)
- 🌐 **AI translation** (technical → client-friendly descriptions)
- 📝 **Dual formats**: Client-accessible + Developer-detailed

## Quick Start

```bash
# Installation
cd ~/.claude/skills/changelog-generator
bash scripts/setup.sh

# Add to PATH (optional, for global access)
bash scripts/install_to_path.sh
source ~/.zshrc  # or source ~/.bashrc

# Test
changelog-generator validate

# Usage in your project
cd /your/project
changelog-generator generate --version v1.0.0
```

## Description

This Claude Code skill automates the creation of sophisticated, dual-format changelogs that accurately reflect development effort and provide value to both technical and non-technical audiences.

### Key Features

- **✨ Smart Parsing**: Conventional Commits support with flexible fallback
- **📅 Accurate Metrics**: Working days calculated excluding weekends, holidays, and course weeks
- **🎯 Intelligent Consolidation**: Automatically groups temporally-related features
- **🔗 GitHub Integration**: Enriches commits with PR descriptions, labels, and reviewers
- **🌐 Translation Engine**: Converts technical jargon to user-friendly language
- **📝 Dual Output**:
  - `./changelogs/client/vX.Y.Z_client.md` - Accessible for end-users
  - `./changelogs/vX.Y.Z_technical.md` - Detailed for developers

## Requirements

- **Go** 1.22 or higher
- **Git** (any recent version)
- **GitHub Token** (optional, for PR/Issue enrichment)
- **jq** (optional, for JSON validation in scripts)

## Usage

### Activation in Claude Code

This skill automatically activates when you say phrases like:
- "Generate the changelog for version 0.38.0"
- "Create a changelog for the release from main to dev"
- "Prepare client changelog for v0.39.0"
- "Calculate working days for the latest release"
- "Analyze commits and generate technical changelog"

### Command Line Interface

#### Generate Changelog

**Basic usage** (default branches: main ↔ dev):
```bash
changelog-generator generate --version v0.38.0
```

**Custom branches**:
```bash
changelog-generator generate \
  --version v0.38.0 \
  --base main \
  --compare feat/new-feature
```

**Tag range**:
```bash
changelog-generator generate \
  --version v0.38.0 \
  --from-tag v0.37.0 \
  --to-tag v0.38.0
```

**Output formats**:
```bash
# Both formats (default)
changelog-generator generate --version v0.38.0

# Client only
changelog-generator generate --version v0.38.0 --format client

# Technical only
changelog-generator generate --version v0.38.0 --format technical
```

#### Calculate Working Days

```bash
# Between tags
changelog-generator calculate \
  --from-tag v0.37.0 \
  --to-tag v0.38.0

# Between dates
changelog-generator calculate \
  --from 2025-01-01 \
  --to 2025-01-31

# Show excluded dates
changelog-generator calculate \
  --from 2025-01-01 \
  --to 2025-01-31 \
  --show-excluded-dates
```

#### Validate Configuration

```bash
changelog-generator validate
```

## Configuration

### Working Days Exclusions

Edit `config/exclusions.json`:

```json
{
  "country": "FR",
  "course_weeks": [
    {
      "start": "2025-01-20",
      "end": "2025-01-24",
      "description": "Formation janvier 2025"
    }
  ],
  "custom_holidays": []
}
```

### Changelog Settings

Edit `config/changelog_config.json`:

```json
{
  "branches": {
    "default_base": "main",
    "default_compare": "dev"
  },
  "output": {
    "dir": "./changelogs",
    "client_subdir": "client"
  },
  "metadata": {
    "include_prs": true,
    "include_issues": true,
    "include_contributors": true,
    "include_metrics": {
      "working_days": true,
      "efficiency": true,
      "loc_changes": true
    }
  },
  "consolidation": {
    "enabled": true,
    "time_threshold_days": 3,
    "scope_matching": true
  },
  "github": {
    "enabled": true,
    "token_env_var": "GITHUB_TOKEN",
    "organization": "YourOrg",
    "repository": "your-repo"
  }
}
```

### Translation Rules

Edit `config/translation_rules.json` to customize technical → client-friendly translations:

```json
{
  "scope_patterns": {
    "auth": "système de connexion",
    "payment": "paiements"
  },
  "action_patterns": {
    "implement": "Mise en place",
    "fix": "Correction"
  },
  "technical_terms": {
    "JWT": "système de sécurité des connexions",
    "API": "interface de programmation"
  }
}
```

### GitHub Authentication

```bash
export GITHUB_TOKEN="ghp_YourPersonalAccessToken"
```

Generate token at: https://github.com/settings/tokens

**Required scopes**:
- `repo` (for private repos)
- `public_repo` (for public repos)

### Formatting Features

The technical changelog includes several formatting enhancements:

#### PR Links
When you configure GitHub organization and repository, PR numbers automatically become clickable links:
```markdown
- **feat** : ([#500](https://github.com/YourOrg/your-repo/pull/500)) Feature description
```

#### Date Format
All dates are displayed in DD/MM/YYYY format (French standard):
```markdown
> Temps de résolution: 12 jours (15/10/2025 - 27/10/2025)
```

#### Developer Attribution
Developer usernames are mentioned with @ symbol for easy GitHub linking:
```markdown
> Développeur: @kbrdn1
> Développeurs: @kbrdn1, @mehdi
```

#### Resolution Time
Each feature includes the working days calculation and date range:
```markdown
> Temps de résolution: 12 jours (15/10/2025 - 27/10/2025)
```

## Examples

### Example 1: Client Changelog

```markdown
# Version 0.38.0 - 15/01/2025

## ✨ Nouveautés
- Nouveau système de paiement simplifié pour les établissements scolaires
- Génération automatique de devis et bons de commande

## 🔧 Améliorations
- Performance des paiements augmentée de 30%
- Stabilité générale renforcée

## 🐛 Corrections
- Problème de validation des webhooks Stripe résolu
```

### Example 2: Technical Changelog

```markdown
# Version 0.38.0 - 30/10/2025

## Description
Cette version comprend 289 modifications développées sur 91 jours calendaires (64 jours ouvrés).
Les principales évolutions incluent 66 nouvelles fonctionnalités, 59 corrections de bugs,
5 corrections urgentes et 11 améliorations techniques.

## Ajouté
- **feat** : ([#500](https://github.com/YourOrg/your-repo/pull/500)) Add ACS subscription import system with auto-linking
  > Développeur: @kbrdn1
  > Temps de résolution: 12 jours (15/10/2025 - 27/10/2025)

- **feat** : ([#519](https://github.com/YourOrg/your-repo/pull/519)), ([#520](https://github.com/YourOrg/your-repo/pull/520)) Improve products table and add client endpoints
  > Développeurs: @kbrdn1, @mehdi
  > Temps de résolution: 8 jours (21/10/2025 - 29/10/2025)

## Corrigé
- **fix** : ([#523](https://github.com/YourOrg/your-repo/pull/523)) Resolve webhook validation issues
  > Développeur: @kbrdn1
  > Temps de résolution: 2 jours (28/10/2025 - 30/10/2025)

## Détails de la version
- **Temps total**: 91 jours calendaires
- **Temps de développement**: 64 jours ouvrés (33 jours avec commits)
- **Période**: 01/08/2025 - 30/10/2025
- **Développeurs**: @kbrdn1, @mehdi, @alex
- **Efficacité**: 51.6% (8.76 commits/jour)
- **Commits**: 289 modifications
- **Pull Requests**: 78 PRs mergés

### Principales fonctionnalités
- Add ACS subscription import system with auto-linking (12 jours)
- Improve products table and add client endpoints (8 jours)
- Implement email confirmation process (5 jours)
```

## Architecture

```
User Request → Claude Code → SKILL.md (orchestration)
                                ↓
                    Go Application (changelog-generator)
                                ↓
      ┌─────────────────────────┼─────────────────────────┐
      ↓                         ↓                         ↓
   Git Parser              GitHub API              Calendar Calculator
      ↓                         ↓                         ↓
      └─────────────────────────┼─────────────────────────┘
                                ↓
                      Consolidator + Translator
                                ↓
                    Template Engine (Markdown)
                                ↓
                  ┌─────────────┴─────────────┐
                  ↓                           ↓
           Client Changelog            Technical Changelog
```

## Token Efficiency

Claude Code skill design:
- **Metadata**: ~450 tokens (always loaded)
- **Instructions**: ~4,200 tokens (on-demand when activated)
- **Go application**: 0 tokens (external binary)
- **Total**: ~4,650 tokens on-demand load

Heavy processing in Go = No token cost during execution!

## Testing

```bash
# Run validation
./bin/changelog-generator validate

# Test with sample repo
cd /path/to/your/project
./bin/changelog-generator generate --version v1.0.0

# Validate output
ls -la ./changelogs/
cat ./changelogs/v1.0.0_technical.md
```

## Troubleshooting

### Issue: Binary not found

```bash
cd ~/.claude/skills/changelog-generator
bash scripts/setup.sh
```

### Issue: GitHub API fails

Check token:
```bash
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

Regenerate at: https://github.com/settings/tokens

### Issue: Working days calculation incorrect

Validate exclusions config:
```bash
cat config/exclusions.json | jq .
```

### Issue: Commits not detected

Verify branches:
```bash
git branch -a | grep -E "(main|dev)"
git log --oneline main..dev
```

## Best Practices

### ✅ DO

1. **Use Conventional Commits** for automatic categorization
2. **Configure exclusions** for accurate working days
3. **Enrich with GitHub** for complete context
4. **Review before finalizing** - AI translation is a draft

### ⚠️ AVOID

1. **Dumping git log** - Use structured format
2. **Technical jargon in client changelog**
3. **Skipping validation** - Always review generated content
4. **Ignoring context** - Features need "why" not just "what"

## Contributing

This skill is located at: `~/.claude/skills/changelog-generator/`

To modify:
1. Edit files in the skill directory
2. Rebuild: `cd ~/.claude/skills/changelog-generator && go build -o bin/changelog-generator cmd/changelog-generator/main.go`
3. Test: `./bin/changelog-generator validate`

## Changelog

### v1.1.0 - 2025-10-30
- ✨ Enhanced PR link formatting with clickable GitHub URLs
- 📅 DD/MM/YYYY date format (French standard)
- 🔗 GitHub organization and repository configuration
- 🎯 Space before colon in entry format (`**feat** :`)
- 🧹 Cleaner output without excessive blank lines
- 📝 Improved developer attribution with @ mentions
- 🛠️ PATH installation script for global access

### v1.0.0 - 2025-01-30
- Initial release
- Git log parsing with Conventional Commits fallback
- Working days calculation (French holidays)
- Dual format generation (client + technical)
- GitHub PR/Issue enrichment
- Feature consolidation
- Automated translation

## License

MIT

## Author

Created via `/me:skill-create` interactive workflow
Date: 2025-01-30

---

**Need Help?**
- Check `SKILL.md` for detailed instructions
- Run `changelog-generator --help`
- Review `test/fixtures/` for example outputs
- Validate config with `bash scripts/validate_config.sh`
