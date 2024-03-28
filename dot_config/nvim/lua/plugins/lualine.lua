return {
        'nvim-lualine/lualine.nvim',
        commit = "b5e8bb642138f787a2c1c5aedc2a78cb2cebbd67",
        dependencies = {
                'nvim-tree/nvim-web-devicons'
        },
        config = function ()
                local lualine = require("lualine")
                lualine.setup({
                        options = {
                                icons_enabled = true,
                                theme = "catppuccin"
                        }
                })
        end
}
