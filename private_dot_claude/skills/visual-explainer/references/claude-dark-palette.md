# Claude Dark Palette Reference

This is the mandatory color palette for all visual-explainer output. Always use these colors. Do not deviate, do not improvise alternate palettes.

Source of truth: kbrdn.dev v2 (`~/Projects/Perso/kbrdn.dev-v2/app/assets/css/theme.css`, synced 2026-11-17). The live implementation for local reports is `~/.claude/skills/me/report/shell/view.css`.

## Surfaces and typography (kbrdn.dev v2)

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--panel` | `#0f0f0f` | `#f5f5f5` | Panels holding cards (sections) |
| `--card` | `#191919` | `#ffffff` | Cards, tables, diagram boxes |
| `--line` | `#2a2a2a` | `#e5e5e5` | Panel and card borders |
| `--label` | `#999999` | `#666666` | Small mono labels (`#666` is 5.3:1 on light, 3.1:1 on dark: never `#666` on dark) |
| `--accent-text` | `#d4825d` | `#a64d2e` | Accent text on an orange tint (`#c15f3c` only holds 3.6:1 there in light) |

Fonts: `Inter` (sans), `Monaspace Krypton` (mono, labels), `Monaspace Neon` (code), `Monaspace Radon` (comments). All installed locally: a **local** HTML file uses them directly. A **published** artifact cannot load them (CSP): keep a system mono stack there.

Never put a class named `label` on your own elements in a page that renders Mermaid: Mermaid uses `.label` for node text and inherits the styles.

## Primary Variant: Pure Dark

Use this by default in `:root`.

### Base Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#1a1a1a` | Page background (Crust) |
| `--surface` | `#242424` | Elevated surfaces (Mantle) |
| `--surface-0` | `#2a2a2a` | Cards, panels |
| `--surface-1` | `#383838` | Active elements |
| `--surface-2` | `#444444` | Hover states |
| `--border` | `#555555` | Default borders (Overlay 0) |
| `--border-dim` | `#666666` | Secondary borders (Overlay 1) |
| `--text` | `#e0e0e0` | Primary text |
| `--text-dim` | `#b0b0b0` | Secondary text (Subtext 0) |
| `--text-muted` | `#999999` | Tertiary text (Subtext 1) |
| `--muted` | `#555555` | Comments, disabled elements |

### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#D4825D` | Primary accent (Orange) — links, active states, cursor |
| `--accent-dark` | `#C15F3C` | Secondary accent (Orange Dark) — hover, focused borders |
| `--accent-dim` | `rgba(212, 130, 93, 0.15)` | Accent background tint |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#86E89A` | Green — additions, pass, yes |
| `--warning` | `#FFDF61` | Yellow — warnings, modifications |
| `--error` | `#FF7A7A` | Red — errors, deletions, danger |
| `--info` | `#7AB8FF` | Blue — information, functions, types |
| `--special` | `#C79BFF` | Purple — keywords, operators |
| `--secondary` | `#8ABFB8` | Cyan — escape chars, secondary info |

### Semantic Dim Variants (for backgrounds)

| Token | Hex |
|-------|-----|
| `--success-dim` | `rgba(134, 232, 154, 0.12)` |
| `--warning-dim` | `rgba(255, 223, 97, 0.12)` |
| `--error-dim` | `rgba(255, 122, 122, 0.12)` |
| `--info-dim` | `rgba(122, 184, 255, 0.12)` |
| `--special-dim` | `rgba(199, 155, 255, 0.12)` |
| `--secondary-dim` | `rgba(138, 191, 184, 0.12)` |

## Light Theme Override

Apply inside `@media (prefers-color-scheme: light)`:

| Token | Hex | Notes |
|-------|-----|-------|
| `--bg` | `#f5f5f5` | Neutral off-white (kbrdn.dev v2, no longer warm) |
| `--surface` | `#ffffff` | Light surface |
| `--surface-0` | `#ffffff` | Light cards |
| `--surface-1` | `#e0e0e0` | Light active |
| `--surface-2` | `#d0d0d0` | Light hover |
| `--border` | `#e5e5e5` | Subtle border |
| `--text` | `#1a1a1a` | Dark text |
| `--text-dim` | `#3a3a3a` | Medium text |
| `--text-muted` | `#666666` | Muted text |
| `--accent` | `#C15F3C` | Orange Dark as primary in light |
| `--accent-dark` | `#a64d2e` | Darker orange for hover, and accent text on a tint |

Semantic colors stay the same hex but increase dim variant opacity to 0.18 for visibility on light backgrounds.

## CSS Template

```css
:root {
  /* Claude Dark — Pure Dark */
  --bg: #1a1a1a;
  --surface: #242424;
  --surface-0: #2a2a2a;
  --surface-1: #383838;
  --surface-2: #444444;
  --border: #555555;
  --border-dim: #666666;
  --text: #e0e0e0;
  --text-dim: #b0b0b0;
  --text-muted: #999999;
  --muted: #555555;

  --accent: #D4825D;
  --accent-dark: #C15F3C;
  --accent-dim: rgba(212, 130, 93, 0.15);

  --success: #86E89A;
  --warning: #FFDF61;
  --error: #FF7A7A;
  --info: #7AB8FF;
  --special: #C79BFF;
  --secondary: #8ABFB8;

  --success-dim: rgba(134, 232, 154, 0.12);
  --warning-dim: rgba(255, 223, 97, 0.12);
  --error-dim: rgba(255, 122, 122, 0.12);
  --info-dim: rgba(122, 184, 255, 0.12);
  --special-dim: rgba(199, 155, 255, 0.12);
  --secondary-dim: rgba(138, 191, 184, 0.12);
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #f5f5f5;
    --surface: #ffffff;
    --surface-0: #ffffff;
    --surface-1: #e0e0e0;
    --surface-2: #d0d0d0;
    --border: #e5e5e5;
    --border-dim: #d0d0d0;
    --text: #1a1a1a;
    --text-dim: #3a3a3a;
    --text-muted: #666666;
    --muted: #666666;

    --accent: #C15F3C;
    --accent-dark: #a64d2e;
    --accent-dim: rgba(193, 95, 60, 0.12);

    --success-dim: rgba(134, 232, 154, 0.18);
    --warning-dim: rgba(255, 223, 97, 0.18);
    --error-dim: rgba(255, 122, 122, 0.18);
    --info-dim: rgba(122, 184, 255, 0.18);
    --special-dim: rgba(199, 155, 255, 0.18);
    --secondary-dim: rgba(138, 191, 184, 0.18);
  }
}
```

## Mermaid Theme Variables

When using Mermaid diagrams, always apply these `themeVariables`:

```javascript
{
  theme: 'base',
  themeVariables: {
    primaryColor: '#2a2a2a',
    primaryTextColor: '#e0e0e0',
    primaryBorderColor: '#555555',
    lineColor: '#D4825D',
    secondaryColor: '#383838',
    tertiaryColor: '#444444',
    background: '#1a1a1a',
    mainBkg: '#2a2a2a',
    nodeBorder: '#555555',
    clusterBkg: '#242424',
    clusterBorder: '#555555',
    titleColor: '#e0e0e0',
    edgeLabelBackground: '#242424',
    nodeTextColor: '#e0e0e0'
  }
}
```

## Diff Colors

| State | Color | Dim Background |
|-------|-------|----------------|
| Added | `#86E89A` | `rgba(134, 232, 154, 0.12)` |
| Modified | `#FFDF61` | `rgba(255, 223, 97, 0.12)` |
| Deleted | `#FF7A7A` | `rgba(255, 122, 122, 0.12)` |

## Accessibility

All combinations meet WCAG 2.1 AA:
- Foreground on Background: 12.5:1 (AAA)
- Orange on Background: 5.8:1 (AA)
- Muted on Background: 4.6:1 (AA)

## Selection

- Background: `#C15F3C80` (Orange Dark 50% opacity)
- Scrollbar thumb: `#D4825D99` (Orange with opacity)
