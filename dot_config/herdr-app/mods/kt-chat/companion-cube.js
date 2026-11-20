// The LED cube companions: one generic companion for any agent, whatever its program
// (carry/mascot/cube-led.html, validated by Kylian on 2026-11-20). companion-logo.js hands over to cube()
// while kt-threads' option companion_style is "cube" (the default; "subscription" keeps the logos).
//
// A black cube whose face is pierced with a grid of round holes (4x4 to 7x7 by size), lit cold white or
// glacier blue, over a circuit texture from 32 px. Its face comes from one of 70 (7 families x 10 variants,
// src/cube.mjs): the family from the parent's address (a lead's workers share it), the variant from the rank
// among siblings (by address, the lead's own skipped; past 9, the next families, keeping only faces still
// 4 LED apart in the waiting view), pinned when first seen (PINS): an elder finishing moves nobody. An agent
// without a parent draws both from its own address.
// States, all native (.loop, .transition) except the done ripple's few timer.after steps, like the logos'
// sparkles: idle breathes, working scans a column back and forth, blocked pulses in the theme's blocked
// color with its four corners lit, done ripples once then stays full on a faint plate, error is a cross.
// A lead with hc workers (terminals().parent) gets the segmented ring: one straight bar per worker on the
// frame, in its state's color; past 4m bars, each bar stands for several, shared between states pro rata.
// o: companion-logo's (state, since, size, height, id, memo, cx, at, onClick) plus address (the terminal),
// parent (a bridge sub-agent's parent terminal) and rank (its coiffe's index: its rank among siblings).
import { div, image } from "gpui-kit";
import { setShared, shared, terminals, theme } from "herdr";

// <data> written by src/cube.mjs: do not edit by hand
const DATA = {"grids":[4,5,6,7],"margin":0.07,"families":["losange","anneau","chevron","sablier","regard","colonnes","arche"],"faces":[[{"4":".ww......bb.....","5":".www..w.w.wbwbw.wbw...w..","6":".w..w..wwww..bwwb..bbbb...bb........","7":".w.w.w..wwwww..ww.ww.wbbwbbw.wbbbw...wbw..v..w..v"},{"4":".....ww.b..bbbbb","5":"..b...www.bw.wb.www.b.b.b","6":"........ww...wwww..wwww..bwwb.bb..bb","7":"...b.....bwb...bwwwb.bww.wwb.bwwwb..bbwbb..b.b.b."},{"4":".....ww..bb.bbbb","5":".......w...bbb...b.......","6":"......v.ww.v.wwww..bbbb...bb........","7":".......v.vwv.v..www...bbbbb...bbb.....b......v..."},{"4":"........bbbb....","5":"..w...www.bbbbbbbbbb..b..","6":"..vv....ww...wwww.bbbbbb.bbbb.......","7":"..v.v....www...wwwww..bbbbb.bbbbbbb..bbb........."},{"4":"w..w.........ww.","5":"w.w.w.bbb.wb.bw.bbb...w..","6":"w....w.wbbw..bbbb..bbbb..vbbv.vv..vv","7":"ww.w.ww..wbw...wbbbw.wbb.bbw.wbbbw.vvwbwvv...w..."},{"4":".bb.bbbb....b..b","5":"..b..bbbbbbbwbb.bwb...w..","6":"......bbbbbbbbbbbb.bbbb...bb........","7":".......bbbbbbbbbbbbbb.bbwbb..bbwbb...bwb........."},{"4":"w..wwwww.bb.....","5":"w...wwwwww.bbb...b.......","6":"w....wwvwwvw.wwww..bbbb.............","7":".......ww.w.ww.wwwww..bbbbb....b......b...v.v.v.v"},{"4":".ww..ww.bwwb....","5":".......w...w.w.bbwbb.....","6":"..vv....ww...wwww..wwww.bbwwbb......","7":"..v.v.....w....vwwwv..ww.ww.bbwwwbbbb.w.bbv.....v"},{"4":".....bb.....b..b","5":".......b....b..b.b.bb...b","6":"..............ww..v.bb.vbb..bb......","7":"...v......b.....bwb..v.bwb.v...w...bw.b.wbv.....v"},{"4":"wwww.bb......ww.","5":"......bbb..b.b..bbb..w.w.","6":".v..v..vbbv..b..b..b..b...bb...w..w.","7":".v...v..v.b.v...bbb...bbvbb...bbb...wwbww.vw...wv"}],[{"4":"....bbbbwwww....","5":"......bbb.ww.ww.www......","6":".......bbbb.bbbbbbwwwwww.wwww.......","7":".........bbb...bbbbb.www.www.wwwww...www........."},{"4":".bb.b..bb..b.bb.","5":".bbb..b.b.b...bbb.bb.bbb.","6":"..bb...wbbw.bb..bbbb..bb.wbbw..bbbb.","7":"..bbb...bwbwb..w...w.bb...bb.wv.vw..wwbww.vbbbbbv"},{"4":"wwwww..w....w..w","5":"wwwww.w.w.w...w.w.w..www.","6":"wwwwww.bwwb.ww..wwww..ww.bwwb..vwwv.","7":"wwwwwww.bwwwb..b.v.b.ww...ww.b...b..wwwww...www.."},{"4":".bb.....bwwb.bb.","5":"..b....w..bw.wb.www...b..","6":"........ww...w..w..wwww.vbwwbv......","7":".........bwb...b...b..ww.ww.vbwvwbv..bwb....v.v.."},{"4":".bb.....w..w....","5":".bbb.bbbbbw...w.www...w..","6":".......bbbb.bb..bbww..ww.wwww.vv..vv","7":"........bbbbb.bb...bbww...wwwwv.vwwvwwwwwv......."},{"4":".ww..........ww.","5":"..w...www.ww.ww.www..bwb.","6":"..ww..vwwwwv.w..w..w..w..wwww..bwwb.","7":"...w...vwwwwwv.ww.ww..w...w..ww.ww..wwwww..bwwwb."},{"4":".bb.b..bbbbb....","5":"..b...bbb.b...b.wbw...b..","6":"..bb...wwww.b....bbw..wb.wwww...bb..","7":"...b....bwwwb..bb.bb.bb...bb.wb.bw..bwwwb....b..."},{"4":".ww.w..w.bb..ww.","5":"..w...b.b..b.b..bbb...w..","6":"v.ww.v.w..w..b..b..b..b..wbbw...ww..","7":"v..w..v..wbw...wb.bw..b...b..wb.bw...wbw.....w..."},{"4":"....b..b.....bb.","5":".bbb.bw.wbbw.wb.w.w..bbb.","6":"..bb..bbwwbbbw..wbbw..wb.bwwb...bb..","7":"..bbb..bbbwbbbbb...bbbw...wb.bv.vb..bbwbb...bbb.."},{"4":".ww.wbbww..w....","5":".www..bbb.wb.bw..b....w..","6":"..ww..vwbbwvwbvvbwwb..bw.vbbv..vwwv.","7":"..www..vwwbwwv.wb.bw.wb...bw.wb.bw..v.b.v....w..."}],[{"4":"....b..b.ww.....","5":".....b...bwwwww..w.......","6":"......b....bbbbbbb.wwww.v.ww.v......","7":".......b.....bbb...bb.wwwww.v.www.v...w.........."},{"4":"bwwb.ww..bb.....","5":"b...b.w.w..bbb..b.b......","6":"b....b.w..w...ww....bb..........vv..","7":"b.....bbw...wb.ww.ww...bbb....bbb....v.v........."},{"4":".....ww.b..b....","5":".w.w..www.bbbbbb...b.....","6":".......wwww..wwww.bb..bbb....b..vv..","7":"........ww.ww...www...bb.bb.bb...bb..v.v........."},{"4":"b..b....bwwbb..b","5":".......w...www.bw.wbb...b","6":"..............ww...wwww.bb..bbb....b","7":".................w.....www...bw.wb.bb...bbb.....b"},{"4":"w..wwwww.....bb.","5":".....ww.ww.bbb.......b.b.","6":"v....vww..ww.wwww...bb.........bbbb.","7":"v.....vww...wwwww.www..bbb...........bvb...bb.bb."},{"4":"........w..w.bb.","5":"......wbw..w.w.w...w.....","6":".v..v..w..w...ww..ww..www....w......","7":".v...v..w.v.w..w.b.w..wb.bw.ww...www.....w......."},{"4":"w..w........w..w","5":"w...ww...www.ww.wbw......","6":"wv..vwwv..vwbw..wb.wwww...ww........","7":"ww...wwww...wwbw...wbwbw.wbw..bbb.....w...v.v.v.v"},{"4":"w..ww..ww..wb..b","5":".....w...w.w.w...w..bb.bb","6":"......w....wwwvvww.wwww.......bb..bb","7":".......w.....wwww.www.w.v.w...www.........bb...bb"},{"4":".........ww..bb.","5":".....w...w.www..bwb..b.b.","6":"......w....www..ww.wwww..bwwb..b..b.","7":".......w.....www.v.ww.wwwww...www...bb.bb.v.....v"},{"4":"....w..wwbbw.ww.","5":".....w...w.bbb.w.b.w.....","6":"vv..vvw....wwb..bw.bbbb.w.vv.w.v..v.","7":"vv.v.vvw..v..www...ww.bbbbb.w.bbb.wwv...vw......."}],[{"4":"wwww.....bb..ww.","5":".www...b....b...bbb..www.","6":".wwww..w..w...bb....bb...wbbw..wwww.","7":"........wwbww....b......b.....bbb...wwbww.v.....v"},{"4":"w..w.bb..bb..ww.","5":"ww.ww.bbb...b...bbb......","6":"ww..ww.wbbw...bb....bb...wbbw.......","7":"ww...ww.wwbww...bbb.....b.....bbb...wwbww.v.....v"},{"4":".ww..ww.....wwww","5":".www..www...w..bwwwb.www.","6":".......wwww...ww....ww..bwwwwb......","7":"........wwwww...www....www...vwwwv.bwwwwwbv.....v"},{"4":".ww.b..b........","5":".www.bwwwbb.w.b......www.","6":"..vv..v.ww.vb.ww.b..ww..v....v......","7":"..v.v..v.www.vbbwwwbbb..w..bv..v..v..www........."},{"4":"w..w.ww.bwwb....","5":"......www.b.w.bbwwwb.....","6":".......wwww...ww..b.ww.b.wwww...vv..","7":"........wwwww...www....vwv..bbwwwbb.wwwww........"},{"4":"b..b.....ww.....","5":".www..www...w....w.......","6":".......wbbw..vbbv...ww...b..b.......","7":".........bwb...vbwbv....w....vwwwv..............."},{"4":"....bbbb....wwww","5":".bbb.bbbbb..w...www..www.","6":"......vbbbbvb.bb.bv.ww.v.wwww..vvvv.","7":".......vbbbbbvbbbbbbb..vwv....www...wwwww....v..."},{"4":"....w..w.bb.bbbb","5":".www.w.w.w..b....b...bbb.","6":"vwwwwvw.ww.w..ww....bb....bb...bbbb.","7":"v.www.v..www..w..w..w...b.....vbv....bbb....bbb.."},{"4":".ww.wwww.ww.....","5":".www..www..wbw..wbw..wbw.","6":".wwww..wwww..w..w...ww...wwww..wwww.","7":".wwwww...www...ww.ww..w.b.w...wbw....wbw...wwbww."},{"4":".bb..ww.b..bb..b","5":"..b....w....w....w...bbb.","6":".v..v...ww....ww....ww.........bbbb.","7":".v...v...bwb....www.....w......w....b.w.b..bb.bb."}],[{"4":"w..ww..w.ww..ww.","5":"......w.w.......bbb......","6":".............w..w........wwww...vv..","7":"...............b...b..........www....www........."},{"4":"....wwww........","5":"......w.w.b...b..w.......","6":".......w..w.ww..ww........ww........","7":".........w.w..vww.wwvbb...bb...w................."},{"4":"wbbww..w.....ww.","5":".w.w.ww.ww.......w.......","6":".v..v.vw..wv.w..w...ww....ww........","7":".vb.bv.vwb.bwvww...ww.........www.........v.....v"},{"4":"bbbb............","5":"b...b.b.b........w.......","6":"b....b.b..b..b..b.......v.ww.v......","7":"b.....bb.....b.bb.bb........v.....v...w....vv.vv."},{"4":".....bb..bb.....","5":"......b.b..b.b...b.......","6":".............bbbb...bb....bb........","7":"...............wb.bw..b.v.b...bbb.....b.........."},{"4":"............wwww","5":"......b.b........w..wwwww","6":"......vbbbbv............wwwwww......","7":".......vbb.bbv.bb.bb...............wwwwwww...v..."},{"4":"wwwww..w.ww.....","5":".....ww.wwb...b.www......","6":".......w..w.bw..wbbwwwwb............","7":"........w...w.ww...wwbb.v.bb.wwwww..............."},{"4":"wwww....wwww....","5":".w.w.w...w......www......","6":".w..w.ww..ww......v....v.wwww.......","7":".w...w.ww...ww.wvvvw.v.....v..www....www........."},{"4":"....wbbwb..b.ww.","5":".....ww.ww.....bbbbb.....","6":"......ww..ww.w..w.b....b.bwwb.......","7":"...v....w...w..w...w........bbv.vbb..wbw..v.....v"},{"4":"....b..bw..w....","5":".....bb.bbw...ww.w.w.....","6":"v....v.b..b..b..b.w....w............","7":"v.....v.bb.bb..bb.bb.w.....ww..w..w.............."}],[{"4":"w..ww..wbbbb....","5":".....ww.wwbb.bbbb.bb.....","6":".v..v..w..w..w..w.bb..bbbb..bbv....v","7":".v...v..ww.ww..ww.ww..bb.bb.bbb.bbbvbb.bbv..v.v.."},{"4":"b..bb..b........","5":".b.b..w.w..w.w..w.w..b.b.","6":".b..b..b..b..w..w..w..w..bvvb..b..b.","7":".b...b..bb.bb..bw.wb..w...w..bv.vb..bb.bb..b.v.b."},{"4":".ww.w..w.ww.w..w","5":"...........w.w..w.w......","6":"......vw..wvww..ww.w..w..w..w.......","7":"...v...vww.wwvww...ww.ww.ww..ww.ww..ww.ww....v..."},{"4":"w..wwwwww..w....","5":"bw.wbww.wwww.wwww.ww.....","6":"bw..wbwwwwww.wwww..wwww..wwww.......","7":"bb...bbwww.www.ww.ww..ww.ww..ww.ww..ww.ww........"},{"4":".....ww.bbbbb..b","5":".....bb.bb.b.b..b.b......","6":"......bb..bb.b..b..b..b..b..b.......","7":".......bbwvwbb.bw.wb...b.b....b.b....b.b..v.....v"},{"4":"....bwwb.ww.b..b","5":"......w.w..w.w..w.w.b...b","6":".......bwwb..wwww..wwww..bwwb.b.vv.b","7":"........bb.bb..bw.wb..ww.ww..bw.wb.bbb.bbbbb...bb"},{"4":"wwwww..wb..b....","5":".w.w..w.w.bb.bbbb.bb.b.b.","6":".w..w..w..w.ww..wwbb..bb.b..b..b..b.","7":".w...w..w...w.vw...wvbb...bbbb...bb.b...b..b...b."},{"4":".........bb.b..b","5":"................b.b..b.b.","6":"v....v.............b..b..w..w..b..b.","7":"v.....v..b.b..................b.b...wb.bw..b...b."},{"4":"........b..bb..b","5":"...........b.b..b.b.bb.bb","6":".............w..w..b..b..b..b.bbvvbb","7":".......................b.b....b.b...bb.bb.bb...bb"},{"4":".ww..ww.........","5":".w.w..w.w..w.w.b...b.w.w.","6":".w..w..wwww..wwww........wvvw..w..w.","7":"..w.w...ww.ww..ww.ww..ww.ww..vv.vv..ww.ww...wvw.."}],[{"4":"w..w.ww.b..b.bb.","5":".w.w..www..b.b...........","6":".wvvw..wwww.vwwwwv.b..b.vb..bvv....v","7":".wv.vw..ww.ww.v.www.v.b.v.b.vb...bvvb...bv.vv.vv."},{"4":".ww.........b..b","5":".......w..bbbbbb...b.....","6":"..vv....vv...wwww.bb..bb.......v..v.","7":"..v.v....v.v....www...bbbbb.bb...bb.v...v........"},{"4":"b..b....b..b....","5":"b...b.bwb.bb.bbb...b.....","6":"bb..bb.bbbb..wbbw.bb..bb.......v..v.","7":"bb...bb.b.b.b..bwbwb..wv.vw.bb...bb.v...v........"},{"4":"bbbbbwwb........","5":"..b...www.b...b......b.b.","6":".......bwwb.bw..wbb....b..vv...b..b.","7":"........bbwbb..bw.wb.bw...wbbbv.vbb........b...b."},{"4":"....w..w....w..w","5":".....wwwwwww.ww..........","6":"v....v..ww..wb..bw.w..w..v..v.......","7":"v.....v..v.v..wbwwwbwwb...bw.wv.vw..............."},{"4":".bb.b..bb..bb..b","5":"......bbb.b...bb...b.....","6":".......bwwb.bb..bbbb..bbbb..bb......","7":".........www..vwb.bwvbb...bbbb...bb.b...b....v..."},{"4":"....bwwbb..bb..b","5":".b.b.......www...........","6":".b..b.........ww...w..w..b..b.......","7":".b...b..b...b...www...ww.ww..b...b..............."},{"4":"w..w.ww.........","5":"b...b......bwb...........","6":"b....b.......wbbw..wwww.............","7":"bw.v.wbw.....w..www...wbbbw......................"},{"4":"....bwwb.ww..bb.","5":"......www.bwwwb......b.b.","6":".v..v...ww..vwwwwvbw..wbv.vv.v.b..b.","7":".v...v...bwb..vbwwwbvbwwwwwbv.v.v.v........vb.bv."},{"4":"bbbb.bb.b..b....","5":"b...b..w..b...b..........","6":"b....bbbbbbb......bb..bb..vv........","7":"bb...bbbbbbbbb...b...bb...bb..v.v............v..."}]],"g34":{"F":[[7,17],[55,23],[7,83]],"S":[[55,23],[94,16],[55,89]],"inset":0.045,"insetRing":0.08}};
// </data>

const K = 1000; // the opacity ramps' steepness (companion-logo's swap): a window edge takes period / 2000
const STEP = 100; // the scan: ms per column
const RIPPLE = 110; // the done ripple: ms per ring
const SLEEP = 600000; // idle 10 min: asleep, dim and still
const HOP = 160;
const COL = { w: "#eef7ff", b: "#8fd0f8", v: "#24425a", hole: "#040506", plate: "#16181b", body: "#08090b" };
// no blur in GPUI: a halo is a faint, slightly larger disc (any stronger and it reads as a gray pill)
const HALO = { w: "#c8e4ff1a", b: "#60b6ff20" };

/** "cube" (the default) or "subscription": kt-threads' option, set in kt-mods. */
export const cubeStyle = () => (shared("kt.opt.kt-threads.companion_style") === "subscription" ? "subscription" : "cube");
/** A face on a grid, a char per cell: "." off, "w"/"b" lit white/blue, "v" veiled. */
export const faceOf = (f, v, N) => DATA.faces[f][v][N];

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
const NF = () => DATA.faces.length;
const famOf = (s) => hash(String(s)) % NF();
const varOf = (s) => hash(String(s) + "#v") % 10;
const id36 = (a) => parseInt(String(a).split("/").pop().replace(/^t/, ""), 36);
const byAddr = (a, b) => (id36(a.address) - id36(b.address)) || String(a.address).localeCompare(String(b.address));
const lit = (ch) => ch === "w" || ch === "b";
function wait4([f, v]) {
  const s = DATA.faces[f][v][4];
  return Array.from(s, (ch, i) => (i === 0 || i === 3 || i === 12 || i === 15 || lit(ch) ? 1 : 0));
}
const dist = (a, b) => a.reduce((d, x, i) => d + (x !== b[i]), 0);

// a lead's team: [lead, worker 1, worker 2, ...] as [family, variant]
const TEAMS = new Map();
export function teamOrder(lead) {
  let t = TEAMS.get(lead);
  if (t) return t;
  const f = famOf(lead);
  t = [[f, varOf(lead)]];
  for (let k = 0; k < NF() * 10; k++) {
    const c = [(f + Math.floor(k / 10)) % NF(), k % 10];
    if (t.some(([a, b]) => a === c[0] && b === c[1])) continue;
    if (c[0] !== f && !t.every((o) => dist(wait4(o), wait4(c)) >= 4)) continue;
    t.push(c);
  }
  TEAMS.set(lead, t);
  return t;
}

// A worker's face is pinned the first time it is seen, in shared PINS (address -> [family, variant]: every
// mod and copy reads the same): the first team slot no live sibling holds, siblings taken by address. Ranking
// the live siblings on every render would change the later ones' faces when an elder finishes (terminals(),
// like hc ls, leaves finished terminals out). A bridge sub-agent (no terminal) takes its slot from the team's
// end, by its coiffe's rank, so it doesn't meet the hc workers filling it from the front.
export const PINS = "kt.cube.pins";

/** [family, variant] of a companion: its pinned team slot, else its own address. pin(next): store new pins. */
export function identityOf(o, ts = [], pin = null) {
  const me = o.address ? ts.find((t) => t.address === o.address) : null;
  const parent = me?.parent ?? o.parent;
  if (parent != null) {
    const order = teamOrder(parent);
    if (me) {
      const pins = shared(PINS) ?? {};
      if (pins[me.address]) return pins[me.address];
      const live = new Set(ts.map((t) => t.address));
      const next = Object.fromEntries(Object.entries(pins).filter(([a]) => live.has(a)));
      const sibs = ts.filter((t) => t.parent === parent).sort(byAddr);
      const held = new Set(sibs.map((t) => next[t.address]).filter(Boolean).map(String));
      for (const t of sibs) {
        if (next[t.address]) continue;
        const c = order.slice(1).find((x) => !held.has(String(x))) ?? order[1];
        next[t.address] = c;
        held.add(String(c));
      }
      pin?.(next);
      return next[me.address];
    }
    if (o.rank != null && o.rank >= 0) return order[order.length - 1 - (o.rank % (order.length - 1))];
  }
  const key = o.address ?? o.id ?? "agent";
  return [famOf(key), varOf(key)];
}

// the grid a face of `side` css px gets (the page's recommendation, 7x7 at most)
export const gridFor = (side) => (side <= 17 ? 4 : side <= 26 ? 5 : side <= 38 ? 6 : 7);

// the ring's bars along the frame's straight sides, path positions 0..P (side i spans [i*side, (i+1)*side))
const perSide = (n) => { const q = Math.floor(n / 4), c = [q, q, q, q]; [0, 2, 1, 3].slice(0, n % 4).forEach((s) => c[s]++); return c; };
const URG = ["blocked", "error", "working", "done", "idle"];
// more workers than S bars: S bars shared between states pro rata, most urgent first, each state keeping one
export function shareBars(ws, S) {
  if (ws.length <= S) return ws;
  const groups = URG.map((s) => [s, ws.filter((w) => w === s).length]).filter((g) => g[1]);
  const share = groups.map(([s, k]) => ({ s, q: 1 + ((S - groups.length) * k) / ws.length }));
  share.forEach((g) => { g.b = Math.floor(g.q); });
  let left = S - share.reduce((t, g) => t + g.b, 0);
  share.slice().sort((a, b) => (b.q - b.b) - (a.q - a.b)).forEach((g) => { if (left > 0) { g.b++; left--; } });
  return share.flatMap((g) => Array(g.b).fill(g.s));
}
export function ringBars(ws, side, gap, min) {
  const m = Math.max(1, Math.floor(side / (min + gap)));
  const bars = shareBars(ws, 4 * m);
  const out = [];
  let i = 0;
  perSide(bars.length).forEach((k, s) => {
    for (let j = 0; j < k; j++, i++) out.push({ s, a: (j * side) / k + gap / 2, b: ((j + 1) * side) / k - gap / 2, st: bars[i] });
  });
  return out;
}

// what both cubes share: identity, workers, state timing
function setup(o) {
  const live = o.at == null;
  const now = o.at ?? Date.now();
  const memo = o.memo ?? {};
  if (memo.state !== o.state) {
    memo.state = o.state;
    memo.seen = now;
  }
  const w = o.size ?? 24;
  const ts = o.address || o.parent ? terminals() : [];
  // new pins go out after this render (a write re-renders every mod, which then reads them)
  const [f, v] = identityOf(o, ts, (next) => { if (live && o.cx && memo.pinned !== o.address) { memo.pinned = o.address; o.cx.timer.after(1, () => setShared(PINS, next)); } });
  return {
    o, t: theme(), live, now, memo, f, v, w, h: o.height ?? (w <= 24 ? 20 : w),
    anim: live && shared("kt.opt.kt-threads.companion") !== false && shared("kt.reducedMotion") !== true,
    id: o.id ?? o.address ?? "agent", since: o.since ?? memo.seen, wakes: [],
    kids: o.address ? ts.filter((k) => k.parent === o.address && k.status && (k.state == null || k.state === "live")).sort(byAddr).map((k) => k.status) : [],
  };
}

// The state's layers over nf faces of the same N x N face. Cell key = face * N^2 + index; the scan runs over
// every face's columns in turn. led(key, color, halo) -> its elements.
function stateLayers(c, N, nf, led) {
  const { o, t, anim, live, now, since, wakes, id, w, h } = c;
  const face = DATA.faces[c.f][c.v][N], NN = N * N;
  const box = (key) => div().id(`${id}-${key}`).absolute().left(0).top(0).w(w).h(h);
  const layer = (key, cells) => box(key).children(cells.flatMap(([k, col, hl]) => led(k, col, hl)));
  const cells = [];
  for (let fi = 0; fi < nf; fi++) for (let i = 0; i < NN; i++) cells.push([fi * NN + i, face[i]]);
  const xy = (k) => [(k % NN) % N, Math.floor((k % NN) / N)];
  const faceCells = (color) => cells.filter(([, ch]) => lit(ch)).map(([k, ch]) => [k, color ?? COL[ch], color ? null : HALO[ch]]);
  const layers = [];
  const veil = cells.filter(([, ch]) => ch === "v").map(([k]) => [k, COL.v, null]);
  if (o.state !== "error" && veil.length) layers.push(layer("veil", veil));

  if (o.state === "error") {
    const x = cells.filter(([k]) => { const [cx, cy] = xy(k); return cx === cy || cx === N - 1 - cy; }).map(([k]) => [k, COL.w, HALO.w]);
    layers.push(layer("cross", x).opacity(0.95));
  } else if (o.state === "blocked") {
    const col = t.blocked ?? "#ffdf61";
    const pulse = layer("wait", faceCells(col));
    layers.push(anim ? pulse.loop("opacity", { from: 0.3, to: 1, period: 900, easing: "ease-in-out" }) : pulse);
    const corners = [];
    for (let fi = 0; fi < nf; fi++) for (const i of [0, N - 1, NN - N, NN - 1]) corners.push([fi * NN + i, col, null]);
    layers.push(layer("corners", corners));
  } else if (o.state === "working") {
    layers.push(layer("face", faceCells()).opacity(0.8));
    // one layer per column, each shown in its window of a common triangle wave: back and forth
    const cols = nf * N, colOf = (k) => Math.floor(k / NN) * N + xy(k)[0];
    const col = (g) => layer(`col${g}`, cells.filter(([k]) => colOf(k) === g).map(([k, ch]) => [k, lit(ch) ? COL.w : COL.b, lit(ch) ? HALO.w : null]));
    if (anim) {
      const period = 2 * cols * STEP;
      for (let g = 0; g < cols; g++) {
        layers.push(box(`scan${g}`).loop("opacity", { from: (-K * g) / cols, to: K * (1 - g / cols), period, easing: "linear" })
          .child(box(`scan${g}-in`).loop("opacity", { from: (K * (g + 1)) / cols, to: K * ((g + 1) / cols - 1), period, easing: "linear" })
            .child(col(g))));
      }
    } else layers.push(col(Math.floor((cols - 1) / 2)));
  } else if (o.state === "done") {
    const c0 = (N - 1) / 2, ring = (k) => { const [cx, cy] = xy(k); return Math.floor(Math.max(Math.abs(cx - c0), Math.abs(cy - c0))); };
    const el = now - since, dur = (ring(0) + 2) * RIPPLE;
    if (live && anim && el >= 0 && el < dur) {
      const cur = Math.floor(el / RIPPLE);
      layers.push(layer("ripple", cells.flatMap(([k, ch]) => {
        const rg = ring(k);
        if (lit(ch) && rg < cur) return [[k, COL[ch], HALO[ch]]];
        if (rg === cur) return [[k, COL.b, HALO.b]];
        return [];
      })));
      wakes.push(since + (cur + 1) * RIPPLE);
    } else {
      layers.push(layer("plate", cells.filter(([, ch]) => !lit(ch)).map(([k]) => [k, COL.b, null])).opacity(0.15));
      layers.push(layer("face", faceCells()));
    }
  } else {
    const asleep = now - since >= SLEEP;
    const rest = layer("face", faceCells());
    layers.push(asleep ? rest.opacity(0.22) : anim ? rest.loop("opacity", { from: 0.42, to: 0.72, period: 3200, easing: "ease-in-out" }) : rest.opacity(0.58));
    if (!asleep) wakes.push(since + SLEEP);
  }
  return layers;
}

// one bar of the ring, in its state's color; the waiting ones pulse
function bar(c, i, st, x, y, bw, bh, th) {
  const col = st === "blocked" ? c.t.blocked ?? "#ffdf61" : st === "working" || st === "error" ? COL.w : COL.b;
  const el = div().id(`${c.id}-bar${i}`).absolute().left(x).top(y).w(bw).h(bh).rounded(th / 2).bg(col);
  if (st === "blocked") return c.anim ? el.loop("opacity", { from: 0.3, to: 1, period: 900, easing: "ease-in-out" }) : el;
  return el.opacity(st === "idle" ? 0.3 : st === "done" ? 1 : 0.9);
}

// the tile: hop on click, the next wake
function finish(c, children) {
  const { o, memo, now, wakes, live } = c;
  const hopping = memo.hopAt != null && now - memo.hopAt < HOP;
  if (hopping) wakes.push(memo.hopAt + HOP);
  const wake = Math.min(...wakes.filter((t) => t > now));
  if (live && o.cx && Number.isFinite(wake) && memo.wake !== wake) {
    memo.wake = wake;
    o.cx.timer.after(Math.ceil(wake - now) + 5, (cx) => cx.notify());
  }
  return div().id(`companion-${c.id}`).relative().w(c.w).h(c.h).flex_none().cursor_pointer()
    .top(hopping ? -3 : 0).transition("top", { duration: hopping ? 90 : HOP, easing: "ease-out" })
    .on_click((e, cx) => {
      memo.hopAt = Date.now();
      memo.wake = null;
      o.onClick?.(e, cx);
      cx.notify();
    })
    .children(children);
}

export function cube(o) {
  const c = setup(o), { w, h, id, kids } = c;
  const s = Math.min(w, h), x0 = (w - s) / 2, y0 = (h - s) / 2;
  // geometry (css px): the frame, the ring on it when there are workers, the plate, the holes
  const r0 = Math.max(0.65, s * 0.042), th = Math.max(0.8, s * 0.042);
  const ip = kids.length ? r0 + th / 2 + Math.max(0.5, s * 0.03) : Math.max(0.75, s * 0.06);
  const side = s - 2 * ip, N = gridFor(side), M = DATA.margin, pn = (1 - 2 * M) / N;
  const d = side * pn * (N <= 5 ? 0.8 : 0.71), dl = d * 0.82, big = s >= 32;
  const cx = (i) => x0 + ip + side * (M + ((i % N) + 0.5) * pn);
  const cy = (i) => y0 + ip + side * (M + (Math.floor(i / N) + 0.5) * pn);
  const led = (i, color, halo) => {
    const el = div().absolute().left(cx(i) - dl / 2).top(cy(i) - dl / 2).w(dl).h(dl).rounded_full().bg(color);
    if (!big || !halo) return [el];
    const hd = d * 1.45;
    return [div().absolute().left(cx(i) - hd / 2).top(cy(i) - hd / 2).w(hd).h(hd).rounded_full().bg(halo), el];
  };
  const layers = stateLayers(c, N, 1, led);
  // the segmented ring
  if (kids.length) {
    const cr = Math.max(0, s * 0.12 - r0) + th, L = s - 2 * r0 - 2 * cr;
    const bars = ringBars(kids, L, Math.max(0.75, s * 0.035), Math.max(1.5, s * 0.05));
    layers.push(div().id(`${id}-ring`).absolute().left(0).top(0).w(w).h(h).children(bars.map((b, i) => {
      const len = b.b - b.a, lo = cr + b.a, hi = cr + L - b.b;
      const [x, y, bw, bh] = b.s === 0 ? [x0 + r0 + lo, y0 + r0 - th / 2, len, th]
        : b.s === 1 ? [x0 + s - r0 - th / 2, y0 + r0 + lo, th, len]
        : b.s === 2 ? [x0 + r0 + hi, y0 + s - r0 - th / 2, len, th]
        : [x0 + r0 - th / 2, y0 + r0 + hi, th, len];
      return bar(c, i, b.st, x, y, bw, bh, th);
    })));
  }
  const holes = div().id(`${id}-holes`).absolute().left(0).top(0).w(w).h(h)
    .children(Array.from({ length: N * N }, (_, i) => div().absolute().left(cx(i) - d / 2).top(cy(i) - d / 2).w(d).h(d).rounded_full().bg(COL.hole)));
  const chassis = div().absolute().left(x0).top(y0).w(s).h(s).rounded(s * 0.12).bg(COL.body).border(1).border_color("#ffffff17");
  const plate = div().absolute().left(x0 + ip).top(y0 + ip).w(side).h(side).rounded(Math.max(1, side * 0.04)).bg(COL.plate)
    .when(big, (el) => el.child(image(`brand/companions/cube/tex-${N}.svg`).w(side).h(side).opacity(s < 48 ? 0.55 : 1)));
  return finish(c, [chassis, plate, holes, ...layers]);
}

/**
 * The cube in 3/4, front and side faces (kt-chat's runner): its body is an image (brand/companions/cube/
 * body34-N[-ring].svg, src/cube.mjs: chassis, top face, both plates with texture and holes), its LEDs are
 * divs on the same projected grid (DATA.g34), lit as cube()'s, the scan running across both faces. It floats
 * (a .loop on top). A lead's ring runs down the front face's two vertical frame edges.
 */
export function cube34(o) {
  const c = setup(o), { w, h, id, kids, anim } = c;
  const W = Math.min(w, h), x0 = (w - W) / 2, y0 = (h - W) / 2, G = DATA.g34, u = W / 100;
  const N = gridFor(W * 0.44), M = DATA.margin, pn = (1 - 2 * M) / N, ring = kids.length > 0;
  const plateOf = ([tl, tr, bl]) => {
    const e = ring ? G.insetRing : G.inset;
    const at = (s, t) => [tl[0] + (tr[0] - tl[0]) * s + (bl[0] - tl[0]) * t, tl[1] + (tr[1] - tl[1]) * s + (bl[1] - tl[1]) * t];
    return [at(e, e), at(1 - e, e), at(e, 1 - e)];
  };
  const plates = [plateOf(G.F), plateOf(G.S)];
  const rl = pn * (N <= 5 ? 0.4 : 0.355) * 0.82;
  const led = (k, color, halo) => {
    const [tl, tr, bl] = plates[Math.floor(k / (N * N))], i = k % (N * N);
    const s = M + ((i % N) + 0.5) * pn, t = M + (Math.floor(i / N) + 0.5) * pn;
    const x = x0 + (tl[0] + (tr[0] - tl[0]) * s + (bl[0] - tl[0]) * t) * u, y = y0 + (tl[1] + (tr[1] - tl[1]) * s + (bl[1] - tl[1]) * t) * u;
    const ew = 2 * rl * Math.abs(tr[0] - tl[0]) * u, eh = 2 * rl * Math.abs(bl[1] - tl[1]) * u;
    const el = div().absolute().left(x - ew / 2).top(y - eh / 2).w(ew).h(eh).rounded_full().bg(color);
    if (W < 48 || !halo) return [el];
    return [div().absolute().left(x - ew * 0.8).top(y - eh * 0.8).w(ew * 1.6).h(eh * 1.6).rounded_full().bg(halo), el];
  };
  const layers = stateLayers(c, N, 2, led);
  if (ring) {
    // the front frame's left and right edges (vertical in this projection): the elder half of the workers down
    // the left, the rest down the right; past 2m, shared between states as ringBars does
    const [tl, , bl] = G.F, th = Math.max(0.8, W * 0.018), L = (bl[1] - tl[1]) * u * 0.8;
    const gap = Math.max(0.75, W * 0.02), min = Math.max(1.5, W * 0.035), m = Math.max(1, Math.floor(L / (min + gap)));
    const ws = shareBars(kids, 2 * m);
    const left = Math.ceil(ws.length / 2), top = y0 + tl[1] * u + (bl[1] - tl[1]) * u * 0.1;
    const xs = [x0 + (G.F[0][0] + 1.6) * u - th / 2, x0 + (G.F[1][0] - 1.6) * u - th / 2];
    layers.push(div().id(`${id}-ring`).absolute().left(0).top(0).w(w).h(h).children(ws.map((st, i) => {
      const side = i < left ? 0 : 1, k = side ? ws.length - left : left, j = side ? i - left : i;
      const a = (j * L) / k + gap / 2, len = L / k - gap;
      // the right edge rises with the face's top: its bars start lower by the slope
      const dy = side ? (G.F[1][1] - G.F[0][1]) * u : 0;
      return bar(c, i, st, xs[side], top + dy + a, th, len, th);
    })));
  }
  const body = image(`brand/companions/cube/body34-${N}${ring ? "-ring" : ""}.svg`).absolute().left(x0).top(y0).w(W).h(W);
  const float = div().id(`${id}-float`).absolute().left(0).top(0).w(w).h(h)
    .when(anim, (el) => el.loop("top", { from: 0, to: -W * 0.02, period: 3200, easing: "ease-in-out" }))
    .child(body).children(layers);
  return finish(c, [float]);
}
