-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

-- Sync clipboard with system
vim.opt.clipboard = "unnamedplus"

-- Fix Alt/Meta key timeout (important for macOS + tmux)
vim.opt.timeout = true
vim.opt.timeoutlen = 300
vim.opt.ttimeout = true
vim.opt.ttimeoutlen = 10

-- Word wrap always on
vim.opt.wrap = true

-- Set Claude Dark as the default colorscheme
vim.g.lazyvim_colorscheme = "claude-dark"
