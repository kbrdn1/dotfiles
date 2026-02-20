return {
  "greggh/claude-code.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  keys = {
    {
      "<leader>ac",
      function()
        Snacks.terminal({ "claude" }, { cwd = LazyVim.root(), win = { position = "left", width = 0.3 } })
      end,
      desc = "Claude Code",
    },
    {
      "<leader>aC",
      function()
        Snacks.terminal({ "claude", "--continue" }, { cwd = LazyVim.root(), win = { position = "left", width = 0.3 } })
      end,
      desc = "Claude Code (continue)",
    },
    {
      "<leader>aS",
      function()
        Snacks.terminal(
          { "claude", "--dangerously-skip-permissions" },
          { cwd = LazyVim.root(), win = { position = "left", width = 0.3 } }
        )
      end,
      desc = "Claude Code (skip perms)",
    },
    {
      "<leader>av",
      function()
        Snacks.terminal({ "claude", "--verbose" }, { cwd = LazyVim.root(), win = { position = "left", width = 0.3 } })
      end,
      desc = "Claude Code (verbose)",
    },
    {
      "<leader>aV",
      function()
        Snacks.terminal(
          { "claude", "--verbose", "--continue" },
          { cwd = LazyVim.root(), win = { position = "left", width = 0.3 } }
        )
      end,
      desc = "Claude Code (verbose + continue)",
    },
  },
  config = function()
    require("claude-code").setup({
      -- Configuration de la fenêtre
      window = {
        position = "leftabove vsplit", -- Ouvre à gauche en vertical
        split_ratio = 0.4, -- 40% de la largeur de l'écran
        enter_insert = true, -- Entre automatiquement en mode insertion
        hide_numbers = true,
        hide_signcolumn = true,
      },

      -- Rafraîchissement automatique des fichiers
      refresh = {
        enable = true,
        updatetime = 100,
        timer_interval = 1000,
        show_notifications = false,
      },

      -- Intégration Git
      git = {
        use_git_root = true,
      },

      -- Keymaps (disabled - using custom keys above)
      keymaps = {
        normal = {
          open = nil,
        },
        terminal = {
          close = "<C-c>",
          navigate = {
            h = "<C-h>",
            j = "<C-j>",
            k = "<C-k>",
            l = "<C-l>",
          },
        },
      },

      -- Commande Claude Code
      command = "claude",
    })
  end,
}
