// card.js: what kt-machines shows of one machine (#64), from machines.js' stateOf. Pure, no herdr:
// card.check.mjs checks it on invented machines.
//
//   { name, status, root, account, version, why, login, linger, primary }
//   login:   `hc machine login <name>` when it needs one (Copy), else null
//   linger:  true when its programs stop at logout (keeps_running_after_logout false): the warning,
//            whose button opens kt-machine-add (the administrator's command is there)
//   primary: what enter (or o) does on it: "login" (copies the command), "project" (opens a project
//            there: space.new {machine}, a shell in its home, never an agent), null when it's away

export function cardOf(s) {
  const login = s.status === "login" ? `hc machine login ${s.name}` : null; // i18n: tech
  return {
    name: s.name,
    status: s.status,
    root: s.root,
    account: s.account,
    version: s.version,
    why: s.status === "away" ? s.why : null,
    login,
    linger: s.linger === false,
    primary: login ? "login" : s.status === "ready" ? "project" : null,
  };
}
