// bun mods/kt-chat/refs.check.mjs: the Chat's references (#82, refs.js). What is recognised and what
// isn't (code blocks aren't here: docOf cut them out; links, URLs, colours, UUIDs, file names in a
// sentence), what each resolves to against a repo's facts, the links written into the prose, their url
// and back, where a click goes, GitHub's page, and the facts asked in one task per render (fake exec).
import assert from "node:assert/strict";
import { scan, resolve, linkify, refUrl, parseRef, plan, githubUrl, githubRepo, onGitHub, labelOf, kindFrom, absOf,
  refsState, ensure, refsOf, factsFor, missing } from "./refs.js";

const kinds = (text) => scan(text).map((c) => [c.raw, c.kinds.map((k) => k.kind).join("|")]);

// ---------- recognised ----------
assert.deepEqual(kinds("voir #82 et kbrdn1/dotfiles#74"), [["#82", "issue"], ["kbrdn1/dotfiles#74", "issue"]]);
assert.deepEqual(kinds("commité (a860227), puis 2f345cb."), [["a860227", "commit"], ["2f345cb", "commit"]]);
assert.deepEqual(kinds("dans mods/kt-chat/main.js:1590 et ~/.config/herdr-app/brand/x.svg"), [["mods/kt-chat/main.js:1590", "path"], ["~/.config/herdr-app/brand/x.svg", "path"]]);
assert.deepEqual(kinds("voir main.js."), [["main.js", "path"]], "a sentence's end isn't the path's");
assert.deepEqual(kinds("sur `dev`, la branche `feat/#82-chat-refs`"), [["`dev`", "branch"], ["`feat/#82-chat-refs`", "branch"]], "a # isn't in a path: the branch alone");
assert.deepEqual(kinds("`kt-keys/projtile.js:12-20` et `a860227`"), [["`kt-keys/projtile.js:12-20`", "path"], ["`a860227`", "commit"]]);
assert.deepEqual(kinds("`mods/kt-chat`"), [["`mods/kt-chat`", "path|branch"]], "a slash and no line: a path, or a branch");
assert.deepEqual(kinds("l'issue `#43`"), [["`#43`", "issue"]]);
const p = scan("x src/a.js#L4-L9")[0].kinds[0];
assert.deepEqual([p.path, p.line, p.to], ["src/a.js", 4, 9], "GitHub's #L lines");
assert.deepEqual(scan("x src/a.js:9-4")[0].kinds[0].to, null, "an end before its start: the line alone");
const gh = scan("la PR https://github.com/kbrdn1/dotfiles/pull/90 est là");
assert.deepEqual([gh.length, gh[0].url, gh[0].kinds[0]], [1, true, { kind: "issue", repo: "kbrdn1/dotfiles", number: 90 }], "a GitHub URL: a chip, not a new link");

// ---------- not recognised ----------
const none = (text, why) => assert.deepEqual(scan(text).filter((c) => !c.url), [], why);
none("la couleur #e06060 et #123456", "colours");
none("la session 791e6229-e389-43cc-bf56-f48f89859f65", "a UUID's parts");
assert.deepEqual(kinds("le fichier e06060-v1.svg"), [["e06060-v1.svg", "path"]], "a sha glued to a dash: not a commit (a file name, checked)");
none("v1.2.3, Opus 5.5 et 2.1.139", "versions");
none("1234567 et deadbeef", "digits only, letters only");
none("[#82](https://x/82) et [voir](mods/a.js) et <https://x.y/a.js>", "inside links and autolinks");
none("https://github.com/kbrdn1/dotfiles/blob/dev/mods/a.js", "inside a bare URL (not an issue URL)");
none("`une phrase avec espaces` et `[x](y)`", "a code span that isn't one reference");
none("Opus 5.5 a travaillé 3m 12s", "prose");
none("a&#82; html", "an HTML entity");
assert.equal(scan("x".repeat(10) + " #1".repeat(60)).length, 40, "at most 40 a segment");

// ---------- resolved against the repo ----------
const R = "/r/herdr", H = "/home/k";
const facts = {
  cwd: R, root: R, home: H, slug: "kbrdn1/dotfiles",
  shas: { a860227: "a860227" + "0".repeat(33), "2f345cb": "ambiguous", "1234abc": "missing" },
  branches: new Set(["dev", "feat/#82-chat-refs"]), worktrees: new Set(["/r/wt/feat-82"]),
  files: new Set([`${R}/mods/kt-chat/main.js`, `${R}/README.md`]),
};
const res = (text) => scan(text).map((c) => resolve(c, facts));
assert.deepEqual(res("#82"), [{ kind: "issue", repo: "kbrdn1/dotfiles", number: 82 }], "#N: the thread's repo");
assert.deepEqual(res("#82").map((r) => r && r.repo), ["kbrdn1/dotfiles"]);
assert.deepEqual(scan("#82").map((c) => resolve(c, { ...facts, slug: null })), [null], "no owner/name: text");
assert.deepEqual(scan("#82").map((c) => resolve(c, { ...facts, slug: "kalima" })), [null], "a folder's name isn't a GitHub repo (Home's guard)");
assert.equal(res("a860227")[0].sha.length, 40, "a sha: the full one");
assert.deepEqual(res("2f345cb 1234abc"), [null, null], "ambiguous, missing: text");
assert.deepEqual(res("mods/kt-chat/main.js:1590")[0], { kind: "file", path: `${R}/mods/kt-chat/main.js`, line: 1590, to: null });
assert.deepEqual(res("`README.md`")[0], { kind: "file", path: `${R}/README.md`, line: null, to: null });
assert.deepEqual(res("mods/kt-chat/absent.js"), [null], "a file that isn't there: text");
assert.deepEqual(res("`dev`")[0], { kind: "branch", name: "dev" });
assert.deepEqual(res("`feat/#82-chat-refs`")[0], { kind: "branch", name: "feat/#82-chat-refs" }, "not a file: the branch");
assert.deepEqual(res("`true`"), [null], "a word that isn't a branch: text");
assert.deepEqual(res("/r/wt/feat-82")[0], { kind: "worktree", path: "/r/wt/feat-82" });
assert.deepEqual(scan("/etc/hosts").map((c) => resolve(c, { ...facts, files: new Set(["/etc/hosts"]) })), [null], "a file outside the repo: Files wouldn't open it");
assert.deepEqual(absOf("~/.zshrc", facts), ["/home/k/.zshrc"]);
assert.deepEqual(absOf("../x/a.js", { cwd: "/r/herdr/mods", root: R }), ["/r/herdr/x/a.js", "/r/x/a.js"], "from the cwd, then from the root");
assert.deepEqual(scan("#82").map((c) => resolve(c, null)), [null], "facts not read yet: text");
assert.deepEqual(gh.map((c) => resolve(c, null)), [{ kind: "issue", repo: "kbrdn1/dotfiles", number: 90 }], "a GitHub URL needs no facts");

// ---------- the links in the prose ----------
const link = (text) => { const c = scan(text); return linkify(text, c, c.map((x) => resolve(x, facts))); };
assert.equal(link("voir #82."), `voir [#82](herdr-ref:issue/kbrdn1%2Fdotfiles%2382).`);
assert.equal(link("sur `dev` (a860227)"), `sur [\`dev\`](herdr-ref:branch/dev) ([a860227](herdr-ref:commit/a860227${"0".repeat(33)}?repo=kbrdn1%2Fdotfiles))`);
assert.equal(link("2f345cb reste du texte"), "2f345cb reste du texte");
assert.equal(link("la PR https://github.com/kbrdn1/dotfiles/pull/90"), "la PR https://github.com/kbrdn1/dotfiles/pull/90", "a URL stays as written");
assert.equal(link("**#82** et _`dev`_"), "**[#82](herdr-ref:issue/kbrdn1%2Fdotfiles%2382)** et _[`dev`](herdr-ref:branch/dev)_", "inside emphasis");
const u = link("dans mods/kt-chat/main.js:12-20").match(/\((herdr-ref:[^)]+)\)/)[1];
assert.ok(!/[\s()[\]]/.test(u), "the url breaks no markdown");

// ---------- the url and back ----------
for (const r of [
  { kind: "issue", repo: "kbrdn1/dotfiles", number: 82 },
  { kind: "commit", sha: "a".repeat(40), repo: "kbrdn1/dotfiles" },
  { kind: "commit", sha: "b".repeat(40), repo: null },
  { kind: "file", path: "/r/a b/c.js", line: 3, to: 9 },
  { kind: "file", path: "/r/c.js", line: null, to: null },
  { kind: "branch", name: "feat/#82-x" },
  { kind: "worktree", path: "/r/wt/feat-82" },
]) assert.deepEqual(parseRef(refUrl(r)), r, `${r.kind}: and back`);
assert.equal(parseRef("https://example.com"), null);
assert.equal(parseRef("herdr-ref:file/relative.js"), null, "a file is absolute");
assert.equal(parseRef("herdr-ref:commit/zz"), null);
assert.equal(parseRef("herdr-ref:issue/%E0%A4%A"), null, "a broken encoding");

// ---------- where a click goes ----------
assert.deepEqual(plan({ kind: "issue", repo: "o/r", number: 5 }, "pr"), { key: "kt.inbox.open", value: { repo: "o/r", kind: "pr", number: 5 }, page: "inbox" });
assert.deepEqual(plan({ kind: "commit", sha: "c".repeat(40) }), { key: "kt.history.open", value: { sha: "c".repeat(40) }, panel: "history" });
assert.deepEqual(plan({ kind: "file", path: "/r/a.js", line: 3, to: null }), { key: "kt.files.open", value: { path: "/r/a.js", line: 3 }, panel: "files" });
assert.deepEqual(plan({ kind: "branch", name: "dev" }), { key: "kt.gwm.open", value: { branch: "dev" }, page: "gwm" });
assert.deepEqual(plan({ kind: "worktree", path: "/r/wt" }), { key: "kt.gwm.open", value: { path: "/r/wt" }, page: "gwm" });
assert.equal(githubUrl({ kind: "issue", repo: "o/r", number: 5 }), "https://github.com/o/r/issues/5");
assert.equal(githubUrl({ kind: "commit", sha: "c".repeat(40), repo: "o/r" }), `https://github.com/o/r/commit/${"c".repeat(40)}`);
assert.equal(githubUrl({ kind: "commit", sha: "c".repeat(40), repo: null }), null);
assert.equal(githubUrl({ kind: "file", path: "/r/a.js" }), null, "a file: no GitHub page (maybe not pushed)");
assert.equal(kindFrom("null\n"), "issue");
assert.equal(kindFrom(""), "issue", "gh failed: an issue");
assert.equal(kindFrom('{"url":"x"}\n'), "pr");
assert.deepEqual([labelOf({ kind: "file", path: "/r/m/a.js", line: 3 }), labelOf({ kind: "commit", sha: "abcdef1234" })], ["a.js:3", "abcdef1"]);
assert.equal(githubRepo("git@github.com:kbrdn1/dotfiles.git"), "kbrdn1/dotfiles");
assert.equal(githubRepo("https://gitlab.com/a/b"), null);
assert.ok(onGitHub("a/b") && !onGitHub("kalima"));

// ---------- the facts: one task per render, one call a kind ----------
const calls = [];
const io = {
  checking: () => false, home: () => H,
  exec: async (cmd, args) => {
    calls.push([cmd, ...args].join(" "));
    const a = args.join(" ");
    if (a.includes("rev-parse --show-toplevel")) return { code: 0, stdout: `${R}\n` };
    if (a.includes("remote get-url origin")) return { code: 0, stdout: "git@github.com:kbrdn1/dotfiles.git\n" };
    if (a.includes("cat-file --batch-check")) return { code: 0, stdout: args.slice(3).map((s) => (s === "a860227" ? `a860227${"0".repeat(33)} commit 300` : `${s} missing`)).join("\n") + "\n" };
    if (a.includes("for-each-ref")) return { code: 0, stdout: "dev\nmain\n" };
    if (a.includes("worktree list")) return { code: 0, stdout: `worktree ${R}\nHEAD x\n\nworktree /r/wt/feat-82\n` };
    if (a.includes("[ -f")) return { code: 0, stdout: args.slice(3).filter((x) => x === `${R}/README.md`).join("\n") + "\n" };
    return { code: 1, stdout: "" };
  },
};
const tasks = [];
let redraws = 0;
const cx = { spawn: (f) => tasks.push(f({ notify: () => redraws++ })) };
const st = refsState();
const text = "voir #82, a860227, `dev`, `README.md` et 1234abc";
let [cands, refs] = refsOf(st, R, text, H);
assert.deepEqual(refs.filter(Boolean).length, 0, "nothing known yet: all text");
ensure(st, cx, R, cands, io);
ensure(st, cx, R, scan("et `main`"), io);
assert.equal(tasks.length, 1, "one task for the render's misses");
await Promise.all(tasks);
assert.equal(redraws, 1, "then a redraw");
assert.equal(calls.filter((c) => c.includes("cat-file")).length, 1, "the shas in one call");
assert.equal(calls.filter((c) => c.includes("for-each-ref")).length, 1, "the branches in one call");
assert.equal(calls.filter((c) => c.includes("[ -f")).length, 1, "the files in one call");
[cands, refs] = refsOf(st, R, text, H);
assert.deepEqual(refs.map((r) => r?.kind ?? null), ["issue", "commit", "branch", "file", null]);
const before = calls.length;
tasks.length = 0;
ensure(st, cx, R, cands, io);
assert.equal(tasks.length + calls.length - before, 0, "all known: nothing asked again");
assert.equal(missing(factsFor(st, R, H), cands), null);
// Not a repo: nothing but explicit references; while checking: nothing asked.
const st2 = refsState();
const io2 = { ...io, exec: async (cmd, args) => (args.includes("--show-toplevel") ? { code: 128, stdout: "" } : io.exec(cmd, args)) };
tasks.length = 0;
ensure(st2, cx, "/tmp/x", scan("#82 kbrdn1/dotfiles#3 a860227"), io2);
await Promise.all(tasks);
assert.deepEqual(refsOf(st2, "/tmp/x", "#82 kbrdn1/dotfiles#3 a860227", H)[1].map((r) => r?.kind ?? null), [null, "issue", null]);
tasks.length = 0;
ensure(refsState(), cx, R, cands, { ...io, checking: () => true });
assert.equal(tasks.length, 0, "nothing while checking");

console.log("refs: ok");
