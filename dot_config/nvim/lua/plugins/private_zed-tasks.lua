-- Zed Tasks picker using Snacks.nvim (same style as GitHub PRs)
-- Full Zed task spec: https://zed.dev/docs/tasks
return {
  "folke/snacks.nvim",
  keys = {
    {
      "<leader>to",
      function()
        -- Build context variables once
        local function build_context()
          local cursor = vim.api.nvim_win_get_cursor(0)
          local worktree = vim.fn.getcwd()
          local file = vim.fn.expand("%:p")

          -- Get selected text
          local selected_text = ""
          local mode = vim.fn.mode()
          if mode == "v" or mode == "V" or mode == "\22" then
            local start_pos = vim.fn.getpos("'<")
            local end_pos = vim.fn.getpos("'>")
            local lines = vim.fn.getline(start_pos[2], end_pos[2])
            if #lines > 0 then
              selected_text = table.concat(lines, "\n")
            end
          end

          -- Get symbol from treesitter
          local symbol = ""
          local ok_ts, ts_utils = pcall(require, "nvim-treesitter.ts_utils")
          if ok_ts then
            local node = ts_utils.get_node_at_cursor()
            if node then
              symbol = vim.treesitter.get_node_text(node, 0) or ""
            end
          end

          return {
            ZED_WORKTREE_ROOT = worktree,
            ZED_FILE = file,
            ZED_FILENAME = vim.fn.expand("%:t"),
            ZED_DIRNAME = vim.fn.expand("%:p:h"),
            ZED_STEM = vim.fn.expand("%:t:r"),
            ZED_EXTENSION = vim.fn.expand("%:e"),
            ZED_RELATIVE_FILE = file:gsub("^" .. vim.pesc(worktree) .. "/", ""),
            ZED_RELATIVE_DIR = vim.fn.expand("%:p:h"):gsub("^" .. vim.pesc(worktree) .. "/", ""),
            ZED_ROW = tostring(cursor[1]),
            ZED_COLUMN = tostring(cursor[2] + 1),
            ZED_SYMBOL = symbol,
            ZED_SELECTED_TEXT = selected_text,
            ZED_CUSTOM_RUST_PACKAGE = "",
          }
        end

        -- Substitute variables in string (supports ${VAR:default} syntax)
        local function substitute_vars(str, ctx)
          if not str then return str end
          -- Handle ${VAR:default} syntax first
          str = str:gsub("%${([^:}]+):([^}]*)}", function(var, default)
            return ctx[var] or default
          end)
          -- Handle $VAR syntax
          for var, value in pairs(ctx) do
            str = str:gsub("%$" .. var, value)
          end
          return str
        end

        -- Load tasks from file
        local function load_tasks(filepath, source)
          if vim.fn.filereadable(filepath) == 0 then
            return {}
          end
          local content = vim.fn.readfile(filepath)
          local ok, tasks = pcall(vim.json.decode, table.concat(content, "\n"))
          if not ok or not tasks then
            return {}
          end
          -- Tag each task with its source
          for _, task in ipairs(tasks) do
            task._source = source
          end
          return tasks
        end

        require("snacks.picker").pick({
          source = "zed_tasks",
          title = "  Zed Tasks",
          finder = function(opts, ctx_picker)
            local ctx = build_context()
            local items = {}

            -- Load tasks (worktree tasks override global)
            local global_tasks = load_tasks(vim.fn.expand("~/.config/zed/tasks.json"), "global")
            local local_tasks = load_tasks(vim.fn.getcwd() .. "/.zed/tasks.json", "local")

            -- Merge: local tasks take precedence
            local all_tasks = {}
            local seen = {}
            for _, task in ipairs(local_tasks) do
              table.insert(all_tasks, task)
              seen[task.label] = true
            end
            for _, task in ipairs(global_tasks) do
              if not seen[task.label] then
                table.insert(all_tasks, task)
              end
            end

            if #all_tasks == 0 then
              vim.notify("No tasks found in .zed/tasks.json or ~/.config/zed/tasks.json", vim.log.levels.WARN)
              return function() end
            end

            for idx, task in ipairs(all_tasks) do
              -- Build command with args
              local cmd = substitute_vars(task.command, ctx)
              if task.args and #task.args > 0 then
                local args = {}
                for _, arg in ipairs(task.args) do
                  table.insert(args, substitute_vars(arg, ctx))
                end
                cmd = cmd .. " " .. table.concat(args, " ")
              end

              -- Substitute env vars (toggleterm expects {"KEY=value", ...} format)
              local env = nil
              if task.env and next(task.env) then
                env = {}
                for k, v in pairs(task.env) do
                  table.insert(env, k .. "=" .. substitute_vars(v, ctx))
                end
              end

              -- Working directory
              local cwd = substitute_vars(task.cwd, ctx) or ctx.ZED_WORKTREE_ROOT

              local category = task.label:match("^([^:]+):") or "Task"
              local name = task.label:match("^[^:]+:%s*(.+)$") or task.label
              local recommended = task.label:match("RECOMMENDED") ~= nil

              table.insert(items, {
                idx = idx,
                text = task.label,
                label = task.label,
                name = name,
                category = category:gsub("^%s*(.-)%s*$", "%1"),
                command = cmd,
                cwd = cwd,
                env = env,
                recommended = recommended,
                raw = task,
                source = task._source,
                score = recommended and 1000 or (task._source == "local" and 500 or 0),
              })
            end

            return function(cb)
              for _, item in ipairs(items) do
                cb(item)
              end
            end
          end,
          format = function(item, ctx)
            local a = Snacks.picker.util.align
            local ret = {}

            -- State icon
            local icon, hl
            if item.recommended then
              icon = " "
              hl = "SnacksPickerGitStatusAdded"
            else
              icon = " "
              hl = "SnacksPickerGitStatusUntracked"
            end
            ret[#ret + 1] = { icon, hl }

            -- Source indicator (global vs local)
            if item.source == "global" then
              ret[#ret + 1] = { " ", "SnacksPickerComment" }
            else
              ret[#ret + 1] = { " " }
            end

            -- Category
            ret[#ret + 1] = { a(item.category, 8), "SnacksPickerLabel" }

            -- Task name
            ret[#ret + 1] = { " " }
            ret[#ret + 1] = { item.name, "SnacksPickerFile" }

            -- Tags indicator
            local raw = item.raw or {}
            if raw.tags and #raw.tags > 0 then
              ret[#ret + 1] = { "  " .. table.concat(raw.tags, ","), "SnacksPickerComment" }
            end

            -- Terminal indicator
            if raw.reveal_target == "center" then
              ret[#ret + 1] = { "  ", "SnacksPickerComment" }
            elseif raw.use_new_terminal then
              ret[#ret + 1] = { "  ", "SnacksPickerComment" }
            end

            return ret
          end,
          preview = function(ctx)
            local item = ctx.item
            if not item then return end
            local raw = item.raw or {}

            local lines = {
              "# " .. item.label,
              "",
              "**Source**: " .. (item.source == "global" and "~/.config/zed/tasks.json" or ".zed/tasks.json"),
              "",
              "## Command",
              "",
              "```bash",
              item.command,
              "```",
              "",
              "## Configuration",
              "",
              "| Option | Value |",
              "|--------|-------|",
              "| cwd | `" .. (item.cwd or "project root") .. "` |",
              "| use_new_terminal | " .. (raw.use_new_terminal and "" or "") .. " |",
              "| allow_concurrent_runs | " .. (raw.allow_concurrent_runs and "" or "") .. " |",
              "| reveal | " .. (raw.reveal or "always") .. " |",
              "| reveal_target | " .. (raw.reveal_target or "dock") .. " |",
              "| hide | " .. (raw.hide or "never") .. " |",
              "| show_summary | " .. (raw.show_summary ~= false and "" or "") .. " |",
              "| show_command | " .. (raw.show_command ~= false and "" or "") .. " |",
            }

            -- Shell config
            if raw.shell then
              local shell_str = type(raw.shell) == "string" and raw.shell or vim.inspect(raw.shell)
              table.insert(lines, "| shell | " .. shell_str .. " |")
            end

            -- Environment variables
            if item.env and next(item.env) then
              table.insert(lines, "")
              table.insert(lines, "## Environment")
              table.insert(lines, "")
              table.insert(lines, "```bash")
              for k, v in pairs(item.env) do
                table.insert(lines, k .. "=" .. v)
              end
              table.insert(lines, "```")
            end

            -- Tags
            if raw.tags and #raw.tags > 0 then
              table.insert(lines, "")
              table.insert(lines, "## Tags")
              table.insert(lines, "")
              table.insert(lines, "`" .. table.concat(raw.tags, "`, `") .. "`")
            end

            ctx.preview:set_lines(lines)
            ctx.preview:highlight({ ft = "markdown" })
          end,
          confirm = function(picker, item)
            picker:close()
            if not item then return end

            local Terminal = require("toggleterm.terminal").Terminal
            local raw = item.raw or {}

            -- Direction based on reveal_target
            local direction = "horizontal"
            if raw.reveal_target == "center" then
              direction = "float"
            end

            -- Close behavior
            local close_on_exit = raw.hide == "always"

            -- Focus behavior
            local should_focus = raw.reveal ~= "never" and raw.reveal ~= "no_focus"

            local term = Terminal:new({
              cmd = item.command,
              dir = item.cwd,
              direction = direction,
              close_on_exit = close_on_exit,
              env = item.env,
              on_open = function(t)
                vim.notify(" " .. item.name, vim.log.levels.INFO)
                if not should_focus then
                  vim.cmd("wincmd p")
                end
              end,
              on_exit = function(t, job, exit_code)
                if exit_code == 0 then
                  if raw.hide == "on_success" then
                    vim.defer_fn(function()
                      t:close()
                    end, 1000)
                  end
                  vim.notify(" " .. item.name, vim.log.levels.INFO)
                else
                  vim.notify(" " .. item.name .. " (exit: " .. exit_code .. ")", vim.log.levels.ERROR)
                end
              end,
            })

            term:toggle()
          end,
          sort = { fields = { "score:desc", "idx" } },
          win = {
            input = {
              keys = {
                ["<C-t>"] = {
                  function(picker)
                    local item = picker:current()
                    if item then
                      picker:close()
                      local Terminal = require("toggleterm.terminal").Terminal
                      Terminal:new({
                        cmd = item.command,
                        dir = item.cwd,
                        direction = "float",
                        env = item.env,
                      }):toggle()
                    end
                  end,
                  mode = { "n", "i" },
                  desc = "Run in float",
                },
                ["<C-s>"] = {
                  function(picker)
                    local item = picker:current()
                    if item then
                      picker:close()
                      local Terminal = require("toggleterm.terminal").Terminal
                      Terminal:new({
                        cmd = item.command,
                        dir = item.cwd,
                        direction = "horizontal",
                        env = item.env,
                      }):toggle()
                    end
                  end,
                  mode = { "n", "i" },
                  desc = "Run in split",
                },
                ["<C-v>"] = {
                  function(picker)
                    local item = picker:current()
                    if item then
                      picker:close()
                      local Terminal = require("toggleterm.terminal").Terminal
                      Terminal:new({
                        cmd = item.command,
                        dir = item.cwd,
                        direction = "vertical",
                        env = item.env,
                      }):toggle()
                    end
                  end,
                  mode = { "n", "i" },
                  desc = "Run in vsplit",
                },
                ["<C-y>"] = {
                  function(picker)
                    local item = picker:current()
                    if item then
                      vim.fn.setreg("+", item.command)
                      vim.notify("Copied!", vim.log.levels.INFO)
                    end
                  end,
                  mode = { "n", "i" },
                  desc = "Copy command",
                },
                ["<C-e>"] = {
                  function(picker)
                    picker:close()
                    local local_file = vim.fn.getcwd() .. "/.zed/tasks.json"
                    if vim.fn.filereadable(local_file) == 1 then
                      vim.cmd("edit " .. local_file)
                    else
                      vim.cmd("edit " .. vim.fn.expand("~/.config/zed/tasks.json"))
                    end
                  end,
                  mode = { "n", "i" },
                  desc = "Edit tasks.json",
                },
                ["<C-g>"] = {
                  function(picker)
                    picker:close()
                    vim.cmd("edit " .. vim.fn.expand("~/.config/zed/tasks.json"))
                  end,
                  mode = { "n", "i" },
                  desc = "Edit global tasks",
                },
              },
            },
          },
        })
      end,
      desc = "Open Tasks",
    },
    {
      "<leader>te",
      function()
        local local_file = vim.fn.getcwd() .. "/.zed/tasks.json"
        if vim.fn.filereadable(local_file) == 1 then
          vim.cmd("edit " .. local_file)
        else
          -- Create directory and file if not exists
          vim.fn.mkdir(vim.fn.getcwd() .. "/.zed", "p")
          vim.cmd("edit " .. local_file)
          vim.api.nvim_buf_set_lines(0, 0, -1, false, { "[", "  {", '    "label": "Task: Example"', '    "command": "echo Hello"', "  }", "]" })
        end
      end,
      desc = "Edit Local Tasks",
    },
    {
      "<leader>tg",
      function()
        local global_file = vim.fn.expand("~/.config/zed/tasks.json")
        if vim.fn.filereadable(global_file) == 0 then
          vim.fn.mkdir(vim.fn.expand("~/.config/zed"), "p")
        end
        vim.cmd("edit " .. global_file)
      end,
      desc = "Edit Global Tasks",
    },
  },
}
