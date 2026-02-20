-- Git Worktree Manager using Snacks.nvim
-- Replaces telescope-git-worktree with native Snacks picker
-- Follows CONTRIBUTING.md conventions: <type>/#<issue>-<description>

-- Setup worktree config on load
local worktree_config = {
  -- Branch types for worktree creation
  -- Format: { type = "name", desc = "description", icon = "emoji" }
  branch_types = {
    { type = "feat", desc = "New feature implementation", icon = "✨" },
    { type = "fix", desc = "Bug fix", icon = "🐛" },
    { type = "hotfix", desc = "Critical production bug fix", icon = "🚑" },
    { type = "docs", desc = "Documentation changes", icon = "📝" },
    { type = "test", desc = "Test additions or modifications", icon = "✅" },
    { type = "refactor", desc = "Code restructuring", icon = "♻️" },
    { type = "chore", desc = "Maintenance tasks", icon = "🔧" },
    { type = "perf", desc = "Performance improvements", icon = "⚡" },
    { type = "ci", desc = "CI/CD configuration", icon = "👷" },
    { type = "build", desc = "Build system changes", icon = "🏗️" },
  },
  -- Main branches that cannot be deleted
  main_branches = { "main", "dev", "master", "develop" },
  -- Branch name pattern: type/#issue-description
  branch_pattern = "%s/#%s-%s",
  -- Files to copy from main repo to new worktree
  copy_files = { ".env", ".env.local" },
  -- Commands to run after worktree creation (in worktree directory)
  setup_commands = {
    -- "composer install",
    -- "bun install",
    -- "direnv allow",
  },
  -- Auto-switch to new worktree after creation
  auto_switch = true,
}

return {
  "folke/snacks.nvim",
  keys = {
    {
      "<leader>gw",
      function()
        require("config.worktree").setup(worktree_config)
        require("config.worktree").list_worktrees()
      end,
      desc = "List Git Worktrees",
    },
    {
      "<leader>gW",
      function()
        require("config.worktree").setup(worktree_config)
        require("config.worktree").create_worktree()
      end,
      desc = "Create Git Worktree",
    },
    {
      "<leader>gD",
      function()
        require("config.worktree").setup(worktree_config)
        require("config.worktree").delete_worktree()
      end,
      desc = "Delete Git Worktree",
    },
  },
}
