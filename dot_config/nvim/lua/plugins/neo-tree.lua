return {
        "nvim-neo-tree/neo-tree.nvim",
        branch = "v3.x",
        lazy = false,
        dependencies = {
                "nvim-lua/plenary.nvim",
                "nvim-tree/nvim-web-devicons", -- not strictly required, but recommended
                "MunifTanjim/nui.nvim",
                -- "3rd/image.nvim", -- Optional image support in preview window: See `# Preview Mode` for more information
        },
        keys = {
                { "<leader>e", "<cmd>Neotree toggle reveal position=left<cr>", desc = "Toggle Neotree" }
        },
        opts = {
                filesystem = {
                        enabled = true,
                        leave_dirs_open = false
                }
        }
}
