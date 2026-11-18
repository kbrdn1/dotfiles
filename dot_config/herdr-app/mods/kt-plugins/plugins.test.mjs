// node mods/kt-plugins/plugins.test.mjs: versions, origins, components, CLI arguments.
import assert from "node:assert/strict";
import { newer, offered, updateState, origin, webOf, components, summary, under, cli, jsonOut, why, isSha, isRepo, isGitUrl, isPluginId, split } from "./plugins.js";

// Versions: semver only; a sha is never "newer" (it differs, unordered).
assert.equal(newer("1.0.10", "1.0.9"), true);
assert.equal(newer("1.0.0", "1.0.0-beta.2"), true);
assert.equal(newer("1.0.0-beta.10", "1.0.0-beta.9"), true);
assert.equal(newer("0.9.9", "1.0.0"), false);
assert.equal(newer("1.0.1", "3ea32df27be7"), false);
assert.equal(updateState("4.8.4", "4.9.0"), "update");
assert.equal(updateState("4.8.4", "4.8.4"), null);
assert.equal(updateState("4.9.0", "4.8.4"), null);
assert.equal(updateState("3ea32df27be7", "1.0.1"), "differs");
assert.equal(updateState("0.7.4", null), null);
assert.ok(isSha("3ea32df27be7") && !isSha("1.0.0"));

// Offered: the source's plugin.json wins over the catalog; an object source's pinned sha last.
assert.equal(offered({ version: "1.0.0", source: "./p" }, { version: "1.1.0" }), "1.1.0");
assert.equal(offered({ version: "1.0.0", source: "./p" }, {}), "1.0.0");
assert.equal(offered({ source: { source: "git-subdir", sha: "deae744bc0cbf6034b4b" } }, null), "deae744bc0cb");
assert.equal(offered({ source: "./p" }, {}), null);

// Origins.
assert.deepEqual(origin({ source: "github", repo: "o/r" }), { kind: "github", label: "o/r", url: "https://github.com/o/r" });
assert.equal(origin({ source: "git", url: "https://github.com/davila7/claude-code-templates.git" }).url, "https://github.com/davila7/claude-code-templates");
assert.deepEqual(origin({ source: "directory", path: "/p/x" }), { kind: "directory", label: "/p/x", url: null });
const gh = origin({ source: "github", repo: "anthropics/claude-plugins-official" });
assert.equal(webOf({}, { source: "./plugins/code-review" }, gh), "https://github.com/anthropics/claude-plugins-official/tree/HEAD/plugins/code-review");
assert.equal(webOf({ repository: "https://github.com/kbrdn1/claude-flow" }, null, null), "https://github.com/kbrdn1/claude-flow");
assert.equal(webOf({}, { source: { source: "git-subdir", url: "https://github.com/stripe/ai.git", path: "providers/claude/plugin", ref: "main" } }, gh),
  "https://github.com/stripe/ai/tree/main/providers/claude/plugin");
assert.equal(webOf({}, { source: "./" }, origin({ source: "directory", path: "/x" })), null);

// Components: ponytail-like (6 skills, hooks through plugin.json), a function-hook mod, an LSP plugin.
const d = "/c/ponytail/4.8.4";
const files = [`${d}/skills/a/SKILL.md`, `${d}/skills/b/SKILL.md`, `${d}/skills/b/ref/SKILL.md`, `${d}/commands/go.md`, `${d}/commands/me/loop.md`, `${d}/agents/r.md`, "/other/skills/z/SKILL.md"];
const c = components(d, files, { hooks: [{ hooks: { SessionStart: [], UserPromptSubmit: [] } }, { hooks: { SessionStart: [], SubagentStart: [] } }], mcp: [{ mcpServers: { ctx: {} } }, { ctx: {}, gh: {} }] });
assert.deepEqual(c.skills, ["a", "b"]);
assert.deepEqual(c.commands, ["go", "me:loop"]);
assert.deepEqual(c.agents, ["r"]);
assert.deepEqual(c.hooks, ["SessionStart", "UserPromptSubmit", "SubagentStart"]);
assert.deepEqual(c.mcp, ["ctx", "gh"]);
assert.deepEqual(components("/h", [], { hooks: [{ modules: ["./register.ts"] }] }).mods, ["register.ts"]);
assert.deepEqual(components("/h", [], { lsp: [{ gopls: { command: "gopls" } }] }).lsp, ["gopls"]);
assert.equal(summary(c), "2 skills · 2 commandes · 1 agent · 3 hooks · 2 MCP");
assert.equal(summary(components("/h", [])), "");
assert.equal(under("/p", "./hooks/hook.json"), "/p/hooks/hook.json");
assert.equal(under("/p", "./"), "/p");

// CLI arguments: ids, scopes, flags pass; anything a shell could read as more doesn't.
assert.deepEqual(cli(["plugin", "enable", "php-lsp@claude-plugins-official", "--scope", "project", "--json"]),
  ["plugin", "enable", "php-lsp@claude-plugins-official", "--scope", "project", "--json"]);
assert.throws(() => cli(["plugin", "enable", "x; rm -rf ~"]));
assert.throws(() => cli(["plugin", "enable", "$(id)"]));
assert.throws(() => cli(["plugin", "enable", "-"]));
assert.deepEqual(cli(["plugin", "marketplace", "add", { path: "/Users/k/My Plugins/x" }]), ["plugin", "marketplace", "add", "/Users/k/My Plugins/x"]);
assert.deepEqual(cli([{ url: "https://github.com/o/r.git" }, { url: "git@github.com:o/r.git" }]), ["https://github.com/o/r.git", "git@github.com:o/r.git"]);
assert.throws(() => cli([{ path: "relative/x" }]));
assert.throws(() => cli([{ url: "https://x y" }]));
assert.ok(isRepo("o/r") && !isRepo("o/r/x") && isGitUrl("git@github.com:o/r.git") && isPluginId("a-b@m") && !isPluginId("a b@m"));
assert.deepEqual(split("php-lsp@claude-plugins-official"), { name: "php-lsp", market: "claude-plugins-official" });

// The login shell's noise around the JSON, and the line that says why.
assert.deepEqual(jsonOut("motd\n[\n {\"id\": \"a@b\"}\n]\nbye"), [{ id: "a@b" }]);
assert.equal(jsonOut("nothing here"), null);
assert.equal(why("gitstatus failed\n{\"ok\":false,\"error\":\"Plugin x not found\"}"), "Plugin x not found");
assert.equal(why("zle: no\nError: boom\n"), "Error: boom");

console.log("plugins.test.mjs: ok");
