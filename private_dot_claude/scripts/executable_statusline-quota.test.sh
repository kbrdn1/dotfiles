#!/usr/bin/env bash
# Check the account's windows in herdr-quota.json (the merge of every session's rate_limits):
#   (a) a reset in the same window (resets_at unchanged) lowers the shown week: a fresh reading wins even lower;
#   (b) an idle session replaying its old, higher reading changes nothing;
#   (c) a later window wins, and an earlier one never comes back;
#   (d) two active sessions: each new reading of either one is shown, and their replays change nothing;
#   (e) a file left by the old merge (98 %, no session remembers it) gives way to the first reading of any session.
# A reading is fresh when it is a session's first or differs from the one it wrote last (its session cache).
# Hermetic: temp HOME (isolates ~/.claude/cache/statusline), a plain folder as cwd, no git, no network.
set -euo pipefail

SL="$(cd "$(dirname "$0")" && pwd)/statusline.ts"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/work"
Q="$tmp/.claude/cache/statusline/herdr-quota.json"
W1=1795546800   # a week's resets_at
W2=1796151600   # the next week's

# render <session> <seven_day used %> <seven_day resets_at>: one status line render of that session.
render() {
  printf '{"session_id":"%s","cwd":"%s","model":{"display_name":"T","id":"x"},"rate_limits":{"five_hour":null,"seven_day":{"used_percentage":%s,"resets_at":%s}}}' \
    "$1" "$tmp/work" "$2" "$3" > "$tmp/in.json"
  HOME="$tmp" HC_TERMINAL_ID="tq-$1" bun "$SL" < "$tmp/in.json" > /dev/null
}
shown() { jq -r '"\(.seven_day.used_percentage)@\(.seven_day.resets_at)"' "$Q"; }
expect() { # <what> <expected used@resets>
  local got; got="$(shown)"
  [ "$got" = "$2" ] || { echo "FAIL: $1: expected $2, got $got"; cat "$Q"; exit 1; }
}

# (e) the 98 % the old merge froze after Kylian's reset (2026-11-19): no session cache knows it.
mkdir -p "$(dirname "$Q")"
printf '{"seven_day":{"used_percentage":98,"resets_at":%s},"updated_at":1}' "$W1" > "$Q"
render z 2 $W1;    expect "(e) a legacy 98 gives way to a first reading" "2@$W1"

render a 98 $W1;   expect "a's first reading" "98@$W1"
render b 98 $W1;   expect "b's first reading" "98@$W1"
# (a) Kylian resets the week on claude.ai: same window, a's next response says 1 %.
render a 1 $W1;    expect "(a) a reset lowers the week" "1@$W1"
# (b) b is idle: it replays its last reading, 98 %, at each render.
render b 98 $W1;   expect "(b) an idle replay changes nothing" "1@$W1"
render b 98 $W1;   expect "(b) again" "1@$W1"
# (d) both active: every new reading shows; their replays don't.
render b 1.5 $W1;  expect "(d) b's new reading" "1.5@$W1"
render a 1.7 $W1;  expect "(d) a's new reading" "1.7@$W1"
render b 1.5 $W1;  expect "(d) b replays" "1.7@$W1"
render a 1.7 $W1;  expect "(d) a replays" "1.7@$W1"
# (c) b's window rolls over: the later window wins, a's replay of the earlier one never comes back,
# and neither does a's first reading of another session still in the earlier window.
render b 0.2 $W2;  expect "(c) a later window wins" "0.2@$W2"
render a 1.7 $W1;  expect "(c) a replay of the earlier window" "0.2@$W2"
render c 40 $W1;   expect "(c) a new session still in the earlier window" "0.2@$W2"
# The rest of the file: five_hour as the session reported it (null on Ultra), a fresh updated_at.
[ "$(jq -r '.five_hour' "$Q")" = null ] || { echo "FAIL: five_hour not passed through"; cat "$Q"; exit 1; }
[ "$(jq -r '.updated_at | type' "$Q")" = number ] || { echo "FAIL: no updated_at"; cat "$Q"; exit 1; }

echo "ok"
