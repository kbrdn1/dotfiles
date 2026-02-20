-- Claude Dark theme for Neovim
-- Ported from Zed's Claude Dark theme

return {
  -- Disable other colorschemes
  { "folke/tokyonight.nvim", enabled = false },
  { "catppuccin/nvim", enabled = false },

  -- Claude Dark as local plugin
  {
    dir = vim.fn.stdpath("config") .. "/lua/claude-dark",
    name = "claude-dark",
    lazy = false,
    priority = 1000,
    config = function()
      require("claude-dark").setup()
    end,
  },

  -- LazyVim colorscheme configuration
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "claude-dark",
    },
  },
}
