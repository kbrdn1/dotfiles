return {
  "jim-at-jibba/nvim-redraft",
  dependencies = {
    { "folke/snacks.nvim", opts = { input = {} } },
  },
  event = "VeryLazy",
  build = "cd ts && npm install && npm run build",
  keys = {
    { "<leader>ai", function() require("nvim-redraft").edit() end, mode = "v", desc = "AI Edit" },
    { "<leader>am", function() require("nvim-redraft").select_model() end, desc = "AI Model Select" },
  },
  opts = {
    llm = {
      models = {
        -- Anthropic (via Copilot)
        { provider = "copilot", model = "claude-haiku-4.5", label = "Claude Haiku 4.5" },
        { provider = "copilot", model = "claude-sonnet-4", label = "Claude Sonnet 4" },
        { provider = "copilot", model = "claude-sonnet-4.5", label = "Claude Sonnet 4.5" },
        { provider = "copilot", model = "claude-opus-4.5", label = "Claude Opus 4.5" },
        -- Google (via Copilot)
        { provider = "copilot", model = "gemini-2.5-pro", label = "Gemini 2.5 Pro" },
        { provider = "copilot", model = "gemini-3-pro", label = "Gemini 3 Pro" },
        { provider = "copilot", model = "gemini-3-flash", label = "Gemini 3 Flash" },
        -- OpenAI (via Copilot)
        { provider = "copilot", model = "gpt-5", label = "GPT-5" },
        { provider = "copilot", model = "gpt-5-codex", label = "GPT-5 Codex" },
        { provider = "copilot", model = "gpt-5.1", label = "GPT-5.1" },
        { provider = "copilot", model = "gpt-5.1-codex", label = "GPT-5.1 Codex" },
        { provider = "copilot", model = "gpt-5.1-codex-mini", label = "GPT-5.1 Codex Mini" },
        { provider = "copilot", model = "gpt-5.1-codex-max", label = "GPT-5.1 Codex Max" },
        { provider = "copilot", model = "gpt-5.2", label = "GPT-5.2" },
        -- xAI (via Copilot)
        { provider = "copilot", model = "grok-code-fast-1", label = "Grok Code Fast 1" },
        -- Other (via Copilot)
        { provider = "copilot", model = "raptor-mini", label = "Raptor Mini" },
      },
      default_model_index = 1,
    },
  },
}
