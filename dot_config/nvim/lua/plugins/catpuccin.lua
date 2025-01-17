return {
        "catppuccin/nvim",
        name = "catppuccin",
        priority = 1000,
        config = function()
                local catpuccin = require("catppuccin")
                catpuccin.setup({
                        flavour = 'macchiato',
                        transparent_background = 'false'
                })
                vim.cmd("colorscheme catppuccin")
        end
}
