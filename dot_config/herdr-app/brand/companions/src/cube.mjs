// bun ~/.config/herdr-app/brand/companions/src/cube.mjs [--pose kt-threads,kbrdn-agents,...]
//
// The LED cube companions' build (carry/mascot/cube-led.html, validated by Kylian on 2026-11-20):
// - the catalog: 7 shape families x 10 variants, each face rasterized on the 4x4..7x7 grids. The 70 pool
//   draws (PICKS) were chosen once by carry/mascot/alloc.cjs (`node alloc.cjs 4 4 4 5`): the 70 stay at
//   least 4 LED apart at 5x5 and 6x6, 5 at 7x7. At 4x4 a face is a code word (mirrored faces lighting 2 or 4
//   pairs: two of them always differ by 4 LED), the free one nearest its shape.
// - the circuit textures, one SVG per grid (cube/tex-N.svg), aligned on the holes companion-cube.js draws.
// - companion-cube.js's DATA block (brand's copy).
// --pose <mods>: copies brand's companion-cube.js and companion-logo.js into those mods (never kt-chat
// without the lead's go: one writer at a time there).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const APP = `${homedir()}/.config/herdr-app`;
const ROOT = `${APP}/brand/companions`;
const GRIDS = [4, 5, 6, 7];
const MARGIN = 0.07; // the plate's margin, as companion-cube.js lays the holes out (fraction of the plate)

function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = (r, a, b) => a + (b - a) * r();
const hf = (s) => fnv(s) / 4294967296;

const FAM = [
  { id: "losange", params: (r) => ({ a: R(r, .62, 1.05), hole: r() < .4 ? R(r, .18, .4) : -1 }), f: (au, v, p) => { const d = au + Math.abs(v); return d < p.a && d > p.hole; } },
  { id: "anneau", params: (r) => ({ r1: R(r, .3, .5), r2: R(r, .72, .98), sq: R(r, .85, 1.25) }), f: (au, v, p) => { const d = Math.hypot(au, v * p.sq); return d > p.r1 && d < p.r2; } },
  { id: "chevron", params: (r) => ({ k: R(r, .7, 1.1), o: R(r, .1, .45), w: R(r, .2, .32), dir: r() < .5 ? 1 : -1 }), f: (au, v, p) => Math.abs(v * p.dir - (au * p.k - p.o)) < p.w },
  { id: "sablier", params: (r) => ({ k: R(r, .6, 1), c: R(r, .05, .25), h: R(r, .7, .95) }), f: (au, v, p) => au < Math.abs(v) * p.k + p.c && Math.abs(v) < p.h },
  { id: "regard", params: (r) => ({ ex: R(r, .35, .6), ey: R(r, -.55, -.2), er: R(r, .2, .32), my: R(r, .3, .6), mh: R(r, .1, .2), mw: R(r, .25, .6) }), f: (au, v, p) => Math.hypot(au - p.ex, v - p.ey) < p.er || (Math.abs(v - p.my) < p.mh && au < p.mw) },
  { id: "colonnes", params: (r) => ({ b1: R(r, .1, .35), b2: R(r, .5, .8), h: R(r, .6, .95) }), f: (au, v, p) => au > p.b1 && au < p.b2 && Math.abs(v) < p.h },
  { id: "arche", params: (r) => ({ o: R(r, .1, .5), r1: R(r, .35, .55), r2: R(r, .7, .95), cut: R(r, .2, .6) }), f: (au, v, p) => { const d = Math.hypot(au, v - p.o); return d > p.r1 && d < p.r2 && v < p.cut; } },
];
const PICKS = [[0,6,8,33,36,66,131,133,341,457],[3,5,13,15,16,37,47,80,138,139],[1,2,3,5,14,19,24,34,40,44],[0,2,3,18,23,34,39,40,43,48],[13,15,20,31,40,44,55,98,130,162],[0,2,26,77,97,112,179,191,448,737],[0,3,4,13,21,27,80,231,273,303]];
const TONE_MODES = ["coeur", "bord", "haut", "accent", "mixte"];

function makeCore(key, f) {
  const r = rng(fnv(key));
  const p = FAM[f].params(r);
  const acc = [];
  if (r() < .55) acc.push({ x: R(r, .3, .85), y: R(r, -.85, .85), rad: R(r, .17, .27), add: true });
  if (r() < .3) acc.push({ x: R(r, 0, .45), y: R(r, -.6, .6), rad: R(r, .14, .22), add: false });
  const tone = TONE_MODES[Math.floor(r() * TONE_MODES.length)];
  return { key, f, p, acc, tone, flip: r() < .5, ts: String(fnv(key + "#t")) };
}
function toneOf(core, c, uc, vc, accFrac) {
  let blue;
  switch (core.tone) {
    case "coeur": blue = c < .9; break;
    case "bord": blue = Math.hypot(uc, vc) > .6; break;
    case "haut": blue = vc >= 0; break;
    case "accent": blue = accFrac > .5; break;
    default: blue = hf(core.ts + ":" + Math.round(Math.abs(uc) * 4) + ":" + Math.round(vc * 4)) < .38;
  }
  if (core.flip && core.tone !== "accent") blue = !blue;
  return blue ? "b" : "w";
}
// one grid: on, tone (every cell), veil (a faint blue on some unlit holes, 6x6 and up)
function raster(core, N) {
  const n = N * N, on = new Uint8Array(n), veil = new Uint8Array(n), tone = new Array(n).fill("w"), SS = 6;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let cov = 0, acc = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const u = -1 + 2 * (x + (i + .5) / SS) / N, v = -1 + 2 * (y + (j + .5) / SS) / N, au = Math.abs(u);
      const main = FAM[core.f].f(au, v, core.p);
      let o = main, accent = false;
      for (const a of core.acc) if (Math.hypot(au - a.x, v - a.y) < a.rad) { o = a.add; accent = a.add && !main; }
      if (o) { cov++; if (accent) acc++; }
    }
    const c = cov / (SS * SS), idx = y * N + x, uc = -1 + 2 * (x + .5) / N, vc = -1 + 2 * (y + .5) / N;
    tone[idx] = toneOf(core, c, uc, vc, acc / Math.max(1, cov));
    if (c >= .42) on[idx] = 1;
    else if (N >= 6 && hf(core.ts + ":v:" + Math.min(x, N - 1 - x) + ":" + y + ":" + N) < .1) veil[idx] = 1;
  }
  return { on, veil, tone };
}
const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] !== b[i]; return d; };
const waitView = (on) => { const b = Uint8Array.from(on); for (const c of [0, 3, 12, 15]) b[c] = 1; return b; };

// ---- the catalog ----
const CAT = FAM.map((fam, fi) => PICKS[fi].map((i, v) => Object.assign(makeCore(fam.id + "#" + i, fi), { v })));
const ALL = CAT.flat();
const raw4 = new Map(ALL.map((c) => [c, raster(c, 4).on]));
const WORDS = [];
for (let m = 0; m < 256; m++) {
  let w = 0; for (let b = 0; b < 8; b++) w += (m >> b) & 1;
  if (w !== 2 && w !== 4) continue;
  const on = new Uint8Array(16);
  for (let r = 0; r < 4; r++) {
    if ((m >> (2 * r)) & 1) { on[r * 4] = 1; on[r * 4 + 3] = 1; }
    if ((m >> (2 * r + 1)) & 1) { on[r * 4 + 1] = 1; on[r * 4 + 2] = 1; }
  }
  WORDS.push(on);
}
{
  const used = new Set(), pairs = [];
  const fits = (c, w, skip) => CAT[c.f].every((o) => o === c || o === skip || !o.w4 || ham(waitView(o.w4), waitView(w)) >= 4);
  ALL.forEach((c) => WORDS.forEach((w, k) => pairs.push([ham(w, raw4.get(c)), c.f, c.v, k])));
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
  for (const [d, f, v, k] of pairs) {
    const c = CAT[f][v];
    if (c.w4 || used.has(k) || !fits(c, WORDS[k])) continue;
    used.add(k); c.w4 = WORDS[k]; c.wk = k; c.d4 = d;
  }
  for (let pass = 0; pass < 6; pass++) {
    let moved = 0;
    for (const a of ALL) {
      for (let k = 0; k < WORDS.length; k++) {
        if (used.has(k)) continue;
        const d = ham(WORDS[k], raw4.get(a));
        if (d < a.d4 && fits(a, WORDS[k])) { used.delete(a.wk); used.add(k); a.w4 = WORDS[k]; a.wk = k; a.d4 = d; moved++; }
      }
      for (const b of ALL) {
        if (a === b) continue;
        const da = ham(b.w4, raw4.get(a)), db = ham(a.w4, raw4.get(b));
        if (Math.max(da, db) < Math.max(a.d4, b.d4) && fits(a, b.w4, b) && fits(b, a.w4, a)) {
          [a.w4, b.w4] = [b.w4, a.w4]; [a.wk, b.wk] = [b.wk, a.wk]; a.d4 = da; b.d4 = db; moved++;
        }
      }
    }
    if (!moved) break;
  }
}
// a face on a grid as one string, a char per cell: "." off, "w"/"b" lit white/blue, "v" veiled
const faces = CAT.map((fc) => fc.map((c) => {
  const out = {};
  for (const N of GRIDS) {
    const g = raster(c, N), on = N === 4 ? c.w4 : g.on;
    out[N] = Array.from({ length: N * N }, (_, i) => (on[i] ? g.tone[i] : g.veil[i] ? "v" : ".")).join("");
  }
  return out;
}));
// checks: the build refuses a catalog that is not what the page verified
for (const N of GRIDS) {
  let m = Infinity;
  for (let i = 0; i < ALL.length; i++) for (let j = i + 1; j < ALL.length; j++) {
    const a = faces[ALL[i].f][ALL[i].v][N], b = faces[ALL[j].f][ALL[j].v][N];
    let d = 0; for (let k = 0; k < a.length; k++) d += (a[k] === "w" || a[k] === "b") !== (b[k] === "w" || b[k] === "b");
    m = Math.min(m, d);
  }
  if (m < 4) throw new Error(`grid ${N}: two faces only ${m} LED apart`);
}

// ---- the circuit textures: a 220-unit square, the plate; traces run between the holes ----
// texture(N, kind, gid): the plate's inner SVG (no wrapper), its background from gradient #gid.
function texture(N, kind = "front", gid = "g") {
  const r = rng(fnv("tex:" + kind + ":" + N)), T = 220, m = MARGIN, p = (1 - 2 * m) / N, P = p * T, U = 1;
  const X = (k) => +((m + k * p) * T).toFixed(2);
  const f2 = (v) => +v.toFixed(2);
  const out = [];
  out.push(`<rect width="${T}" height="${T}" fill="url(#${gid})"/>`);
  for (let i = 0; i < 220; i++) out.push(`<rect x="${f2(r() * T)}" y="${f2(r() * T)}" width=".6" height=".6" fill="#fff" fill-opacity=".03"/>`);
  out.push(`<rect x="${f2(m * T * .35)}" y="${f2(m * T * .35)}" width="${f2(T - m * T * .7)}" height="${f2(T - m * T * .7)}" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width=".55"/>`);
  const tr = [], vias = [];
  for (let i = 0; i < N * 3; i++) {
    const vert = r() < .5, k = Math.floor(r() * (N + 1)), a = Math.floor(r() * N), len = 1 + Math.floor(r() * 3);
    const turn = r() < .6, dir = r() < .5 ? -1 : 1, kk = Math.max(0, Math.min(N, k + dir * (1 + Math.floor(r() * 2))));
    const lanes = r() < .3 ? [-U * 1.1, U * 1.1] : [(r() - .5) * U * 1.6];
    const b = Math.min(N, a + len), ch = P * .12;
    const pt = (al, ac) => (vert ? [f2(ac), f2(al)] : [f2(al), f2(ac)]);
    for (const o of lanes) {
      const x0 = X(k) + o, y0 = X(a), y1 = X(b) + o;
      const pts = [pt(y0, x0)];
      if (turn && kk !== k) pts.push(pt(y1 - ch, x0), pt(y1, x0 + dir * ch), pt(y1, X(kk)));
      else pts.push(pt(X(b), x0));
      tr.push(`<polyline points="${pts.map((q) => q.join(",")).join(" ")}"/>`);
      vias.push(`<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="1.1"/>`);
    }
  }
  out.push(`<g fill="none" stroke="#a0b0c0" stroke-opacity=".24" stroke-width=".55">${tr.join("")}</g>`);
  out.push(`<g fill="#0d0e11" stroke="#a0b0c0" stroke-opacity=".24" stroke-width=".55">${vias.join("")}</g>`);
  const chips = [];
  for (let i = 0; i < Math.max(2, Math.floor(N / 2)); i++) {
    const kx = 1 + Math.floor(r() * (N - 1)), ky = 1 + Math.floor(r() * (N - 1)), s = P * .2;
    const x = f2(X(kx) - s / 2), y = f2(X(ky) - s / 2);
    chips.push(`<rect x="${x}" y="${y}" width="${f2(s)}" height="${f2(s)}"/>`);
    for (let q = 1; q < 4; q++) { const o = f2(x + s * q / 4); chips.push(`<line x1="${o}" y1="${y}" x2="${o}" y2="${f2(y - U)}"/><line x1="${o}" y1="${f2(y + s)}" x2="${o}" y2="${f2(y + s + U)}"/>`); }
  }
  out.push(`<g fill="#0a0b0d" stroke="#aabacc" stroke-opacity=".27" stroke-width=".55">${chips.join("")}</g>`);
  const frames = [];
  for (let i = 0; i < 2 && N > 2; i++) {
    const bx = Math.floor(r() * (N - 1)), by = Math.floor(r() * (N - 1));
    frames.push(`<rect x="${f2(X(bx) + U)}" y="${f2(X(by) + U)}" width="${f2(2 * P - 2 * U)}" height="${f2(2 * P - 2 * U)}"/>`);
  }
  out.push(`<g fill="none" stroke="#fff" stroke-opacity=".055" stroke-width=".55">${frames.join("")}</g>`);
  // glyph runs in the top and bottom margins: labels without words
  const band = m * T, glyphs = [];
  const run = (x0, y0, maxX) => {
    let x = x0;
    while (x < maxX) {
      const n = 3 + Math.floor(r() * 5);
      for (let gI = 0; gI < n && x < maxX; gI++) {
        const bars = 1 + Math.floor(r() * 3);
        for (let q = 0; q < bars; q++) { const w = U * (.5 + r() * .9); glyphs.push(`<rect x="${f2(x)}" y="${f2(y0)}" width="${f2(w)}" height="1.8"/>`); x += w + U * .35; }
        x += U * .9;
      }
      x += U * 4 + r() * U * 10;
    }
  };
  run(band * 1.2, band * .5 - U, T * (.35 + r() * .3));
  run(T * .55, T - band * .5 - U, T - band * 1.4);
  out.push(`<g fill="#cddae8" fill-opacity=".22">${glyphs.join("")}</g>`);
  const cs = band * .72, cx = T - band * .92, cy = band * .14, grid = [];
  for (let q = 1; q < 4; q++) grid.push(`<line x1="${f2(cx + cs * q / 4)}" y1="${f2(cy)}" x2="${f2(cx + cs * q / 4)}" y2="${f2(cy + cs)}"/><line x1="${f2(cx)}" y1="${f2(cy + cs * q / 4)}" x2="${f2(cx + cs)}" y2="${f2(cy + cs * q / 4)}"/>`);
  out.push(`<g fill="none" stroke="#aabacc" stroke-opacity=".15" stroke-width=".55"><rect x="${f2(cx)}" y="${f2(cy)}" width="${f2(cs)}" height="${f2(cs)}"/>${grid.join("")}</g>`);
  return out.join("");
}
const GRAD = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const flatTexture = (N) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220"><defs>${GRAD("g", "#1c1e22", "#0e0f11")}</defs>${texture(N)}</svg>\n`;

// ---- the 3/4 cube's body (kt-chat's runner): an image, its LEDs drawn on top by companion-cube.js ----
// A parallel projection, so a face is a parallelogram and an SVG matrix lays the flat plate (texture, holes)
// on it exactly; companion-cube.js places the LEDs with the same corners (DATA.g34). Box: 100 x 100.
// F: the front face's chassis [top left, top right, bottom left]; S: the side face's; inset: the plate in it
// (insetRing: room for a lead's ring on the frame).
const G34 = { F: [[7, 17], [55, 23], [7, 83]], S: [[55, 23], [94, 16], [55, 89]], inset: 0.045, insetRing: 0.08 };
const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const corner4 = ([tl, tr, bl]) => [tl, tr, bl, add(tr, sub(bl, tl))];
const at = (q, s, t) => [q[0][0] + (q[1][0] - q[0][0]) * s + (q[2][0] - q[0][0]) * t, q[0][1] + (q[1][1] - q[0][1]) * s + (q[2][1] - q[0][1]) * t];
const insetQ = (q, e) => [at(q, e, e), at(q, 1 - e, e), at(q, e, 1 - e)];
function body34(N, inset) {
  const f2 = (v) => +v.toFixed(3);
  const pts = (ps) => ps.map((p) => p.map(f2).join(",")).join(" ");
  const [fTL, nT, fBL, nB] = corner4(G34.F), [, sTR, , sBR] = corner4(G34.S);
  const back = add(fTL, sub(sTR, nT));
  const p = (1 - 2 * MARGIN) / N, rh = p * 220 * (N <= 5 ? 0.4 : 0.355);
  const holes = Array.from({ length: N * N }, (_, i) => `<circle cx="${f2((MARGIN + ((i % N) + 0.5) * p) * 220)}" cy="${f2((MARGIN + (Math.floor(i / N) + 0.5) * p) * 220)}" r="${f2(rh)}"/>`).join("");
  const plate = (q, kind, gid, shade) => {
    const [tl, tr, bl] = insetQ(q, inset);
    const mx = [(tr[0] - tl[0]) / 220, (tr[1] - tl[1]) / 220, (bl[0] - tl[0]) / 220, (bl[1] - tl[1]) / 220, tl[0], tl[1]].map(f2).join(" ");
    return `<g transform="matrix(${mx})">${texture(N, kind, gid)}<g fill="#040506" stroke="#ffffff" stroke-opacity=".07" stroke-width="1.2">${holes}</g>`
      + (shade ? `<rect width="220" height="220" fill="#000" fill-opacity="${shade}"/>` : "") + `</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${GRAD("g", "#1c1e22", "#0e0f11")}${GRAD("gs", "#141518", "#0a0b0c")}`
    + `<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16181c"/><stop offset="1" stop-color="#262a30"/></linearGradient>`
    + `<radialGradient id="sh"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".6" stop-color="#28506e" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`
    + `<ellipse cx="52" cy="96" rx="38" ry="3.2" fill="url(#sh)"/>`
    + `<polygon points="${pts([fTL, back, sTR, nT])}" fill="url(#top)"/>`
    + `<polygon points="${pts([fTL, nT, nB, fBL])}" fill="#0d0e11"/><polygon points="${pts([nT, sTR, sBR, nB])}" fill="#08090b"/>`
    + plate(G34.F, "front", "g", 0) + plate(G34.S, "side", "gs", 0.2)
    + `<g fill="none" stroke-linejoin="round"><polyline points="${pts([fTL, nT, sTR])}" stroke="#fff" stroke-opacity=".13" stroke-width=".4"/>`
    + `<polyline points="${pts([fTL, back, sTR])}" stroke="#fff" stroke-opacity=".07" stroke-width=".4"/>`
    + `<line x1="${f2(nT[0])}" y1="${f2(nT[1])}" x2="${f2(nB[0])}" y2="${f2(nB[1])}" stroke="#fff" stroke-opacity=".24" stroke-width=".6"/>`
    + `<polyline points="${pts([fTL, fBL, nB, sBR, sTR])}" stroke="#fff" stroke-opacity=".05" stroke-width=".4"/></g></svg>\n`;
}

mkdirSync(`${ROOT}/cube`, { recursive: true });
for (const N of GRIDS) {
  writeFileSync(`${ROOT}/cube/tex-${N}.svg`, flatTexture(N));
  writeFileSync(`${ROOT}/cube/body34-${N}.svg`, body34(N, G34.inset));
  writeFileSync(`${ROOT}/cube/body34-${N}-ring.svg`, body34(N, G34.insetRing));
}

const DATA = { grids: GRIDS, margin: MARGIN, families: FAM.map((f) => f.id), faces, g34: G34 };
const js = `${ROOT}/companion-cube.js`;
const src = readFileSync(js, "utf8");
const [head, rest] = src.split("// <data>");
const tail = rest.split("// </data>")[1];
writeFileSync(js, head + "// <data> written by src/cube.mjs: do not edit by hand\nconst DATA = " + JSON.stringify(DATA) + ";\n// </data>" + tail);
const d4 = ALL.map((c) => c.d4);
console.log(`cube: 70 faces, 4x4 code vs shape ${(d4.reduce((s, x) => s + x, 0) / 70).toFixed(2)} LED on average, ${Math.max(...d4)} at worst; textures cube/tex-{${GRIDS}}.svg`);

const pose = process.argv.indexOf("--pose");
if (pose > 0) {
  for (const mod of (process.argv[pose + 1] ?? "").split(",").filter(Boolean)) {
    if (mod === "kt-chat" && !process.env.KT_CHAT_GO) throw new Error("kt-chat: the lead's go first (KT_CHAT_GO=<base hash>)");
    const dir = `${APP}/mods/${mod}`;
    if (!existsSync(`${dir}/companion-logo.js`)) throw new Error(`${mod} has no companion-logo.js`);
    for (const f of ["companion-cube.js", "companion-logo.js"]) copyFileSync(`${ROOT}/${f}`, `${dir}/${f}`);
    console.log(`posed: ${mod}`);
  }
}
