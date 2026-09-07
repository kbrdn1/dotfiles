---
name: speckit.taskstoissues
description: Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts.
tools: ['github/github-mcp-server/issue_write']
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

0. **Load project config**: Read `.specify/speckit.env` from the repo root. Parse all `SPECKIT_*` variables to determine paths and naming conventions. If `.specify/speckit.env` does not exist, fall back to defaults: `SPECKIT_SPEC_DIR=".specify/specs"`, `SPECKIT_SCRIPTS_DIR=".specify/scripts/bash"`, `SPECKIT_TEMPLATES_DIR=".specify/templates"`.

1. Run `${SPECKIT_SCRIPTS_DIR}/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").
1. From the executed script, extract the path to **tasks**.
1. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

**ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL**

1. For each task in the list, use the GitHub MCP server to create a new issue in the repository that is representative of the Git remote.

**UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL**
