#!/usr/bin/env bash
# Check the statusline auto-pin: a session whose cwd is the main checkout but
# whose edits land in a linked worktree gets `gwm agents attach`ed there exactly
# once — and never again on later renders (the loop guard).
# Hermetic: temp repo, temp HOME (isolates the session cache), `gwm` shim.
set -euo pipefail

SL="$(cd "$(dirname "$0")" && pwd)/statusline.ts"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
SID="test-$$-pin"

# --- fixture: repo + linked worktree ---------------------------------
git init -q "$tmp/repo" && cd "$tmp/repo"
git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
git worktree add -q "$tmp/wt" -b 'feat/#1-x'
echo hi > "$tmp/wt/f.txt"

# --- gwm shim: logs its args, and attach really writes the pin -------
# the first attach FAILS on purpose: gwm rejects a session it has not detected
# yet, and that race is the nominal case in production.
mkdir -p "$tmp/bin"
cat > "$tmp/bin/gwm" <<EOF
#!/usr/bin/env bash
echo "\$*" >> "$tmp/gwm.log"
if [ "\$1 \$2" = "agents attach" ]; then
  [ -f "$tmp/attach-failed-once" ] || { touch "$tmp/attach-failed-once"; exit 1; }
  git config --add "branch.\$(git rev-parse --abbrev-ref HEAD).gwm-agent-pin" "\$4"
fi
exit 0
EOF
chmod +x "$tmp/bin/gwm"

# --- transcript: one Edit inside the worktree ------------------------
printf '{"message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"%s"}}]}}\n' \
  "$tmp/wt/f.txt" > "$tmp/t.jsonl"
printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s","model":{"display_name":"T","id":"x"}}' \
  "$SID" "$tmp/t.jsonl" "$tmp/repo" > "$tmp/in.json"

render() { HOME="$tmp" PATH="$tmp/bin:$PATH" bun "$SL" < "$tmp/in.json" > /dev/null; }
settle() { perl -e 'select(undef,undef,undef,0.6)'; }

attaches() { grep -c 'agents attach' "$tmp/gwm.log" 2>/dev/null || true; }
pins() { git config --get-all 'branch.feat/#1-x.gwm-agent-pin' 2>/dev/null | grep -c "$SID" || true; }

render; settle  # first attach is rejected by gwm
[ "$(attaches)" = 1 ] || { echo "FAIL: expected 1 attach, got $(attaches)"; cat "$tmp/gwm.log"; exit 1; }
[ "$(pins)" = 0 ] || { echo "FAIL: pin recorded although attach failed"; exit 1; }

render; settle  # bounded retry lands it
[ "$(attaches)" = 2 ] || { echo "FAIL: no retry after a failed attach ($(attaches) attaches)"; exit 1; }
[ "$(pins)" = 1 ] || { echo "FAIL: expected 1 pin in git config, got $(pins)"; exit 1; }

render; render; settle  # pinned now: no further spawn
[ "$(attaches)" = 2 ] || { echo "FAIL: re-pinned on later renders ($(attaches) attaches)"; exit 1; }

# --- a session working in its own cwd must NOT be pinned -------------
sed -i '' "s|\"cwd\":\"$tmp/repo\"|\"cwd\":\"$tmp/wt\"|" "$tmp/in.json"
rm -f "$tmp/gwm.log"
SID="$SID-2"
sed -i '' "s|\"session_id\":\"[^\"]*\"|\"session_id\":\"$SID\"|" "$tmp/in.json"
render; settle
[ ! -f "$tmp/gwm.log" ] || { echo "FAIL: pinned a session already inside its worktree"; cat "$tmp/gwm.log"; exit 1; }

echo "ok"
