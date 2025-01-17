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

        -- Telescope
        km("n", "<leader>ff", "<cmd>Telescope find_files<cr>", { desc = "Find files", silent = true })
        km("n", "<leader>fg", "<cmd>Telescope live_grep<cr>", { desc = "Grep files", silent = true })
        km("n", "<leader>fb", "<cmd>Telescope buffers<cr>", { desc = "Find buffers", silent = true })
        km("n", "<leader>fh", "<cmd>Telescope help_tags<cr>", { desc = "Find help tags", silent = true })

        -- Copilot Chat
        km("n", "<leader>cci",
                "<cmd>:lua function() local input = vim.fn.input('Ask Copilot: ') if input ~= '' then vim.cmd('CopilotChat ' .. input) end end<cr>",
                { desc = "CopilotChat - Inline prompt", silent = true })
        km("n", "<leader>cco", "<cmd>CopilotChatToggle<cr>", { desc = "CopilotChat - Toggle", silent = true })
        km("n", "<leader>ccc", "<cmd>CopilotChatReset<cr>", { desc = "CopilotChat - Clear chat", silent = true })
        km("n", "<leader>cce", "<cmd>CopilotChatExplain<cr>", { desc = "CopilotChat - Explain code", silent = true })
        km("n", "<leader>cct", "<cmd>CopilotChatTests<cr>", { desc = "CopilotChat - Generate tests", silent = true })
        km("n", "<leader>ccr", "<cmd>CopilotChatReview<cr>", { desc = "CopilotChat - Review code", silent = true })
        km("n", "<leader>ccR", "<cmd>CopilotChatRefactor<cr>", { desc = "CopilotChat - Refactor code", silent = true })
        km("n", "<leader>ccn", "<cmd>CopilotChatBetterNamings<cr>",
                { desc = "CopilotChat - Better Naming", silent = true })
        km("n", "<leader>ccff", "<cmd>CopilotChatFix<cr>", { desc = "CopilotChat - Fix", silent = true })
        km("n", "<leader>ccfc", "<cmd>CopilotChatFixCode<cr>", { desc = "CopilotChat - Fix code", silent = true })
        km("n", "<leader>ccfe", "<cmd>CopilotChatFixErrors<cr>", { desc = "CopilotChat - Fix errors", silent = true })
        km("n", "<leader>ccfd", "<cmd>CopilotChatFixDiff<cr>", { desc = "CopilotChat - Fix diagnostics", silent = true })
end

return keys
