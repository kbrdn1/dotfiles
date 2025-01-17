return {
        "numToStr/FTerm.nvim",
        commit = "d1320892cc2ebab472935242d9d992a2c9570180",
        main = "FTerm",
        keys = {
                {"ù", '<cmd>lua require("FTerm").toggle()<cr>', desc = "Open terminal"},
                {"ù", '<C-\\><C-n><cmd>lua require("FTerm").toggle()<cr>', desc = "Close terminal", mode = "t"}
        }
}
