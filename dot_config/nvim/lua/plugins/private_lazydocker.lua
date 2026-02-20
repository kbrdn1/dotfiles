-- Lazy* tools integration (similar to LazyGit)
return {
  "folke/snacks.nvim",
  keys = {
    {
      "<leader>td",
      function()
        Snacks.terminal("lazydocker", { cwd = LazyVim.root() })
      end,
      desc = "LazyDocker",
    },
    {
      "<leader>ts",
      function()
        Snacks.terminal("lazysql", { cwd = LazyVim.root() })
      end,
      desc = "LazySQL",
    },
    {
      "<leader>tlc",
      function()
        Snacks.terminal(vim.fn.expand("~/go/bin/lazycurl"), { cwd = LazyVim.root() })
      end,
      desc = "LazyCurl",
    },
    {
      "<leader>tgd",
      function()
        Snacks.terminal("lumen diff", { cwd = LazyVim.root() })
      end,
      desc = "Lumen Diff",
    },
    {
      "<leader>tS",
      function()
        Snacks.terminal("lazyssh", { cwd = LazyVim.root() })
      end,
      desc = "LazySSH",
    },
    {
      "<leader>tm",
      function()
        Snacks.terminal("ekphos", { cwd = LazyVim.root() })
      end,
      desc = "Ekphos",
    },
    {
      "<leader>ta",
      function()
        Snacks.terminal("awsui", { cwd = LazyVim.root() })
      end,
      desc = "AWS UI",
    },
    {
      "<leader>tP",
      function()
        Snacks.picker.files({
          title = "Select PDF",
          cwd = LazyVim.root(),
          args = { "--extension", "pdf" },
          confirm = function(picker, item)
            picker:close()
            if item then
              local cwd = LazyVim.root()
              local path = cwd .. "/" .. item.file
              vim.fn.jobstart({ "open", path }, { detach = true })
            end
          end,
        })
      end,
      desc = "Open PDF",
    },
    {
      "<leader>tG",
      function()
        Snacks.terminal("gpg-tui", { cwd = LazyVim.root() })
      end,
      desc = "GPG TUI",
    },
  },
}
