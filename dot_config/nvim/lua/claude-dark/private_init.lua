-- Claude Dark theme for Neovim
-- Ported from Zed's Claude Dark theme by kbrdn1

local M = {}

-- Import colors from separate file
local colors = require("claude-dark.colors")

-- Apply highlights
local function apply_highlights()
  local highlights = {
    -- Editor (transparent background)
    Normal = { fg = colors.fg, bg = "NONE" },
    NormalFloat = { fg = colors.fg, bg = colors.bg_dark },
    NormalNC = { fg = colors.fg, bg = "NONE" },

    -- UI Elements
    LineNr = { fg = colors.fg_gutter, bg = "NONE" },
    CursorLineNr = { fg = colors.accent, bg = "NONE", bold = true },
    CursorLine = { bg = colors.bg_highlight },
    ColorColumn = { bg = colors.bg_dark },
    SignColumn = { bg = "NONE" },
    Folded = { fg = colors.comment, bg = colors.bg_dark },
    FoldColumn = { fg = colors.comment, bg = "NONE" },

    -- Statusline (with exact Zed colors)
    StatusLine = { fg = colors.fg, bg = colors.bg },
    StatusLineNC = { fg = colors.fg_dark, bg = colors.bg },

    -- WinBar (transparent like editor)
    WinBar = { fg = colors.fg, bg = colors.bg },
    WinBarNC = { fg = colors.fg_dark, bg = colors.bg },

    -- Tabline (transparent)
    TabLine = { fg = colors.fg_dark, bg = colors.bg },
    TabLineFill = { bg = colors.bg },
    TabLineSel = { fg = colors.fg, bg = colors.bg, bold = true },

    -- Window separator (using Zed's border.focused for active windows)
    WinSeparator = { fg = colors.border_focused },
    VertSplit = { fg = colors.border_focused },

    -- Popup menu
    Pmenu = { fg = colors.fg, bg = colors.bg_dark },
    PmenuSel = { fg = colors.bg, bg = colors.accent, bold = true },
    PmenuSbar = { bg = colors.bg_dark },
    PmenuThumb = { bg = colors.accent },

    -- Search
    Search = { fg = colors.bg, bg = colors.search },
    IncSearch = { fg = colors.bg, bg = colors.accent, bold = true },
    CurSearch = { link = "IncSearch" },

    -- Visual
    Visual = { bg = colors.selection },
    VisualNOS = { link = "Visual" },

    -- Messages
    ErrorMsg = { fg = colors.error, bold = true },
    WarningMsg = { fg = colors.warning, bold = true },
    ModeMsg = { fg = colors.fg, bold = true },
    MoreMsg = { fg = colors.green, bold = true },
    Question = { fg = colors.blue, bold = true },

    -- Diff
    DiffAdd = { bg = "#3a4a3a", fg = colors.git_add },
    DiffChange = { bg = "#4a4535", fg = colors.git_change },
    DiffDelete = { bg = "#4a3535", fg = colors.git_delete },
    DiffText = { bg = "#4a4535", fg = colors.yellow, bold = true },

    -- Spell
    SpellBad = { sp = colors.error, undercurl = true },
    SpellCap = { sp = colors.warning, undercurl = true },
    SpellLocal = { sp = colors.info, undercurl = true },
    SpellRare = { sp = colors.hint, undercurl = true },

    -- Syntax highlighting
    Comment = { fg = colors.comment, italic = true },
    Constant = { fg = colors.yellow },
    String = { fg = colors.green },
    Character = { fg = colors.green },
    Number = { fg = colors.yellow },
    Boolean = { fg = colors.yellow },
    Float = { fg = colors.yellow },

    Identifier = { fg = colors.fg },
    Function = { fg = colors.blue },

    Statement = { fg = colors.purple },
    Conditional = { fg = colors.purple },
    Repeat = { fg = colors.purple },
    Label = { fg = colors.orange },
    Operator = { fg = colors.purple },
    Keyword = { fg = colors.purple },
    Exception = { fg = colors.purple },

    PreProc = { fg = colors.purple },
    Include = { fg = colors.purple },
    Define = { fg = colors.purple },
    Macro = { fg = colors.purple },
    PreCondit = { fg = colors.purple },

    Type = { fg = colors.blue },
    StorageClass = { fg = colors.purple },
    Structure = { fg = colors.blue },
    Typedef = { fg = colors.blue },

    Special = { fg = colors.orange },
    SpecialChar = { fg = colors.cyan },
    Tag = { fg = colors.red },
    Delimiter = { fg = colors.fg_dark },
    SpecialComment = { fg = colors.comment, italic = true },
    Debug = { fg = colors.orange },

    -- Treesitter
    ["@variable"] = { fg = colors.fg },
    ["@variable.builtin"] = { fg = colors.red },
    ["@variable.parameter"] = { fg = "#E8C4A0" },
    ["@variable.member"] = { fg = colors.fg },

    ["@constant"] = { fg = colors.yellow },
    ["@constant.builtin"] = { fg = colors.yellow },
    ["@constant.macro"] = { fg = colors.yellow },

    ["@string"] = { fg = colors.green },
    ["@string.escape"] = { fg = colors.cyan },
    ["@string.special"] = { fg = colors.cyan },
    ["@string.regex"] = { fg = colors.orange },

    ["@character"] = { fg = colors.green },
    ["@number"] = { fg = colors.yellow },
    ["@boolean"] = { fg = colors.yellow },
    ["@float"] = { fg = colors.yellow },

    ["@function"] = { fg = colors.blue },
    ["@function.builtin"] = { fg = colors.cyan },
    ["@function.call"] = { fg = colors.blue },
    ["@function.macro"] = { fg = colors.purple },
    ["@function.method"] = { fg = colors.blue, italic = true },

    ["@keyword"] = { fg = colors.purple },
    ["@keyword.function"] = { fg = colors.purple },
    ["@keyword.operator"] = { fg = colors.purple },
    ["@keyword.return"] = { fg = colors.purple },
    ["@keyword.import"] = { fg = colors.purple },

    ["@type"] = { fg = colors.blue },
    ["@type.builtin"] = { fg = colors.purple, italic = true },
    ["@type.definition"] = { fg = colors.blue },
    ["@type.qualifier"] = { fg = colors.blue },

    ["@property"] = { fg = "#E8C4A0" },
    ["@attribute"] = { fg = colors.orange, italic = true },
    ["@field"] = { fg = "#E8C4A0" },

    ["@constructor"] = { fg = colors.blue },
    ["@namespace"] = { fg = colors.blue },
    ["@module"] = { fg = colors.blue },

    ["@operator"] = { fg = colors.purple },
    ["@punctuation.bracket"] = { fg = colors.fg_dark },
    ["@punctuation.delimiter"] = { fg = colors.fg_dark },
    ["@punctuation.special"] = { fg = colors.orange },

    ["@comment"] = { link = "Comment" },
    ["@comment.documentation"] = { fg = colors.comment, italic = true },

    ["@tag"] = { fg = colors.red },
    ["@tag.attribute"] = { fg = colors.orange, italic = true },
    ["@tag.delimiter"] = { fg = colors.fg_dark },

    ["@markup.strong"] = { fg = colors.orange, bold = true },
    ["@markup.italic"] = { fg = colors.orange, italic = true },
    ["@markup.heading"] = { fg = colors.fg, bold = true },
    ["@markup.link"] = { fg = colors.accent_dark },
    ["@markup.link.url"] = { fg = colors.blue, italic = true, underline = true },
    ["@markup.raw"] = { fg = colors.green },

    -- LSP
    LspReferenceText = { bg = colors.bg_visual },
    LspReferenceRead = { bg = colors.bg_visual },
    LspReferenceWrite = { bg = colors.bg_visual },

    DiagnosticError = { fg = colors.error },
    DiagnosticWarn = { fg = colors.warning },
    DiagnosticInfo = { fg = colors.info },
    DiagnosticHint = { fg = colors.hint },

    DiagnosticUnderlineError = { sp = colors.error, undercurl = true },
    DiagnosticUnderlineWarn = { sp = colors.warning, undercurl = true },
    DiagnosticUnderlineInfo = { sp = colors.info, undercurl = true },
    DiagnosticUnderlineHint = { sp = colors.hint, undercurl = true },

    -- Git signs
    GitSignsAdd = { fg = colors.git_add },
    GitSignsChange = { fg = colors.git_change },
    GitSignsDelete = { fg = colors.git_delete },

    -- Telescope (with Zed's panel borders)
    TelescopeBorder = { fg = colors.border_focused, bg = colors.bg_dark },
    TelescopeNormal = { fg = colors.fg, bg = colors.bg_dark },
    TelescopePromptBorder = { fg = colors.border_selected, bg = colors.bg_dark },
    TelescopePromptNormal = { fg = colors.fg, bg = colors.bg_dark },
    TelescopePromptPrefix = { fg = colors.accent, bold = true },
    TelescopeSelection = { fg = colors.fg, bg = colors.selection, bold = true },
    TelescopeSelectionCaret = { fg = colors.accent, bg = colors.selection },

    -- NeoTree / nvim-tree (transparent sidebar)
    NeoTreeNormal = { fg = colors.fg, bg = "NONE" },
    NeoTreeNormalNC = { fg = colors.fg, bg = "NONE" },
    NeoTreeDirectoryIcon = { fg = colors.blue },
    NeoTreeDirectoryName = { fg = colors.blue },
    NeoTreeGitAdded = { fg = colors.git_add },
    NeoTreeGitModified = { fg = colors.git_change },
    NeoTreeGitDeleted = { fg = colors.git_delete },

    -- WhichKey (with Zed's focused borders)
    WhichKey = { fg = colors.accent, bold = true },
    WhichKeyGroup = { fg = colors.blue },
    WhichKeyDesc = { fg = colors.fg },
    WhichKeySeperator = { fg = colors.comment },
    WhichKeyFloat = { bg = colors.bg_dark },
    WhichKeyBorder = { fg = colors.border_focused, bg = colors.bg_dark },

    -- Indent Blankline
    IndentBlanklineChar = { fg = colors.fg_gutter, nocombine = true },
    IndentBlanklineContextChar = { fg = colors.comment, nocombine = true },

    -- Dashboard / Alpha
    DashboardHeader = { fg = colors.accent, bold = true },
    DashboardCenter = { fg = colors.blue },
    DashboardShortcut = { fg = colors.purple },
    DashboardFooter = { fg = colors.comment, italic = true },

    -- Snacks (transparent)
    SnacksNormal = { fg = colors.fg, bg = "NONE" },
    SnacksNormalNC = { fg = colors.fg, bg = "NONE" },
    SnacksBackdrop = { bg = "NONE" },
    SnacksWin = { fg = colors.fg, bg = "NONE" },
    SnacksWinBar = { fg = colors.fg, bg = "NONE" },
    SnacksWinBarNC = { fg = colors.fg_dark, bg = "NONE" },

    -- Snacks Picker
    SnacksPickerNormal = { fg = colors.fg, bg = "NONE" },
    SnacksPickerBorder = { fg = colors.border_focused, bg = "NONE" },
    SnacksPickerTitle = { fg = colors.accent, bg = "NONE", bold = true },
    SnacksPickerPrompt = { fg = colors.fg, bg = "NONE" },
    SnacksPickerMatch = { fg = colors.accent, bold = true },
    SnacksPickerSelected = { fg = colors.fg, bg = colors.selection, bold = true },
    SnacksPickerDir = { fg = colors.fg_dark },
    SnacksPickerFile = { fg = colors.fg },
    SnacksPickerLabel = { fg = colors.blue },
    SnacksPickerComment = { fg = colors.comment, italic = true },
    SnacksPickerGitStatusAdded = { fg = colors.git_add },
    SnacksPickerGitStatusModified = { fg = colors.git_change },
    SnacksPickerGitStatusDeleted = { fg = colors.git_delete },
    SnacksPickerGitStatusUntracked = { fg = colors.fg_dark },

    -- Snacks Explorer
    SnacksExplorerNormal = { fg = colors.fg, bg = "NONE" },
    SnacksExplorerNormalNC = { fg = colors.fg, bg = "NONE" },
    SnacksExplorerDir = { fg = colors.blue },
    SnacksExplorerFile = { fg = colors.fg },

    -- Snacks Dashboard
    SnacksDashboardNormal = { fg = colors.fg, bg = "NONE" },
    SnacksDashboardHeader = { fg = colors.accent, bold = true },
    SnacksDashboardFooter = { fg = colors.comment, italic = true },
    SnacksDashboardDesc = { fg = colors.accent_light },
    SnacksDashboardKey = { fg = colors.purple, bold = true },
    SnacksDashboardIcon = { fg = colors.blue },
    SnacksDashboardTitle = { fg = colors.orange, bold = true },
    SnacksDashboardSpecial = { fg = colors.green },
    SnacksDashboardTerminal = { fg = colors.cyan },

    -- Snacks Notifier
    SnacksNotifierNormal = { fg = colors.fg, bg = "NONE" },
    SnacksNotifierBorder = { fg = colors.border_focused, bg = "NONE" },
    SnacksNotifierInfo = { fg = colors.info },
    SnacksNotifierWarn = { fg = colors.warning },
    SnacksNotifierError = { fg = colors.error },

    -- Snacks Indent
    SnacksIndent = { fg = "#333333", nocombine = true },
    SnacksIndentScope = { fg = colors.accent, nocombine = true },

    -- Snacks Terminal
    SnacksTerminalNormal = { fg = colors.fg, bg = "NONE" },
    SnacksTerminalBorder = { fg = colors.border_focused, bg = "NONE" },
  }

  -- Apply all highlights
  for group, opts in pairs(highlights) do
    vim.api.nvim_set_hl(0, group, opts)
  end
end

-- Setup function
function M.setup()
  -- Clear existing highlights
  vim.cmd("hi clear")

  if vim.fn.exists("syntax_on") then
    vim.cmd("syntax reset")
  end

  -- Set colorscheme name
  vim.g.colors_name = "claude-dark"

  -- Set terminal colors
  vim.g.terminal_color_0 = "#4a3f35"
  vim.g.terminal_color_1 = "#FF7A7A"
  vim.g.terminal_color_2 = "#86E89A"
  vim.g.terminal_color_3 = "#FFDF61"
  vim.g.terminal_color_4 = "#7AB8FF"
  vim.g.terminal_color_5 = "#C79BFF"
  vim.g.terminal_color_6 = "#8ABFB8"
  vim.g.terminal_color_7 = "#D4C4B8"
  vim.g.terminal_color_8 = "#8a7a70"
  vim.g.terminal_color_9 = "#FF7A7A"
  vim.g.terminal_color_10 = "#86E89A"
  vim.g.terminal_color_11 = "#FFDF61"
  vim.g.terminal_color_12 = "#7AB8FF"
  vim.g.terminal_color_13 = "#C79BFF"
  vim.g.terminal_color_14 = "#8ABFB8"
  vim.g.terminal_color_15 = "#F4F3EE"

  -- Apply highlights
  apply_highlights()
end

return M
