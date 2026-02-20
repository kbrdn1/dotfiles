return {
  "aserowy/tmux.nvim",
  lazy = false,
  opts = {
    copy_sync = {
      enable = false, -- disabled to use system clipboard directly
    },
    navigation = {
      enable_default_keybindings = true,
      cycle_navigation = true,
      persist_zoom = false,
    },
    resize = {
      enable_default_keybindings = false, -- Resize handled by tmux prefix + H/J/K/L
    },
  },
  keys = {
    { "<C-h>", [[<cmd>lua require("tmux").move_left()<cr>]], desc = "Tmux Left" },
    { "<C-j>", [[<cmd>lua require("tmux").move_bottom()<cr>]], desc = "Tmux Down" },
    { "<C-k>", [[<cmd>lua require("tmux").move_top()<cr>]], desc = "Tmux Up" },
    { "<C-l>", [[<cmd>lua require("tmux").move_right()<cr>]], desc = "Tmux Right" },
  },
}
