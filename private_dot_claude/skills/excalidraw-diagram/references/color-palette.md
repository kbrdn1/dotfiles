# Color Palette & Brand Style — Claude Dark

**This is the single source of truth for all colors and brand-specific styles.** Based on the Claude Dark palette (Catppuccin-inspired warm dark with orange accent). All Excalidraw diagrams render on a dark canvas with subtle surface fills and bright semantic strokes.

Source reference: `~/.claude/skills/visual-explainer/references/claude-dark-palette.md`

---

## Shape Colors (Semantic)

Colors encode meaning, not decoration. Fills are dark surfaces; strokes carry the semantic color. Always pair a bright stroke with a dark surface fill so shapes read on the `#1a1a1a` canvas.

| Semantic Purpose | Fill | Stroke |
|------------------|------|--------|
| Primary/Neutral | `#2a2a2a` | `#D4825D` |
| Secondary | `#383838` | `#C15F3C` |
| Tertiary | `#444444` | `#b0b0b0` |
| Start/Trigger | `#2a2a2a` | `#D4825D` |
| End/Success | `#2a2a2a` | `#86E89A` |
| Warning/Reset | `#2a2a2a` | `#FFDF61` |
| Decision | `#2a2a2a` | `#FFDF61` |
| AI/LLM | `#2a2a2a` | `#C79BFF` |
| Info | `#2a2a2a` | `#7AB8FF` |
| Cyan/Secondary info | `#2a2a2a` | `#8ABFB8` |
| Inactive/Disabled | `#242424` | `#666666` (use dashed stroke) |
| Error | `#2a2a2a` | `#FF7A7A` |

**Rule**: Dark fills (#242424–#444444) + bright semantic strokes. Never put bright fills behind text — readability dies on the dark canvas.

---

## Text Colors (Hierarchy)

Use color on free-floating text to create visual hierarchy without containers. The canvas is dark, so text is light by default.

| Level | Color | Use For |
|-------|-------|---------|
| Title | `#e0e0e0` | Section headings, major labels |
| Subtitle | `#D4825D` | Subheadings, secondary labels (accent orange) |
| Body/Detail | `#b0b0b0` | Descriptions, annotations, metadata |
| Muted/Tertiary | `#999999` | Captions, footnotes, low-priority detail |
| On surface fills | `#e0e0e0` | Text inside shapes (#2a2a2a–#444444 fills) |
| Semantic emphasis | match stroke color | Inline labels tied to a semantic shape |

---

## Evidence Artifact Colors

Used for code snippets, data examples, and other concrete evidence inside technical diagrams.

| Artifact | Background | Text Color |
|----------|-----------|------------|
| Code snippet | `#242424` | `#e0e0e0` body, syntax accents from semantic palette |
| JSON/data example | `#242424` | `#86E89A` (success green) for values, `#C79BFF` (special) for keys |
| Inline keyword | n/a | `#C79BFF` (special purple) |
| Inline function/type | n/a | `#7AB8FF` (info blue) |
| Inline string | n/a | `#86E89A` (success green) |

---

## Default Stroke & Line Colors

| Element | Color |
|---------|-------|
| Arrows | Use the stroke color of the source element's semantic purpose |
| Structural lines (dividers, trees, timelines) | `#555555` (border) or `#b0b0b0` (text-dim) |
| Marker dots (fill + stroke) | `#D4825D` (accent) |
| Annotation lines | `#666666` (border-dim) |
| Focus / highlight emphasis | `#D4825D` (accent) |

---

## Background

| Property | Value |
|----------|-------|
| Canvas background | `#1a1a1a` |

The Excalidraw `appState.viewBackgroundColor` must be `#1a1a1a` so dark surface fills blend correctly and bright strokes pop.

---

## Diff Colors

For before/after, change tracking, or version diagrams:

| State | Stroke | Fill |
|-------|--------|------|
| Added | `#86E89A` | `#2a2a2a` |
| Modified | `#FFDF61` | `#2a2a2a` |
| Deleted | `#FF7A7A` | `#2a2a2a` (use dashed stroke) |

---

## Quick Reference (CSS-token mapping)

For traceability back to the source palette:

- `--bg` `#1a1a1a` → canvas
- `--surface` `#242424` → code/evidence backgrounds, disabled fills
- `--surface-0` `#2a2a2a` → default shape fill
- `--surface-1` `#383838` → secondary shape fill
- `--surface-2` `#444444` → tertiary shape fill
- `--border` `#555555` → structural lines
- `--border-dim` `#666666` → annotation lines, disabled strokes
- `--text` `#e0e0e0` → primary text
- `--text-dim` `#b0b0b0` → secondary text
- `--text-muted` `#999999` → muted text
- `--accent` `#D4825D` → primary accent, focus, markers
- `--accent-dark` `#C15F3C` → secondary accent
- `--success` `#86E89A` / `--warning` `#FFDF61` / `--error` `#FF7A7A` / `--info` `#7AB8FF` / `--special` `#C79BFF` / `--secondary` `#8ABFB8` → semantic strokes
