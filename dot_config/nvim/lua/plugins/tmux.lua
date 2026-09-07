-- Navigation seamless entre splits nvim et panes du multiplexeur.
-- Ctrl+h/j/k/l bouge entre splits nvim ; au bord du split, bascule sur la pane
-- voisine. herdr prioritaire (HERDR_PANE_ID injecté dans chaque pane), sinon
-- fallback tmux.nvim — utile car la session est souvent nestée tmux + herdr.
-- Côté herdr : binds ctrl+hjkl -> plugin vim-herdr-navigation (~/.config/herdr/config.toml).
return {
  "aserowy/tmux.nvim",
  lazy = false,
  opts = {
    copy_sync = {
      enable = false, -- disabled to use system clipboard directly
    },
    navigation = {
      enable_default_keybindings = false, -- on gère C-hjkl nous-mêmes (herdr-aware)
      cycle_navigation = true,
      persist_zoom = false,
    },
    resize = {
      enable_default_keybindings = false, -- Resize handled by tmux/herdr prefix + H/J/K/L
    },
  },
  keys = {
    { "<C-h>", function() require("config.herdr-nav").nav("h", "left") end, desc = "Nav Left (vim/herdr)" },
    { "<C-j>", function() require("config.herdr-nav").nav("j", "down") end, desc = "Nav Down (vim/herdr)" },
    { "<C-k>", function() require("config.herdr-nav").nav("k", "up") end, desc = "Nav Up (vim/herdr)" },
    { "<C-l>", function() require("config.herdr-nav").nav("l", "right") end, desc = "Nav Right (vim/herdr)" },
  },
}
