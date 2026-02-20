return {
  "nvim-lualine/lualine.nvim",
  event = "VeryLazy",
  opts = {
    options = {

      theme = {
        normal = {
          a = { fg = "#1a1a1a", bg = "#D4825D", gui = "bold" },
          b = { fg = "#e0e0e0", bg = "#3a3a3a" },
          c = { fg = "#999999", bg = "#1a1a1a" },
        },
        insert = { a = { fg = "#1a1a1a", bg = "#86E89A", gui = "bold" } },
        visual = { a = { fg = "#1a1a1a", bg = "#C79BFF", gui = "bold" } },
        replace = { a = { fg = "#1a1a1a", bg = "#FF7A7A", gui = "bold" } },
        command = { a = { fg = "#1a1a1a", bg = "#FFDF61", gui = "bold" } },
        terminal = { a = { fg = "#1a1a1a", bg = "#7AB8FF", gui = "bold" } },
        inactive = {
          a = { fg = "#999999", bg = "#2a2a2a" },
          b = { fg = "#999999", bg = "#242424" },
          c = { fg = "#555555", bg = "#1a1a1a" },
        },
      },

      globalstatus = true,
      component_separators = { left = "", right = "" },
      disabled_filetypes = {
        statusline = { "dashboard", "alpha", "ministarter", "snacks_dashboard" },
        winbar = {
          "dashboard",
          "alpha",
          "ministarter",
          "snacks_dashboard",
          "neo-tree",
          "Trouble",
          "lazy",
          "toggleterm",
          "snacks_terminal",
        },
      },
    },
    sections = {
      -- GAUCHE
      lualine_a = { { "mode", separator = { left = "", right = "" } } },
      lualine_b = {
        { "branch", separator = { right = "" } },
        {
          "diagnostics",
          symbols = {
            error = " ",
            warn = " ",
            info = " ",
            hint = " ",
          },
          separator = { right = "" },
        },
      },
      lualine_c = {
        LazyVim.lualine.root_dir(),
      },

      -- DROITE
      lualine_x = {
        {
          "diff",
          symbols = {
            added = " ",
            modified = " ",
            removed = " ",
          },
        },
      },
      lualine_y = {
        {
          function()
            local reg = vim.fn.reg_recording()
            if reg ~= "" then
              return "󰑋 @" .. reg
            end
            return ""
          end,
          color = { fg = "#FF7A7A" },
        },
        {
          function()
            local status = require("copilot.api").status.data.status
            local icons = { InProgress = "", Normal = "", Warning = "" }
            return icons[status] or ""
          end,
          color = { fg = "#86E89A" },
          separator = { left = "" },
        },
        {
          function()
            local clients = vim.lsp.get_clients({ bufnr = 0 })
            if #clients == 0 then
              return ""
            end
            local names = {}
            for _, client in ipairs(clients) do
              table.insert(names, client.name)
            end
            return "󰒋 " .. table.concat(names, "•")
          end,
          color = { fg = "#7AB8FF" },
          separator = { left = "" },
        },
        { "progress", separator = { left = "" } },
        { "location", separator = { left = "" } },
      },
      lualine_z = {
        {
          function()
            return "󰅐 " .. os.date("%R")
          end,
          separator = { left = "", right = "" },
        },
      },
    },
    winbar = {
      lualine_a = {
        { "filetype", icon_only = true, separator = { left = "" }, padding = { left = 1, right = 0 } },
        { LazyVim.lualine.pretty_path(), separator = { right = "" } },
      },
      lualine_b = {
        {
          function()
            return require("nvim-navic").get_location()
          end,
          cond = function()
            return package.loaded["nvim-navic"] and require("nvim-navic").is_available()
          end,
          separator = { right = "" },
        },
      },
      lualine_c = {
        {
          function()
            return " "
          end,
          color = { bg = "#1a1a1a" },
          padding = 0,
        },
      },
    },
    inactive_winbar = {
      lualine_a = {
        { "filetype", icon_only = true, separator = "", padding = { left = 1, right = 0 } },
        { LazyVim.lualine.pretty_path(), separator = { right = "" } },
      },
      lualine_b = {},
      lualine_c = {
        {
          function()
            return " "
          end,
          color = { bg = "NONE" },
          padding = 0,
        },
      },
    },
    extensions = { "neo-tree", "lazy", "fzf" },
  },
}
