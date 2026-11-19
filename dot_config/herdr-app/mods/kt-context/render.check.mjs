// bun mods/kt-context/render.check.mjs: kt-context's whole view drawn once with data, everything unfolded,
// gpui-kit / gpui-base / herdr mocked (herdr-app check only draws its empty state). An invented transcript
// (ctx-index.ts on a temp file) with every list; the draw must not throw, and must show the grid, the rows,
// each group of Détail with its items, and the curve. Prints the element and painted-path counts.
import { plugin } from "bun";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let paints = 0;
const texts = [];
const el = () => {
  const node = { kids: [] };
  const p = new Proxy(node, {
    get(t, k) {
      if (k === "then") return undefined;
      if (k in t) return t[k];
      return (...a) => {
        if (k === "child") { t.kids.push(a[0]); if (typeof a[0] === "string") texts.push(a[0]); }
        else if (k === "children") for (const c of a[0] ?? []) { t.kids.push(c); if (typeof c === "string") texts.push(c); }
        else if (k === "when") return a[0] ? a[1](p) : p;
        return p;
      };
    },
  });
  return p;
};
const builder = () => { const api = { move_to: () => api, line_to: () => api, arc_to: () => api, close: () => api, build: () => ({}) }; return api; };
const LAYOUT = { id: "root", children: [{ id: "panel", children: [{ id: "panel-body", active: "context", children: [] }] }] };
const T = new Proxy({}, { get: (_t, k) => (k === "then" ? undefined : "#808080") });
plugin({ setup(build) {
  build.module("gpui-kit", () => ({ loader: "object", exports: { View: class {}, div: () => el(), svg: () => el(), PathBuilder: { fill: builder, stroke: builder }, Background: { linear_gradient: () => ({}) } } }));
  build.module("gpui-base", () => ({ loader: "object", exports: { v_flex: () => el(), h_flex: () => el() } }));
  build.module("herdr", () => ({ loader: "object", exports: {
    focused: () => ({ terminal: "t9" }), panes: () => [], spaces: () => [], theme: () => T, layout: () => LAYOUT, readTextFile: async () => "",
    exec: async () => ({ code: 0, stdout: "" }), home: () => "/h", appHome: () => "/h/.config/herdr-app", nextCommand: () => new Promise(() => {}),
    checking: () => true, run: () => {}, openOverlay: () => {}, shared: () => undefined, setShared: () => {}, settings: () => ({ dark: true }),
  } }));
} });
globalThis.window = { paint_path: () => { paints++; return el(); } };

const INDEX = join(import.meta.dir, "ctx-index.ts");
const { default: Context } = await import("./main.js");
const { merge } = await import("./model.js");

const line = (o) => JSON.stringify(o) + "\n";
const att = (attachment) => line({ type: "attachment", timestamp: "2026-11-19T14:00:00Z", attachment });
const call = (id, at, n) => line({ type: "assistant", timestamp: at, message: { id, usage: { input_tokens: 2, cache_creation_input_tokens: 0, cache_read_input_tokens: n } } });
const dir = mkdtempSync(join(tmpdir(), "kt-context-render-"));
let fails = 0;
try {
  const f = join(dir, "s.jsonl");
  writeFileSync(f, line({ type: "api-request-shape", shape: { system: [{ text: "s".repeat(13000) }], tools: [{ name: "Read", description: "r".repeat(90000) },
    ...Array.from({ length: 15 }, (_, i) => ({ name: `mcp__srv${i % 3}__tool${i}`, description: "m".repeat(200 * (i + 1)) }))] } })
    + att({ type: "instructions", files: [{ path: "/h/.claude/CLAUDE.md", type: "User", content: "c".repeat(3000) }, { path: "/h/.claude/RULES.md", type: "User", content: "c".repeat(7000) }] })
    + att({ type: "skill_listing", content: Array.from({ length: 30 }, (_, i) => `- skill${i}: ${"d".repeat(i * 10)}`).join("\n"), skillCount: 31, names: [] })
    + att({ type: "agent_listing_delta", addedTypes: ["Explore", "mine"], addedLines: ["- Explore: x", "- mine: y"], builtInTypes: ["Explore"], removedTypes: [], isInitial: true })
    + att({ type: "mcp_instructions_delta", addedNames: ["tavily", "serena"], addedBlocks: ["i".repeat(800), "j".repeat(1600)], removedNames: [] })
    + att({ type: "deferred_tools_delta", addedNames: ["mcp__x__a", "Monitor"], addedLines: ["a", "b"], removedNames: [], readdedNames: [] })
    + call("a1", "2026-11-19T14:00:01Z", 300000)
    + line({ type: "system", subtype: "compact_boundary", timestamp: "2026-11-19T14:10:00Z", compactMetadata: { trigger: "auto", preTokens: 967000, postTokens: 60000 } })
    // A compaction re-sends the listings: here all but the deferred tools, CLAUDE.md gone from the memory.
    + att({ type: "skill_listing", content: "- again: x", skillCount: 1, names: ["again"] })
    + att({ type: "instructions", files: [{ path: "/h/.claude/RULES.md", type: "User", content: "c".repeat(7000) }] })
    + att({ type: "agent_listing_delta", addedTypes: ["Explore", "mine"], addedLines: ["- Explore: x", "- mine: y"], builtInTypes: ["Explore"], removedTypes: [], isInitial: true })
    + att({ type: "mcp_instructions_delta", addedNames: ["tavily"], addedBlocks: ["i".repeat(800)], removedNames: [] })
    + call("a2", "2026-11-19T14:10:01Z", 450000));
  const r = Bun.spawnSync([process.execPath, INDEX, f]);
  const st = merge(null, f, JSON.parse(r.stdout.toString()));

  const view = new Context();
  const cx = { focus_handle: () => ({ is_focused: () => false, focus() {} }), notify() {}, spawn() {}, timer: { after() {}, every() {} } };
  view.init({}, cx);
  Object.assign(view, { st, line: { model: "Opus", effort: "high", window: 1_000_000, ctx_pct: 45, updated_at: 1795100000 }, readFor: "t9", term: "t9", shown: true });
  for (const k of ["kc-curve", "kc-d-mcp", "kc-d-mcpInstructions", "kc-d-deferred", "kc-d-agents", "kc-d-memory", "kc-d-skills"]) view.open.add(k);
  const count = (n) => (n && typeof n === "object" && Array.isArray(n.kids) ? 1 + n.kids.reduce((s, k) => s + count(k), 0) : 0);
  let tree;
  try { tree = view.draw(cx); } catch (e) { fails++; console.error(`FAIL draw threw: ${e?.stack ?? e}`); }
  const has = (s) => texts.some((x) => x.includes(s));
  const want = ["Utilisation", "Prompt système", "Outils système", "Outils MCP", "Instructions MCP", "Agents personnalisés", "Fichiers mémoire",
    "Skills", "Messages", "Espace libre", "Réserve de compaction", "Détail", "tool14", "~/.claude/RULES.md", "again", "Au fil des appels", "compaction vers", "Compaction auto", "± 14 % par élément (p90 sur 111 points)"];
  for (const w of want) if (!has(w)) { fails++; console.error(`FAIL not drawn: « ${w} »`); }
  // After the compaction: only what it re-sent (no skill29, no CLAUDE.md, no deferred tools).
  for (const gone of ["skill29", "CLAUDE.md", "Outils différés"]) if (has(gone)) { fails++; console.error(`FAIL from before the compaction, still drawn: « ${gone} »`); }
  console.log(`render: ${count(tree)} elements, ${paints} painted paths, grid ${view.gridMemo?.rects} rectangles`);
  // Folded (as at first): the heads only, no item, no chart, no compaction line.
  view.open.clear();
  texts.length = 0;
  const folded = view.draw(cx);
  for (const w of ["Détail", "Fichiers mémoire", "Au fil des appels"]) if (!has(w)) { fails++; console.error(`FAIL folded, head not drawn: « ${w} »`); }
  for (const w of ["tool14", "RULES.md", "Compaction auto"]) if (has(w)) { fails++; console.error(`FAIL folded, still drawn: « ${w} »`); }
  console.log(`render folded: ${count(folded)} elements`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("render: ok");
