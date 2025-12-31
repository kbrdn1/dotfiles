---
name: changelog-generator
description: Generate comprehensive changelogs from Git history with dual formats (client-accessible and technical) including working days calculation, feature consolidation, GitHub enrichment, and automated client-friendly translation
version: 1.0.0
dependencies: ["go >= 1.22", "git", "github.com/rickar/cal/v2", "github.com/google/go-github/v58", "github.com/spf13/cobra", "github.com/spf13/viper"]
allowed-tools: ["Bash", "Read", "Write"]
---

# Changelog Generator - Intelligent Git History Analyzer

## Overview

This skill automates the generation of sophisticated, dual-format changelogs from Git history with:
- **Smart parsing**: Git log analysis with Conventional Commits fallback
- **Working days calculation**: Accurate development time accounting (French holidays, course weeks, weekends)
- **Feature consolidation**: Automatic grouping of related changes
- **Dual formats**: Client-accessible (non-technical) + Developer (detailed metrics)
- **GitHub enrichment**: PRs, Issues, contributors metadata
- **AI translation**: Technical descriptions → user-friendly language

## When to Use This Skill

Activate when user says:
- "Generate the changelog for version X.Y.Z"
- "Create a changelog for the release..."
- "Analyze commits since last version"
- "Prepare client changelog for v0.38.0"
- "Technical changelog for the release"
- "Compare main and dev branches for changelog"
- "Calculate working days for development"

## What It Does

1. **Analyzes Git history**: Parses commits between branches/tags
2. **Calculates metrics**: Working days, efficiency, productivity trends
3. **Consolidates features**: Groups temporally-related changes
4. **Enriches with GitHub**: Fetches PR descriptions, labels, reviewers
5. **Translates for clients**: Converts technical jargon → accessible language
6. **Generates dual changelogs**:
   - `./changelogs/client/vX.Y.Z_client.md` (user-friendly)
   - `./changelogs/vX.Y.Z_technical.md` (developer details)

## Prerequisites

- Go 1.22 or higher installed
- Git repository initialized
- GitHub token (optional, for PR/Issue enrichment)
- Configuration files in project root:
  - `config/exclusions.json` (working days exclusions)
  - `config/changelog_config.json` (generation settings)

## Instructions

### Step 1: Installation & Setup

Run the setup script to install dependencies and validate environment:

```bash
cd ~/.claude/skills/changelog-generator
bash scripts/setup.sh
```

This will:
- Install Go dependencies via `go mod download`
- Validate Git repository
- Check configuration files
- Build the binary

### Step 2: Configuration

**Working Days Exclusions** (`config/exclusions.json`):
```json
{
  "country": "FR",
  "course_weeks": [
    {"start": "2025-01-20", "end": "2025-01-24"},
    {"start": "2025-02-17", "end": "2025-02-21"}
  ],
  "custom_holidays": []
}
```

**Changelog Settings** (`config/changelog_config.json`):
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
    "token_env_var": "GITHUB_TOKEN"
  }
}
```

**GitHub Authentication** (optional):
```bash
export GITHUB_TOKEN="ghp_YourPersonalAccessToken"
```

### Step 3: Generate Changelog

**Basic usage** (uses default branches main ↔ dev):
```bash
cd ~/.claude/skills/changelog-generator
go run cmd/changelog-generator/main.go generate --version v0.38.0
```

**Custom branches**:
```bash
go run cmd/changelog-generator/main.go generate \
  --version v0.38.0 \
  --base main \
  --compare feat/new-feature
```

**Tag range**:
```bash
go run cmd/changelog-generator/main.go generate \
  --version v0.38.0 \
  --from-tag v0.37.0 \
  --to-tag v0.38.0
```

**Output formats**:
```bash
# Both formats (default)
go run cmd/changelog-generator/main.go generate --version v0.38.0

# Client only
go run cmd/changelog-generator/main.go generate --version v0.38.0 --format client

# Technical only
go run cmd/changelog-generator/main.go generate --version v0.38.0 --format technical
```

### Step 4: Validate & Review

Generated files:
```
./changelogs/
├── v0.38.0_technical.md       # Developer changelog
└── client/
    └── v0.38.0_client.md      # Client changelog
```

**Validation**:
```bash
# Validate generated changelog
bash scripts/validate_config.sh ./changelogs/v0.38.0_technical.md
```

## Error Handling

| Error Code | Description | Solution |
|------------|-------------|----------|
| GIT001 | Git repository not found | Initialize git with `git init` |
| GIT002 | Branch not found | Check branch name with `git branch -a` |
| GIT003 | No commits in range | Verify tag/branch range |
| CFG001 | Configuration file missing | Run `bash scripts/setup.sh` to create |
| CFG002 | Invalid JSON syntax | Validate with `jq . config/file.json` |
| GH001 | GitHub token invalid | Regenerate token at github.com/settings/tokens |
| GH002 | API rate limit exceeded | Wait 1 hour or use authenticated requests |
| PARSE001 | Commit parsing failed | Check git log format |
| PARSE002 | Conventional Commit parse error | Fallback to manual categorization |

## Examples

### Example 1: Standard Release Changelog

**User Request**:
> "Generate the changelog for version 0.38.0"

**Claude Actions**:
1. Read `config/changelog_config.json` (default branches: main ↔ dev)
2. Execute:
   ```bash
   cd ~/.claude/skills/changelog-generator
   go run cmd/changelog-generator/main.go generate --version v0.38.0
   ```
3. Parse output JSON:
   ```json
   {
     "status": "success",
     "files": {
       "client": "./changelogs/client/v0.38.0_client.md",
       "technical": "./changelogs/v0.38.0_technical.md"
     },
     "metrics": {
       "commits": 47,
       "working_days": 9,
       "calendar_days": 14,
       "efficiency": 5.2
     }
   }
   ```
4. Present summary to user:
   ```
   ✅ Changelog generated successfully!

   📄 Client version: ./changelogs/client/v0.38.0_client.md
   🔧 Technical version: ./changelogs/v0.38.0_technical.md

   📊 Metrics:
   - 47 commits analyzed
   - 9 working days
   - 5.2 commits/day efficiency
   ```

**Expected Output** (Client format):
```markdown
# Version 0.38.0 - 15/01/2025

## ✨ Nouveautés
- Nouveau système de paiement simplifié pour les établissements scolaires
- Génération automatique de devis et bons de commande
- Interface de gestion améliorée pour les administrateurs

## 🔧 Améliorations
- Performance des paiements augmentée de 30%
- Validation des documents PDF améliorée
- Stabilité générale renforcée

## 🐛 Corrections
- Problème de validation des webhooks Stripe résolu
- Affichage correct des montants dans toutes les devises
- Correction des notifications email
```

**Expected Output** (Technical format):
```markdown
# Version 0.38.0 - 2025-01-15

## Description
Refonte complète du système de mandats scolaires avec workflow dual quote/BC, intégration Stripe Quote API, et génération PDF automatisée.

## Feat
- **Dev**: #341 ([562](https://github.com/org/repo/pull/562)) Dual workflow for school mandates (quote + BC)
  > Implemented Stripe Quote generation, checkout session management, and PDF generation workflow
  > Développeur: @kbrdn1 | Temps: 12 jours (03/01 - 15/01)
  > Files: 18 modified, 450 LoC added, 120 LoC removed

- **Dev**: #340 ([560](https://github.com/org/repo/pull/560)) PDF generation service
  > Automated PDF generation for quotes and purchase orders with custom templates
  > Développeur: @kbrdn1 | Temps: 3 jours (05/01 - 08/01)
  > Files: 6 modified, 200 LoC added

## Fix
- **Hotfix**: #342 ([563](https://github.com/org/repo/pull/563)) Webhook signature validation
  > Fixed Stripe webhook signature verification for production environment
  > Temps: 1 jour (14/01)
  > Files: 2 modified, 15 LoC changed

## Chore
- **CI**: #339 ([559](https://github.com/org/repo/pull/559)) Update Docker configuration
  > Optimized Docker build process and dependency caching
  > Temps: 1 jour (03/01)

## Détails de la version
- **Temps total**: 14 jours calendaires
- **Jours travaillés**: 9 jours ouvrables (hors weekends, jours fériés, semaines de cours)
- **Commits**: 47
- **Efficacité**: 5.2 commits/jour
- **Contributors**:
  - @kbrdn1 (95% - 45 commits)
  - @contributor2 (5% - 2 commits)
- **Principales fonctionnalités**:
  - School mandates workflow (8 jours)
  - PDF generation (3 jours)
  - Bug fixes (2 jours)

[0.38.0]: https://github.com/org/repo/compare/v0.37.2...v0.38.0
```

### Example 2: Custom Branch Comparison

**User Request**:
> "Compare main and feat/payment-refactor branches for changelog"

**Claude Actions**:
```bash
go run cmd/changelog-generator/main.go generate \
  --version v0.39.0-beta \
  --base main \
  --compare feat/payment-refactor
```

### Example 3: Working Days Calculation Only

**User Request**:
> "Calculate the development time between v0.37.0 and v0.38.0"

**Claude Actions**:
```bash
go run cmd/changelog-generator/main.go calculate \
  --from-tag v0.37.0 \
  --to-tag v0.38.0
```

**Output**:
```json
{
  "calendar_days": 21,
  "working_days": 14,
  "excluded_days": 7,
  "exclusions": {
    "weekends": 6,
    "holidays": 0,
    "course_weeks": 1
  },
  "commits": 67,
  "efficiency": 4.8,
  "period": "2024-12-20 - 2025-01-10"
}
```

## Best Practices

### ✅ DO

1. **Use Conventional Commits** for automatic categorization
   ```
   feat(auth): add JWT refresh token rotation
   fix(payments): validate Stripe webhook signatures
   chore(deps): update Laravel to 11.x
   ```

2. **Configure exclusions** for accurate working days
   - Course weeks
   - Company-specific holidays
   - Team vacations

3. **Enrich with GitHub** for complete context
   - PR descriptions provide feature context
   - Labels help categorization
   - Reviewers show collaboration

4. **Review before finalizing** - AI translation is a draft
   - Validate client-friendly descriptions
   - Add business context where needed
   - Adjust categorization if needed

### ⚠️ AVOID

1. **Dumping git log** - Use structured format
   ❌ `git log --oneline` → changelog
   ✅ Parsed, categorized, consolidated

2. **Technical jargon in client changelog**
   ❌ "Refactor CSRF middleware validation"
   ✅ "Amélioration de la sécurité des connexions"

3. **Skipping validation** - Always review generated content
   ❌ Auto-publish without review
   ✅ Validate → adjust → publish

4. **Ignoring context** - Features need "why" not just "what"
   ❌ "Added new API endpoint"
   ✅ "Added payment processing for school subscriptions"

## Troubleshooting

### Issue: Commits not detected

**Cause**: Branch comparison incorrect or no new commits

**Fix**:
```bash
# Verify branches exist
git branch -a | grep -E "(main|dev)"

# Check commits in range
git log --oneline main..dev

# If using tags, verify they exist
git tag -l
```

### Issue: Working days calculation seems wrong

**Cause**: Exclusions config outdated or incorrect

**Fix**:
```bash
# Validate config
cat config/exclusions.json | jq .

# Test with manual date range
go run cmd/changelog-generator/main.go calculate \
  --from 2025-01-01 --to 2025-01-31 \
  --show-excluded-dates
```

### Issue: GitHub enrichment fails

**Cause**: Token invalid, expired, or missing permissions

**Fix**:
```bash
# Test token
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Regenerate with correct scopes:
# - repo (for private repos)
# - public_repo (for public repos)
```

### Issue: Translation quality poor

**Cause**: Technical terms not in mapping table

**Fix**:
Edit `config/translation_rules.json`:
```json
{
  "feat(auth)": "Amélioration de la sécurité des connexions",
  "fix(payments)": "Correction des problèmes de paiement",
  "refactor": "Amélioration de la qualité du code"
}
```

## Technical Details

### Architecture

```
User Request → Claude Code → SKILL.md (orchestration)
                                ↓
                    Go Application (changelog-generator)
                                ↓
      ┌─────────────────────────┼─────────────────────────┐
      ↓                         ↓                         ↓
   Git Parser              GitHub API              Calendar Calculator
 (commits, branches)     (PRs, Issues)           (working days, holidays)
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
        (./changelogs/client/)        (./changelogs/)
```

### Token Efficiency

- **Metadata**: ~450 tokens (always loaded)
- **Instructions** (this file): ~4,200 tokens (on-demand)
- **Go application**: 0 tokens (external binary)
- **Total on-demand load**: ~4,650 tokens

**Optimization Strategy**:
- Heavy logic in Go (no token cost)
- Configuration as JSON (not embedded in prompt)
- Templates external (loaded only when needed)
- Results returned as structured JSON

### Performance Considerations

- **Max commits analyzed**: Unlimited (Go handles efficiently)
- **Processing time**:
  - < 50 commits: ~2 seconds
  - 50-500 commits: ~5-10 seconds
  - 500+ commits: ~15-30 seconds
- **Memory usage**: ~50MB for 1000 commits
- **GitHub API**:
  - Rate limit: 5000 requests/hour (authenticated)
  - 60 requests/hour (unauthenticated)

### Data Flow

1. **Input Phase**:
   ```
   User → Branches/Tags → Git Log → Raw Commits
   ```

2. **Parsing Phase**:
   ```
   Raw Commits → Parser → Structured Commits (Type, Scope, PRs, Issues)
   ```

3. **Enrichment Phase**:
   ```
   Structured Commits → GitHub API → Enriched Commits (descriptions, labels)
   ```

4. **Calculation Phase**:
   ```
   Commit Dates → Calendar → Working Days, Metrics
   ```

5. **Consolidation Phase**:
   ```
   Enriched Commits → Consolidator → Feature Groups
   ```

6. **Translation Phase**:
   ```
   Technical Descriptions → Translator → Client-Friendly Text
   ```

7. **Generation Phase**:
   ```
   Feature Groups + Metrics → Templates → Dual Changelogs
   ```

## Related Skills

*(No related skills detected - this is your first skill)*

Potential future integrations:
- `git-release-automation` - Automatic tagging and release
- `jira-sync` - Sync changelog with Jira tickets
- `slack-notifier` - Post release notes to Slack

## Maintenance

**Version History**:
- v1.0.0 (2025-01-30) - Initial release
  - Git log parsing with Conventional Commits fallback
  - Working days calculation (French holidays)
  - Dual format generation (client + technical)
  - GitHub PR/Issue enrichment
  - Feature consolidation
  - Automated translation

**Roadmap**:
- v1.1.0: GitLab support
- v1.2.0: AI-powered translation (OpenAI integration)
- v1.3.0: Multi-language changelog (EN, FR, ES)
- v1.4.0: Jira/Linear integration

**Known Limitations**:
- GitHub-only (GitLab/Bitbucket not supported yet)
- French holidays only (other countries need manual config)
- Translation mapping requires manual updates
- No breaking change detection (manual BREAKING CHANGE: keyword required)

**Author**: Created via /me:skill-create interactive workflow
**Created**: 2025-01-30
**License**: MIT

---

**Need Help?**
- Check README.md for quick start guide
- Run `go run cmd/changelog-generator/main.go --help`
- Review test/fixtures/ for example outputs
- Validate config with `bash scripts/validate_config.sh`
