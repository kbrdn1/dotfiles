// bun ~/.config/herdr-app/mods/kt-market/model.check.mjs: model.js on invented fixtures (no network, no
// real catalog): the text cleaning, each source's normalizer, the risk rules and scans, the plans, the
// search with its facet counts and sorts.
import assert from "node:assert/strict";
import {
  clean, https, github, safeRel, hash, normalizeMarketplace, marketSource, mcpVariants, normalizeRegistry, normalizeSkillsSh,
  normalizeHerdr, normalizeLoop, levelOf, code, unpinnedRun, scanHerdr, scanSkill, pluginFlags, repoFlags, findSkill,
  loopRecipe, plan, mcpForm, skillForm, query, tokens, typeMatch, dedupe, LIVE, SOURCES, TYPES, typeCount, pinOf,
} from "./model.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";

// ── text ────────────────────────────────────────────────────────────────────
assert.equal(clean("a\u001b[31mred\u001b[0m b"), "ared b", "CSI out");
assert.equal(clean("x\u001b]8;;https://evil\u0007link\u001b]8;;\u0007y"), "xlinky", "OSC 8 out");
assert.equal(clean("safe‮dcba"), "safedcba", "bidi override out");
assert.equal(clean("a\u0000b\tc\n d"), "a b c d", "control out, spaces collapsed");
assert.equal(clean("abcdef", 4), "abc…");
assert.equal(clean("l1\nl2\u0007", 50, { lines: true }), "l1\nl2", "lines kept, bell out");
assert.equal(clean(null), "");
assert.equal(https("https://example.test/a"), "https://example.test/a");
assert.equal(https("http://example.test"), null);
assert.equal(https("https://x.test/a b"), null);
assert.equal(https("javascript:alert(1)"), null);
assert.deepEqual(github("https://github.com/acme/tool.git"), { owner: "acme", name: "tool" });
assert.deepEqual(github("https://github.com/acme/tool/tree/main/x"), { owner: "acme", name: "tool" });
assert.deepEqual(github("acme/tool"), { owner: "acme", name: "tool" });
assert.equal(github("https://gitlab.test/acme/tool"), null);
assert.equal(github("acme/.hidden"), null);
assert.equal(safeRel("./plugins/x/"), "plugins/x");
assert.equal(safeRel(""), "");
assert.equal(safeRel("a/../b"), null);
assert.equal(safeRel("a/./b"), null);
assert.equal(safeRel("a/$(x)"), null);
assert.equal(hash("abc"), hash("abc"));
assert.notEqual(hash("abc"), hash("abd"));
assert.match(hash("x"), /^[0-9a-f]{8}$/);

// ── plugins ─────────────────────────────────────────────────────────────────
const catalog = { plugins: [
  { name: "local-one", source: "./plugins/local-one", description: "A \u001b[1mlocal\u001b[0m plugin", author: { name: "Acme" }, keywords: ["Loop"] },
  { name: "pinned", source: { source: "url", url: "https://github.com/acme/pinned.git", sha: SHA }, version: "1.2.0", hooks: { Stop: [] } },
  { name: "subdir", source: { source: "git-subdir", url: "https://github.com/acme/mono.git", path: "plugins/sub", ref: "v1" } },
  { name: "cmd", source: { source: "command", command: "do-something" } },
  { name: "plain-http", source: { source: "url", url: "http://example.test/x.git", sha: SHA } },
  { name: "bad name!", source: "./x" },
  { name: "escape", source: "../outside" },
  { name: "odd", source: { source: "npm", package: "x" } },
] };
const mk = normalizeMarketplace(catalog, { name: "acme-market", repo: { owner: "acme", name: "market" }, head: SHA, updatedAt: "2026-01-02T00:00:00Z" });
assert.equal(mk.rejected, 2, "a bad name and a path leaving the repo are rejected");
const P = Object.fromEntries(mk.items.map((i) => [i.name, i]));
assert.equal(P["local-one"].id, "plugin:known:local-one@acme-market");
assert.deepEqual(P["local-one"].pin, { kind: "market", value: SHA });
assert.deepEqual(P["local-one"].repo, { owner: "acme", name: "market", path: "plugins/local-one", ref: null });
assert.equal(P["local-one"].description, "A local plugin");
assert.equal(P["local-one"].author, "Acme");
assert.ok(P["local-one"].tags.includes("loop"), "a loop keyword tags it loop");
assert.equal(P["local-one"].route, "kt-plugins");
assert.deepEqual(P.pinned.pin, { kind: "sha", value: SHA });
assert.ok(P.pinned.flags.includes("hooks"));
assert.equal(P.pinned.url, "https://github.com/acme/pinned.git");
assert.ok(P.subdir.flags.includes("unpinned"), "no sha: unpinned");
assert.equal(P.subdir.repo.path, "plugins/sub");
assert.equal(P.subdir.repo.ref, "v1");
assert.equal(P.cmd.route, null);
assert.equal(P.cmd.why, "command-source");
assert.equal(levelOf(P.cmd.flags), "blocking");
assert.equal(P["plain-http"].route, null);
assert.equal(P["plain-http"].why, "non-https");
assert.equal(P.odd.why, "unsupported-source");
assert.equal(marketSource("claude-plugins-official", { owner: "anthropics", name: "claude-plugins-official" }), "official");
assert.equal(marketSource("claude-plugins-official", { owner: "someone", name: "claude-plugins-official" }), "known", "a reserved name from elsewhere is not official");
assert.equal(marketSource("claude-community", { owner: "anthropics", name: "claude-plugins-community" }), "community");
assert.equal(normalizeMarketplace({ plugins: "nope" }, { name: "m" }).items.length, 0);

// ── MCP ─────────────────────────────────────────────────────────────────────
const server = (o = {}, meta = { status: "active", updatedAt: "2026-03-04T05:06:07Z" }) => ({ server: { name: "io.example/demo-tool", title: "Demo", description: "Does \u001b[2Jthings", version: "1.4.0", repository: { url: "https://github.com/acme/demo-tool" }, ...o }, _meta: { "io.modelcontextprotocol.registry/official": meta } });
const npm = { registryType: "npm", identifier: "@acme/demo-mcp", version: "1.4.0", transport: { type: "stdio" },
  environmentVariables: [{ name: "DEMO_KEY", isSecret: true }, { name: "DEMO_MODE", isRequired: true }, { name: "bad name" }],
  packageArguments: [{ type: "named", name: "--port", value: "7" }] };
const v1 = mcpVariants({ packages: [npm] })[0];
assert.deepEqual(v1.config, { type: "stdio", command: "npx", args: ["-y", "@acme/demo-mcp@1.4.0", "--port", "7"], env: { DEMO_KEY: "", DEMO_MODE: "" } });
assert.deepEqual(v1.secrets, ["DEMO_KEY"]);
assert.equal(v1.needs, true, "a required, non secret variable without default needs the person");
assert.equal(v1.pinned, true);
const py = mcpVariants({ packages: [{ registryType: "pypi", identifier: "demo-mcp", version: "2.0", transport: { type: "stdio" }, runtimeArguments: [{ type: "named", name: "--from", value: "demo" }] }] })[0];
assert.deepEqual(py.config.args, ["--from", "demo", "demo-mcp==2.0"]);
const oci = mcpVariants({ packages: [{ registryType: "oci", identifier: "acme/demo", version: "3", transport: { type: "stdio" }, environmentVariables: [{ name: "TOKEN", isSecret: true }] }] })[0];
assert.deepEqual(oci.config.args, ["run", "-i", "--rm", "-e", "TOKEN", "acme/demo:3"]);
assert.equal(mcpVariants({ packages: [{ ...npm, version: "latest" }] })[0].pinned, false, "latest is not a pin");
assert.equal(mcpVariants({ packages: [{ ...npm, identifier: "x; rm -rf ~" }] }).length, 0, "a bad identifier is dropped");
assert.equal(mcpVariants({ packages: [{ ...npm, transport: { type: "sse" } }] }).length, 0, "a package that serves http: not in v1");
const rem = mcpVariants({ remotes: [{ type: "streamable-http", url: "https://mcp.example.test/mcp", headers: [{ name: "Authorization", isSecret: true }] },
  { type: "sse", url: "https://server.smithery.ai/x/sse" }, { type: "streamable-http", url: "https://h.example.test/u/{user}/mcp" }] });
assert.equal(rem.length, 2, "the dead Smithery host is left out");
assert.deepEqual(rem[0].config, { type: "http", url: "https://mcp.example.test/mcp", headers: { Authorization: "" } });
assert.equal(rem[0].host, "mcp.example.test");
assert.equal(rem[1].needs, true, "a {variable} in the URL needs the person");

const m1 = normalizeRegistry(server({ packages: [npm] }));
assert.equal(m1.id, "mcp:mcp-registry:io.example/demo-tool");
assert.equal(m1.name, "demo-tool");
assert.equal(m1.description, "Does things");
assert.deepEqual(m1.pin, { kind: "version", value: "1.4.0" });
assert.ok(m1.flags.includes("secrets:1") && m1.flags.includes("needs-args"));
assert.equal(m1.route, "kt-mcp");
assert.equal(m1.updatedAt, "2026-03-04T05:06:07.000Z");
assert.equal(m1.variants.length, 1);
const m2 = normalizeRegistry(server({ name: "io.example/remote-tool", remotes: [{ type: "streamable-http", url: "https://mcp.example.test/mcp" }] }));
assert.ok(m2.flags.includes("remote-mcp:mcp.example.test"));
assert.equal(m2.pin.kind, "remote");
assert.deepEqual(normalizeRegistry(server({ remotes: [{ type: "sse", url: "https://server.smithery.ai/a" }] })), { hidden: "dead-host" });
assert.deepEqual(normalizeRegistry(server({ packages: [npm] }, { status: "deprecated" })), { hidden: "inactive" });
assert.deepEqual(normalizeRegistry(server({ name: "bad name" })), { hidden: "bad-name" });
const m3 = normalizeRegistry(server({ packages: [{ ...npm, version: "" }] }));
assert.ok(m3.flags.includes("unpinned"));
assert.equal(normalizeRegistry(server({})).route, null, "nothing to run: no route");

// ── skills.sh ───────────────────────────────────────────────────────────────
const s1 = normalizeSkillsSh({ source: "acme/skills", skillId: "demo-skill", name: "demo-skill", installs: 1200 });
assert.equal(s1.id, "skill:skills-sh:acme/skills/demo-skill");
assert.deepEqual(s1.repo, { owner: "acme", name: "skills", path: "", ref: null });
assert.deepEqual(s1.popularity, { unit: "installs", n: 1200 });
assert.equal(s1.route, "kt-skills");
const s2 = normalizeSkillsSh({ source: "skills.example.test", skillId: "x", installs: 3 });
assert.equal(s2.route, null);
assert.equal(s2.why, "non-github");
assert.equal(normalizeSkillsSh({ source: "acme/skills", skillId: "bad id" }), null);

// ── herdr.dev ───────────────────────────────────────────────────────────────
const h = (o = {}) => ({ owner: "acme", repo: "herdr-demo", defaultBranch: "main", stars: 12, pushedAt: "2026-05-06T07:08:09Z", headCommit: SHA,
  path: "mods-src", name: "Demo panel", blurb: "A panel that schedules things.", modNames: ["demo-panel"], hasKeys: true,
  previewUrl: "https://assets.herdr.dev/previews/a.png", ...o });
const h1 = normalizeHerdr(h(), "mod");
assert.equal(h1.id, "herdr-mod:herdr-dev:acme/herdr-demo/mods-src");
assert.deepEqual(h1.mods, ["demo-panel"], "its mods' names, for « déjà installé »");
assert.deepEqual(normalizeHerdr(h({ modNames: ["ok-one", "../escape", "a b"] }), "mod").mods, ["ok-one"], "plain names only");
assert.deepEqual(h1.pin, { kind: "sha", value: SHA });
assert.ok(h1.flags.includes("keys-json"));
assert.ok(h1.tags.includes("automation"), "a scheduling blurb is tagged automation");
assert.equal(h1.route, "herdr-thread");
assert.equal(h1.preview, "https://assets.herdr.dev/previews/a.png");
assert.equal(normalizeHerdr(h({ previewUrl: "https://elsewhere.test/a.png" }), "mod").preview, null, "previews from assets.herdr.dev only");
const h2 = normalizeHerdr(h({ modNames: ["Bad.Name"] }), "mod");
assert.equal(h2.route, null);
assert.equal(h2.why, "bad-name");
assert.equal(normalizeHerdr(h(), "layout").why, "layout-readonly");
assert.equal(normalizeHerdr(h({ path: "../x" }), "mod"), null);
assert.equal(normalizeHerdr(h({ owner: "a b" }), "mod"), null);
assert.ok(normalizeHerdr(h({ headCommit: "main" }), "mod").flags.includes("unpinned"));

// ── aitmpl loops ────────────────────────────────────────────────────────────
const l1 = normalizeLoop({ name: "demo-loop", path: "eng/demo-loop.md", description: "Loops.", downloads: 9, keywords: ["ci"], skillspector: { recommendation: "SAFE" } });
assert.equal(l1.type, "loop");
assert.equal(l1.repo.path, "cli-tool/components/loops/eng/demo-loop.md");
assert.ok(l1.flags.includes("third-party-scan:SAFE"));
assert.equal(l1.route, "loop-session");
assert.equal(normalizeLoop({ name: "x", path: "../x.md" }), null);
assert.equal(normalizeLoop({ name: "x", path: "x.txt" }), null);

// ── risk ────────────────────────────────────────────────────────────────────
assert.equal(code("remote-mcp:h"), "remote-mcp");
assert.equal(levelOf([]), "info");
assert.equal(levelOf(["secrets:1"]), "info");
assert.equal(levelOf(["secrets:1", "remote-mcp:h"]), "warn");
assert.equal(levelOf(["unpinned", "hooks"]), "danger");
assert.equal(levelOf(["third-party-scan:DO_NOT_INSTALL"]), "warn");
assert.equal(levelOf(["third-party-scan:SAFE"]), "info");
assert.equal(unpinnedRun("npx", ["-y", "@acme/x@1.2.3"]), false);
assert.equal(unpinnedRun("npx", ["-y", "@acme/x"]), true);
assert.equal(unpinnedRun("npx", ["-y", "x@latest"]), true);
assert.equal(unpinnedRun("/usr/local/bin/bunx", ["x@2"]), false);
assert.equal(unpinnedRun("uvx", ["x==1.0"]), false);
assert.equal(unpinnedRun("uvx", ["x"]), true);
assert.equal(unpinnedRun("docker", ["run", "-i", "--rm", "-e", "K", "acme/x:1.2"]), false);
assert.equal(unpinnedRun("docker", ["run", "acme/x:latest"]), true);
assert.equal(unpinnedRun("docker", ["run", "acme/x"]), true);
assert.equal(unpinnedRun("node", ["server.js"]), null);

const scan = scanHerdr([
  { path: "mods/demo/main.js", text: 'import { exec } from "herdr";\nawait exec("git", []);\nconst r = await fetch(u);\nrun("layout.select", {});\nimport * as fs from "fs/promises";' },
  { path: "mods/demo/README.md", text: "exec( in prose is not code" },
  { path: "keys.json", text: "{}" }]);
assert.deepEqual(scan.flags.sort(), ["herdr-exec", "herdr-fetch", "herdr-focus", "herdr-fs", "keys-json"]);
assert.deepEqual(scan.findings.find((f) => f.code === "herdr-exec"), { code: "herdr-exec", file: "mods/demo/main.js", line: 2 });
assert.equal(scanHerdr([]).flags.length, 0);

assert.deepEqual(scanSkill([{ path: "s/SKILL.md" }, { path: "s/run", exec: true }]), ["scripts"]);
assert.deepEqual(scanSkill([{ path: "s/tool.py" }]), ["scripts"]);
assert.deepEqual(scanSkill([{ path: "s/notes", text: "#!/bin/sh\n" }]), ["scripts"]);
assert.deepEqual(scanSkill([{ path: "s/SKILL.md" }], { "allowed-tools": "Read, Bash(git:*)", hooks: "x" }), ["bash-tool", "skill-hooks"]);
assert.deepEqual(scanSkill([{ path: "s/SKILL.md" }], {}), []);

assert.deepEqual(pluginFlags({ hooks: ["Stop", "PreToolUse"], mods: ["m.ts"], mcp: ["a"], lsp: [] }, [{ command: "npx", args: ["-y", "x"] }]),
  ["hooks:Stop,PreToolUse", "mods", "plugin-mcp", "unpinned"]);
assert.deepEqual(pluginFlags({ hooks: [], mods: [], mcp: [], lsp: ["l"] }, [{ command: "npx", args: ["x@1.0.0"] }]), ["plugin-lsp"]);

const NOW = Date.parse("2026-11-19T00:00:00Z");
assert.deepEqual(repoFlags(null), ["license-unknown"]);
assert.deepEqual(repoFlags({ license: { spdx_id: "NOASSERTION" }, pushed_at: "2026-11-01T00:00:00Z" }, NOW), ["license-unknown"]);
assert.deepEqual(repoFlags({ license: { spdx_id: "MIT" }, archived: true, pushed_at: "2025-01-01T00:00:00Z" }, NOW), ["archived", "stale"]);
assert.deepEqual(repoFlags({ license: { spdx_id: "Apache-2.0" }, pushed_at: "2026-10-01T00:00:00Z" }, NOW), []);

// skills.sh ids differ from folders: the frontmatter name wins, then the folder, the shallowest first.
const cands = [
  { path: "node_modules/x/demo-skill/SKILL.md", name: "demo-skill" },
  { path: "skills/deep/demo-skill/SKILL.md", name: "other" },
  { path: "skills/best-practices/SKILL.md", name: "acme-best-practices" },
  { path: "SKILL.md", name: "root-skill" }];
assert.equal(findSkill(cands, "acme-best-practices"), "skills/best-practices");
assert.equal(findSkill(cands, "demo-skill"), "skills/deep/demo-skill", "by folder name, node_modules ignored");
assert.equal(findSkill(cands, "root-skill"), "");
assert.equal(findSkill(cands, "missing"), null);

const recipe = loopRecipe("# T\n\n```\n/loop 10m \"Build, test, fix.\"\n```\n\n```js\nx\n```", { interval: "10m", "stop-condition": "Green.", components: ["agent:a/b"] });
assert.deepEqual(recipe, { interval: "10m", stop: "Green.", components: ["agent:a/b"], prompt: '/loop 10m "Build, test, fix."' });
assert.equal(loopRecipe("no code", {}).prompt, null);

// ── plans ───────────────────────────────────────────────────────────────────
assert.deepEqual(plan(P.pinned).lines, ["claude plugin install pinned@acme-market --scope user --json"]);
assert.equal(plan(P.pinned, { addMarket: "anthropics/claude-plugins-community" }).lines[0], "claude plugin marketplace add anthropics/claude-plugins-community --json");
assert.equal(plan(P.pinned, { addMarket: "anthropics/claude-plugins-community" }).addMarket, "anthropics/claude-plugins-community", "the marketplace view comes first");
assert.equal(plan(P.pinned).addMarket, null);
assert.equal(plan(P.cmd).route, null);
assert.equal(plan(P.cmd).why, "command-source");
const mp = plan(m1, { variant: m1.variants[0] });
assert.equal(mp.lines[0], "claude mcp add demo-tool -s user -e DEMO_KEY=… -e DEMO_MODE=… -- npx -y @acme/demo-mcp@1.4.0 --port 7", "as kt-mcp's stdio form shows it");
assert.equal(mp.form, "stdio");
assert.equal(plan(m1, {}).why, "no-variant");
const mr = plan(m2, { variant: m2.variants[0] });
assert.equal(mr.lines[0], "claude mcp add --transport http -s user remote-tool https://mcp.example.test/mcp");
assert.equal(mr.form, "http");

// kt-mcp's forms (lot 4): public values only, never a secret; the command splits back as typed.
const f1 = mcpForm("demo-tool", m1.variants[0]);
assert.equal(f1.add, "stdio");
assert.deepEqual(f1.prefill, { name: "demo-tool", cmd: "npx -y @acme/demo-mcp@1.4.0 --port 7", env: ["DEMO_KEY", "DEMO_MODE"], scope: "user" });
assert.ok(!JSON.stringify(f1).includes("\"DEMO_KEY\":"), "env names only, no value field at all");
const f2 = mcpForm("remote", rem[0]);
assert.deepEqual(f2, { add: "http", prefill: { name: "remote", url: "https://mcp.example.test/mcp", transport: "http", headers: ["Authorization"], scope: "user" } });
assert.equal(mcpForm("bad name", m1.variants[0]), null, "a name kt-mcp refuses");
assert.equal(mcpForm("x", null), null);
const { splitArgs } = await import("../kt-mcp/mcp.js");
const odd = { config: { type: "stdio", command: "uvx", args: ["--from", "a b", "it's", "pkg==1.0", "~/x"] } };
assert.deepEqual(splitArgs(mcpForm("odd", odd).prefill.cmd), ["uvx", "--from", "a b", "it's", "pkg==1.0", "~/x"], "kt-mcp's splitArgs reads back what mcpForm wrote");
assert.deepEqual(splitArgs(f1.prefill.cmd), ["npx", ...m1.variants[0].config.args]);
const sp = plan(s1, { skillPath: "skills/demo" });
assert.equal(sp.src, "acme/skills/skills/demo");
assert.equal(sp.name, "demo");
// kt-skills' « Depuis GitHub » (lot 5): what its github.js and name rule accept, the inspected commit.
assert.deepEqual(skillForm(sp, SHA), { add: "github", prefill: { src: "acme/skills/skills/demo", name: "demo" }, expect: SHA });
assert.equal(skillForm(sp, "main").expect, null, "only a full sha is passed as the inspected commit");
assert.equal(skillForm({ src: "acme/skills/my skill", name: "my skill" }, SHA), null, "a path kt-skills refuses: no Installer");
assert.equal(skillForm({ src: "acme/skills/x", name: "-bad" }, SHA), null);
assert.equal(skillForm({ src: "acme/skills/a/../b", name: "b" }, SHA), null);
const { githubSource } = await import("../kt-skills/github.js");
assert.equal(githubSource(skillForm(sp, SHA).prefill.src).path, "skills/demo", "kt-skills reads the source as written");
assert.deepEqual(sp.writes, ["~/.agents/skills/demo", "~/.claude/skills/demo"]);
assert.equal(plan(s1, { skillPath: null }).why, "no-skill-md");
assert.deepEqual(plan(h1, { mods: ["demo-panel"] }).writes, ["~/.config/herdr-app/mods/demo-panel"]);
assert.equal(plan(normalizeHerdr(h(), "layout")).why, "layout-readonly");
assert.deepEqual(plan(l1, { prompt: "/loop 5m x\nmore" }).lines, ["/loop 5m x"]);

// ── search ──────────────────────────────────────────────────────────────────
assert.deepEqual(tokens("  Demo  TOOL "), ["demo", "tool"]);
const pool = dedupe([[m1, m2, s1, s2, h1, l1, P["local-one"], P.pinned], [m1]]);
assert.equal(pool.length, 8, "one per id");
assert.ok(typeMatch(P["local-one"], ["loop"]), "a loop-tagged plugin shows under Loops");
assert.ok(typeMatch(h1, ["automation"]));
assert.ok(!typeMatch(h1, ["plugin"]));

const all = query(pool, {});
assert.equal(all.total, 8);
assert.equal(all.counts.byType.mcp, 2);
assert.equal(all.counts.byType.loop, 2, "the aitmpl loop and the loop-tagged plugin");
assert.equal(all.counts.bySource["mcp-registry"], 2);
assert.ok(all.rows.every((r) => !("hay" in r) && !("variants" in r)), "rows are compact");
assert.equal(query([P.cmd], {}).rows[0].route, null, "a blocked item is listed, without a route");
assert.equal(query([P.cmd], {}).rows[0].level, "blocking");

const demo = query(pool, { q: "demo" });
assert.ok(demo.rows.every((r) => `${r.name} ${r.title} ${r.description}`.toLowerCase().includes("demo") || r.repo?.includes("demo") || r.author?.toLowerCase().includes("demo")));
assert.equal(query(pool, { q: "demo zzz" }).total, 0, "every word must match");
assert.equal(query(pool, { q: "demo-tool" }).rows[0].id, m1.id, "the exact name comes first");

const onlyMcp = query(pool, { types: ["mcp"] });
assert.equal(onlyMcp.total, 2);
assert.equal(onlyMcp.counts.byType.skill, 2, "type counts ignore the type filter");
assert.equal(onlyMcp.counts.bySource["skills-sh"], 0, "source counts follow the type filter");
assert.equal(query(pool, { sources: ["herdr-dev"] }).counts.bySource["skills-sh"], 2, "source counts ignore the source filter");

// Popularity is ranked within its unit: 12 stars (only stars) ties with 1 200 installs (top installs).
const popular = query(pool, { sort: "popular" }).rows.map((r) => r.id);
assert.ok(popular.indexOf(h1.id) < popular.indexOf(m1.id), "an item with a popularity before one without");
assert.ok(popular.indexOf(s1.id) < popular.indexOf(s2.id), "1 200 installs before 3");
const recent = query(pool, { sort: "recent" }).rows.map((r) => r.id);
assert.equal(recent[0], h1.id, "the latest push first");
assert.equal(query(pool, { limit: 500 }).rows.length, 8);
assert.equal(query(pool, { offset: 6, limit: 60 }).rows.length, 2);
const many = Array.from({ length: 130 }, (_, i) => normalizeSkillsSh({ source: "acme/skills", skillId: `s${i}`, installs: i }));
assert.equal(query(many, { limit: 500 }).rows.length, 60, "never more than 60 rows");
assert.equal(query(many, { sort: "popular" }).rows[0].name, "s129");

// ── the other mods' pure modules market.mjs imports (not copied): their shapes, as it uses them ──
const { components } = await import("../kt-plugins/plugins.js");
const { frontmatter } = await import("../kt-skills/frontmatter.js");
assert.equal(typeof components, "function", "kt-plugins/plugins.js still exports components()");
assert.equal(typeof frontmatter, "function", "kt-skills/frontmatter.js still exports frontmatter()");
const comps = components("/p", ["/p/skills/demo/SKILL.md", "/p/commands/sub/go.md", "/p/agents/helper.md", "/p/README.md"],
  { hooks: [{ hooks: { Stop: [], PreToolUse: [] } }, { modules: ["./hooks/m.ts"] }], mcp: [{ mcpServers: { srv: { command: "npx" } } }], lsp: [{ lspServers: { ls: {} } }] });
assert.deepEqual(comps, { skills: ["demo"], commands: ["sub:go"], agents: ["helper"], hooks: ["Stop", "PreToolUse"], mods: ["hooks/m.ts"], mcp: ["srv"], lsp: ["ls"] },
  "components(dir, files, { hooks, mcp, lsp }) -> { skills, commands, agents, hooks, mods, mcp, lsp }");
assert.deepEqual(pluginFlags(comps, [{ command: "npx", args: ["-y", "x"] }]), ["hooks:Stop,PreToolUse", "mods", "plugin-mcp", "plugin-lsp", "unpinned"]);
const fm = frontmatter("---\nname: demo-skill\nallowed-tools: Read, Bash\nhooks: x\n---\n\n# Demo\n");
assert.equal(fm.meta?.name, "demo-skill", "frontmatter(text) -> { meta, body }");
assert.ok(String(fm.body).includes("# Demo"));
assert.deepEqual(scanSkill([{ path: "s/SKILL.md" }], fm.meta), ["bash-tool", "skill-hooks"]);
assert.equal(findSkill([{ path: "skills/x/SKILL.md", name: String(frontmatter("---\nname: other-id\n---\n").meta.name) }], "other-id"), "skills/x");
const loopFm = frontmatter("---\nname: l\ninterval: 10m\nstop-condition: Green.\ncomponents: [agent:a/b]\n---\n\n```\n/loop 10m \"go\"\n```\n");
assert.deepEqual(loopRecipe(loopFm.body, loopFm.meta), { interval: "10m", stop: "Green.", components: ["agent:a/b"], prompt: '/loop 10m "go"' });

assert.ok(LIVE.has("mcp-registry") && LIVE.has("skills-sh") && !LIVE.has("herdr-dev"));
assert.equal(SOURCES.length, 7);
assert.ok(TYPES.includes("automation"));

// ── chips and pins ──────────────────────────────────────────────────────────
// A live type's count: none while its source wasn't asked (no words, or filtered out), 0 once asked.
const ans = (mcp, skills) => ({ counts: { byType: { plugin: 4, mcp: 0, skill: 0 } }, sources: { "mcp-registry": mcp, "skills-sh": skills } });
const notAsked = ans({ state: "needs-query" }, { state: "off" });
assert.equal(typeCount(notAsked, "mcp"), undefined, "registry not asked: no number");
assert.equal(typeCount(notAsked, "skill"), undefined, "skills.sh not asked: no number");
assert.equal(typeCount(notAsked, "plugin"), 4, "a catalog type keeps its count");
assert.equal(typeCount(ans({ state: "cache" }, { state: "live" }), "mcp"), 0, "asked and nothing found: 0");
assert.equal(typeCount(ans({ state: "error", error: "timeout" }, { state: "off" }), "mcp"), 0);
assert.equal(typeCount(null, "mcp"), undefined, "no answer yet");
// The pin: the catalog's first; a catalog pinning nothing, the inspection's commit; else the kind.
assert.deepEqual(pinOf({ pinKind: "sha", pin: "900b4f258f5c" }, { head: SHA }), { at: "900b4f258f5c" });
assert.deepEqual(pinOf({ pinKind: "version", pin: "1.2.3" }, { head: SHA }), { at: "1.2.3" }, "a version stays the pin");
assert.deepEqual(pinOf({ pinKind: "none" }, { head: SHA }), { at: SHA.slice(0, 12) }, "unpinned, inspected: its commit");
assert.deepEqual(pinOf({ pinKind: "none" }, null), { kind: "none" }, "unpinned, not inspected");
assert.deepEqual(pinOf({ pinKind: "none" }, { pending: true }), { kind: "none" });
assert.deepEqual(pinOf({ pinKind: "market" }, { head: SHA }), { kind: "market" }, "a local clone isn't pinned by a commit");
assert.deepEqual(pinOf({ pinKind: "remote" }, { head: SHA }), { kind: "remote" });

console.log("kt-market model: ok");
