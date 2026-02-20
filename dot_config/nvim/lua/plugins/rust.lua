return {
  {
    "mrcjkb/rustaceanvim",
    opts = {
      server = {
        cmd = { "rust-analyzer" },
        settings = {
          ["rust-analyzer"] = {
            cargo = { allFeatures = true },
            checkOnSave = { command = "clippy" },
          },
        },
      },
    },
  },
  {
    "mason-org/mason.nvim",
    opts = function(_, opts)
      opts.ensure_installed = opts.ensure_installed or {}
      -- Remove rust-analyzer from Mason (use system one from Nix)
      opts.ensure_installed = vim.tbl_filter(function(tool)
        return tool ~= "rust-analyzer"
      end, opts.ensure_installed)
    end,
  },
}
