return {
  "akinsho/bufferline.nvim",
  opts = {
    options = {
      separator_style = "thin",
      diagnostics = "nvim_lsp",
    },
    highlights = {
      -- Fond global
      fill = { bg = "#1a1a1a" },

      -- Buffer inactif
      background = { fg = "#555555", bg = "#1a1a1a" },
      close_button = { fg = "#555555", bg = "#1a1a1a" },
      separator = { fg = "#3a3a3a", bg = "#1a1a1a" },
      duplicate = { fg = "#555555", bg = "#1a1a1a", italic = true },
      modified = { fg = "#FFDF61", bg = "#1a1a1a" },

      -- Buffer visible (dans une fenêtre mais pas focus)
      buffer_visible = { fg = "#999999", bg = "#1a1a1a" },
      close_button_visible = { fg = "#999999", bg = "#1a1a1a" },
      separator_visible = { fg = "#3a3a3a", bg = "#1a1a1a" },
      indicator_visible = { fg = "#3a3a3a", bg = "#1a1a1a" },
      duplicate_visible = { fg = "#555555", bg = "#1a1a1a", italic = true },
      modified_visible = { fg = "#FFDF61", bg = "#1a1a1a" },

      -- Buffer sélectionné (accent orange)
      buffer_selected = { fg = "#1a1a1a", bg = "#D4825D", bold = true },
      close_button_selected = { fg = "#1a1a1a", bg = "#D4825D" },
      separator_selected = { fg = "#D4825D", bg = "#1a1a1a" },
      indicator_selected = { fg = "#D4825D", bg = "#D4825D" },
      duplicate_selected = { fg = "#2a2a2a", bg = "#D4825D", italic = true },
      modified_selected = { fg = "#FFDF61", bg = "#D4825D" },

      -- Diagnostics inactif
      error = { fg = "#B54A4A", bg = "#1a1a1a" },
      warning = { fg = "#FFDF61", bg = "#1a1a1a" },
      info = { fg = "#D4825D", bg = "#1a1a1a" },
      hint = { fg = "#5a4a40", bg = "#1a1a1a" },
      error_diagnostic = { fg = "#B54A4A", bg = "#1a1a1a" },
      warning_diagnostic = { fg = "#FFDF61", bg = "#1a1a1a" },
      info_diagnostic = { fg = "#D4825D", bg = "#1a1a1a" },
      hint_diagnostic = { fg = "#5a4a40", bg = "#1a1a1a" },

      -- Diagnostics visible
      error_visible = { fg = "#B54A4A", bg = "#1a1a1a" },
      warning_visible = { fg = "#FFDF61", bg = "#1a1a1a" },
      info_visible = { fg = "#D4825D", bg = "#1a1a1a" },
      hint_visible = { fg = "#5a4a40", bg = "#1a1a1a" },
      error_diagnostic_visible = { fg = "#B54A4A", bg = "#1a1a1a" },
      warning_diagnostic_visible = { fg = "#FFDF61", bg = "#1a1a1a" },
      info_diagnostic_visible = { fg = "#D4825D", bg = "#1a1a1a" },
      hint_diagnostic_visible = { fg = "#5a4a40", bg = "#1a1a1a" },

      -- Diagnostics sélectionné (sur fond orange)
      error_selected = { fg = "#B54A4A", bg = "#D4825D", bold = true },
      warning_selected = { fg = "#FFDF61", bg = "#D4825D", bold = true },
      info_selected = { fg = "#1a1a1a", bg = "#D4825D", bold = true },
      hint_selected = { fg = "#2a2a2a", bg = "#D4825D", bold = true },
      error_diagnostic_selected = { fg = "#B54A4A", bg = "#D4825D", bold = true },
      warning_diagnostic_selected = { fg = "#FFDF61", bg = "#D4825D", bold = true },
      info_diagnostic_selected = { fg = "#1a1a1a", bg = "#D4825D", bold = true },
      hint_diagnostic_selected = { fg = "#2a2a2a", bg = "#D4825D", bold = true },

      -- Tabs
      tab = { fg = "#555555", bg = "#1a1a1a" },
      tab_selected = { fg = "#1a1a1a", bg = "#D4825D", bold = true },
      tab_close = { fg = "#B54A4A", bg = "#1a1a1a" },
      tab_separator = { fg = "#3a3a3a", bg = "#1a1a1a" },
      tab_separator_selected = { fg = "#D4825D", bg = "#1a1a1a" },
    },
  },
}
