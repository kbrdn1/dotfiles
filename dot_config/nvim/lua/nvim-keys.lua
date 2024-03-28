local keys = {}

function keys.init()
        -- Keybindings de base
        local km = vim.keymap.set

        km("n", "<C-s>", "<cmd>:w<cr>", { silent = true })
        km("n", "<up>", "‹nop>", { silent = true })
        km("n", "<down>", "‹nop>", { silent = true })
        km("n", "<left>", "‹nop>", { silent = true })
        km("n", "<right>", "‹nop>", { silent = true })

        -- Désactiver le biding des macros
        km("n", "q", "<nop>", { silent = true }) -- Désactiver les macros
        km({ "n", "i" }, "<esc>", "<cmd>noh<cr><esc>", { desc = "Escape and clear hlsearch", silent = true })

        -- Window Management
        km("n", "<leader>wd", "<C-W>c", { desc = "Delete window", silent = true })
        km("n", "<leader>ws", "<C-W>s", { desc = "Split below", silent = true })
        km("n", "<leader>wv", "<C-W>v", { desc = "Split right", silent = true })
        km("n", "<C-h>", "<C-W>h", { desc = "Move to the left window", silent = true })
        km("n", "<C-l>", "<C-W>l", { desc = "Move to the right window", silent = true })

        -- Tab Management
        km("n", "<leader>tt", "<cmd>tabnew<cr>", { desc = "Open new tab", silent = true })
        km("n", "<leader>td", "<cmd>tabclose<cr>", { desc = "Close current tab", silent = true })
        km("n", "<S-h>", "<cmd>tabprevious<cr>", { desc = "Go to previous tab", silent = true })
        km("n", "<S-l>", "<cmd>tabnext<cr>", { desc = "Go to next tab", silent = true })
        km("n", "<S-j>", "<cmd>-tabmove<cr>", { desc = "Move a tab to the left", silent = true })
        km("n", "<S-k>", "<cmd>+tabmove<cr>", { desc = "Move a tab to the right", silent = true })

        -- Other
        km("v", "J", ":m '>+1<CR>gv=gv", { desc = "Move line down", silent = true })
        km("v", "K", ":m '<-2<CR>gv=gv", { desc = "Move line up", silent = true })
end

return keys
