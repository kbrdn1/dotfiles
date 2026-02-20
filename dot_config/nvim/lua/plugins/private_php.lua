return {
  -- Disable phpactor, use intelephense instead
  {
    "nvim-treesitter/nvim-treesitter",
    opts = { ensure_installed = { "php" } },
  },
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        phpactor = { enabled = false },
        intelephense = {
          init_options = {
            licenceKey = vim.fn.expand("~/intelephense/licence.txt"),
          },
          settings = {
            intelephense = {
              files = {
                maxSize = 5000000,
              },
              format = {
                enable = false, -- Use php-cs-fixer instead
              },
            },
          },
        },
      },
    },
  },
  {
    "mason-org/mason.nvim",
    opts = {
      ensure_installed = { "intelephense" },
    },
  },
  -- Disable phpcs linter (project uses 2 spaces, not PSR-12's 4 spaces)
  {
    "mfussenegger/nvim-lint",
    optional = true,
    opts = {
      linters_by_ft = {
        php = {}, -- Disable phpcs
      },
    },
  },
  -- Formatting: php-cs-fixer for PHP only (JS/TS/Vue handled in linting.lua)
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        php = { "php_cs_fixer" },
      },
    },
  },
}
