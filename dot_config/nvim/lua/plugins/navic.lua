return {
  {
    "SmiteshP/nvim-navic",
    lazy = true,
    init = function()
      vim.g.navic_silence = true
      vim.api.nvim_create_autocmd("LspAttach", {
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          if client and client.server_capabilities.documentSymbolProvider then
            require("nvim-navic").attach(client, args.buf)
          end
        end,
      })
    end,
    opts = function()
      local ok, colors = pcall(require, "claude-dark.colors")
      if not ok then
        colors = {
          bg_dark = "#242424",
          fg = "#e0e0e0",
          fg_dark = "#999999",
          comment = "#5a4a40",
          purple = "#C79BFF",
          orange = "#E07A47",
          cyan = "#8ABFB8",
          green = "#86E89A",
          yellow = "#FFDF61",
          blue = "#7AB8FF",
          red = "#FF7A7A",
          accent = "#D4825D",
        }
      end

      local bg = "#3a3a3a"

      -- stylua: ignore
      local icons_hl = {
        File          = { fg = colors.fg_dark,  bg = bg },
        Module        = { fg = colors.blue,     bg = bg },
        Namespace     = { fg = colors.blue,     bg = bg },
        Package       = { fg = colors.blue,     bg = bg },
        Class         = { fg = colors.purple,   bg = bg },
        Method        = { fg = colors.orange,   bg = bg },
        Property      = { fg = colors.cyan,     bg = bg },
        Field         = { fg = colors.cyan,     bg = bg },
        Constructor   = { fg = colors.orange,   bg = bg },
        Enum          = { fg = colors.purple,   bg = bg },
        Interface     = { fg = colors.purple,   bg = bg },
        Function      = { fg = colors.accent,   bg = bg },
        Variable      = { fg = colors.cyan,     bg = bg },
        Constant      = { fg = colors.yellow,   bg = bg },
        String        = { fg = colors.green,    bg = bg },
        Number        = { fg = colors.yellow,   bg = bg },
        Boolean       = { fg = colors.yellow,   bg = bg },
        Array         = { fg = colors.cyan,     bg = bg },
        Object        = { fg = colors.purple,   bg = bg },
        Key           = { fg = colors.red,      bg = bg },
        Null          = { fg = colors.red,      bg = bg },
        EnumMember    = { fg = colors.cyan,     bg = bg },
        Struct        = { fg = colors.purple,   bg = bg },
        Event         = { fg = colors.orange,   bg = bg },
        Operator      = { fg = colors.fg,       bg = bg },
        TypeParameter = { fg = colors.purple,   bg = bg },
      }

      for kind, hl in pairs(icons_hl) do
        vim.api.nvim_set_hl(0, "NavicIcons" .. kind, hl)
      end
      vim.api.nvim_set_hl(0, "NavicText", { fg = colors.fg_dark, bg = bg })
      vim.api.nvim_set_hl(0, "NavicSeparator", { fg = colors.comment, bg = bg })

      return {
        separator = "",
        highlight = true,
        depth_limit = 5,
        lazy_update_context = true,
      }
    end,
  },
}
