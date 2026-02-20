-- ========================================================================
-- Optimized snacks.nvim dashboard
-- ALL data computed in ONE shell call (was: ~15+ separate io.popen)
-- file_exists: vim.fn.filereadable (was: io.open + close per file)
-- system_info: plist read + vim APIs (was: 2x io.popen sw_vers)
-- ========================================================================

-- System info (zero forks: read plist + vim APIs)
local function get_system_info()
  local os_display
  local f = io.open("/System/Library/CoreServices/SystemVersion.plist", "r")
  if f then
    local c = f:read("*a")
    f:close()
    local name = c:match("<key>ProductName</key>%s*<string>(.-)</string>")
    local ver = c:match("<key>ProductUserVisibleVersion</key>%s*<string>(.-)</string>")
    if name and ver then
      os_display = name .. " " .. ver
    end
  end
  if not os_display then
    os_display = vim.uv.os_uname().sysname
  end
  local terminal = os.getenv("TERM_PROGRAM") or "Terminal"
  local v = vim.version()
  return "󰀵 " .. os_display .. " -  " .. terminal .. " -  v" .. v.major .. "." .. v.minor .. "." .. v.patch
end

-- Format codexbar JSON into display string
local function format_codexbar(raw, icon)
  if not raw or raw == "" then
    return nil
  end
  local ok, data = pcall(vim.fn.json_decode, raw)
  if not ok or not data or not data[1] or not data[1].usage then
    return nil
  end
  local u = data[1].usage
  local plan = u.loginMethod or "?"
  local parts = { plan }
  if u.primary and type(u.primary) == "table" and u.primary.usedPercent then
    table.insert(parts, "󰔛 session " .. math.floor(u.primary.usedPercent + 0.5) .. "%")
  end
  if u.secondary and type(u.secondary) == "table" and u.secondary.usedPercent then
    table.insert(parts, "󰨳 weekly " .. math.floor(u.secondary.usedPercent + 0.5) .. "%")
  end
  return icon .. " " .. table.concat(parts, " ")
end

-- ALL dashboard data in ONE shell call (git + tech + codexbar + gh)
local function get_dashboard_data()
  local cwd = vim.fn.getcwd()

  local function has(rel)
    return vim.fn.filereadable(cwd .. "/" .. rel) == 1
  end

  local cmds = { "cd " .. vim.fn.shellescape(cwd) .. " 2>/dev/null" }

  -- Git (branch + change counts)
  table.insert(cmds, [[b=$(git branch --show-current 2>/dev/null)]])
  table.insert(cmds, [[[ -n "$b" ] && {]])
  table.insert(cmds, [[  printf 'branch=%s\n' "$b"]])
  table.insert(cmds, [[  st=$(git status --porcelain 2>/dev/null)]])
  table.insert(cmds, [[  if [ -n "$st" ]; then]])
  table.insert(cmds, [[    echo dirty=1]])
  table.insert(cmds, [[    s=$(echo "$st" | grep -c '^[MADRC]')]])
  table.insert(cmds, [[    m=$(echo "$st" | grep -c '^.[MD]')]])
  table.insert(cmds, [[    u=$(echo "$st" | grep -c '^??')]])
  table.insert(cmds, [[    [ "$s" -gt 0 ] 2>/dev/null && printf 'git_staged=%s\n' "$s"]])
  table.insert(cmds, [[    [ "$m" -gt 0 ] 2>/dev/null && printf 'git_modified=%s\n' "$m"]])
  table.insert(cmds, [[    [ "$u" -gt 0 ] 2>/dev/null && printf 'git_untracked=%s\n' "$u"]])
  table.insert(cmds, [[    r=$(echo "$st" | grep -c '^D.\|^.D')]])
  table.insert(cmds, [[    [ "$r" -gt 0 ] 2>/dev/null && printf 'git_deleted=%s\n' "$r"]])
  table.insert(cmds, [[  else]])
  table.insert(cmds, [[    echo dirty=0]])
  table.insert(cmds, [[  fi]])
  table.insert(cmds, [[}]])

  -- Languages
  if has("package.json") then
    table.insert(cmds, [[printf 'node=%s\n' "$(node --version 2>/dev/null)"]])
  end
  if has("Gemfile") then
    table.insert(cmds, [[printf 'ruby=%s\n' "$(ruby -v 2>/dev/null | awk '{print $2}')"]])
  end
  if has("pom.xml") then
    table.insert(cmds, [[printf 'java_pom=%s\n' "$(java -version 2>&1 | awk -F '\"' '/version/ {print $2}')"]])
  end
  if has("build.gradle") then
    table.insert(cmds, [[printf 'java_gradle=%s\n' "$(java -version 2>&1 | awk -F '\"' '/version/ {print $2}')"]])
  end
  if has("go.mod") then
    table.insert(cmds, [[printf 'go=%s\n' "$(go version 2>/dev/null | awk '{print $3}' | sed 's/go//')"]])
  end
  if has("Cargo.toml") then
    table.insert(cmds, [[printf 'rust=%s\n' "$(rustc --version 2>/dev/null | awk '{print $2}')"]])
  end
  if has("requirements.txt") or has("pyproject.toml") then
    table.insert(cmds, [[printf 'python=%s\n' "$(python3 --version 2>/dev/null | awk '{print $2}')"]])
  end
  if has("artisan") then
    table.insert(cmds, [[printf 'laravel=%s\n' "$(php artisan --version 2>/dev/null | awk '{print $3}')"]])
  end

  -- Package manager
  if has("bun.lockb") or has("bun.lock") then
    table.insert(cmds, [[printf 'pm_bun=%s\n' "$(bun --version 2>/dev/null)"]])
  elseif has("pnpm-lock.yaml") then
    table.insert(cmds, [[printf 'pm_pnpm=%s\n' "$(pnpm --version 2>/dev/null)"]])
  elseif has("yarn.lock") then
    table.insert(cmds, [[printf 'pm_yarn=%s\n' "$(yarn --version 2>/dev/null)"]])
  elseif has("package-lock.json") then
    table.insert(cmds, [[printf 'pm_npm=%s\n' "$(npm --version 2>/dev/null)"]])
  elseif has("composer.lock") then
    table.insert(cmds, [[printf 'pm_composer=%s\n' "$(composer --version 2>/dev/null | head -1 | awk '{print $3}')"]])
  elseif has("Gemfile.lock") then
    table.insert(cmds, [[printf 'pm_gem=%s\n' "$(gem --version 2>/dev/null)"]])
  elseif has("Pipfile.lock") then
    table.insert(cmds, [[printf 'pm_pipenv=%s\n' "$(pipenv --version 2>/dev/null | awk '{print $3}')"]])
  elseif has("poetry.lock") then
    table.insert(cmds, [[printf 'pm_poetry=%s\n' "$(poetry --version 2>/dev/null | awk '{print $3}')"]])
  elseif has("uv.lock") then
    table.insert(cmds, [[printf 'pm_uv=%s\n' "$(uv --version 2>/dev/null | awk '{print $2}')"]])
  end

  -- Docker
  if has("Dockerfile") or has("docker-compose.yml") or has("docker-compose.yaml") then
    table.insert(cmds, [[echo docker=1]])
  end

  -- Codexbar (JSON collapsed to single line)
  if vim.fn.executable("codexbar") == 1 then
    table.insert(
      cmds,
      [[printf 'cb_claude='; codexbar usage --format json --provider claude --no-color 2>/dev/null | tr '\n' ' '; echo]]
    )
    table.insert(
      cmds,
      [[printf 'cb_copilot='; codexbar usage --format json --provider copilot --no-color 2>/dev/null | tr '\n' ' '; echo]]
    )
  end

  -- gh checks
  if vim.fn.executable("gh") == 1 then
    table.insert(
      cmds,
      [[n=$(GH_PAGER='' gh issue list --state=open --limit=1 --json number --jq 'length' 2>/dev/null); [ "$n" -gt 0 ] 2>/dev/null && echo gh_issues=1]]
    )
    table.insert(
      cmds,
      [[n=$(GH_PAGER='' gh pr list --state=open --limit=1 --json number --jq 'length' 2>/dev/null); [ "$n" -gt 0 ] 2>/dev/null && echo gh_prs=1]]
    )
  end

  -- Execute ONE shell call
  local out = vim.fn.system(table.concat(cmds, "\n"))

  -- Parse key=value output
  local d = {}
  for line in out:gmatch("[^\n]+") do
    local k, v = line:match("^([^=]+)=(.+)$")
    if k and v and v ~= "" then
      d[k] = v
    end
  end

  -- Build git info
  local git_parts = {}
  if d.branch then
    table.insert(git_parts, " " .. d.branch .. (d.dirty == "1" and " ✗" or " ✓"))
  end
  local project = vim.fn.fnamemodify(cwd, ":t")
  if project ~= "" then
    table.insert(git_parts, " " .. project)
  end

  -- Build git changes text chunks (colored per type)
  local gc_chunks = {}
  if d.git_staged then
    table.insert(gc_chunks, { " " .. d.git_staged, hl = "DiagnosticOk" })
  end
  if d.git_modified then
    if #gc_chunks > 0 then
      table.insert(gc_chunks, { "  " })
    end
    table.insert(gc_chunks, { " " .. d.git_modified, hl = "DiagnosticWarn" })
  end
  if d.git_untracked then
    if #gc_chunks > 0 then
      table.insert(gc_chunks, { " " })
    end
    table.insert(gc_chunks, { " " .. d.git_untracked, hl = "Comment" })
  end
  if d.git_deleted then
    if #gc_chunks > 0 then
      table.insert(gc_chunks, { " " })
    end
    table.insert(gc_chunks, { " " .. d.git_deleted, hl = "DiagnosticError" })
  end

  -- Build tech info
  local tech_parts = {}
  for _, e in ipairs({
    { "node", " " },
    { "ruby", " " },
    { "java_pom", "󰬷 " },
    { "java_gradle", " " },
    { "go", "󰟓 " },
    { "rust", " " },
    { "python", " " },
    { "laravel", " " },
  }) do
    if d[e[1]] then
      table.insert(tech_parts, e[2] .. d[e[1]])
    end
  end
  for _, e in ipairs({
    { "pm_bun", " " },
    { "pm_pnpm", " " },
    { "pm_yarn", " " },
    { "pm_npm", " " },
    { "pm_composer", " " },
    { "pm_gem", " " },
    { "pm_pipenv", " " },
    { "pm_poetry", " " },
    { "pm_uv", " " },
  }) do
    if d[e[1]] then
      table.insert(tech_parts, e[2] .. d[e[1]])
    end
  end
  if d.docker then
    table.insert(tech_parts, "󰡨 docker")
  end

  return {
    git = #git_parts > 0 and table.concat(git_parts, "  ") or nil,
    git_changes = #gc_chunks > 0 and gc_chunks or nil,
    tech = #tech_parts > 0 and table.concat(tech_parts, "  ") or nil,
    claude = format_codexbar(d.cb_claude, " "),
    copilot = format_codexbar(d.cb_copilot, "󰚩 "),
    gh_issues = d.gh_issues == "1",
    gh_prs = d.gh_prs == "1",
  }
end

local logo = [[
       _                  __     ___
      | |    __ _ _____   \ \   / (_)_ __ ___
      | |   / _` |_  / | | \ \ / /| | '_ ` _ \
      | |__| (_| |/ /| |_| |\ V / | | | | | | |
      |_____\__,_/___|\__, | \_/  |_|_| |_| |_|
                      |___/    Kyk's - @kbrdn1]]

return {
  "folke/snacks.nvim",
  keys = {
    {
      "<leader>e",
      function()
        Snacks.explorer({
          auto_close = true,
          layout = {
            layout = {
              position = "float",
              width = 0.8,
              height = 0.8,
            },
          },
        })
      end,
      desc = "Explorer (float)",
    },
    {
      "<leader>E",
      function()
        Snacks.explorer()
      end,
      desc = "Explorer (sidebar)",
    },
  },
  opts = function()
    local data = get_dashboard_data()

    return {
      styles = {
        float = { backdrop = false, wo = { winblend = 0 } },
        split = { wo = { winblend = 0 } },
      },
      dashboard = {
        preset = {
          keys = {
            { icon = "󰈞 ", key = "f", desc = "Find File", action = ":lua Snacks.dashboard.pick('files')" },
            { icon = " ", key = "n", desc = "New File", action = ":ene | startinsert" },
            { icon = "󱎸 ", key = "g", desc = "Find Text", action = ":lua Snacks.dashboard.pick('live_grep')" },
            { icon = "󱋡 ", key = "r", desc = "Recent Files", action = ":lua Snacks.dashboard.pick('oldfiles')" },
            { icon = "󰲂 ", key = "p", desc = "Projects", action = ":lua Snacks.picker.projects()" },
            {
              icon = "󱫘 ",
              key = "s",
              desc = "Last session",
              action = ":lua require('persistence').load({ last = true })",
            },
            {
              icon = " ",
              key = "c",
              desc = "Config",
              action = ":lua Snacks.dashboard.pick('files', {cwd = vim.fn.stdpath('config')})",
            },
            { icon = "󰒲 ", key = "l", desc = "Lazy", action = ":Lazy" },
            { icon = "󰈆 ", key = "q", desc = "Quit", action = ":qa" },
          },
        },
        sections = {
          { text = logo, hl = "SnacksDashboardHeader", padding = 1 },
          {
            text = { { get_system_info(), hl = "SnacksDashboardTerminal" } },
            padding = 1,
            align = "center",
          },

          -- git info (p10k style) - only in git repos
          {
            text = { { data.git or "", hl = "SnacksDashboardSpecial" } },
            align = "center",
            enabled = function()
              return Snacks.git.get_root() ~= nil and data.git ~= nil
            end,
          },

          -- git changes (staged, modified, untracked)
          {
            text = data.git_changes or {},
            align = "center",
            enabled = function()
              return Snacks.git.get_root() ~= nil and data.git_changes ~= nil
            end,
          },

          -- tech stack (languages, package manager, docker)
          {
            text = { { data.tech or "", hl = "SnacksDashboardIcon" } },
            align = "center",
            enabled = function()
              return Snacks.git.get_root() ~= nil and data.tech ~= nil
            end,
          },

          -- claude usage (codexbar)
          {
            text = { { data.claude or "", hl = "SnacksDashboardTitle" } },
            align = "center",
            enabled = function()
              return Snacks.git.get_root() ~= nil and data.claude ~= nil
            end,
          },

          -- copilot usage (codexbar)
          {
            text = { { data.copilot or "", hl = "SnacksDashboardKey" } },
            padding = 1,
            align = "center",
            enabled = function()
              return Snacks.git.get_root() ~= nil and data.copilot ~= nil
            end,
          },

          -- hors projet: 3 derniers projects
          {
            icon = "󰲂 ",
            title = "Projects",
            section = "projects",
            limit = 3,
            indent = 2,
            padding = 1,
            enabled = function()
              return Snacks.git.get_root() == nil
            end,
          },

          -- issues: avec resultats
          {
            icon = " ",
            title = "Open Issues",
            key = "i",
            action = function()
              vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<leader>gi", true, false, true), "m", false)
            end,
            section = "terminal",
            cmd = [[GH_PAGER='' gh issue list --state=open --limit=3 --json number,title --jq '.[] | "#\(.number) \(if (.title | length) > 50 then (.title[:47] + "…") else .title end)"' 2>/dev/null || true]],
            height = 3,
            indent = 2,
            padding = 1,
            ttl = 5 * 60,
            enabled = function()
              return Snacks.git.get_root() ~= nil and data.gh_issues
            end,
          },
          -- issues: aucune
          {
            icon = " ",
            title = "Issues",
            key = "I",
            action = function()
              vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<leader>gI", true, false, true), "m", false)
            end,
            padding = 1,
            enabled = function()
              return Snacks.git.get_root() ~= nil and not data.gh_issues
            end,
          },

          -- prs: avec resultats
          {
            icon = " ",
            title = "Open Pull Requests",
            key = "p",
            action = function()
              vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<leader>gp", true, false, true), "m", false)
            end,
            section = "terminal",
            cmd = [[GH_PAGER='' gh pr list --state=open --limit=3 --json number,title --jq '.[] | "#\(.number) \(if (.title | length) > 50 then (.title[:47] + "…") else .title end)"' 2>/dev/null || true]],
            height = 3,
            indent = 2,
            padding = 1,
            ttl = 5 * 60,
            enabled = function()
              return Snacks.git.get_root() ~= nil and data.gh_prs
            end,
          },
          -- prs: aucune
          {
            icon = " ",
            title = "Pull Requests",
            key = "P",
            action = function()
              vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<leader>gP", true, false, true), "m", false)
            end,
            padding = 1,
            enabled = function()
              return Snacks.git.get_root() ~= nil and not data.gh_prs
            end,
          },

          { section = "keys", gap = 1, padding = 1 },
          { section = "startup" },
        },
        wo = { winblend = 0 },
      },
      explorer = {
        replace_netrw = true,
        wo = { winblend = 0 },
      },
      picker = {
        wo = { winblend = 0 },
        sources = {
          files = {
            hidden = true,
          },
          grep = {
            hidden = true,
          },
          explorer = {
            wo = { winblend = 0 },
            layout = {
              layout = {
                position = "right",
              },
            },
          },
        },
      },
      terminal = {
        wo = {
          winblend = 0,
          winhighlight = "FloatBorder:SnacksTerminalBorder",
        },
        win = {
          position = "float",
          width = 0.85,
          height = 0.85,
          border = "rounded",
        },
      },
      indent = {
        enabled = true,
        scope = {
          enabled = true,
          char = "┊",
        },
      },
      notifier = {
        wo = { winblend = 0 },
      },
    }
  end,
}
