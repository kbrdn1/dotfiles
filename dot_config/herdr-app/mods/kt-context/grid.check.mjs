// bun mods/kt-context/grid.check.mjs: the render budget of the Utilisation grid (#91). model.js' grid()
// and gridInk() through viz.js' runs() and capped(), as main.js builds them, gpui-kit mocked (as
// kt-keys/viz.check.mjs mocks it): the rectangles painted at each render stay under viz.js' MAX_RECTS and
// the cell keeps its 3 px (a coarser rebuild would change the grid's size). Prints the counts.
import { plugin } from "bun";

const el = () => new Proxy({}, { get: (_t, k) => (k === "then" ? undefined : () => el()) });
const builder = () => { const api = { move_to: () => api, line_to: () => api, close: () => api, build: () => ({}) }; return api; };
plugin({ setup(build) {
  build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el(), svg: () => el(), PathBuilder: { fill: builder, stroke: builder }, Background: { linear_gradient: () => ({}) } } }));
  build.module("herdr", () => ({ loader: "object", exports: { shared: () => undefined, setShared: () => {}, exec: async () => ({ code: 0, stdout: "" }), checking: () => true } }));
} });
const { runs, inked, capped, MAX_RECTS } = await import("./viz.js");
const { grid, gridInk } = await import("./model.js");

// main.js' TINT tones: the half-ink categories.
const HALF = new Set(["mcpInstructions", "agents", "memory"]);
const tone = (k) => (HALF.has(k) ? 0.5 : 1);
let fails = 0;
function measure(name, rows, window, buffer) {
  const g = grid(rows, window, buffer);
  const gi = gridInk(g, tone, inked);
  const built = capped((c) => ({ rects: runs(gi.cols, gi.rows, gi.ink, c), cell: c }), 3);
  const ok = built.rects.length <= MAX_RECTS && built.cell === 3;
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${built.rects.length} rectangles (max ${MAX_RECTS}), cell ${built.cell} px, ${gi.cols * built.cell} × ${gi.rows * built.cell} px`);
}

// The orchestrator's session (2026-11-19, ctx-detail-proto.ts' figures).
measure("real, 1M", [{ key: "system", tokens: 3355 }, { key: "tools", tokens: 23159 }, { key: "mcp", tokens: 791 }, { key: "mcpInstructions", tokens: 2221 },
  { key: "agents", tokens: 920 }, { key: "memory", tokens: 16535 }, { key: "skills", tokens: 7500 }, { key: "messages", tokens: 646426 }], 1_000_000, 32832);
// The worst one can see: the half-ink categories filling the window, a reserve of a fifth, every row partial.
measure("worst, 1M", [{ key: "system", tokens: 2500 }, { key: "mcpInstructions", tokens: 252500 }, { key: "agents", tokens: 252500 },
  { key: "memory", tokens: 252500 }, { key: "skills", tokens: 2500 }, { key: "messages", tokens: 2500 }], 1_000_000, 200000);
measure("200 k", [{ key: "system", tokens: 3400 }, { key: "tools", tokens: 20000 }, { key: "memory", tokens: 16000 }, { key: "messages", tokens: 90000 }], 200_000, 33000);

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("grid: ok");
