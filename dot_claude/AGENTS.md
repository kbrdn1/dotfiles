# Agent Guidelines for SuperClaude Framework

## Build/Test Commands
No build or test commands - this is a configuration framework directory for Claude Code.

## Code Style

### File Organization
- Framework docs: Root level (RULES.md, FLAGS.md, MODE_*.md, MCP_*.md, BUSINESS_*.md)
- Agent definitions: `/agents/` directory
- Scripts: `/scripts/` directory (JavaScript with Bun runtime)
- Debug logs: `/debug/` directory
- Backups: `/backups/` directory
- Analysis/reports: `/claudedocs/` directory (if created)

### JavaScript Style (for scripts/)
- Runtime: Bun (use `#!/usr/bin/env bun` shebang)
- Use modern ES6+ features (async/await, destructuring)
- camelCase for variables/functions, UPPER_CASE for constants
- Objects for configuration (see SECURITY_RULES pattern in validate-command.js)

### Markdown Style (for .md files)
- Use H1 (#) for file title only
- Use H2 (##) for major sections
- Use priority markers: 🔴 CRITICAL, 🟡 IMPORTANT, 🟢 RECOMMENDED
- Include examples with ✅ Right / ❌ Wrong patterns
- Use @filename.md for file references (SuperClaude import syntax)
