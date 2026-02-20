-- ESLint priority formatting + oxlint support
return {
  -- Configure conform for non-eslint files only
  {
    "stevearc/conform.nvim",
    opts = function(_, opts)
      opts.formatters_by_ft = opts.formatters_by_ft or {}

      -- For JS/TS/Vue: disable conform, use EslintFixAll instead (see below)
      local eslint_fts = {
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact",
        "vue",
        "astro",
      }

      for _, ft in ipairs(eslint_fts) do
        -- Disable conform for these - eslint handles formatting via LspAttach autocmd
        opts.formatters_by_ft[ft] = {}
      end

      -- Keep prettier for non-JS files
      local prettier_fts = {
        "css",
        "scss",
        "html",
        "json",
        "jsonc",
        "yaml",
        "markdown",
        "graphql",
      }

      for _, ft in ipairs(prettier_fts) do
        opts.formatters_by_ft[ft] = opts.formatters_by_ft[ft] or { "prettier" }
      end

      return opts
    end,
  },

  -- Add oxlint to nvim-lint
  {
    "mfussenegger/nvim-lint",
    opts = function(_, opts)
      opts.linters_by_ft = opts.linters_by_ft or {}

      local oxlint_fts = {
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact",
        "vue",
      }

      for _, ft in ipairs(oxlint_fts) do
        opts.linters_by_ft[ft] = opts.linters_by_ft[ft] or {}
        if not vim.tbl_contains(opts.linters_by_ft[ft], "oxlint") then
          table.insert(opts.linters_by_ft[ft], 1, "oxlint")
        end
      end

      opts.linters = opts.linters or {}
      opts.linters.oxlint = {
        condition = function(ctx)
          return vim.fs.find({
            ".oxlintrc.json",
            "oxlintrc.json",
          }, { path = ctx.filename, upward = true })[1] ~= nil
        end,
      }

      return opts
    end,
  },

  -- Ensure oxlint is installed via mason
  {
    "mason-org/mason.nvim",
    opts = {
      ensure_installed = {
        "oxlint",
      },
    },
  },

  -- Configure eslint-lsp with flat config support + EslintFixAll on save
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        eslint = {
          settings = {
            format = true,
            workingDirectories = { mode = "auto" },
            -- Enable flat config support (eslint.config.mjs)
            experimental = {
              useFlatConfig = true,
            },
          },
        },
      },
    },
  },

  -- EslintFixAll on save via LspAttach
  {
    "neovim/nvim-lspconfig",
    opts = function()
      -- Setup eslint fix on save when eslint attaches
      vim.api.nvim_create_autocmd("LspAttach", {
        group = vim.api.nvim_create_augroup("EslintFixSetup", { clear = true }),
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          if client and client.name == "eslint" then
            -- Create EslintFixAll command
            vim.api.nvim_buf_create_user_command(args.buf, "EslintFixAll", function()
              vim.lsp.buf.code_action({
                context = {
                  only = { "source.fixAll.eslint" },
                  diagnostics = {},
                },
                apply = true,
              })
            end, { desc = "Fix all eslint issues" })

            -- Auto fix on save for this buffer
            vim.api.nvim_create_autocmd("BufWritePre", {
              buffer = args.buf,
              callback = function()
                vim.lsp.buf.code_action({
                  context = {
                    only = { "source.fixAll.eslint" },
                    diagnostics = {},
                  },
                  apply = true,
                })
              end,
            })
          end
        end,
      })
    end,
  },
}
