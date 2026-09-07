---
name: design-export
description: Extract a website's design system (colors, typography, spacing, components, shadows, radius) into a DESIGN.md file. Use when the user asks to "extract design system", "export design tokens", "scrape branding", "analyze website styles", "extract colors and fonts from a URL", or invokes /me:design-export <url>. Uses Hyperbrowser's branding extraction via MCP, the `hx` CLI, or the @hyperbrowser/sdk as fallbacks.
version: 1.0.0
allowed-tools: ["Bash", "Read", "Write", "WebFetch"]
---

# Design System Exporter

## Overview

This skill extracts the design system from any public website URL and writes a clean, structured `DESIGN.md` file at the project root. It leverages Hyperbrowser's branding extraction to pull colors, typography, spacing, component styles, shadows, and border radius.

**When to use this skill:**
- User wants to clone or match the visual identity of an existing site
- User asks to "extract design tokens", "get the colors/fonts of <site>", "scrape design from <url>"
- User invokes the `/me:design-export <url>` slash command
- Bootstrapping a new project with a reference brand baseline

**What it does:**
1. Normalizes the input URL (prepends `https://` if missing)
2. Calls Hyperbrowser with `formats: ["branding"]` via the best available transport
3. Maps the returned data into a normalized `DESIGN.md` markdown structure
4. Writes the file to the project root (current working directory)

## Input

The user provides a URL. Examples:
- `/me:design-export stripe.com`
- `/me:design-export https://linear.app`
- `/me:design-export anthropic.com`
- "extract the design system from vercel.com"

If the URL does not start with `https://`, prepend it before any extraction call.

## Steps

### Step 1: Resolve the extraction transport

Try in this order, stop at the first that works:

1. **Hyperbrowser MCP server** (recommended) — if a tool named `mcp__hyperbrowser__*` is available in the session (e.g. `mcp__hyperbrowser__scrape_webpage`), call it with the URL and request branding output. Install once via `npm i -g hyperbrowser-mcp` then `claude mcp add hyperbrowser hyperbrowser-mcp --scope user -e HYPERBROWSER_API_KEY=<key>`.

2. **Inline Node SDK** — if no MCP tool is available, require `HYPERBROWSER_API_KEY` in env, then write a temporary script and run it with `bun` (preferred) or `node`. Install the SDK on the fly via `bun add` in `/tmp/` if it is not already resolvable.

   IMPORTANT: the `branding` format is only exposed via the legacy `client.web.fetch({ outputs: { formats: ["branding"] } })` API. The newer `client.scrape.startAndWait` rejects `branding` (valid values: `markdown` | `html` | `links` | `screenshot` | `extract`). Always use `web.fetch` for design extraction.

   ```javascript
   import { Hyperbrowser } from "@hyperbrowser/sdk";

   const client = new Hyperbrowser({ apiKey: process.env.HYPERBROWSER_API_KEY });

   const result = await client.web.fetch({
     url: process.argv[2],
     outputs: { formats: ["branding"] },
   });

   console.log(JSON.stringify(result, null, 2));
   ```

   Recommended runner sequence (one-shot, sandboxed in `/tmp/`):
   ```bash
   cd /tmp && bun add @hyperbrowser/sdk --silent && bun run /tmp/hb-extract.mjs "<URL>"
   ```

   Clean up the temp script afterwards (`rm /tmp/hb-extract.mjs`).

   NOTE: Claude Code Bash shells are non-interactive and do not source `~/.zshrc`. If `HYPERBROWSER_API_KEY` is exported only from an interactive shell config, it will be invisible. Persist it via `~/.zshenv`, a project `.env` sourced explicitly, or the `env` block of `~/.claude/settings.json`.

If neither transport is available, tell the user clearly to install one (recommend the MCP server: `npm i -g hyperbrowser-mcp` + `claude mcp add hyperbrowser hyperbrowser-mcp --scope user -e HYPERBROWSER_API_KEY=<key>`) and stop. Do not invent data.

### Step 2: Normalize the branding payload

Hyperbrowser returns a JSON blob with branding fields. Map them into the `DESIGN.md` structure below.

**Rules:**
- Use hex (`#rrggbb`) for all colors
- Use `px` for all numeric sizes
- Drop any section that has no extracted data — do not pad with empty bullets
- Never hallucinate values not present in the payload
- Preserve dark mode variants when present, under a dedicated section

### Step 3: Write `DESIGN.md`

Write the file to the current working directory (project root) using the template below. Overwrite if it already exists, but warn the user first if `DESIGN.md` is already tracked in git with uncommitted changes.

## Output Template

```markdown
# DESIGN.md

> Design system extracted from <url> via Hyperbrowser

## Colors

### Primary
- Background: #hex
- Foreground: #hex

### Accent
- Primary: #hex
- Secondary: #hex

### Neutral
- Gray 50: #hex
- Gray 100: #hex
...

## Typography

### Font Families
- Headings: <font name>
- Body: <font name>
- Mono: <font name>

### Font Sizes
- xs: Xpx
- sm: Xpx
- base: Xpx
- lg: Xpx
- xl: Xpx
- 2xl: Xpx

### Font Weights
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

## Spacing

- xs: Xpx
- sm: Xpx
- md: Xpx
- lg: Xpx
- xl: Xpx

## Border Radius

- sm: Xpx
- md: Xpx
- lg: Xpx
- full: 9999px

## Shadows

- sm: <value>
- md: <value>
- lg: <value>

## Components

### Buttons
- Primary: <describe style>
- Secondary: <describe style>

### Cards
- <describe style>

### Inputs
- <describe style>

## Dark Mode

If dark mode colors are detected, include them here.
```

## Rules

- Always save the file as `DESIGN.md` in the project root (cwd), never nested
- Include only data that was actually extracted — do not hallucinate
- Omit sections that have no data entirely (do not leave empty headings)
- All colors as hex, all sizes in px
- Keep the file clean and scannable
- Add the source URL at the top under the H1
- No emojis anywhere in the output
- Do not commit the file automatically — the user controls git

## Examples

### Example 1: Stripe

**User:** `/me:design-export stripe.com`

**Behavior:**
1. URL normalized to `https://stripe.com`
2. Call Hyperbrowser branding extraction
3. Receive payload with colors, typography, spacing
4. Write `DESIGN.md` in cwd
5. Reply with a one-line summary: `wrote DESIGN.md (12 colors, 3 font families, 6 spacing tokens)`

### Example 2: Missing transport

**User:** "extract the design system from linear.app"

**Behavior if no MCP / SDK available:**
1. Detect that neither transport works
2. Reply: `no hyperbrowser transport available. install one of: (a) MCP server via 'npm i -g hyperbrowser-mcp' + 'claude mcp add hyperbrowser hyperbrowser-mcp --scope user -e HYPERBROWSER_API_KEY=<key>', (b) @hyperbrowser/sdk + HYPERBROWSER_API_KEY env var`
3. Stop. Do not write `DESIGN.md`.

## Troubleshooting

**Issue:** `HYPERBROWSER_API_KEY` is not set
**Fix:** Claude Code Bash shells are non-interactive and do not source `~/.zshrc`. Persist the key in `~/.zshenv` (sourced by all zsh shells, incl. non-interactive) or in the `env` block of `~/.claude/settings.json` (visible to every Claude Code session, in plain text).

**Issue:** `client.scrape.startAndWait` rejects format `branding`
**Fix:** that endpoint only accepts `markdown | html | links | screenshot | extract`. For design extraction, use the legacy `client.web.fetch({ outputs: { formats: ["branding"] } })` API instead.

**Issue:** payload returns partial data (e.g. no spacing tokens)
**Fix:** that is expected — omit the empty section. Some sites only expose a subset.

**Issue:** site blocks scraping or returns a captcha page
**Fix:** Hyperbrowser handles most anti-bot cases; if it still fails, report the error verbatim to the user and stop. Do not retry blindly.

## Source

Adapted from `hyperbrowserai/examples` — `skills/design-skill.md` on GitHub.
