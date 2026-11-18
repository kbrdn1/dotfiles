// node mods/kt-mcp/mcp.test.mjs: masking, transports and `claude mcp list` states.
import assert from "node:assert/strict";
import { server, parseList, maskArgs, maskUrl, jsonc, maskGet, parseGet, splitArgs, shq, maskJson, MASK } from "./mcp.js";

// Secrets never survive: flag values, NAME=value, headers, URL queries/userinfo, tokens.
const secret = "sk-live_4f9a8b7c6d5e4f3a2b1c";
assert.deepEqual(
  maskArgs(["-y", "pkg@latest", "--api-key", "abc", "--token=xyz", "TAVILY_API_KEY=abc", "Authorization: Bearer abc", secret, "--port=3000"]),
  ["-y", "pkg@latest", "--api-key", MASK, `--token=${MASK}`, `TAVILY_API_KEY=${MASK}`, `Authorization: ${MASK}`, MASK, "--port=3000"],
);
assert.equal(maskUrl("https://u:p@mcp.x.com/mcp/?tavilyApiKey=abc&x=1#frag"), `https://mcp.x.com/mcp/?tavilyApiKey=${MASK}&x=${MASK}`);
assert.equal(maskUrl("https://mcp.x.com/a1b2c3d4e5f6a7b8c9d0e1f2a3/sse"), `https://mcp.x.com/${MASK}/sse`);
// Package names stay readable.
assert.deepEqual(maskArgs(["-y", "@modelcontextprotocol/server-sequential-thinking"]), ["-y", "@modelcontextprotocol/server-sequential-thinking"]);

// Every provider's shape -> one row; env/header values are dropped, names kept.
const c = server("claude", "user", "tavily", { type: "stdio", command: "npx", args: ["-y", "tavily-mcp"], env: { TAVILY_API_KEY: "v" } }, "/f");
assert.equal(c.transport, "stdio");
assert.equal(c.target, "npx -y tavily-mcp");
assert.deepEqual(c.env, ["TAVILY_API_KEY"]);
assert.ok(!JSON.stringify(c).includes('"v"'));
assert.equal(server("claude", "user", "x", { type: "http", url: "https://a.b/mcp", headers: { Authorization: "Bearer t" } }).headers[0], "Authorization");
assert.equal(server("cursor", "user", "x", { url: "https://a.b/sse", type: "sse" }).transport, "sse");
assert.equal(server("codex", "user", "x", { url: "https://a.b/mcp" }).transport, "http");
const o = server("opencode", "user", "x", { type: "local", command: ["npx", "-y", "pkg"], environment: { K: "v" }, enabled: false });
assert.deepEqual([o.transport, o.target, o.env, o.disabled], ["stdio", "npx -y pkg", ["K"], true]);
assert.equal(server("opencode", "user", "x", { type: "remote", url: "https://a.b" }).transport, "http");
assert.equal(server("claude", "plugin", "ctx", { command: "x" }, "/p", "plugin:context7:ctx").listName, "plugin:context7:ctx");

// `claude mcp list`: name before the first ": ", state after the last " - ".
assert.deepEqual(parseList(`Checking MCP server health...

context7: npx -y @upstash/context7-mcp - ✓ Connected
excalidraw: https://mcp.excalidraw.com/mcp (HTTP) - ✗ Failed to connect
sentry: https://mcp.sentry.dev/mcp (HTTP) - ! Needs authentication
plugin:context7:context7: npx -y a - b - ✓ Connected
claude.ai Gmail: https://gmail.mcp.claude.com/mcp - ? Pending
`), { context7: "connected", excalidraw: "failed", sentry: "auth", "plugin:context7:context7": "connected", "claude.ai Gmail": "unknown" });

assert.deepEqual(jsonc('{ // c\n "mcp": { "a": { "url": "http://x//y" }, }, /* b */ }'), { mcp: { a: { url: "http://x//y" } } });

// The detail's config: masked values, env and header names only.
assert.deepEqual(c.config, { type: "stdio", command: "npx", args: ["-y", "tavily-mcp"], env: { TAVILY_API_KEY: MASK } });
assert.deepEqual(server("claude", "user", "x", { type: "http", url: "https://a.b/mcp?k=v", headers: { Authorization: "Bearer t" } }).config,
  { type: "http", url: `https://a.b/mcp?k=${MASK}`, headers: { Authorization: MASK } });

// `claude mcp get`: env and header values never survive; the state comes from Status.
const got = `tavily:
  Scope: User config (available in all your projects)
  Status: ✔ Connected
  Type: stdio
  Command: npx
  Args: -y tavily-mcp --api-key abc123
  Environment:
    TAVILY_API_KEY=tvly-short
    PLAIN=x
  URL: https://u:p@mcp.x.com/mcp?token=abc
  Headers:
    Authorization: Bearer sk-abc
    X-Team: kbrdn

To remove this server, run: claude mcp remove tavily -s user`;
const m = maskGet(got);
for (const s of ["tvly-short", "=x", "abc123", "u:p@", "token=abc", "sk-abc", "kbrdn"]) assert.ok(!m.includes(s), s);
assert.ok(m.includes(`TAVILY_API_KEY=${MASK}`) && m.includes(`Authorization: ${MASK}`) && m.includes("Status: ✔ Connected"));
assert.equal(parseGet(got), "connected");
assert.equal(parseGet("x:\n  Status: ! Needs authentication"), "auth");
assert.equal(parseGet("x:\n  Status: ✗ Failed to connect"), "failed");
assert.equal(parseGet('No MCP server named "x".'), "unknown");

// + Ajouter: a typed command line, shell-split; arguments quoted back; a pasted config masked.
assert.deepEqual(splitArgs(`npx -y "@a/b c" --dir='/x y' a\\ b ""`), ["npx", "-y", "@a/b c", "--dir=/x y", "a b", ""]);
assert.deepEqual([shq("a/b"), shq("x y"), shq("it's")], ["a/b", "'x y'", "'it'\\''s'"]);
const j = maskJson({ type: "stdio", command: "npx", args: ["-y", "pkg", "--token", "abc"], env: { KEY: "v" },
  url: "https://h/x?k=v", headers: { Authorization: "Bearer t" }, apiKey: "plain", note: "sk-live_abcdefgh12345" });
assert.deepEqual(j, { type: "stdio", command: "npx", args: ["-y", "pkg", "--token", MASK], env: { KEY: MASK },
  url: `https://h/x?k=${MASK}`, headers: { Authorization: MASK }, apiKey: MASK, note: MASK });

console.log("kt-mcp: ok");
