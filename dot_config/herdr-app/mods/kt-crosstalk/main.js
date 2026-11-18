// kbrdn Threads' Crosstalk (the "crosstalk" child of the right panel's stack):
// what Claude Code sessions told each other, as the crosstalk plugin keeps it
// (`~/.claude/plugins/store/crosstalk_*.json`: `thread:<session id>` ->
// { savedAt, entries: [{ dir: in|out, peer, text, at }], aliases, selected }).
// The focused terminal's session first (its id from the statusline's
// herdr-<terminal>.json), or every session. One row a conversation (peer, last
// message, time, new count), a click opens it, by day, theirs left and its own
// right. READ-ONLY: replying goes through /crosstalk in the session. The
// plugin keeps its unread counts in the session's memory only (never stored),
// so "nouveaux" here is this panel's own: messages since you last opened that
// conversation here (localStorage). Reads every 5 s while shown.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { focused, panes, spaces, theme, layout, home, nextCommand, checking } from "herdr";
import * as fs from "fs/promises";

const ME = "crosstalk"; // this block's id in the layout's "panel-body" stack
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const STORE = () => `${home()}/.claude/plugins/store`;
const STATUSLINE = () => `${home()}/.claude/cache/statusline`;
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
function visible() {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body && (body.active ?? body.children?.[0]?.id) === ME);
}
function terminal() {
  const f = focused()?.terminal;
  if (f && !f.includes("/")) return f;
  const tab = spaces().find((s) => s.active)?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal && !p.terminal.includes("/"));
  return (mine.find((p) => p.program?.agent) ?? mine[0])?.terminal ?? null;
}
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const pad = (n) => String(n).padStart(2, "0");
const clock = (at) => { const d = new Date(at); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayOf = (at) => { const d = new Date(at); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
function when(at) {
  if (!at) return "";
  const d = new Date(at), now = new Date();
  return d.toDateString() === now.toDateString() ? clock(at) : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default class Crosstalk extends View {
  init(_props, cx) {
    this.threads = {}; // session id -> saved thread
    this.terms = {}; // session id -> terminal (from the statusline files)
    this.term = null;
    this.session = null;
    this.all = false;
    this.open = null; // { sid, peer }
    this.hot = null;
    this.scroll = ScrollHandle.new();
    if (checking()) return;
    this.seen = load("seen") ?? {};
    this.since = load("since") ?? Date.now();
    save("since", this.since);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "open-first") { const first = this.conversations()[0]; if (first) this.openConv(first, cx); }
        else if (c === "back") this.open = null;
        cx.notify();
      }
    });
    this.read(cx);
    cx.timer.every(5000, (cx) => this.read(cx));
  }

  read(cx) {
    if (!visible() || this.reading) return;
    const term = terminal();
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        // fs reads past readTextFile's 1 MiB: the store already holds ~0.5 MB.
        const names = (await fs.readdir(STORE()).catch(() => [])).filter((n) => n.startsWith("crosstalk_") && n.endsWith(".json"));
        const texts = await Promise.all(names.map((n) => fs.readFile(`${STORE()}/${n}`, "utf8").catch(() => null)));
        const lines = (await fs.readdir(STATUSLINE()).catch(() => [])).filter((n) => /^herdr-t[^/]*\.json$/.test(n));
        const sls = await Promise.all(lines.map((n) => fs.readFile(`${STATUSLINE()}/${n}`, "utf8").catch(() => null)));
        const key = JSON.stringify([term, texts.map((s) => s?.length ?? 0), sls]);
        if (key === this.key && texts.join("") === this.raw) return;
        this.key = key;
        this.raw = texts.join("");
        const threads = {};
        for (const s of texts) {
          for (const [k, v] of Object.entries(parse(s) ?? {})) {
            if (!k.startsWith("thread:") || !Array.isArray(v?.entries)) continue;
            const sid = k.slice(7);
            if (!threads[sid] || (v.savedAt ?? 0) > (threads[sid].savedAt ?? 0)) threads[sid] = v;
          }
        }
        const terms = {};
        lines.forEach((n, i) => { const sid = parse(sls[i] ?? "")?.session_id; if (sid) terms[sid] = n.slice(6, -5); });
        this.threads = threads;
        this.terms = terms;
        this.term = term;
        this.session = Object.keys(terms).find((sid) => terms[sid] === term) ?? null;
        cx.notify();
      } finally { this.reading = false; }
    });
  }

  // Conversations: [{ sid, peer, entries, last, unread }], latest first.
  conversations() {
    const sids = this.all || !this.session ? Object.keys(this.threads) : [this.session];
    const out = [];
    for (const sid of sids) {
      const byPeer = new Map();
      for (const e of this.threads[sid]?.entries ?? []) {
        if (!byPeer.has(e.peer)) byPeer.set(e.peer, []);
        byPeer.get(e.peer).push(e);
      }
      for (const [peer, entries] of byPeer) {
        const last = entries[entries.length - 1];
        const seen = Math.max(this.seen[`${sid}|${peer}`] ?? 0, this.since ?? 0);
        out.push({ sid, peer, entries, last, unread: entries.filter((e) => e.dir === "in" && (e.at ?? 0) > seen).length });
      }
    }
    return out.sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));
  }

  openConv(c, cx) {
    this.open = { sid: c.sid, peer: c.peer };
    this.seen[`${c.sid}|${c.peer}`] = c.last?.at ?? Date.now();
    save("seen", this.seen);
    this.scroll.scroll_to_item(Math.max(0, c.entries.length * 2));
    cx.notify();
  }

  tag(t, color, text) {
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .font_family(MONO).text_size(10.5).text_color(color).child(String(text));
  }

  row(t, c, i) {
    const k = `${c.sid}|${c.peer}`;
    const hot = this.hot === k;
    const live = this.terms[c.sid];
    return v_flex().id(`xt-row-${i}`).px(12).py(9).gap(4).rounded(12).cursor_pointer()
      .when(hot, (el) => el.bg(t.hover))
      .on_hover((on, cx) => { const n = on ? k : this.hot === k ? null : this.hot; if (n !== this.hot) { this.hot = n; cx.notify(); } })
      .on_click((_e, cx) => this.openConv(c, cx))
      .child(h_flex().gap(8).items_center()
        .child(div().size(7).flex_none().rounded_full().bg(c.unread ? t.accent : t.input))
        .child(div().flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(t.foreground).child(c.peer))
        .when(c.unread > 0, (el) => el.child(h_flex().h(16).min_w(16).px(4).items_center().justify_center().rounded_full().bg(t.accent)
          .font_family(MONO).text_size(10).font_weight(600).text_color(t.accent_foreground).child(String(c.unread))))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(when(c.last?.at))))
      .child(div().pl(15).text_size(12).line_height("17px").max_h(34).overflow_hidden().text_color(t.muted)
        .child(`${c.last?.dir === "out" ? "toi : " : ""}${(c.last?.text ?? "").replace(/\s+/g, " ").slice(0, 220)}`))
      .when(this.all || !this.session, (el) => el.child(h_flex().pl(15).gap(6)
        .child(this.tag(t, t.dim, `session ${c.sid.slice(0, 8)}`))
        .when(Boolean(live), (el) => el.child(this.tag(t, t.muted, live)))));
  }

  conversation(t, c) {
    const out = [];
    let day = null;
    c.entries.forEach((e, i) => {
      const d = e.at ? dayOf(e.at) : null;
      if (d && d !== day) {
        day = d;
        out.push(h_flex().flex_none().py(8).gap(10).items_center()
          .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border))
          .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(d.toUpperCase()))
          .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border)));
      }
      const mine = e.dir === "out";
      out.push(v_flex().id(`xt-msg-${i}`).flex_none().w_full().gap(4).py(4).when(mine, (el) => el.items_end())
        .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${mine ? "toi" : c.peer}${e.at ? ` · ${clock(e.at)}` : ""}`))
        .child(div().max_w(420).px(12).py(8).rounded(12).text_size(12.5).line_height("18px").text_color(t.foreground)
          .bg(mine ? alpha(t.accent, "1f") : t.raised)
          .border(1).border_color(mine ? alpha(t.accent, "4d") : t.border)
          .child(e.text)));
    });
    return out;
  }

  render(cx) {
    const vis = visible();
    if (vis && !this.shown && !checking()) this.read(cx);
    this.shown = vis;
    const t = theme();
    const card = () => v_flex().rounded(16).border(1).border_color(t.border).bg(t.background);
    const convs = this.conversations();
    const scope = this.all || !this.session ? "Toutes les sessions" : `Session de ${this.term}`;
    const seg = (id, label, on, enabled, fn) => h_flex().id(id).h(26).px(11).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00")).when(on, (el) => el.bg(alpha(t.accent, "24")))
      .text_size(12).text_color(on ? t.foreground : enabled ? t.muted : t.dim)
      .when(enabled && !on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { fn(); cx.notify(); }))
      .child(label);
    const head = card().flex_none().px(12).py(10).gap(8)
      .child(h_flex().gap(8).items_center()
        .child(svg("mods/kt-panel-head/messages-square.svg").size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.muted).child(scope.toUpperCase()))
        .child(this.tag(t, t.dim, "lecture seule")))
      .child(h_flex().gap(4)
        .child(seg("xt-mine", "Cette session", !this.all && Boolean(this.session), Boolean(this.session), () => { this.all = false; this.open = null; }))
        .child(seg("xt-all", "Toutes", this.all || !this.session, true, () => { this.all = true; this.open = null; })));
    const c = this.open && convs.find((x) => x.sid === this.open.sid && x.peer === this.open.peer);
    if (c) {
      return v_flex().size_full().gap(4).text_color(t.foreground)
        .child(head)
        .child(card().flex_1().min_h(0)
          .child(h_flex().flex_none().h(40).px(8).gap(8).items_center()
            .child(div().id("xt-back").p(5).rounded_full().text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
              .on_click((_e, cx) => { this.open = null; cx.notify(); })
              .child(svg("mods/kt-crosstalk/chevron-left.svg").size(14).flex_none()))
            .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_semibold().child(c.peer))
            .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(`${c.entries.length} message${c.entries.length > 1 ? "s" : ""}`)))
          .child(div().mx(12).flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
          .child(v_flex().id("xt-msgs").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).px(12).py(6)
            .children(this.conversation(t, c)))
          .child(div().flex_none().px(14).py(8).border_t(1).border_dashed().border_color(t.border).font_family(MONO).text_size(10.5).text_color(t.dim)
            .child("Répondre : /crosstalk dans la session (SendMessage).")));
    }
    const empty = !Object.keys(this.threads).length ? "Aucune conversation crosstalk enregistrée."
      : "Aucune conversation pour cette session.";
    return v_flex().size_full().gap(4).text_color(t.foreground)
      .child(head)
      .child(card().flex_1().min_h(0)
        .child(v_flex().id("xt-list").flex_1().min_h(0).overflow_y_scrollbar().p(4).gap(2)
          .when(!convs.length, (el) => el.child(div().p(12).text_size(13).text_color(t.dim).child(empty)))
          .children(convs.map((x, i) => this.row(t, x, i))))
        .child(div().flex_none().px(14).py(8).border_t(1).border_dashed().border_color(t.border).font_family(MONO).text_size(10.5).text_color(t.dim)
          .child("Nouveaux : depuis ta dernière ouverture ici. Le plugin ne stocke pas ses non-lus.")));
  }
}
