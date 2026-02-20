-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- Fix macOS: Option key sends Meta modifier with special characters
-- Required for French/international keyboards where {} [] | ~ etc. need Option
if vim.fn.has("mac") == 1 then
  local meta_fixes = { "{", "}", "[", "]", "|", "~", "`", "#", "@", "\\", "€" }
  for _, char in ipairs(meta_fixes) do
    pcall(vim.keymap.set, { "i", "o", "x", "c", "n" }, string.format("<M-%s>", char), char, { noremap = true, silent = true })
  end
end

-- Buffer navigation
vim.keymap.set("n", "<leader>bb", "<cmd>bprevious<cr>", { desc = "Previous buffer" })
vim.keymap.set("n", "<leader>bn", "<cmd>bnext<cr>", { desc = "Next buffer" })

-- Tab navigation
vim.keymap.set("n", "<leader><tab>b", "<cmd>tabprevious<cr>", { desc = "Previous tab" })
vim.keymap.set("n", "<leader><tab>n", "<cmd>tabnext<cr>", { desc = "Next tab" })

-- Terminal directions (using Snacks.terminal)
vim.keymap.set("n", "<leader>Ts", function()
  Snacks.terminal(nil, { win = { position = "bottom", height = 0.3 } })
end, { desc = "Terminal (split)" })

vim.keymap.set("n", "<leader>Tv", function()
  Snacks.terminal(nil, { win = { position = "right", width = 0.4 } })
end, { desc = "Terminal (vertical)" })

vim.keymap.set("n", "<leader>Tf", function()
  Snacks.terminal(nil, { win = { position = "float" } })
end, { desc = "Terminal (float)" })

-- OpenCode
vim.keymap.set("n", "<leader>ao", function()
  Snacks.terminal({"opencode"}, { cwd = LazyVim.root(), win = { position = "left", width = 0.3 } })
end, { desc = "OpenCode" })

vim.keymap.set("n", "<leader>aO", function()
  Snacks.terminal({"opencode", "--continue"}, { cwd = LazyVim.root(), win = { position = "left", width = 0.3 } })
end, { desc = "OpenCode (continue)" })
