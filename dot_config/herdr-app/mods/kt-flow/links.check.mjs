// bun ~/.config/herdr-app/mods/kt-flow/links.check.mjs: what each Flow button and g-key does (links.js), with
// herdr faked: the exact run / exec / setShared calls. Not loaded by Herdr.
import assert from "node:assert/strict";
import { target, checksOf, stepKind, stepUrl, inHerdr, toBrowser, toPage, toTab, gLink } from "./links.js";
import { Vim } from "./vim.js";

const fake = () => {
  const calls = [];
  return { calls, h: { run: (...a) => calls.push(["run", ...a]), exec: (...a) => { calls.push(["exec", ...a]); return Promise.resolve({ code: 0 }); },
    setShared: (...a) => calls.push(["setShared", ...a]), now: () => 1000 } };
};

// Targets: GitHub's url from the repo, the report's when given; the number always a number (the branch's is a string).
const issue = target("kbrdn1/dotfiles", "issue", "40");
assert.deepEqual(issue, { repo: "kbrdn1/dotfiles", kind: "issue", number: 40, url: "https://github.com/kbrdn1/dotfiles/issues/40" });
const pr = target("kbrdn1/dotfiles", "pr", 41, "https://github.com/kbrdn1/dotfiles/pull/41");
assert.equal(target("kbrdn1/dotfiles", "pr", 41).url, "https://github.com/kbrdn1/dotfiles/pull/41");
assert.equal(target("o/r", "issue", null), null);
assert.deepEqual(target(null, "pr", 7), { repo: null, kind: "pr", number: 7, url: null });
assert.deepEqual(checksOf(pr), { ...pr, tab: "checks", url: "https://github.com/kbrdn1/dotfiles/pull/41/checks" });
assert.equal(checksOf(null), null);

// Issue pill, gi, enter on the issue step: the Inbox on the issue.
let f = fake();
assert.equal(inHerdr(f.h, issue), true);
assert.deepEqual(f.calls, [
  ["setShared", "kt.inbox.open", { repo: "kbrdn1/dotfiles", kind: "issue", number: 40, at: 1000 }],
  ["run", "layout.select", { stack: "view", child: "inbox" }],
]);
// PR pill, gp: the Inbox on the PR; CI pill: its Checks tab.
f = fake();
inHerdr(f.h, pr);
inHerdr(f.h, checksOf(pr));
assert.deepEqual(f.calls.filter((c) => c[0] === "setShared").map((c) => c[2]), [
  { repo: "kbrdn1/dotfiles", kind: "pr", number: 41, at: 1000 },
  { repo: "kbrdn1/dotfiles", kind: "pr", number: 41, tab: "checks", at: 1000 },
]);
// Off GitHub: no Inbox (nothing sent), the caller goes to the browser.
f = fake();
assert.equal(inHerdr(f.h, target(null, "pr", 7, "https://ghe.example/o/r/pull/7")), false);
assert.deepEqual(f.calls, []);

// GitHub icons, gI / gP, O: the browser, read-only.
f = fake();
assert.equal(toBrowser(f.h, issue.url), true);
assert.equal(toBrowser(f.h, null), false);
assert.deepEqual(f.calls, [["exec", "open", ["https://github.com/kbrdn1/dotfiles/issues/40"]]]);

// Steps: enter / o go to Herdr on the issue and the PR; O and the row's icon to GitHub.
assert.deepEqual(["issue", "issue-closed", "pr", "review", "ci", "branch"].map(stepKind), ["issue", "issue", "pr", null, null, null]);
assert.deepEqual(["issue", "issue-closed", "pr", "review", "ci", "push"].map((id) => stepUrl(id, issue, pr)), [
  "https://github.com/kbrdn1/dotfiles/issues/40", "https://github.com/kbrdn1/dotfiles/issues/40",
  "https://github.com/kbrdn1/dotfiles/pull/41", "https://github.com/kbrdn1/dotfiles/pull/41/files",
  "https://github.com/kbrdn1/dotfiles/pull/41/checks", null,
]);
assert.equal(stepUrl("ci", issue, null), null);
assert.equal(stepUrl("issue", null, pr), null);

// The branch line: Worktrees (the page), Changes and History (the panel's tabs).
f = fake();
toPage(f.h, "gwm");
toTab(f.h, "diff");
toTab(f.h, "history");
assert.deepEqual(f.calls, [
  ["run", "layout.select", { stack: "view", child: "gwm" }],
  ["run", "layout.select", { stack: "panel-body", child: "diff" }],
  ["run", "layout.select", { stack: "panel-body", child: "history" }],
]);

// g-keys: after vim.js' pending g only, within its 600 ms; gg stays vim's.
let t = 0;
const v = new Vim({ now: () => t });
assert.equal(v.handle("g"), "pending");
assert.deepEqual(gLink(v, "i", t + 100), { kind: "issue", github: false });
assert.equal(v.pending, null); // back in NORMAL
for (const [k, want] of [["I", { kind: "issue", github: true }], ["p", { kind: "pr", github: false }], ["P", { kind: "pr", github: true }]]) {
  v.handle("g");
  assert.deepEqual(gLink(v, k, t), want);
}
assert.equal(gLink(v, "i", t), null); // no g before
v.handle("g");
assert.equal(gLink(v, "i", t + 601), null); // too late
v.normal();
v.handle("g");
assert.equal(gLink(v, "g", t), null); // gg: vim's
assert.equal(v.handle("g"), "top");
v.handle("g");
assert.equal(gLink(v, "j", t), null);
console.log("links.js: ok");
