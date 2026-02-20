-- Color palette from Zed Claude Dark (Blur variant)
-- Using darker Zed "Pure" variant for better contrast
local colors = {
  -- Base colors (using Pure Dark variant - much darker)
  bg = "#1a1a1a",              -- terminal.background from Pure Dark
  bg_dark = "#242424",         -- elevated_surface.background
  bg_highlight = "#2a2a2a",    -- element.background
  bg_visual = "#3a3a3a",       -- element.selected
  fg = "#e0e0e0",              -- text (Pure variant)
  fg_dark = "#999999",         -- text.muted
  fg_gutter = "#555555",       -- editor.line_number

  -- Syntax colors (exact from theme)
  comment = "#8a7a6a",
  cyan = "#8ABFB8",
  green = "#86E89A",
  orange = "#E07A47",
  purple = "#C79BFF",
  red = "#FF7A7A",
  yellow = "#FFDF61",
  blue = "#7AB8FF",

  -- Accent colors (from theme borders and highlights)
  accent = "#D4825D",          -- text.accent, icon.accent
  accent_dark = "#C15F3C",     -- border.focused (ORANGE!)
  accent_light = "#F4C895",
  accent_variant = "#A64D2E",  -- border.variant

  -- UI colors (exact from Zed theme)
  border = "#2a2520",          -- border
  border_focused = "#C15F3C",  -- border.focused (ORANGE!)
  border_selected = "#D4825D", -- border.selected (ORANGE!)
  selection = "#4a3f35",       -- element.selected
  search = "#D4825D",          -- search.match_background (darker for visibility)

  -- Git colors
  git_add = "#86E89A",
  git_change = "#FFDF61",
  git_delete = "#FF7A7A",

  -- Diagnostic colors
  error = "#FF7A7A",
  warning = "#FFDF61",
  info = "#D4825D",
  hint = "#5a4a40",

  -- Special
  none = "NONE",
}

return colors
