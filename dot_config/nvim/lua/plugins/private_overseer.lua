return {
  "stevearc/overseer.nvim",
  dependencies = {
    "akinsho/toggleterm.nvim",
    "nvim-telescope/telescope.nvim",
  },
  cmd = {
    "OverseerOpen",
    "OverseerClose",
    "OverseerToggle",
    "OverseerRun",
    "OverseerShell",
    "OverseerTaskAction",
  },
  opts = {
    templates = { "builtin", "zed_tasks" },
    task_list = {
      direction = "bottom",
      min_height = 15,
      default_detail = 1,
      bindings = {
        ["?"] = "ShowHelp",
        ["g?"] = "ShowHelp",
        ["<CR>"] = "RunAction",
        ["<C-e>"] = "Edit",
        ["o"] = "Open",
        ["<C-v>"] = "OpenVsplit",
        ["<C-s>"] = "OpenSplit",
        ["<C-f>"] = "OpenFloat",
        ["<C-q>"] = "OpenQuickFix",
        ["p"] = "TogglePreview",
        ["<C-l>"] = "IncreaseDetail",
        ["<C-h>"] = "DecreaseDetail",
        ["L"] = "IncreaseAllDetail",
        ["H"] = "DecreaseAllDetail",
        ["["] = "DecreaseWidth",
        ["]"] = "IncreaseWidth",
        ["{"] = "PrevTask",
        ["}"] = "NextTask",
        ["<C-k>"] = "ScrollOutputUp",
        ["<C-j>"] = "ScrollOutputDown",
        ["q"] = "Close",
      },
    },
  },
  keys = {
    { "<leader>oo", "<cmd>OverseerToggle<cr>", desc = "Toggle Task List" },
    { "<leader>or", "<cmd>OverseerRun<cr>", desc = "Run Task" },
    { "<leader>oa", "<cmd>OverseerTaskAction<cr>", desc = "Task Action" },
    { "<leader>os", "<cmd>OverseerShell<cr>", desc = "Shell Command" },
  },
  config = function(_, opts)
    require("overseer").setup(opts)
    require("telescope").load_extension("overseer")
  end,
}
