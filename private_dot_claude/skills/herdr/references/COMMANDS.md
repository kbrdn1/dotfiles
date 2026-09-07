# spawn-agent commands cheatsheet

source: `/Users/kbrdn1/.config/zed/tasks.json` (section "AI & Code Assistant Tools", lines ~553-678).

all commands are designed to be run **inside a herdr pane that already has the project as cwd**. since the skill always creates workspaces with `--cwd "$PWD"`, every spawned agent inherits the right project path automatically.

## claude code

| label (zed)                                                            | command                                                                  |
| :--------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Claude Code                                                            | `claude`                                                                 |
| Claude Code (Resume)                                                   | `claude --resume`                                                        |
| Claude Code (Continue)                                                 | `claude --continue`                                                      |
| Claude Code (Chrome)                                                   | `claude --chrome`                                                        |
| Claude Code (Continue + Chrome)                                        | `claude --continue --chrome`                                             |
| Claude Code (Dangerous Skip Permissions)                               | `claude --dangerously-skip-permissions`                                  |
| Claude Code (Resume + Dangerous Skip Permissions)                      | `claude --dangerously-skip-permissions --resume`                         |
| Claude Code (Continue + Dangerous Skip Permissions)                    | `claude --continue --dangerously-skip-permissions`                       |
| Claude Code (Chrome + Dangerous Skip Permissions)                      | `claude --chrome --dangerously-skip-permissions`                         |
| Claude Code (Resume + Chrome + Dangerous Skip Permissions)             | `claude --chrome --dangerously-skip-permissions --resume`                |
| Claude Code (Continue + Chrome + Dangerous Skip Permissions)           | `claude --continue --chrome --dangerously-skip-permissions`              |

### flag semantics

- `--continue`: resume the most recent claude session in this cwd. fastest way to keep a thread going.
- `--resume`: open the picker to choose which past session to resume. use when `--continue` is the wrong thread.
- `--chrome`: enable chrome devtools mcp / browser automation for this session.
- `--dangerously-skip-permissions` (yolo mode): no permission prompts for tool calls. only spawn this when the user explicitly asks for it — never default to it.

### picking the right variant

| user intent                                              | recommended                              |
| :------------------------------------------------------- | :--------------------------------------- |
| "spawn another claude"                                   | `claude`                                 |
| "continue what you / the other agent was doing"          | `claude --continue`                      |
| "resume the session from earlier"                        | `claude --resume`                        |
| "give it browser access"                                 | add `--chrome`                           |
| "let it work unattended" (user explicitly opts in)       | add `--dangerously-skip-permissions`     |

## copilot cli

| label (zed)            | command              |
| :--------------------- | :------------------- |
| Copilot CLI            | `copilot`            |
| Copilot CLI (Continue) | `copilot --continue` |

## spawn snippet (copy-paste ready)

```bash
# 1. capture our own pane id (so we can come back if needed)
SELF=$(herdr pane list | python3 -c 'import sys,json; print(next(p["pane_id"] for p in json.load(sys.stdin)["result"]["panes"] if p.get("focused")))')

# 2. split + capture new pane id
NEW=$(herdr pane split "$SELF" --direction right --no-focus \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')

# 3. launch the agent — swap this line for any row from the tables above
herdr pane run "$NEW" "claude --continue"

# 4. wait until the agent is interactive, then hand it work
herdr wait output "$NEW" --match ">" --timeout 15000
herdr pane run "$NEW" "your task description here"
```
