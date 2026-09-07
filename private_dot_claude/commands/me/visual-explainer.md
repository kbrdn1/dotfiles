---
name: visual-explainer
description: Generate visual HTML pages -- diff reviews, plan reviews, project recaps, diagrams, changelogs, fact-checks, explorations, prototypes, reports, custom editors, slide decks, design systems, component variants, SVG illustrations, PR writeups, and implementation plans. HTML over markdown for information density, visual clarity, sharing, and two-way interaction. Invoke with a subcommand as first argument.
argument-hint: <diff|plan|recap|diagram|changelog|check|explore|proto|report|editor|deck|ds|variants|svg-sheet|pr|impl-plan> [args...]
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Visual Explainer

Parse `$ARGUMENTS` to determine which mode to run:

```
$ARGUMENTS = "<subcommand> [remaining args...]"
```

**Subcommand routing:**

| First word of $ARGUMENTS | Mode | Rest of $ARGUMENTS |
|--------------------------|------|--------------------|
| `diff-review` or `diff` | [Diff Review](#diff-review) | `[git-ref\|PR-number\|commit]` |
| `plan-review` or `plan` | [Plan Review](#plan-review) | `<plan-file.md> [codebase-path]` |
| `project-recap` or `recap` | [Project Recap](#project-recap) | `[time-window: 2w\|30d\|3m]` |
| `diagram` or `draw` | [Diagram](#diagram) | `<topic description>` |
| `changelog` or `log` | [Changelog](#changelog) | `[version-range\|tag\|--all] [--mono\|--multi]` |
| `fact-check` or `check` | [Fact Check](#fact-check) | `[file-path]` |
| `explore` or `explorations` | [Explore](#explore) | `<topic> [--n=3..6]` |
| `prototype` or `proto` | [Prototype](#prototype) | `<what to prototype>` |
| `report` or `explain` | [Report](#report) | `<feature\|concept\|topic>` |
| `editor` | [Editor](#editor) | `<data-type> <task> [file]` |
| `deck` or `slides` | [Deck](#deck) | `<topic> [--n=6]` |
| `design-system` or `ds` | [Design System](#design-system) | `[codebase-path]` |
| `variants` | [Variants](#variants) | `<component name> [source-file]` |
| `illustrations` or `svg-sheet` | [Illustrations](#illustrations) | `<topic>` |
| `pr-writeup` or `pr` | [PR Writeup](#pr-writeup) | `[PR-number\|branch]` |
| `impl-plan` or `plan-create` | [Plan Create](#plan-create) | `<feature description>` |
| (empty or unrecognized) | Show this help table and ask the user which mode |

**Example invocations:**
- `/me:visual-explainer diff #42`
- `/me:visual-explainer plan ~/docs/refactor-plan.md`
- `/me:visual-explainer recap 2w`
- `/me:visual-explainer diagram auth flow for the API`
- `/me:visual-explainer changelog v0.40.0..v0.42.0`
- `/me:visual-explainer changelog --all --multi`
- `/me:visual-explainer check`
- `/me:visual-explainer explore onboarding screen directions --n=6`
- `/me:visual-explainer proto checkout button animation with easing sliders`
- `/me:visual-explainer report how rate limiting works in this repo`
- `/me:visual-explainer editor tickets reprioritize linear-export.json`
- `/me:visual-explainer deck weekly platform status`
- `/me:visual-explainer design-system .`
- `/me:visual-explainer variants Button`
- `/me:visual-explainer svg-sheet background jobs hero illustrations`
- `/me:visual-explainer pr #312`
- `/me:visual-explainer impl-plan comment threads on task cards`

---

## Why HTML over Markdown

HTML beats markdown as the default output format for AI-generated artifacts. Apply these principles to every mode below.

**Information density.** HTML carries tables, CSS, SVG, scripts, spatial layout, interactions, and images in one self-contained file. Markdown flattens spatial information (diffs, call-graphs, comparisons) into linear text. Diffs and call-graphs are spatial information; markdown flattens them.

**Visual clarity.** Markdown breaks down past ~100 lines — nobody reads it, nobody on your team reads it. HTML structures hierarchy with typography, color, depth tiers, collapsible sections, and tabs. A page someone *will read* beats a doc they skim.

**Sharing.** A single `.html` file opens in any browser, uploadable to S3 for a shareable link. Markdown requires a renderer or an attachment.

**Two-way interaction.** Knobs, sliders, toggles, color pickers, drag-and-drop, live preview. Always end interactive artifacts with an **export button** (`Copy as JSON`, `Copy as markdown`, `Copy as prompt`, `Copy diff`) so the loop closes back into Claude. Stay in the loop; the loop gets tighter.

**Cross-source synthesis.** Claude Code ingests filesystem, git history, MCPs (Slack, Linear, Stripe...), web browser, and tools. Bake that context into the page — don't just summarize it.

**Trade-offs (accept them):**
- 2-4x slower to generate than markdown — worth it for output quality
- HTML diffs are noisy in version control
- Higher token cost — 1M context absorbs it; quality of output justifies the spend

**Anti-pattern.** Don't reach for a generic `/html` slash. The trick is knowing what you want the artifact to *do*. Each subcommand below picks the right pattern for a specific job. If your need doesn't fit, prompt from scratch.

References: https://thariqs.github.io/html-effectiveness/, https://x.com/trq212/status/2052809885763747935

---

## Common setup (all modes)

Before generating any HTML:

1. Read the visual-explainer instructions: `~/.claude/skills/visual-explainer/INSTRUCTIONS.md`
2. Read the palette (mandatory): `~/.claude/skills/visual-explainer/references/claude-dark-palette.md`
3. Read CSS patterns: `~/.claude/skills/visual-explainer/references/css-patterns.md`
4. Read the matching reference template from `~/.claude/skills/visual-explainer/templates/`:
   - Architecture overviews: `templates/architecture.html`
   - Flowcharts, sequences, ER, state machines, mind maps: `templates/mermaid-flowchart.html`
   - Tables, comparisons, audits: `templates/data-table.html`
5. For pages with 4+ sections: also read `~/.claude/skills/visual-explainer/references/responsive-nav.md`

**Output:** write to `~/.claude/diagrams/`, open in browser (`open` on macOS, `xdg-open` on Linux).
**Palette:** Claude Dark Pure Dark. Copy the CSS template from the palette reference verbatim. Do not improvise colors.
**surf-cli (optional):** if `which surf` succeeds, consider generating AI illustrations via `surf gemini --generate-image`. Embed as base64 data URI. Skip if not available.

---

## diff-review

Generate a visual HTML diff review with before/after architecture comparison and structured code review.

**Scope detection** from remaining args after `diff`/`diff-review`:
- Branch name (e.g. `main`, `develop`): working tree vs that branch
- Commit hash: `git show <hash>`
- `HEAD`: uncommitted changes (`git diff` + `git diff --staged`)
- PR number (e.g. `#42`): `gh pr diff 42`
- Range (e.g. `abc123..def456`): diff between two commits
- No remaining args: default to `main`

**Data gathering:**
- `git diff --stat <ref>` for file-level overview
- `git diff --name-status <ref> --` for new/modified/deleted files
- Line counts: compare key files between `<ref>` and working tree
- New public API surface: grep for exported symbols, functions, classes, interfaces
- Feature inventory: grep for new actions, config fields, event types
- Read all changed files in full + surrounding code paths
- Check CHANGELOG.md, README.md, docs/ for needed updates
- Reconstruct decision rationale from conversation, commit messages, progress docs

**Verification checkpoint:** produce a fact sheet of every claim before generating HTML. Cite sources. Mark uncertain claims.

**Page sections:**
1. **Executive summary** -- why do these changes exist? Hero depth, 20-24px type, accent bg.
2. **KPI dashboard** -- lines added/removed, files changed, modules, tests. Housekeeping badges.
3. **Module architecture** -- Mermaid dependency graph. Zoom controls.
4. **Feature comparisons** -- side-by-side before/after panels. Overflow protection.
5. **Flow diagrams** -- Mermaid for new patterns. Zoom controls.
6. **File map** -- tree with color-coded indicators. Collapsible.
7. **Test coverage** -- before/after counts.
8. **Code review** -- Good/Bad/Ugly/Questions cards (green/red/amber/blue left borders).
9. **Decision log** -- decision, rationale, alternatives, confidence (high=green, medium=blue, low=amber).
10. **Re-entry context** -- invariants, coupling, gotchas, follow-ups. Collapsible.

Visual language: red=removed, green=added, yellow=modified, blue=neutral. Ultrathink.

---

## plan-review

Generate a visual HTML plan review -- current codebase vs. proposed implementation plan.

**Inputs** from remaining args after `plan`/`plan-review`:
- First arg: path to plan/spec/RFC file (required)
- Second arg: codebase path (optional, defaults to cwd)

**Data gathering:**
1. Read plan file in full. Extract problem statement, proposed changes, rejected alternatives, scope.
2. Read every referenced file + their importers/dependents.
3. Map blast radius: importers, tests, config, public API surface.
4. Cross-reference: verify files/functions/types exist and match plan's description.

**Verification checkpoint:** same rigor -- fact sheet, cite sources, flag uncertain claims.

**Page sections:**
1. **Plan summary** -- intuition and scope. Hero depth.
2. **Impact dashboard** -- files to modify/create/delete, estimated lines, completeness indicator.
3. **Current architecture** -- Mermaid of affected subsystem today. Zoom controls.
4. **Planned architecture** -- Mermaid post-implementation. Same nodes/layout. Highlight new/removed/changed.
5. **Change-by-change breakdown** -- side-by-side current vs. planned + rationale. Flag discrepancies.
6. **Dependency & ripple analysis** -- downstream effects. Color-coded coverage. Collapsible.
7. **Risk assessment** -- edge cases, assumptions, ordering, rollback, cognitive complexity.
8. **Plan review** -- Good/Bad/Ugly/Questions cards.
9. **Understanding gaps** -- rationale gaps, cognitive complexity flags, recommendations.

Visual language: blue=current, green/purple=planned, amber=concern, red=gap. Ultrathink.

---

## project-recap

Generate a visual project recap to rebuild mental model after time away.

**Time window** from remaining args after `recap`/`project-recap`:
- Shorthand: `2w`, `30d`, `3m` -> git `--since` format
- No remaining args: default to `2w`

**Data gathering:**
1. Project identity: README, CHANGELOG, package manifest, top-level structure.
2. Recent activity: `git log --oneline --since=<window>`, `git log --stat`, `git shortlog -sn`.
3. Current state: `git status`, stale branches, TODO/FIXME in recent files.
4. Decision context: commit messages, plan docs, RFCs, ADRs.
5. Architecture scan: key source files, entry points, frequently changed files.

**Verification checkpoint:** fact sheet, cite sources.

**Page sections:**
1. **Project identity** -- current-state summary, version, deps, elevator pitch.
2. **Architecture snapshot** -- Mermaid system diagram. Hero depth, zoom controls.
3. **Recent activity** -- narrative grouped by theme, timeline.
4. **Decision log** -- key decisions with rationale.
5. **State of things** -- KPI cards: working/in-progress/broken/blocked.
6. **Mental model essentials** -- invariants, coupling, gotchas, conventions.
7. **Cognitive debt hotspots** -- amber cards with severity.
8. **Next steps** -- inferred from activity and TODOs.

Ultrathink.

---

## diagram

Generate a standalone HTML diagram.

**Topic:** everything after `diagram`/`draw` in $ARGUMENTS describes what to diagram.

Follow the visual-explainer skill workflow. Read the matching template. Pick distinctive layout/typography within Claude Dark palette.

**Annotated flowchart pattern** (for pipelines, deploy flows, request paths, decision trees): each node is clickable to reveal what runs, timings, and failure paths. Style nodes by status (`node.ok`, `node.gate`, `node.bad`, `node.term`), edges by branch (`edge.yes`, `edge.no`). Include a legend mapping node shapes/colors to their semantics. Use SVG or CSS-positioned divs with absolute connectors.

Write to `~/.claude/diagrams/` and open in browser.

---

## changelog

Generate a visual HTML changelog page from git history, tags, releases, and CHANGELOG.md files.

**Scope detection** from remaining args after `changelog`/`log`:
- Version range (e.g. `v0.40.0..v0.42.0`): changelog between those two tags
- Single tag (e.g. `v0.42.0`): changelog for that specific version only
- `--all`: full changelog across all versions found
- `--latest` or no args: most recent version/tag only
- `--mono`: treat cwd as a single repo (default if only one git root)
- `--multi`: scan for multiple sub-repos/packages (auto-detected if cwd contains multiple git roots or a monorepo with distinct CHANGELOG.md files)

**Data gathering:**

1. **Detect repo layout**
   - Check if cwd contains multiple git repos (monorepo, workspace, or multi-package)
   - Look for `CHANGELOG.md` files at root and in subdirectories
   - Identify repo names from `package.json`, `composer.json`, `Cargo.toml`, or directory names

2. **Parse CHANGELOG.md** (primary source, preferred when available)
   - Extract version headers: `# Version X.X.X - YYYY-MM-DD` or `## [X.X.X] - YYYY-MM-DD`
   - Extract description paragraphs per version
   - Extract entries per category: Ajouté/Added, Modifié/Changed, Corrigé/Fixed, Supprimé/Removed, Sécurité/Security, Déprécié/Deprecated
   - For each entry, extract:
     - Type badge (Feat, Fix, Refactor, Perf, etc.)
     - Issue number and PR link
     - Commit hash
     - Description + detail block (quoted lines)
     - Author (@mentions)
     - Resolution time if present
   - Detect sub-grouping by domain/feature area (### subsections)

3. **Enrich from git** (complement CHANGELOG data)
   - `git tag --sort=-v:refname` for version list
   - `git log --oneline --format="%h %s (%an, %ad)" <from-tag>..<to-tag>` for commits between versions
   - `git shortlog -sn <from-tag>..<to-tag>` for contributor stats
   - `gh release list` and `gh release view <tag>` for GitHub release notes (if `gh` available)
   - `git diff --stat <from-tag>..<to-tag>` for file change stats per version

4. **Compute metrics**
   - Total commits per version
   - Total PRs merged per version
   - Contributors per version (count + names)
   - Lines added/removed per version
   - Average resolution time per entry (if available)
   - Development period (first commit to tag date)
   - Feature/fix/refactor distribution (pie chart data)

**Verification checkpoint:** cross-reference CHANGELOG entries against actual git history. Flag entries without matching commits or PRs. Flag commits without CHANGELOG entry. Cite sources.

**Page sections:**

1. **Release hero** -- project name, version range covered, generation date. Hero depth, accent bg, large type.

2. **Overview dashboard** -- KPI cards:
   - Versions covered (count)
   - Total commits / PRs merged
   - Contributors (count + avatars if GitHub)
   - Lines of code delta
   - Development period (days)
   - Feature/Fix/Refactor distribution (small donut or bar)

3. **Version timeline** -- interactive vertical timeline:
   - Each version as a node (version number + date + description excerpt)
   - Color-coded by release significance (major=accent, minor=info, patch=text-dim)
   - Click/scroll to jump to version detail
   - For multi-repo: parallel timelines side by side, one column per repo

4. **Version detail cards** (one per version, collapsible):
   - Version header: number, date, development period, commit count
   - Description narrative (from CHANGELOG ## Description)
   - Entries grouped by category (Added, Changed, Fixed, Removed):
     - Each entry: type badge (color-coded), title, issue/PR link, author, resolution time
     - Expandable detail (the `>` quoted description lines)
   - If sub-grouped by domain: show domain tabs or accordion (e.g. "Stripe & Paiements", "Dashboard Statistiques")
   - Mini stats per version: commits, PRs, files changed, lines +/-

5. **Contributors board** -- grid of contributor cards:
   - Name/handle
   - Commit count across the range
   - Top features/fixes attributed
   - Active versions

6. **Change type distribution** -- Mermaid pie or bar chart:
   - Features vs Fixes vs Refactors vs Docs vs Tests vs Chores
   - Per-version stacked bar if multi-version

7. **Multi-repo sync view** (only if `--multi` or auto-detected):
   - Side-by-side version alignment between repos
   - Shared features highlighted (same issue number across repos)
   - API contract changes flagged (backend version -> frontend version dependency)

8. **Breaking changes & deprecations** -- amber/red cards:
   - Any entries tagged as breaking or deprecated
   - Migration notes if available

Visual language: accent=new features, green=fixes, blue=refactors, amber=deprecations, red=breaking changes, text-dim=chores/docs. Use data-table template as base. Ultrathink.

---

## fact-check

Verify factual accuracy of a document against the actual codebase, correct inaccuracies in place.

**Target** from remaining args after `check`/`fact-check`:
- Explicit file path: verify that file
- No remaining args: verify most recent `.html` in `~/.claude/diagrams/`

**Workflow:**
1. **Extract claims** -- quantitative, naming, behavioral, structural, temporal. Skip subjective.
2. **Verify against source** -- re-read files, re-run git commands. Classify: Confirmed/Corrected/Unverifiable.
3. **Correct in place** -- fix numbers, names, paths, descriptions. Preserve layout/CSS/structure.
4. **Add verification summary** -- HTML: styled banner. Markdown: append section.
5. **Report** -- tell user what was checked/corrected. Open file.

Fact-checker only. Does not re-review opinions or judgments. Ultrathink.

---

## explore

Generate multiple distinct approaches to a problem, laid out side-by-side so the user can point at one instead of holding three sequential walls of text in their head.

**Inputs** from remaining args after `explore`/`explorations`:
- Topic/problem description (required) — e.g. "onboarding screen", "debounced search in React", "modal close UX"
- Optional flag `--n=<3-6>` for number of approaches (default 3)

**Data gathering:**
1. Read relevant codebase context if the topic touches existing code.
2. Identify the axes of variation (layout, density, tone, architecture, library, abstraction level, etc.) — pick axes that produce *distinctive* alternatives, not minor tweaks.
3. Generate N approaches that differ along multiple axes simultaneously. Each must be a credible candidate, not a strawman.
4. Surface the trade-off each one is making — explicitly, inline, not buried.

**Page sections:**
1. **Prompt restatement** -- the original ask, eyebrow style. Establishes scope.
2. **Side-by-side grid** -- N approach cards (3=row, 4-6=responsive grid). Each card contains:
   - Numbered label (01, 02, 03...)
   - Approach name (distinctive, descriptive)
   - One-paragraph description
   - Concrete artifact: code snippet, mockup, palette, or diagram (not prose)
   - PRO / CON columns inline
3. **Comparison matrix** (optional, when 4+ approaches) -- table with axes as rows, approaches as columns. Cell content: short verdict per axis.
4. **Recommendation** -- which one and why. Honest. Don't dodge.

Visual language: each approach gets a distinct accent (accent, info, secondary, success, special, warning rotated from palette). Recommendation card uses success border. Ultrathink.

---

## prototype

Build an interactive, throwaway HTML prototype with live controls so the user can *feel* an interaction or *tune* a parameter set before committing to it. Motion and interaction can't be described, only felt.

**Inputs** from remaining args after `prototype`/`proto`:
- What to prototype (required) — e.g. "checkout button animation", "card hover state", "loading spinner timing", "color palette mixer"

**Data gathering:**
1. Identify the prototype subject: motion/transition, micro-interaction, layout variant, multi-screen flow, parameter tuner, color/value picker.
2. List the controls needed (sliders, dropdowns, color pickers, toggles, number inputs, easing curve pickers).
3. Identify which parameters the user will want to copy back into their codebase.

**Page sections:**
1. **Live preview area** -- centered, generous padding, accent-tinted background. The thing being prototyped renders here at real fidelity.
2. **Controls panel** -- sliders, selects, pickers. Each control shows its current value next to its label. Group related controls with subtle dividers.
3. **State readout** -- the current parameter set displayed as readable values (CSS, JSON, or component props).
4. **Export buttons (mandatory)** -- `Copy as CSS`, `Copy as JSON`, `Copy as React props`, or whatever format the user will paste back into Claude or their codebase. Multiple export formats if useful.
5. **Reset / preset buttons** (optional) -- snap to known good defaults.

Implementation notes: vanilla JS + CSS variables. No framework. Use `<input type="range">` with `oninput` to update CSS vars live. For motion, trigger `requestAnimationFrame` on play button. Respect `prefers-reduced-motion` for auto-playing previews.

Visual language: accent=live preview frame, dim=control labels, success=copy buttons on click, text=current values. Ultrathink.

---

## report

Generate an in-depth HTML explainer for a feature, concept, or system — optimized for someone reading it once. Synthesize across filesystem, git history, MCPs, and web context.

**Inputs** from remaining args after `report`/`explain`:
- Feature/concept/topic (required) — e.g. "how rate limiting works", "the auth refresh flow", "our caching strategy"

**Data gathering:**
1. Read all relevant source code in full. Trace the actual code path — entry point, key transformations, exit.
2. Pull commit history and PR rationale for the feature.
3. Cross-reference with docs, READMEs, ADRs, RFCs, and inline comments.
4. Identify 3-4 key code snippets that *carry the explanation* — not boilerplate, not glue code.
5. Surface gotchas: edge cases, surprising behaviors, "I learned this the hard way" knowledge.

**Verification checkpoint:** fact sheet. Cite line numbers. Mark uncertain claims.

**Page sections:**
1. **Title + eyebrow** -- topic name + repo/scope label.
2. **TL;DR box** -- 2-4 sentences. Hero depth, accent tint. The one paragraph someone could read and walk away knowing the gist.
3. **The path, step by step** -- collapsible `<details>` per step. Each step:
   - Step number + name
   - File:line reference (clickable if local)
   - Annotated code snippet (syntax highlighted, key lines emphasized)
   - 1-2 sentences explaining what this step does and why it exists
4. **Visual diagram** -- Mermaid for token-bucket flow / state machine / request path. Zoom controls.
5. **Configuration** -- tabbed code samples showing how to use/configure the feature in different contexts.
6. **Gotchas** -- amber callouts. Each gotcha: short title + 1-2 sentences + code reference if applicable.
7. **FAQ** -- 4-8 short Q&A pairs. Address questions the reader will actually have.
8. **Glossary** (optional) -- hover-linked terms in the margin or at the bottom for unfamiliar concepts.

Variants:
- **status-report** -- if topic looks like "this week", "weekly status", "platform eng week of X": render as a clean status page with sections like *Highlights / Shipped / Velocity / Carryover* or *What shipped / What slipped / Numbers we watch / One call to make / On deck*. Small inline chart for trend data.
- **incident-report** -- if topic involves an outage or post-mortem: header with INC-ID + severity, minute-by-minute *Timeline*, *Root cause* callout, *Impact* numbers, *Action items* checklist with owners.
- **callstack-walkthrough** -- if topic is "how X flows through Y" or "trace the path of Z": numbered steps with hot-path highlighting (`step.hot`/`box.hot`), arrow-connected diagram, *Key files* sidebar, *Gotchas* at the bottom.
- **interactive-concept** -- if topic is a CS/algorithm concept (consistent hashing, B-trees, debouncing, etc.): include a *live interactive demo* (add/remove nodes from a ring, toggle parameters, watch state change) plus comparison table and hover-linked glossary. The demo is the page.

Visual language: accent=TL;DR + key emphasis, dim=glossary + meta, amber=gotchas, success=verified facts, info=neutral references. Hot-path elements use accent borders. Ultrathink.

---

## editor

Build a throwaway, purpose-built HTML editor for one specific data-shaping task. Not a product. Not a reusable tool. A single HTML file for the one piece of data the user is working on right now. Always ends with an export button that turns the UI state back into something pasteable.

**Inputs** from remaining args after `editor`:
- First arg: data type (e.g. `tickets`, `flags`, `prompt`, `dataset`, `config`, `annotations`, `colors`)
- Second arg: task (e.g. `reprioritize`, `toggle`, `tune`, `tag`, `annotate`, `reorder`, `pick`)
- Optional: path to input file or data source

**Data gathering:**
1. Load the input data. Infer schema from the file or ask the user.
2. Identify constraints: required fields, dependencies between fields, validation rules.
3. Identify the export format the user wants back (`copy as markdown`, `copy as JSON`, `copy diff`, `copy as prompt`).

**Page patterns (pick the one that fits the task):**

- **Drag-and-drop columns** (triage, bucketing, kanban): N columns with draggable cards. HTML5 drag-and-drop API. Persist column membership in JS state.
- **Form editor with dependencies** (feature flags, config): grouped toggles/inputs. Show dependency warnings when prerequisites unmet. Diff against original state. "Copy diff" exports only changed keys.
- **Side-by-side live editor** (prompt tuner, template): editable left pane with variable highlighting, live-rendered right pane with sample inputs. Token/char counter.
- **Tabular grid** (dataset curation, approve/reject rows): table with row-level actions, bulk select, filter bar.
- **Annotation overlay** (document or diff annotator): the source content rendered with selectable spans, comment popovers, export annotations as JSON.
- **Value picker** (color, easing curve, cron, regex, crop region): visual picker UI for values painful to express in text.

**Mandatory structure:**
1. **Header** -- task name + data scope ("Cycle 14 triage", "auth-service flags", "onboarding prompt v3").
2. **Editor body** -- one of the patterns above. Full width, generous space.
3. **Validation strip** (if applicable) -- warnings/errors in amber/red, surfaced inline.
4. **Export bar (mandatory)** -- sticky bottom or top. Always at least one `Copy as <format>` button. Multiple buttons if multiple export formats are useful. Optional `Reset` button.

Implementation notes: vanilla JS. No framework. Use `navigator.clipboard.writeText()` for export. Persist state in JS only (no localStorage unless user asks) — this is throwaway. The export *is* the artifact, not the file itself.

Visual language: accent=primary action, success=export click feedback, warning=validation, dim=meta. Ultrathink.

---

## deck

Generate an HTML slideshow as a single self-contained file with arrow-key navigation. No build step, no Keynote, no export. Right for status updates, brief explanations, design pitches, anything you'd otherwise paste into Google Slides.

**Inputs** from remaining args after `deck`/`slides`:
- Topic/outline (required) — e.g. "weekly platform status", "our new caching approach", "Q2 design themes"
- Optional `--n=<count>` for target slide count (default 5-8)

**Data gathering:**
1. If topic touches the codebase, read relevant context.
2. If topic references a doc or Slack thread, ingest it (via MCP if available).
3. Structure: ~5-8 slides max. One idea per slide. Avoid the temptation to cram.

**Page structure:**
- One `<section class="slide">` per slide. Only the current slide is visible (`display: none` on others).
- JS keyboard handler: `ArrowLeft`/`ArrowRight`/`Space` to advance, `Home`/`End` to jump. Touch/swipe optional.
- Slide counter in corner (e.g. "3 / 7"). Subtle progress bar at top or bottom.
- First slide is the title slide: large display type, project/scope eyebrow, date.
- Last slide is a "next steps" or "call to action" slide.

**Slide content patterns:**
- Big number + single line caption (metric highlights)
- Three short bullets, generous spacing
- Single mockup or screenshot, centered, with one-line caption
- Side-by-side comparison (before/after, this/that)
- A short list of items with status dots (shipped/slipped/blocked)

Avoid: bullet walls (>4 bullets), dense paragraphs, tiny code, multi-column dense text. If a slide needs more, split it.

Implementation notes: vanilla JS for nav. CSS for slide transitions (`opacity` + `transform`). Print stylesheet renders all slides stacked for easy PDF export via browser print.

Visual language: hero depth on every slide (each is a focal moment), large display typography, accent for emphasis, very high contrast. Ultrathink.

---

## design-system

Generate an interactive design system reference page from a codebase — colors, typography, spacing, radius/elevation, and core components rendered as live, copyable swatches. The artifact you feed back into the next prompt to keep style consistent.

**Inputs** from remaining args after `design-system`/`ds`:
- Optional codebase path (defaults to cwd)

**Data gathering:**
1. Scan the codebase for design tokens: CSS variables, Tailwind config, theme objects, SCSS vars, JSON tokens.
2. Pull color palette (named tokens, hex/rgb values, semantic groupings).
3. Pull typography scale (font families, weights, sizes, line-heights, letter-spacing).
4. Pull spacing scale (4/8/16/24 etc., named tokens).
5. Pull radius scale and elevation/shadow definitions.
6. Identify core components and their primary states.

**Page sections (mirror these section IDs for in-page nav):**
1. **Header** -- project name + "Design system" eyebrow + last-updated stamp.
2. **`#color`** -- swatch grid. Each swatch: color preview, name (e.g. `accent-500`), hex value, click-to-copy. Group by family (neutrals, brand, semantic).
3. **`#typography`** -- type ladder with size + line-height labels (`display-1`, `display-2`, `body`, `caption`, `mono`). Render in the actual font with sample text.
4. **`#spacing`** -- horizontal bars at each scale step. Token name + px value + visual ruler.
5. **`#shape`** -- radius cards (sm/md/lg/full) + elevation cards showing the actual shadow.
6. **`#components`** -- core components rendered in their primary state: buttons (primary/secondary/ghost/danger), badges (accent/neutral/success/warning), inputs, checkbox, chip.

Each token should have a *copy* button that writes the token reference (e.g. `var(--accent-500)` or `theme.colors.accent[500]`) to the clipboard via `navigator.clipboard.writeText()`.

Visual language: surfaces neutral, accent only on focus states + copy feedback. Generous whitespace. Editorial typography. Ultrathink.

---

## variants

Generate a single-sheet contact page for every state, size, and intent of one component. The matrix you pull up when deciding "does this component handle that case?"

**Inputs** from remaining args after `variants`:
- Component name (required) — e.g. `Button`, `Card`, `Modal`, `Avatar`
- Optional source file path

**Data gathering:**
1. Read the component implementation. Extract all props, variants, sizes, intents.
2. Identify the axes of variation: size (sm/md/lg), variant (elevated/flat/outlined/inset/horizontal/stripe), intent (default/success/warning/danger/info), state (default/hover/active/disabled/loading), with/without icon/avatar/badge.
3. Generate a grid that covers the cartesian product of meaningful combinations (not literally everything — skip nonsense combos).

**Page sections:**
1. **Header** -- component name + tagline ("Card variant matrix"). Eyebrow with file:line reference.
2. **Controls strip** -- toggle buttons to filter the matrix: show only size=md, intent=danger, state=hover, etc. Resets on click.
3. **Variant grid** -- one cell per variant. Each cell:
   - Live render of the component in that variant
   - Compact label (e.g. `v-elevated · md · primary`)
   - Code snippet on hover or via expand chevron
4. **Snippet panel** (collapsible) -- the full code for the currently selected variant. Copy button.

Implementation notes: vanilla JS + CSS. Use CSS attribute selectors or class compositions to render variants. Live render = real markup, not a screenshot.

Visual language: subtle borders between cells, accent on selected variant, dim on filtered-out cells. Ultrathink.

---

## illustrations

Generate a single-page SVG illustration sheet for a topic — vector art tweakable inline, copyable one-by-one. Use when you want hero illustrations, blog post figures, or conceptual artwork that Mermaid can't express.

**Inputs** from remaining args after `illustrations`/`svg-sheet`:
- Topic (required) — e.g. "background jobs hero", "queue concepts", "auth flow figures"

**Data gathering:**
1. Understand the topic enough to know what 3-6 illustrations would carry it.
2. Pick a palette and stick to it — declare the rules up top (max N colors, stroke widths, corner radius, etc.).

**Page sections:**
1. **Header** -- topic name + intended use ("Header illustrations for the Background jobs landing page").
2. **Palette & rules** -- swatches with hex values + the artistic constraints (e.g. "Stroke = 1.5px, radius = 8px, no gradients").
3. **Illustration sheet** -- grid of 3-6 SVG figures. Each figure:
   - Inline `<svg>` (not `<img>`, not embedded)
   - Caption with title + subtitle + intended placement
   - "Copy SVG" button that writes the SVG markup to clipboard
   - "Download" button (optional) that triggers download via blob URL
4. **Notes** -- editorial notes about variations, alternative interpretations, what to commission a human illustrator for.

Implementation notes: hand-author the SVG paths or let Claude generate them. Use CSS variables for palette colors so the entire sheet can be re-themed. Respect `prefers-reduced-motion` if illustrations animate.

Visual language: gallery feel. Generous whitespace. Captions in small caps. Each figure on its own "canvas" with subtle border. Ultrathink.

---

## pr-writeup

Generate a PR companion document for reviewers — author-side, explaining motivation, file-by-file rationale, where to focus, test plan, and rollout. Attached to every PR you make. Different from `diff-review` which is the *reviewer's* side.

**Inputs** from remaining args after `pr-writeup`/`pr`:
- PR number (e.g. `#312`) or branch name. If absent, use current branch vs `main`.

**Data gathering:**
1. `git diff main...HEAD` for the changeset.
2. `git log main..HEAD` for commit messages and authoring rationale.
3. Read every changed file in full + their importers.
4. Extract the *why* — from commit messages, conversation, linked issues.
5. Identify the *risky/subtle* parts that reviewers should focus on.
6. List what was tested + how to test more.
7. Note the rollout plan if it's not "merge and ship".

**Verification checkpoint:** fact sheet. Cite line numbers. Mark uncertain claims.

**Page sections (mirror these IDs for nav):**
1. **Header** -- `#NUM — <title>` + author + branch + base. Layout with sidebar TOC.
2. **`#why`** (lede) -- 2-4 sentences. The motivation, written in prose. The *one thing* a reviewer needs to know before scrolling.
3. **`#tour`** (file-by-file) -- collapsible per file. Each file:
   - File path + lines added/removed badges (`badge.new`, `badge.mod`, `badge.del`)
   - 1-2 sentences explaining what changed in *this* file and why
   - Mini diff with margin annotations on the subtle lines
4. **`#focus`** -- "Where to focus your review" — explicit list of 3-5 items with one-line rationale each. Marked with `focus` class for emphasis.
5. **`#tests`** (test plan) -- what was tested + how. Checkboxes for manual steps + auto-test references.
6. **`#rollout`** -- flag gates, migration order, monitoring to watch, rollback plan if applicable.

Visual language: lede as hero, `focus` items with accent left-border, file-tour collapsibles with chevron, badges color-coded (`new`=success, `mod`=info, `del`=warning). Ultrathink.

---

## plan-create

Generate a fresh implementation plan as a single HTML page — milestones on a timeline, data-flow diagram, inline mockups, key code snippets, risks table. The plan you *hand off* to another agent or engineer. Different from `plan-review` which critiques an existing plan.

**Inputs** from remaining args after `plan-create`/`impl-plan`:
- Feature description (required) — e.g. "comment threads on task cards", "switch notification delivery to a queue"

**Data gathering:**
1. Read the existing codebase to understand current state.
2. Identify affected subsystems, files, schemas, APIs.
3. Sequence the work into milestones — each independently mergeable, each unlocking the next.
4. Specify data shapes and API contracts up front.
5. Draft 1-3 key code snippets that *anchor the implementation* (not pseudo-code — real code).
6. Mock UI states inline (HTML/CSS mocks of the target screens).
7. Surface risks with mitigation.

**Page sections:**
1. **Header** -- feature title + author + estimated scope. Hero depth.
2. **Milestones** -- ordered list with dot indicators (`dot`, `dot.done`). Each milestone: name, deliverable, dependencies, est. effort. Visual timeline if 4+ milestones.
3. **Schema & API contract** -- code blocks with the new/changed types, endpoints, events. Annotated.
4. **Component/composer mocks** -- inline HTML/CSS mockups of UI states. Real CSS, not screenshots.
5. **Data flow** -- diagram (Mermaid or hand-positioned SVG) showing the path of data through the system after this lands.
6. **Key code** -- 2-4 code snippets that carry the implementation. Each with file:line target + 1-2 sentence intent.
7. **Risks & mitigations** -- table or card grid. Each risk: severity badge, description, mitigation. `dot.done` next to mitigated risks.
8. **Open questions** -- explicit list, with current best-guess answer + who can confirm.

Visual language: milestones use sequential accents, mocks use real component styles, risks color-coded by severity (success=mitigated, amber=monitored, red=open). Ultrathink.

---

$ARGUMENTS
