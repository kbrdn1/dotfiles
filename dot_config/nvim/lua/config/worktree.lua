-- Git Worktree Manager for Neovim using Snacks.nvim
-- Based on gwq (https://github.com/d-kuro/gwq)
-- Follows CONTRIBUTING.md conventions: <type>/#<issue>-<description>

local M = {}

-- Default configuration
M.config = {
  -- Branch types for worktree creation
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
  copy_files = {},
  -- Commands to run after worktree creation (in worktree directory)
  setup_commands = {},
  -- Auto-switch to new worktree after creation
  auto_switch = true,
}

-- Setup function to merge user config
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})
end

-- Check if branch is a main branch
local function is_main_branch(branch)
  for _, main in ipairs(M.config.main_branches) do
    if branch == main then
      return true
    end
  end
  return false
end

-- Check if gwq is available
local function check_gwq()
  if vim.fn.executable("gwq") ~= 1 then
    Snacks.notify.error("gwq is not installed!\nInstall: brew install d-kuro/tap/gwq", { title = "Git Worktree" })
    return false
  end
  return true
end

-- Check if in a git repository
local function check_git_repo()
  local result = vim.fn.system("git rev-parse --git-dir 2>/dev/null")
  if vim.v.shell_error ~= 0 then
    Snacks.notify.error("Not in a git repository", { title = "Git Worktree" })
    return false
  end
  return true
end

-- Execute shell command and return output (in current vim directory)
local function exec(cmd, cwd_override)
  local cwd = cwd_override or vim.fn.getcwd()
  local full_cmd = string.format("cd %s && %s", vim.fn.shellescape(cwd), cmd)
  local result = vim.fn.system(full_cmd)
  if vim.v.shell_error ~= 0 then
    return nil, "Command failed: " .. result
  end
  return result, nil
end

-- Get the main repository root (where .git folder is)
local function get_repo_root()
  local result = exec("git rev-parse --show-toplevel")
  if result then
    return result:gsub("%s+$", "")
  end
  return nil
end

-- Post-creation setup: copy files and run commands
local function post_create_setup(worktree_path, branch_name)
  local repo_root = get_repo_root()
  if not repo_root then
    Snacks.notify.warn("Could not determine repo root", { title = "Git Worktree" })
    return
  end

  local messages = {}

  -- Copy files
  if M.config.copy_files and #M.config.copy_files > 0 then
    for _, file in ipairs(M.config.copy_files) do
      local src = repo_root .. "/" .. file
      local dst = worktree_path .. "/" .. file
      -- Check if source exists
      if vim.fn.filereadable(src) == 1 then
        local copy_cmd = string.format("cp %s %s", vim.fn.shellescape(src), vim.fn.shellescape(dst))
        local _, err = exec(copy_cmd, repo_root)
        if err then
          table.insert(messages, "⚠️ Failed to copy: " .. file)
        else
          table.insert(messages, "✓ Copied: " .. file)
        end
      else
        table.insert(messages, "⏭️ Skipped (not found): " .. file)
      end
    end
  end

  -- Run setup commands
  if M.config.setup_commands and #M.config.setup_commands > 0 then
    for _, cmd in ipairs(M.config.setup_commands) do
      table.insert(messages, "🔄 Running: " .. cmd)
      -- Run async to not block UI
      vim.fn.jobstart(cmd, {
        cwd = worktree_path,
        on_exit = function(_, exit_code)
          vim.schedule(function()
            if exit_code == 0 then
              Snacks.notify.info("✓ Completed: " .. cmd, { title = "Git Worktree Setup" })
            else
              Snacks.notify.warn("⚠️ Failed: " .. cmd, { title = "Git Worktree Setup" })
            end
          end)
        end,
      })
    end
  end

  -- Show summary
  if #messages > 0 then
    Snacks.notify.info(table.concat(messages, "\n"), { title = "Git Worktree Setup" })
  end
end

-- Parse git worktree list output into structured data
local function parse_worktrees()
  local output, err = exec("git worktree list")
  if err or not output then
    return {}
  end

  local worktrees = {}
  for line in output:gmatch("[^\r\n]+") do
    -- Parse lines like: /path/to/worktree  <hash> [branch-name]
    local path, branch = line:match("^(%S+)%s+%S+%s+%[([^%]]+)%]")
    if path and branch then
      -- Expand ~ to home directory for display
      local display_path = path:gsub("^" .. os.getenv("HOME"), "~")
      table.insert(worktrees, {
        path = path,
        branch = branch,
        is_main = is_main_branch(branch),
        display = string.format("%s  %s", branch, display_path),
      })
    end
  end

  return worktrees
end

-- List and switch worktrees
function M.list_worktrees()
  if not check_gwq() or not check_git_repo() then
    return
  end

  local worktrees = parse_worktrees()

  if #worktrees == 0 then
    Snacks.notify.warn("No worktrees found", { title = "Git Worktree" })
    return
  end

  -- Build picker items
  local items = {}
  for i, wt in ipairs(worktrees) do
    local icon = wt.is_main and "󰊢" or "󰘬"
    table.insert(items, {
      text = string.format("%s %s", icon, wt.branch),
      idx = i,
      worktree = wt,
      file = wt.path,
    })
  end

  Snacks.picker({
    title = "Git Worktrees",
    items = items,
    format = function(item)
      local wt = item.worktree
      local icon = wt.is_main and { "󰊢 ", "SnacksPickerIconDirectory" } or { "󰘬 ", "SnacksPickerIconBranch" }
      return {
        icon,
        { wt.branch, wt.is_main and "SnacksPickerLabel" or "SnacksPickerFile" },
        { "  " },
        { wt.path, "SnacksPickerComment" },
      }
    end,
    confirm = function(picker, item)
      picker:close()
      if item and item.worktree then
        local wt = item.worktree
        -- Change directory to worktree
        vim.cmd("cd " .. vim.fn.fnameescape(wt.path))
        -- Refresh file tree
        vim.cmd("e .")
        Snacks.notify.info("Switched to: " .. wt.branch, { title = "Git Worktree" })
      end
    end,
    actions = {
      delete = function(picker, item)
        if item and item.worktree then
          local wt = item.worktree
          if wt.is_main then
            Snacks.notify.error("Cannot delete main/dev/master worktree", { title = "Git Worktree" })
            return
          end

          -- Confirm deletion
          vim.ui.select({ "Yes", "Yes (delete branch too)", "No" }, {
            prompt = "Delete worktree: " .. wt.branch .. "?",
          }, function(choice)
            if choice == "Yes" then
              local _, err = exec("gwq remove " .. vim.fn.shellescape(wt.branch))
              if err then
                Snacks.notify.error("Failed to remove worktree", { title = "Git Worktree" })
              else
                Snacks.notify.info("Removed worktree: " .. wt.branch, { title = "Git Worktree" })
                picker:close()
                M.list_worktrees() -- Refresh
              end
            elseif choice == "Yes (delete branch too)" then
              local _, err = exec("gwq remove -b " .. vim.fn.shellescape(wt.branch))
              if err then
                Snacks.notify.error("Failed to remove worktree and branch", { title = "Git Worktree" })
              else
                Snacks.notify.warn("Removed worktree and branch: " .. wt.branch, { title = "Git Worktree" })
                picker:close()
                M.list_worktrees() -- Refresh
              end
            end
          end)
        end
      end,
    },
    win = {
      input = {
        keys = {
          ["<C-d>"] = { "delete", mode = { "n", "i" }, desc = "Delete worktree" },
        },
      },
    },
  })
end

-- Create new worktree with guided flow
function M.create_worktree()
  if not check_gwq() or not check_git_repo() then
    return
  end

  -- Step 1: Select branch type
  local type_items = {}
  for i, bt in ipairs(M.config.branch_types) do
    table.insert(type_items, {
      text = string.format("%s %s - %s", bt.icon, bt.type, bt.desc),
      idx = i,
      branch_type = bt,
    })
  end

  Snacks.picker({
    title = "Select Branch Type",
    items = type_items,
    format = function(item)
      local bt = item.branch_type
      return {
        { bt.icon .. " ", "SnacksPickerIcon" },
        { bt.type, "SnacksPickerLabel" },
        { " - " },
        { bt.desc, "SnacksPickerComment" },
      }
    end,
    confirm = function(picker, item)
      picker:close()
      if item and item.branch_type then
        local selected_type = item.branch_type.type

        -- Step 2: Get issue number
        vim.ui.input({ prompt = "GitHub Issue Number: " }, function(issue_number)
          if not issue_number or issue_number == "" then
            Snacks.notify.warn("Cancelled: No issue number provided", { title = "Git Worktree" })
            return
          end

          -- Validate issue number
          if not issue_number:match("^%d+$") then
            Snacks.notify.error("Invalid issue number", { title = "Git Worktree" })
            return
          end

          -- Step 3: Get description
          vim.ui.input({ prompt = "Short Description (kebab-case): " }, function(description)
            if not description or description == "" then
              Snacks.notify.warn("Cancelled: No description provided", { title = "Git Worktree" })
              return
            end

            -- Convert to kebab-case
            description = description:lower():gsub("%s+", "-"):gsub("[^a-z0-9-]", "")

            -- Build branch name
            local branch_name = string.format(M.config.branch_pattern, selected_type, issue_number, description)

            -- Confirm creation
            vim.ui.select({ "Yes", "No" }, {
              prompt = "Create worktree: " .. branch_name .. "?",
            }, function(choice)
              if choice == "Yes" then
                Snacks.notify.info("Creating worktree...", { title = "Git Worktree" })

                -- Create worktree with gwq
                vim.fn.jobstart({ "gwq", "add", "-b", branch_name }, {
                  on_exit = function(_, exit_code)
                    vim.schedule(function()
                      if exit_code == 0 then
                        Snacks.notify.info("Created worktree: " .. branch_name, { title = "Git Worktree" })

                        -- Get worktree path for post-setup
                        local path_output = exec("gwq get " .. vim.fn.shellescape(selected_type))
                        local worktree_path = path_output and path_output:gsub("%s+$", "") or nil

                        -- Run post-creation setup (copy files, run commands)
                        if worktree_path then
                          post_create_setup(worktree_path, branch_name)
                        end

                        -- Handle auto-switch or ask user
                        if M.config.auto_switch then
                          if worktree_path then
                            vim.cmd("cd " .. vim.fn.fnameescape(worktree_path))
                            vim.cmd("e .")
                            Snacks.notify.info("Switched to: " .. branch_name, { title = "Git Worktree" })
                          end
                        else
                          vim.ui.select({ "Yes", "No" }, {
                            prompt = "Switch to new worktree?",
                          }, function(switch_choice)
                            if switch_choice == "Yes" and worktree_path then
                              vim.cmd("cd " .. vim.fn.fnameescape(worktree_path))
                              vim.cmd("e .")
                              Snacks.notify.info("Switched to: " .. branch_name, { title = "Git Worktree" })
                            end
                          end)
                        end
                      else
                        Snacks.notify.error("Failed to create worktree", { title = "Git Worktree" })
                      end
                    end)
                  end,
                })
              end
            end)
          end)
        end)
      end
    end,
  })
end

-- Delete worktree with picker
function M.delete_worktree()
  if not check_gwq() or not check_git_repo() then
    return
  end

  local worktrees = parse_worktrees()

  -- Filter out main branches
  local deletable = {}
  for _, wt in ipairs(worktrees) do
    if not wt.is_main then
      table.insert(deletable, wt)
    end
  end

  if #deletable == 0 then
    Snacks.notify.warn("No deletable worktrees found", { title = "Git Worktree" })
    return
  end

  -- Build picker items
  local items = {}
  for i, wt in ipairs(deletable) do
    table.insert(items, {
      text = wt.branch,
      idx = i,
      worktree = wt,
    })
  end

  Snacks.picker({
    title = "Delete Worktree",
    items = items,
    format = function(item)
      local wt = item.worktree
      return {
        { "󰘬 ", "SnacksPickerIconBranch" },
        { wt.branch, "SnacksPickerFile" },
        { "  " },
        { wt.path, "SnacksPickerComment" },
      }
    end,
    confirm = function(picker, item)
      picker:close()
      if item and item.worktree then
        local wt = item.worktree

        vim.ui.select({ "Remove worktree only", "Remove worktree AND branch", "Cancel" }, {
          prompt = "Delete: " .. wt.branch,
        }, function(choice)
          if choice == "Remove worktree only" then
            local _, err = exec("gwq remove " .. vim.fn.shellescape(wt.branch))
            if err then
              Snacks.notify.error("Failed to remove worktree", { title = "Git Worktree" })
            else
              Snacks.notify.info("Removed worktree: " .. wt.branch, { title = "Git Worktree" })
            end
          elseif choice == "Remove worktree AND branch" then
            local _, err = exec("gwq remove -b " .. vim.fn.shellescape(wt.branch))
            if err then
              Snacks.notify.error("Failed to remove worktree and branch", { title = "Git Worktree" })
            else
              Snacks.notify.warn("Removed worktree and branch: " .. wt.branch, { title = "Git Worktree" })
            end
          end
        end)
      end
    end,
  })
end

-- Prune stale worktree references
function M.prune()
  if not check_gwq() or not check_git_repo() then
    return
  end

  local output, err = exec("gwq prune")
  if err then
    Snacks.notify.error("Failed to prune worktrees", { title = "Git Worktree" })
  else
    Snacks.notify.info("Pruned stale worktree references\n" .. (output or ""), { title = "Git Worktree" })
  end
end

return M
