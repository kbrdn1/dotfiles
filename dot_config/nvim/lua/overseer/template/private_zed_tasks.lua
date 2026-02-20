-- Zed Tasks Template for Overseer
-- Reads .zed/tasks.json and converts to Overseer tasks

return {
  name = "zed_tasks",
  generator = function(opts, cb)
    local tasks_file = vim.fn.getcwd() .. "/.zed/tasks.json"

    -- Check if file exists
    if vim.fn.filereadable(tasks_file) == 0 then
      return cb({})
    end

    -- Read and parse JSON
    local content = vim.fn.readfile(tasks_file)
    local ok, zed_tasks = pcall(vim.json.decode, table.concat(content, "\n"))

    if not ok or not zed_tasks then
      vim.notify("Failed to parse .zed/tasks.json", vim.log.levels.WARN)
      return cb({})
    end

    local ret = {}

    for _, task in ipairs(zed_tasks) do
      -- Replace Zed variables with Neovim equivalents
      local cmd = task.command
        :gsub("%$ZED_WORKTREE_ROOT", vim.fn.getcwd())
        :gsub("%$ZED_FILE", vim.fn.expand("%:p"))
        :gsub("%$ZED_DIRNAME", vim.fn.expand("%:p:h"))
        :gsub("%$ZED_FILENAME", vim.fn.expand("%:t"))
        :gsub("%$ZED_STEM", vim.fn.expand("%:t:r"))
        :gsub("%$ZED_EXTENSION", vim.fn.expand("%:e"))

      -- Build component list (no custom strategy - use overseer default)
      local components = {
        { "on_output_summarize", max_lines = 10 },
        { "on_exit_set_status" },
        { "on_complete_notify" },
      }
      if task.hide == "on_success" then
        table.insert(components, { "on_complete_dispose", timeout = 5 })
      end

      -- Priority: RECOMMENDED tasks first
      local priority = 50
      if task.label:match("RECOMMENDED") then
        priority = 40
      elseif task.label:match("Stop") or task.label:match("Down") then
        priority = 60
      end

      -- Extract category from label (e.g., "FP: Dev Local" -> "FP")
      local category = task.label:match("^([^:]+):") or "Tasks"

      table.insert(ret, {
        name = task.label,
        builder = function()
          return {
            cmd = { "bash", "-c", cmd },
            cwd = vim.fn.getcwd(),
            components = components,
            metadata = {
              zed_task = true,
              allow_concurrent = task.allow_concurrent_runs or false,
            },
          }
        end,
        desc = string.format("[%s] %s", category:gsub("^%s*(.-)%s*$", "%1"), cmd:sub(1, 60)),
        tags = { "zed", category:gsub("^%s*(.-)%s*$", "%1"):lower() },
        priority = priority,
      })
    end

    cb(ret)
  end,

  -- Cache for 5 seconds to avoid re-reading on every keystroke
  cache_key = function(opts)
    return vim.fn.getcwd() .. "/.zed/tasks.json"
  end,
}
