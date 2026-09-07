#!/usr/bin/env bash
# Check the row-2 forge links: the worktree chip points at the branch on the
# forge, the repo chip at the repo — GitHub and GitLab path layouts, nothing at
# all on an unknown host. `#` in the branch (feat/#283-x) must be percent-encoded
# or everything after it is a URL fragment.
# Hermetic: temp repo, temp HOME (isolates the session cache), `gwm` shim.
set -euo pipefail

SL="$(cd "$(dirname "$0")" && pwd)/statusline.ts"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git init -q -b 'feat/#283-x' "$tmp/repo"
git -C "$tmp/repo" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init

# row 2 only renders when gwm is on PATH — it is never called here
mkdir -p "$tmp/bin"
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp/bin/gwm"
chmod +x "$tmp/bin/gwm"

printf '{"session_id":"test-links","cwd":"%s","model":{"display_name":"T","id":"x"}}' \
  "$tmp/repo" > "$tmp/in.json"

render() { # $1 = origin url
  git -C "$tmp/repo" config remote.origin.url "$1"
  rm -rf "$tmp/.claude/cache"
  HOME="$tmp" PATH="$tmp/bin:$PATH" bun "$SL" < "$tmp/in.json"
}
# upstream set = the branch is on the forge; gwm's fresh branches are local-only
git -C "$tmp/repo" config 'branch.feat/#283-x.merge' 'refs/heads/feat/#283-x'

has() { case "$1" in *"$2"*) ;; *) echo "FAIL: missing '$2' in: $1"; exit 1;; esac; }
hasnt() { case "$1" in *"$2"*) echo "FAIL: unexpected '$2' in: $1"; exit 1;; *) ;; esac; }

# GitHub, scp-style remote
out="$(render 'git@github.com:o/r.git')"
has "$out" 'https://github.com/o/r/tree/feat/%23283-x'
has "$out" $'\e]8;;https://github.com/o/r\a'   # repo chip links to the repo
hasnt "$out" 'tree/feat/#283-x'               # raw # would truncate the URL

# GitLab, https remote with a credential — must never reach the link
out="$(render 'https://oauth2:tok@gitlab.com/g/sub/r.git')"
has "$out" 'https://gitlab.com/g/sub/r/-/tree/feat/%23283-x'
hasnt "$out" 'tok@'

# unknown forge → no link at all (a github-shaped path would 404)
out="$(render 'git@bitbucket.org:o/r.git')"
hasnt "$out" $'\e]8;;'

# branch not pushed yet (no upstream) → no branch link, repo link stays
git -C "$tmp/repo" config --unset 'branch.feat/#283-x.merge'
out="$(render 'git@github.com:o/r.git')"
hasnt "$out" '/tree/'
has "$out" $'\e]8;;https://github.com/o/r\a'

echo "OK: statusline forge links"
