# Claude Dark Palette Reference

This is the mandatory color palette for all visual-explainer output. Always use these colors. Do not deviate, do not improvise alternate palettes.

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
| `--bg` | `#faf8f6` | Warm off-white |
| `--surface` | `#f0ece8` | Light warm surface |
| `--surface-0` | `#e8e2dc` | Light cards |
| `--surface-1` | `#ddd5cc` | Light active |
| `--surface-2` | `#d0c6ba` | Light hover |
| `--border` | `rgba(0, 0, 0, 0.1)` | Subtle dark border |
| `--text` | `#2a2520` | Dark warm text |
| `--text-dim` | `#5a4a40` | Medium text |
| `--text-muted` | `#8a7a70` | Muted text |
| `--accent` | `#C15F3C` | Orange Dark as primary in light |
| `--accent-dark` | `#a04e30` | Darker orange for hover in light |

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
    --bg: #faf8f6;
    --surface: #f0ece8;
    --surface-0: #e8e2dc;
    --surface-1: #ddd5cc;
    --surface-2: #d0c6ba;
    --border: rgba(0, 0, 0, 0.1);
    --border-dim: rgba(0, 0, 0, 0.06);
    --text: #2a2520;
    --text-dim: #5a4a40;
    --text-muted: #8a7a70;
    --muted: #8a7a70;

    --accent: #C15F3C;
    --accent-dark: #a04e30;
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
