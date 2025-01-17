local prompts = {
  -- Code related prompts
  Explain = "Veuillez expliquer le fonctionnement du code suivant.",
  Review = "Veuillez examiner le code suivant et fournir des suggestions d'amélioration.",
  Tests = "Veuillez expliquer le fonctionnement du code sélectionné, puis générer des tests unitaires pour celui-ci.",
  Refactor = "Veuillez refactoriser le code suivant pour améliorer sa clarté et sa lisibilité.",
  FixCode = "Veuillez corriger le code suivant pour le faire fonctionner comme prévu.",
  FixError = "Veuillez expliquer l'erreur dans le texte suivant et fournir une solution.",
  BetterNamings = "Veuillez fournir de meilleurs noms pour les variables et fonctions suivantes.",
  Documentation = "Veuillez fournir une documentation pour le code suivant.",
  SwaggerApiDocs = "Veuillez fournir une documentation pour l'API suivante en utilisant Swagger.",
  SwaggerJsDocs = "Veuillez rédiger une documentation JSDoc pour l'API suivante en utilisant Swagger.",
  -- Text related prompts
  Summarize = "Veuillez résumer le texte suivant.",
  Spelling = "Veuillez corriger les erreurs de grammaire et d'orthographe dans le texte suivant.",
  Wording = "Veuillez améliorer la grammaire et la formulation du texte suivant.",
  Concise = "Veuillez reformuler le texte suivant pour le rendre plus concis.",
}

return {
  "CopilotC-Nvim/CopilotChat.nvim",
  version = "v2.4.2",
  dependencies = {
    { "nvim-telescope/telescope.nvim" }, -- Use telescope for help actions
    { "nvim-lua/plenary.nvim" },
  },
  opts = {
    language = "French", -- Language to use for Copilot
    title = "Copilot Chat",
    question_header = "## User ",
    answer_header = "## Copilot ",
    error_header = "## Error ",
    separator = " ",            -- Separator to use in chat
    prompts = prompts,
    auto_follow_cursor = false, -- Don't follow the cursor after getting response
    show_help = false,          -- Show help in virtual text, set to true if that's 1st time using Copilot Chat
    mappings = {
      -- Use tab for completion
      complete = {
        detail = "Use @<Tab> or /<Tab> for options.",
        insert = "<Tab>",
      },
      -- Close the chat
      close = {
        normal = "q",
        insert = "<C-c>",
      },
      -- Reset the chat buffer
      reset = {
        normal = "<C-o>",
        insert = "<C-o>",
      },
      -- Submit the prompt to Copilot
      submit_prompt = {
        normal = "<CR>",
        insert = "<C-CR>",
      },
      -- Accept the diff
      accept_diff = {
        normal = "<C-y>",
        insert = "<C-y>",
      },
      -- Yank the diff in the response to register
      yank_diff = {
        normal = "gmy",
      },
      -- Show the diff
      show_diff = {
        normal = "gmd",
      },
      -- Show the prompt
      show_system_prompt = {
        normal = "gmp",
      },
      -- Show the user selection
      show_user_selection = {
        normal = "gms",
      },
    },
    config = function(_, opts)
      local chat = require("CopilotChat")
      local select = require("CopilotChat.select")
      -- Use unnamed register for the selection
      opts.selection = select.unnamed

      -- Override the git prompts message
      opts.prompts.Commit = {
        prompt = "Write commit message for the change with commitizen convention",
        selection = select.gitdiff,
      }
      opts.prompts.CommitStaged = {
        prompt = "Write commit message for the change with commitizen convention",
        selection = function(source)
          return select.gitdiff(source, true)
        end,
      }

      chat.setup(opts)

      vim.api.nvim_create_user_command("CopilotChatVisual", function(args)
        chat.ask(args.args, { selection = select.visual })
      end, { nargs = "*", range = true })

      -- Inline chat with Copilot
      vim.api.nvim_create_user_command("CopilotChatInline", function(args)
        chat.ask(args.args, {
          selection = select.visual,
          window = {
            layout = "float",
            relative = "cursor",
            width = 1,
            height = 0.4,
            row = 1,
          },
        })
      end, { nargs = "*", range = true })

      -- Restore CopilotChatBuffer
      vim.api.nvim_create_user_command("CopilotChatBuffer", function(args)
        chat.ask(args.args, { selection = select.buffer })
      end, { nargs = "*", range = true })

      -- Custom buffer for CopilotChat
      vim.api.nvim_create_autocmd("BufEnter", {
        pattern = "copilot-*",
        callback = function()
          vim.opt_local.relativenumber = true
          vim.opt_local.number = true

          -- Get current filetype and set it to markdown if the current filetype is copilot-chat
          local ft = vim.bo.filetype
          if ft == "copilot-chat" then
            vim.bo.filetype = "markdown"
          end
        end,
      })

      -- Add which-key mappings
      local wk = require("which-key")
      wk.register({
        g = {
          m = {
            name = "+Copilot Chat",
            d = "Show diff",
            p = "System prompt",
            s = "Show selection",
            y = "Yank diff",
          },
        },
      })
    end,
    event = "VeryLazy",
    keys = {
      -- Show help actions with telescope
      {
        "<leader>cch",
        function()
          local actions = require("CopilotChat.actions")
          require("CopilotChat.integrations.telescope").pick(actions.help_actions())
        end,
        desc = "CopilotChat - Help actions",
      },
      -- Show prompts actions with telescope
      {
        "<leader>ccp",
        function()
          local actions = require("CopilotChat.actions")
          require("CopilotChat.integrations.telescope").pick(actions.prompt_actions())
        end,
        desc = "CopilotChat - Prompt actions",
      },
      {
        "<leader>ccp",
        ":lua require('CopilotChat.integrations.telescope').pick(require('CopilotChat.actions').prompt_actions({selection = require('CopilotChat.select').visual}))<CR>",
        mode = "x",
        desc = "CopilotChat - Prompt actions",
      },
      -- Code related commands
      { "<leader>cce", "<cmd>CopilotChatExplain<cr>",       desc = "CopilotChat - Explain code" },
      { "<leader>cct", "<cmd>CopilotChatTests<cr>",         desc = "CopilotChat - Generate tests" },
      { "<leader>ccr", "<cmd>CopilotChatReview<cr>",        desc = "CopilotChat - Review code" },
      { "<leader>ccR", "<cmd>CopilotChatRefactor<cr>",      desc = "CopilotChat - Refactor code" },
      { "<leader>ccn", "<cmd>CopilotChatBetterNamings<cr>", desc = "CopilotChat - Better Naming" },
      -- Chat with Copilot in visual mode
      {
        "<leader>ccv",
        ":CopilotChatVisual",
        mode = "x",
        desc = "CopilotChat - Open in vertical split",
      },
      {
        "<leader>cci",
        ":CopilotChatInline<cr>",
        mode = "x",
        desc = "CopilotChat - Inline chat",
      },
      -- Custom input for CopilotChat
      {
        "<leader>cci",
        function()
          local input = vim.fn.input("Ask Copilot: ")
          if input ~= "" then
            vim.cmd("CopilotChat " .. input)
          end
        end,
        desc = "CopilotChat - Ask input",
      },
      -- Generate commit message based on the git diff
      {
        "<leader>ccm",
        "<cmd>CopilotChatCommit<cr>",
        desc = "CopilotChat - Generate commit message for all changes",
      },
      {
        "<leader>ccM",
        "<cmd>CopilotChatCommitStaged<cr>",
        desc = "CopilotChat - Generate commit message for staged changes",
      },
      -- Quick chat with Copilot
      {
        "<leader>ccq",
        function()
          local input = vim.fn.input("Quick Chat: ")
          if input ~= "" then
            vim.cmd("CopilotChatBuffer " .. input)
          end
        end,
        desc = "CopilotChat - Quick chat",
      },
      -- Debug
      { "<leader>ccd", "<cmd>CopilotChatDebugInfo<cr>",     desc = "CopilotChat - Debug Info" },
      -- Fix the issue with diagnostic
      { "<leader>ccf", "<cmd>CopilotChatFixDiagnostic<cr>", desc = "CopilotChat - Fix Diagnostic" },
      -- Clear buffer and chat history
      { "<leader>ccl", "<cmd>CopilotChatReset<cr>",         desc = "CopilotChat - Clear buffer and chat history" },
      -- Toggle Copilot Chat Vsplit
      { "<leader>cct", "<cmd>CopilotChatToggle<cr>",        desc = "CopilotChat - Toggle" },
    },
  },
}
