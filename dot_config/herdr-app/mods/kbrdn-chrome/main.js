import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout, settings, agents } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// kbrdn.dev FooterCritter (app/utils/invaders.ts): five invaders, frames A/B, and their hues [light, dark].
const INVADERS = [
  [["...##...", "..####..", ".######.", "##.##.##", "########", "..#..#..", ".#.##.#.", "#.#..#.#"],
   ["...##...", "..####..", ".######.", "##.##.##", "########", ".#.##.#.", "#......#", ".#....#."]],
  [["..#.....#..", "...#...#...", "..#######..", ".##.###.##.", "###########", "#.#######.#", "#.#.....#.#", "...##.##..."],
   ["..#.....#..", "#..#...#..#", "#.#######.#", "###.###.###", "###########", ".#########.", "..#.....#..", ".#.......#."]],
  [["....####....", ".##########.", "############", "###..##..###", "############", "...##..##...", "..##.##.##..", "##........##"],
   ["....####....", ".##########.", "############", "###..##..###", "############", "..###..###..", ".##..##..##.", "..##....##.."]],
  [[".....######.....", "...##########...", "..############..", ".##.##.##.##.##.", "################", "..###..##..###..", "...#........#..."],
   [".....######.....", "...##########...", "..############..", ".#.##.##.##.##.#", "################", "..###..##..###..", "...#........#..."]],
  [["..######..", ".########.", "##..##..##", "##..##..##", "##########", "##########", "##########", "#.##..##.#"],
   ["..######..", ".########.", "#..##..###", "#..##..###", "##########", "##########", "##########", "##.#..#.##"]],
];
const HUES = [["#a87ee0", "#c79bff"], ["#6bc97f", "#86e89a"], ["#5aa0e6", "#7ab8ff"], ["#6fa39c", "#8abfb8"], ["#c15f3c", "#d4825d"]];
// Two pixel rows per text row: ▀ top, ▄ bottom, █ both (an odd last row pairs with an empty one).
function halfBlocks(m) {
  const rows = [];
  for (let r = 0; r < m.length; r += 2) {
    const bottom = m[r + 1] ?? ".".repeat(m[r].length);
    rows.push([...m[r]].map((c, i) => (c === "#" ? (bottom[i] === "#" ? "█" : "▀") : bottom[i] === "#" ? "▄" : " ")).join(""));
  }
  return rows;
}
const PX = 4; // font size = one pixel row pair: a 2.4 x 2 px pixel in JetBrains Mono, the site's CELL 2

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

export default class WorkspaceChrome extends View {
  init() {
    this.variant = Math.floor(Math.random() * INVADERS.length);
    this.width = 0;
    this.hovered = false;
    this.walkUntil = 0;
    this.done = new Set();
  }

  // An agent that just finished sends the critter walking for 20 s.
  watchDone(cx) {
    const now = new Set(agents().filter((a) => a.status === "done").map((a) => a.address));
    const fresh = [...now].some((a) => !this.done.has(a));
    this.done = now;
    if (!fresh) return;
    this.walkUntil = Date.now() + 20000;
    cx.timer.after(20050, (cx) => cx.notify());
  }

  // Rests at the left of the footer's top edge, free. Walks there and back at 60 px/s (legs stepped
  // natively by .frames) only while the footer is hovered or an agent just finished: a native loop
  // redraws the window at ~30 fps, too dear to run forever. A click sends the next species.
  critter(t) {
    const v = this.variant;
    const [a, b] = INVADERS[v].map(halfBlocks);
    const w = Math.ceil(a[0].length * PX * 0.6);
    const lane = Math.max(0, this.width - 24 - w);
    const walking = this.hovered || Date.now() < this.walkUntil;
    return v_flex().id(walking ? "critter-walk" : "critter-rest").absolute().bottom(0).left(12).w(w)
      .font_family("JetBrains Mono").text_size(PX).line_height(`${PX}px`).text_color(HUES[v][settings().dark ? 1 : 0])
      .cursor_pointer().on_click((_e, cx) => { this.variant = (v + 1) % INVADERS.length; cx.notify(); })
      .when(walking, (el) => el.loop("left", { from: 12, to: 12 + lane, period: Math.max(2000, Math.round((2 * lane / 60) * 1000)), easing: "linear" }))
      .children(a.map((row, i) => div().id(`critter-${i}`).whitespace_nowrap().child(row).when(walking, (el) => el.frames([row, b[i]], 220))));
  }

  // kbrdn.dev Logo.vue on hover, at 20 px (s = 20/96): the bar leaves to the top right and comes back from
  // the bottom left, the two orange pieces kick out and settle. Native transitions; one-shot timers step
  // the keyframes (820 ms), only while it plays.
  playLogo(cx) {
    if (this.playing) return;
    this.playing = true;
    const s = 20 / 96;
    const L = (this.k = { bar: [0, 0], tri: [0, 0], leg: [0, 0], barMs: 312, barEase: "ease-in", partMs: 100, gen: this.k?.gen ?? 0 });
    const set = (patch) => (cx) => { Object.assign(this.k, patch); cx.notify(); };
    set({ bar: [80 * s, -80 * s] })(cx);
    cx.timer.after(312, set({ bar: [-80 * s, 80 * s], gen: L.gen + 1 })); // a new element: the jump back is instant
    cx.timer.after(330, set({ bar: [2 * s, -2 * s], barMs: 244, barEase: "ease-out" }));
    cx.timer.after(492, set({ tri: [-7 * s, -7 * s], leg: [7 * s, 7 * s], partMs: 98 }));
    cx.timer.after(574, set({ bar: [0, 0], barMs: 115, barEase: "ease-in-out" }));
    cx.timer.after(590, set({ tri: [2 * s, 2 * s], leg: [-2 * s, -2 * s], partMs: 107 }));
    cx.timer.after(697, set({ tri: [0, 0], leg: [0, 0], partMs: 120 }));
    cx.timer.after(840, () => { this.playing = false; });
  }

  logo(t) {
    const L = this.k ?? { bar: [0, 0], tri: [0, 0], leg: [0, 0], barMs: 312, barEase: "ease-in", partMs: 100, gen: 0 };
    const at = (id, [x, y], ms, easing, child) => div().id(id).absolute().left(x).top(y).size(20)
      .transition("left", { duration: ms, easing }).transition("top", { duration: ms, easing }).child(child);
    return div().relative().size(20).flex_none()
      .child(div().absolute().left(0).top(0).size(20).overflow_hidden()
        .child(at(`k-bar-${L.gen}`, L.bar, L.barMs, L.barEase, svg("brand/logo/k-bar.svg").size(20).text_color(t.foreground))))
      .child(at("k-tri", L.tri, L.partMs, "ease-out", image("brand/logo/k-tri.svg").size(20)))
      .child(at("k-leg", L.leg, L.partMs, "ease-out", image("brand/logo/k-leg.svg").size(20)));
  }

  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render(cx) {
    const t = theme();
    const collapsed = narrow();
    if (props()?.footer) {
      this.watchDone(cx);
      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().rounded(8)
        .when(collapsed, el => el.relative().w(32).px(0).justify_center().tooltip(label))
        .text_color(dim ? t.dim : t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click(action).child(svg(`mods/kbrdn-chrome/${icon}.svg`).size(14))
        .when(!collapsed, el => el.child(label));
      const ready = div().size(6).rounded_full().bg(t.accent);
      const rows = v_flex().flex_1().border_t(1).border_color(t.border).px(8).pt(4).pb(8)
        .when(collapsed, el => el.px(0).items_center())
        .child(row("settings", "settings", "Settings", false, () => run("app.settings"))
          .when(Boolean(updates().app.ready), el => el.child(collapsed ? ready.absolute().top(5).right(6) : ready)))
        .child(row("machine", "plus", "Add machine", true, () => run("mod.open", { name: "machine-add" })));
      return v_flex().id("footer").size_full().bg(t.chrome).text_size(13)
        .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
        .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
        // The critter's lane sits on the footer's top border, as on kbrdn.dev's footer panel.
        .child(div().relative().h(18).flex_none().when(!collapsed && this.width > 120, el => el.child(this.critter(t))))
        .child(rows);
    }
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().id("brand").flex_1().gap(8).items_center()
        .on_hover((hovered, cx) => { if (hovered) this.playLogo(cx); })
        .child(this.logo(t))
        .child(h_flex().font_family("Monaspace Krypton").font_bold().text_size(13).child(div().text_color(t.foreground).child("@")).child(div().text_color(t.accent).child("kbrdn1")))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/kbrdn-chrome/search.svg").size(15), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/kbrdn-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
