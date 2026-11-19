// bun ~/.config/herdr-app/mods/kt-market/installed.check.mjs: installed.js on invented fixtures: which
// catalog items this Mac has, and which have an update, matched as installed.mjs reads them.
import assert from "node:assert/strict";
import { pluginState, mcpState, skillState, modState, states, repoOfRemote, serverFacts, urlKey, knownOf } from "./installed.js";
import { normalizeMarketplace, normalizeRegistry, normalizeSkillsSh } from "./model.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";

// ── plugins: claude plugin list --json ──────────────────────────────────────
const { items: [semv, pinned, fresh] } = normalizeMarketplace({ plugins: [
  { name: "semv", source: "./plugins/semv", version: "1.3.0" },
  { name: "pinned", source: { source: "url", url: "https://github.com/acme/pinned.git", sha: SHA } },
  { name: "fresh", source: "./plugins/fresh", version: "2.0.0" },
] }, { name: "acme-market", repo: { owner: "acme", name: "market" }, head: SHA });
const plugins = [
  { id: "semv@acme-market", version: "1.2.0", scope: "project", enabled: false },
  { id: "semv@acme-market", version: "1.2.0", scope: "user", enabled: true },
  { id: "pinned@acme-market", version: "fedcba987654", scope: "user", enabled: true },
  { id: "fresh@acme-market", version: "2.0.0", scope: "user", enabled: true },
  { id: "other@elsewhere", version: "9.9.9", scope: "user", enabled: true }];
assert.deepEqual(pluginState(semv, plugins), { state: "update", local: { version: "1.2.0", scope: "user", enabled: true, scopes: 2 }, available: "1.3.0" }, "the user scope's row, a newer semver");
assert.equal(pluginState(pinned, plugins).state, "installed", "another commit can't be ordered: not called an update (kt-plugins' « differs »)");
assert.equal(pluginState(pinned, plugins).available, SHA.slice(0, 12));
assert.equal(pluginState(fresh, plugins).state, "installed");
assert.equal(pluginState(fresh, []), null);

// ── MCP: ~/.claude.json's servers (names, commands, URLs; never a value) ───────
const srv = (o = {}) => ({ server: { name: "io.example/demo-tool", version: "1.4.0", ...o }, _meta: { "io.modelcontextprotocol.registry/official": { status: "active" } } });
const npm = { registryType: "npm", identifier: "@acme/demo-mcp", version: "1.4.0", transport: { type: "stdio" } };
const m = normalizeRegistry(srv({ packages: [npm], remotes: [{ type: "streamable-http", url: "https://mcp.example.test/mcp" }] }));
// A server as installed.mjs keeps it: its name and scope, then serverFacts() of its config, against
// what the catalog publishes (knownOf).
const K = knownOf([m, normalizeRegistry(srv({ name: "io.example/py-tool", version: "2.0.0", packages: [{ registryType: "pypi", identifier: "py-tool", version: "2.0.0", transport: { type: "stdio" } }] })),
  normalizeRegistry(srv({ name: "io.example/img", version: "3.2", packages: [{ registryType: "oci", identifier: "acme/img", version: "3.2", transport: { type: "stdio" } }] }))]);
assert.deepEqual([...K.pkgs].sort(), ["@acme/demo-mcp", "acme/img", "py-tool"]);
assert.deepEqual([...K.urls], ["https://mcp.example.test/mcp"]);
const S = (name, scope, cfg) => ({ name, scope, ...serverFacts(cfg, K) });
assert.deepEqual(mcpState(m, [S("demo", "user", { command: "npx", args: ["-y", "@acme/demo-mcp@1.2.0"] })]),
  { state: "update", local: { name: "demo", scope: "user", version: "1.2.0" }, available: "1.4.0" }, "an older pinned version runs");
assert.equal(mcpState(m, [S("x", "user", { command: "/opt/bin/bunx", args: ["-y", "@acme/demo-mcp@1.4.0"] })]).state, "installed", "any runner, the same version");
assert.deepEqual(mcpState(m, [S("x", "local", { command: "npx", args: ["-y", "@acme/demo-mcp"] })]).local, { name: "x", scope: "local", version: null }, "unpinned: installed, version unknown");
assert.equal(mcpState(m, [S("y", "user", { url: "https://u:p@mcp.example.test/mcp/?k=v#f" })]).state, "installed", "the remote URL: origin and path");
assert.equal(mcpState(m, [S("z", "user", { command: "npx", args: ["-y", "@acme/demo-mcp-extra@1.0.0"] })]), null, "another package with the same prefix");
assert.equal(mcpState(m, []), null);
const py = normalizeRegistry(srv({ name: "io.example/py-tool", version: "2.0.0", packages: [{ registryType: "pypi", identifier: "py-tool", version: "2.0.0", transport: { type: "stdio" } }] }));
assert.equal(mcpState(py, [S("p", "user", { command: "uvx", args: ["py-tool==1.9.0"] })]).state, "update");
assert.equal(mcpState(py, [S("p", "user", { command: "uvx", args: ["--from", "py-tool==2.0.0", "py-tool-cli"] })]).state, "installed", "uvx --from");

// serverFacts: the runner, a catalog package and its plain version, a catalog URL. Nothing else.
assert.deepEqual(serverFacts({ command: "npx", args: ["-y", "--registry", "https://r.test", "@acme/demo-mcp@1.4.0", "--port", "7"] }, K),
  { command: "npx", pkg: "@acme/demo-mcp", version: "1.4.0", url: null }, "an option's value is not the package");
assert.deepEqual(serverFacts({ command: "docker", args: ["run", "-i", "--rm", "-e", "TOKEN", "acme/img:3.2"] }, K), { command: "docker", pkg: "acme/img", version: "3.2", url: null });
assert.deepEqual(serverFacts({ command: "node", args: ["/srv/server.js", "--key", "x"] }, K), { command: "node", pkg: null, version: null, url: null }, "not a runner: no package kept");
assert.deepEqual(serverFacts({ command: "npx", args: ["-y", "unknown-pkg@1.0.0"] }, K), { command: "npx", pkg: null, version: null, url: null }, "a package the catalog doesn't publish: not kept");
assert.equal(serverFacts({ command: "npx", args: ["@acme/demo-mcp@not a version"] }, K).version, null, "a version that isn't one is not kept");
assert.equal(serverFacts({ url: "https://mcp.example.test/u/SECRET/mcp" }, K).url, null, "a token in a URL's path: not a catalog URL, not kept");
// The guard: a secret anywhere in the args (even before the package), the env, the headers or the URL
// never comes out.
const leaky = { command: "npx", args: ["-y", "--api-key", "SECRET", "--token=SECRET", "@acme/demo-mcp@1.4.0", "SECRET"],
  env: { API_KEY: "SECRET" }, headers: { Authorization: "Bearer SECRET" }, url: "https://user:SECRET@mcp.example.test/mcp?token=SECRET#SECRET" };
const facts = serverFacts(leaky, K);
assert.ok(!JSON.stringify(facts).includes("SECRET"), "no SECRET in what the scan keeps");
assert.deepEqual(facts, { command: "npx", pkg: "@acme/demo-mcp", version: "1.4.0", url: "https://mcp.example.test/mcp" });
const leakOut = states([m], { servers: [{ name: "demo", scope: "user", ...facts }] });
assert.ok(!JSON.stringify(leakOut).includes("SECRET"), "no SECRET in the states either");
assert.equal(leakOut[m.id].state, "installed");
// The lead's case: secrets in args and in every part of a URL; the match by URL still works, and no
// SECRET reaches what installed.mjs prints (states) nor what it keeps of the server.
const hx = normalizeRegistry(srv({ name: "io.example/hx", version: "1.0.0", remotes: [{ type: "streamable-http", url: "https://h.example/mcp" }] }));
const Kh = knownOf([hx]);
const hs = { name: "hx", scope: "user", ...serverFacts({ command: "npx", args: ["--api-key", "SECRET1", "--token=SECRET2"], url: "https://u:SECRET3@h.example/mcp?key=SECRET4#SECRET5" }, Kh) };
assert.ok(!JSON.stringify(hs).includes("SECRET"), "nothing of the args nor of the URL's userinfo, query or fragment is kept");
const hOut = states([hx], { servers: [hs] });
assert.equal(hOut[hx.id]?.state, "installed", "the reduced URL still matches the catalog's");
assert.ok(!JSON.stringify(hOut).includes("SECRET") && !JSON.stringify(hOut).includes("h.example"), "the states carry no URL at all");
assert.equal(urlKey("https://a.test/p?x=1#y"), "https://a.test/p");
assert.equal(urlKey("file:///etc/passwd"), null);
assert.equal(urlKey("not a url"), null);

// ── skills: ~/.claude/skills' links into their git clones ─────────────────────
const sk = normalizeSkillsSh({ source: "acme/skills", skillId: "acme-best-practices", installs: 3 });
const skills = [
  { name: "best-practices", repo: "acme/skills", path: "skills/best-practices", skill: "acme-best-practices", head: SHA },
  { name: "other", repo: "acme/other", path: "", skill: "other", head: SHA }];
assert.deepEqual(skillState(sk, skills), { state: "installed", local: { name: "best-practices", path: "skills/best-practices", head: SHA } }, "by its SKILL.md's name");
assert.equal(skillState(normalizeSkillsSh({ source: "ACME/Skills", skillId: "best-practices", installs: 1 }), skills).state, "installed", "by folder, repo case-insensitive");
assert.equal(skillState(normalizeSkillsSh({ source: "acme/elsewhere", skillId: "acme-best-practices", installs: 1 }), skills), null, "the same name in another repo is not it");

// ── herdr mods: the mods' folders ────────────────────────────────────────────
assert.deepEqual(modState({ mods: ["demo-panel", "demo-extra"] }, ["kt-keys", "demo-panel"]), { state: "present", local: { mods: ["demo-panel"] } },
  "a folder of that name: « present », not « installed » (a name proves nothing)");
assert.equal(modState({ mods: [] }, ["demo-panel"]), null);
assert.equal(modState({}, ["demo-panel"]), null, "an item without its mods' names: unknown, never « installed »");

// ── all at once ──────────────────────────────────────────────────────────────
const all = states([semv, pinned, fresh, m, sk, { id: "herdr-mod:herdr-dev:acme/x", type: "herdr-mod", mods: ["demo-panel"] }],
  { plugins, servers: [S("demo", "user", { command: "npx", args: ["-y", "@acme/demo-mcp@1.4.0"] })], skills, mods: ["demo-panel"] });
assert.deepEqual(Object.keys(all).sort(), [fresh.id, m.id, "herdr-mod:herdr-dev:acme/x", pinned.id, semv.id, sk.id].sort());
assert.equal(all[semv.id].state, "update");
assert.equal(all[m.id].state, "installed");

assert.equal(repoOfRemote("https://github.com/acme/skills.git"), "acme/skills");
assert.equal(repoOfRemote("git@github.com:acme/skills.git"), "acme/skills");
assert.equal(repoOfRemote("https://gitlab.test/acme/skills"), null);

console.log("kt-market installed: ok");
