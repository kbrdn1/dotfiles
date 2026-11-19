// kt-machine-add's add() refuses a target starting with "-" before anything runs: `hc machine add` would read it as
// an option, and down to ssh `-oProxyCommand=…` runs a command (2026-11-19). A plain host still goes to hc.
// herdr and gpui are mocked, the fixtures made up: nothing reaches a machine.
// Run with `bun test` (bun:test's mocks): bun test mods/kt-machine-add/dash.test.mjs
import { test, expect, mock } from "bun:test";

const MOD = import.meta.dir;
const chain = () => new Proxy(function () {}, { get: (_t, k) => (k === "then" ? undefined : () => chain()), apply: () => chain() });
const ran = [];
class FakeInput {
  constructor() { this.v = ""; }
  on() {}
  focus() {}
  value() { return this.v; }
  set_value(v) { this.v = v; }
}
mock.module("gpui-kit", () => ({ View: class {}, div: chain, svg: chain }));
mock.module("gpui-base", () => ({ v_flex: chain, h_flex: chain, Input: { new: chain }, InputState: { new: () => new FakeInput() }, TextView: { html: chain } }));
mock.module("herdr", () => ({
  hc: async (args) => { ran.push(args); return { code: 0, stdout: "{\"machines\":[]}", stderr: "" }; },
  exec: async (...a) => { ran.push(a); return { code: 0, stdout: "" }; },
  home: () => "/fake/home", readTextFile: async () => null, theme: () => new Proxy({}, { get: () => "#000000" }),
  props: () => ({ overlay: "o1" }), closeOverlay() {}, settings: () => ({ dark: true }),
  shared: (k) => (k === "kt.lang" ? "fr" : null), checking: () => true,
}));
const { default: MachineAdd } = await import(`${MOD}/main.js`);
const cx = () => ({ notify() {}, spawn: (f) => f(cx()), timer: { after() {}, every() {} }, focus_handle: () => ({ focus() {} }) });
const settle = () => new Promise((r) => setTimeout(r, 0));

test("a target starting with « - » is refused, said, and never reaches hc", async () => {
  ran.length = 0;
  const m = new MachineAdd();
  m.init({}, cx());
  for (const typed of ["-oProxyCommand=touch /fake/x", "  --help", "-F/fake/config vps-a"]) {
    m.add(typed, cx());
    const target = typed.trim();
    expect(m.state[target]).toContain("tiret");
    expect(m.pending.has(target)).toBe(false);
  }
  await settle();
  expect(ran).toEqual([]);
});

test("a plain host still goes to hc machine add", async () => {
  ran.length = 0;
  const m = new MachineAdd();
  m.init({}, cx());
  m.add("vps-a", cx());
  await settle();
  expect(ran[0]).toEqual(["machine", "add", "vps-a", "--json"]);
});
