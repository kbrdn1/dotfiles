// node mods/kt-mcp/mcp.test.mjs: masking, transports and `claude mcp list` states.
import assert from "node:assert/strict";
import { server, parseList, maskArgs, maskUrl, jsonc, MASK } from "./mcp.js";

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

console.log("kt-mcp: ok");
