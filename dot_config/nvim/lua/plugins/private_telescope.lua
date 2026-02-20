return {
  "nvim-telescope/telescope.nvim",
  opts = function(_, opts)
    local actions = require("telescope.actions")

    -- Customized window appearance for all telescope pickers
    opts.defaults = vim.tbl_deep_extend("force", opts.defaults or {}, {
      -- Window styling
      border = true,
      borderchars = {
        prompt = { "─", "│", " ", "│", "╭", "╮", "│", "│" },
        results = { "─", "│", "─", "│", "├", "┤", "╯", "╰" },
        preview = { "─", "│", "─", "│", "╭", "╮", "╯", "╰" },
      },

      -- Layout configuration
      layout_strategy = "horizontal", -- or "vertical", "center", "cursor"
      layout_config = {
        horizontal = {
          prompt_position = "top",
          preview_width = 0.55,
          results_width = 0.8,
        },
        width = 0.87,
        height = 0.80,
        preview_cutoff = 120,
      },

      -- Sorting and selection
      sorting_strategy = "ascending",
      selection_caret = " ",  -- Nerd Font icon (1 cell) + space
      entry_prefix = "  ",    -- 2 spaces to match caret width
      multi_icon = "",       -- Nerd Font checkmark

      -- Visual enhancements
      prompt_prefix = "  ",   -- Nerd Font search icon
      color_devicons = true,
      path_display = { "truncate" },

      -- Behavior
      mappings = {
        i = {
          ["<C-j>"] = actions.move_selection_next,
          ["<C-k>"] = actions.move_selection_previous,
          ["<C-q>"] = actions.send_selected_to_qflist + actions.open_qflist,
        },
      },
    })

    -- Specific picker configurations (optional)
    opts.pickers = vim.tbl_deep_extend("force", opts.pickers or {}, {})

    -- Apply custom highlight groups for better aesthetics
    vim.api.nvim_create_autocmd("FileType", {
      pattern = "TelescopePrompt",
      callback = function()
        -- Claude Dark colors (from lua/claude-dark/colors.lua)
        local colors = {
          base = "#1a1a1a",
          surface0 = "#242424",
          text = "#e0e0e0",
          subtext0 = "#999999",
          subtext1 = "#555555",
          blue = "#7AB8FF",
          green = "#86E89A",
          peach = "#D4825D",
          red = "#FF7A7A",
          mauve = "#C79BFF",
          yellow = "#FFDF61",
          teal = "#8ABFB8",
        }

        -- Window borders and backgrounds
        vim.api.nvim_set_hl(0, "TelescopeBorder", { bg = colors.base, fg = colors.blue })
        vim.api.nvim_set_hl(0, "TelescopeNormal", { bg = colors.base, fg = colors.text })
        vim.api.nvim_set_hl(0, "TelescopePromptBorder", { bg = colors.surface0, fg = colors.blue })
        vim.api.nvim_set_hl(0, "TelescopePromptNormal", { bg = colors.surface0, fg = colors.text })
        vim.api.nvim_set_hl(0, "TelescopeResultsBorder", { bg = colors.base, fg = colors.blue })
        vim.api.nvim_set_hl(0, "TelescopeResultsNormal", { bg = colors.base, fg = colors.text })
        vim.api.nvim_set_hl(0, "TelescopePreviewBorder", { bg = colors.base, fg = colors.blue })
        vim.api.nvim_set_hl(0, "TelescopePreviewNormal", { bg = colors.base, fg = colors.text })

        -- Titles
        vim.api.nvim_set_hl(0, "TelescopePromptTitle", { bg = colors.blue, fg = colors.base, bold = true })
        vim.api.nvim_set_hl(0, "TelescopeResultsTitle", { bg = colors.peach, fg = colors.base, bold = true })
        vim.api.nvim_set_hl(0, "TelescopePreviewTitle", { bg = colors.green, fg = colors.base, bold = true })

        -- Selection
        vim.api.nvim_set_hl(0, "TelescopeSelection", { bg = colors.surface0, fg = colors.text, bold = true })
        vim.api.nvim_set_hl(0, "TelescopeSelectionCaret", { bg = colors.surface0, fg = colors.red })

        -- Results content (used by entry_display)
        vim.api.nvim_set_hl(0, "TelescopeResultsIdentifier", { fg = colors.yellow })
        vim.api.nvim_set_hl(0, "TelescopeResultsComment", { fg = colors.subtext0, italic = true })
        vim.api.nvim_set_hl(0, "TelescopeResultsClass", { fg = colors.mauve })
        vim.api.nvim_set_hl(0, "TelescopeResultsFunction", { fg = colors.blue })
        vim.api.nvim_set_hl(0, "TelescopeResultsVariable", { fg = colors.teal })

        -- Matching characters
        vim.api.nvim_set_hl(0, "TelescopeMatching", { fg = colors.peach, bold = true })
        vim.api.nvim_set_hl(0, "TelescopePromptPrefix", { fg = colors.blue })
      end,
    })

    return opts
  end,
}
