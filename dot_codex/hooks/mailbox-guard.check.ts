#!/usr/bin/env bun
// Check de mailbox-guard.ts : chaque cas passe par le vrai hook, sur stdin, comme Codex l'appelle.
// Les chemins sont des canaris : aucun fichier de la vraie boîte aux lettres n'est lu ni créé.
const HOOK = `${import.meta.dir}/mailbox-guard.ts`;
const cases: [string, unknown, boolean][] = [
  ["apply_patch vers la boîte", { tool_name: "apply_patch", cwd: "/tmp", tool_input: { command: "*** Begin Patch\n*** Add File: /Users/kbrdn1/.claude/cache/herdr/t9.decision.json\n+{}\n*** End Patch" } }, true],
  ["apply_patch ailleurs", { tool_name: "apply_patch", cwd: "/tmp", tool_input: { command: "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-a\n+b\n*** End Patch" } }, false],
  ["MCP qui lit par chemin relatif", { tool_name: "mcp__serena__read_file", cwd: "/Users/kbrdn1/.claude/cache/herdr", tool_input: { relative_path: "t9.saytoken.json" } }, true],
  ["MCP qui lit par glob", { tool_name: "mcp__fs__read", cwd: "/tmp", tool_input: { path: "~/.claude/cache/herdr/*.json" } }, true],
  ["MCP sans rapport", { tool_name: "mcp__context7__query-docs", cwd: "/tmp", tool_input: { query: "say.json format" } }, false],
  ["Bash laissé à no-shell-write", { tool_name: "Bash", cwd: "/tmp", tool_input: { command: "cat ~/.claude/cache/herdr/t9.ask.json" } }, false],
];
let fail = 0;
for (const [name, input, deny] of cases) {
  const p = Bun.spawnSync(["bun", HOOK], { stdin: new TextEncoder().encode(JSON.stringify(input)) });
  const out = p.stdout.toString();
  const got = out.includes('"permissionDecision":"deny"');
  if (got !== deny || p.exitCode !== 0) { fail++; console.log(`ÉCHEC ${name} : attendu ${deny ? "refus" : "passage"}, sortie ${JSON.stringify(out)} code ${p.exitCode}`); }
  else console.log(`ok ${name}`);
}
const bad = Bun.spawnSync(["bun", HOOK], { stdin: new TextEncoder().encode("pas du json") });
if (bad.stdout.toString() || bad.exitCode !== 0) { fail++; console.log("ÉCHEC entrée illisible : le hook doit laisser passer"); } else console.log("ok entrée illisible");
process.exit(fail ? 1 : 0);
