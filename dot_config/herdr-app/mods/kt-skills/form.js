// form.js: "+ Ajouter" for kt-skills and kt-mcp. Written once in mods/kt-mcp/form.js and copied byte
// for byte into mods/kt-skills (edit here, then copy). The page opens its own mod as a popup with
// props { add: "menu", ...context } (AddMenu: the ways to add), and a way as a dialog with props
// { add: <method id>, ...context } (AddForm: its fields, then a confirmation showing the exact
// command, secrets masked, then the run). Props carry only the context (space, folders), never what
// is typed: values stay in the form's memory and go to the command as argv.
// A method (the mod's add.js): { id, label, hint, icon, badge?, title, intro, fields | fields(ctx),
// plan(values, ctx) -> { error } | { shown, cwd?, preview?, previewLabel?, note?, label?, run, cancel? }
// } or { ..., direct(ctx) } (no form). `run()` answers a toast ({ level, title, body }), masked.
// Fields are real ones (gpui-base Input / Textarea): "text" (`secret`: masked, the eye shows it while
// it's typed in), "pairs" (KEY / value rows, values masked the same way), "choice" (chips), "json"
// (a textarea, its text masked by `mask` once left), "folder" (a path, typed or picked).
// Keys (vim.js): a field types (INSERT): tab / shift-tab next / previous field, enter the
// confirmation, esc NORMAL. NORMAL: j / k the fields, h / l a choice, i, / or l types in the field,
// enter the confirmation, q or esc closes. Confirmation: y or enter runs, n or esc back, q closes.
// Commands for tests, taken by the copy with the role: `<mod>.menu-key:<keys>`,
// `<mod>.form-key:<keys>`, `<mod>.form-set:<field>=<value>` (pairs: K=V;K2=V2).

import { div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea } from "gpui-base";
import { theme, settings, props, openOverlay, closeOverlay, notify, pickFolder, home } from "herdr";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { makeT } from "./i18n.js";
import words from "./form.strings.js";

// Its own words (I18N.md), copied with it; a method's are its mod's (add.js).
const tr = makeT(words);
const MONO = "Monaspace Krypton";
const CARD = 580;
const I = (name) => `mods/kt-threads/${name}.svg`;
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
export const tilde = (p) => (p && (p === home() || p.startsWith(home() + "/")) ? `~${p.slice(home().length)}` : p ?? "");
// Props for the next overlay: the context, without this one's overlay id.
const context = () => { const { overlay, add, ...ctx } = props() ?? {}; return ctx; };
const fieldsOf = (m, ctx) => (typeof m.fields === "function" ? m.fields(ctx) : m.fields ?? []);

// The popup's size for `n` ways (its rows are 54 px).
export const menuSize = (n) => ({ width: 360, height: 46 + 54 * n });

function eyebrow(t, text, color) {
  return div().font_family(MONO).text_size(10.5).text_color(color ?? t.muted).child(String(text).toUpperCase());
}

function mode(t, label, on) {
  return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
    .border_color(on ? alpha(t.accent, "66") : t.border).bg(on ? alpha(t.accent, "24") : t.background)
    .font_family(MONO).text_size(9).text_color(on ? t.accent : t.muted).child(label);
}

// ---------- the menu (a popup) ----------

export class AddMenu {
  constructor(mod, methods, cx) {
    this.mod = mod;
    this.methods = methods;
    this.cur = 0;
    this.vim = new Vim();
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  // A way: its form first, then this popup goes (a form-less way acts at once).
  pick(m) {
    const ctx = context();
    if (m.direct) m.direct(ctx);
    else openOverlay({ mod: this.mod, kind: "dialog", width: 1, height: 1, frame: "none", modal: true, props: { ...ctx, add: m.id } });
    closeOverlay(props().overlay);
  }

  command(c) {
    if (c.startsWith("menu-key:")) for (const k of keysOf(c.slice(9))) this.press(k);
  }

  press(k) {
    const a = this.vim.handle(k);
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.cur = Math.max(0, step(a, this.cur, this.methods.length, this.vim.count, 8));
    else if (a === "open" || a === "right") this.pick(this.methods[this.cur]);
    else if (a === "quit" || a === "escape") closeOverlay(props().overlay);
    else return Boolean(a);
    return true;
  }

  render() {
    const t = theme();
    const keyed = this.handle.is_focused();
    // The popup (16) holds its rows 4 px in (12), each its tile 6 px in (6).
    return v_flex().id("add-menu").w_full().p(4).gap(2).rounded(16).bg(t.popover).border(1).border_color(t.border).shadow_lg()
      .track_focus(this.handle)
      .on_key_down((e, cx) => { if (this.press(e)) { cx.stop_propagation(); cx.notify(); } })
      .child(h_flex().h(28).px(10).items_center().child(eyebrow(t, tr("add"), t.dim).flex_1()).when(keyed, (el) => el.child(mode(t, this.vim.label, false))))
      .children(this.methods.map((m, i) => {
        const cursor = keyed && i === this.cur;
        return h_flex().id(`add-m-${m.id}`).h(52).p(6).pr(10).gap(10).items_center().rounded(12).border(1)
          .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
          .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
          .when(!cursor, (el) => el.hover((s) => s.bg(t.hover)))
          .cursor_pointer()
          .on_click((_e, cx) => { this.pick(m); cx.notify(); })
          .child(div().size(38).flex_none().rounded(6).border(1).border_color(t.border).bg(t.raised).flex().items_center().justify_center()
            .child(svg(m.icon).size(16).text_color(t.foreground)))
          .child(v_flex().flex_1().min_w(0).gap(2)
            .child(h_flex().gap(7).items_center()
              .child(div().min_w(0).truncate().text_size(13).font_medium().text_color(t.foreground).child(m.label))
              .when(Boolean(m.badge), (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded_full().border(1)
                .border_color(alpha(t.accent, "4d")).bg(alpha(t.accent, "1a")).font_family(MONO).text_size(9).text_color(t.accent).child(String(m.badge).toUpperCase()))))
            .child(div().truncate().text_size(11.5).text_color(t.muted).child(m.hint)))
          .when(Boolean(m.direct), (el) => el.child(svg(I("external-link")).size(12).flex_none().text_color(t.dim)));
      }));
  }
}

// ---------- the form (a dialog) ----------

export class AddForm {
  constructor(mod, method, cx) {
    this.mod = mod;
    this.m = method;
    this.ctx = context();
    this.fields = fieldsOf(method, this.ctx);
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    this.step = "form"; // form | planning | confirm | running
    this.plan = null;
    this.error = null;
    this.at = 0; // the keys' cursor in NORMAL: a field's index
    this.focus = null; // the input that has the keyboard: "<field>" or "<field>.<row>.k|v"
    this.reveal = null; // the secret input shown in clear, while it's typed in
    this.st = {}; // field id -> { input } | { rows: [{ k, v }] } | { value } (choice)
    for (const d of this.fields) {
      if (d.kind === "choice") this.st[d.id] = { value: d.value ?? d.choices[0]?.[0] };
      else if (d.kind === "pairs") { this.st[d.id] = { rows: [] }; this.addRow(d); }
      else this.st[d.id] = { input: this.input(d, d.id, d.kind === "json") };
    }
    const first = this.stops()[0];
    if (first) this.focusOn(first);
    else this.handle.focus();
  }

  // One real field: its focus and blur keep `focus` (the ring, INSERT) and mask a revealed secret again.
  input(d, id, multi, secret = d.secret) {
    const s = multi ? TextareaState.new({ placeholder: d.placeholder ?? "", rows: 7 }) : InputState.new({ placeholder: d.placeholder ?? "", value: d.value ?? "" });
    if (secret) s.set_masked(true);
    s.on("focus", (_e, cx) => { this.focus = id; this.vim.normal(); cx.notify(); });
    s.on("blur", (_e, cx) => {
      if (this.focus === id) this.focus = null;
      if (secret && this.reveal === id) { this.reveal = null; s.set_masked(true); }
      cx.notify();
    });
    s.on("change", (_e, cx) => { if (this.error) { this.error = null; cx.notify(); } });
    if (!multi) s.on("submit", (_e, cx) => { this.submit(cx); cx.notify(); });
    return s;
  }

  addRow(d) {
    const rows = this.st[d.id].rows;
    const i = rows.length;
    rows.push({ k: this.input({ placeholder: d.keyPlaceholder }, `${d.id}.${i}.k`, false, false),
      v: this.input({ placeholder: d.valuePlaceholder }, `${d.id}.${i}.v`, false, true) });
    return i;
  }

  // The inputs tab walks, in order: [id, state].
  stops() {
    const out = [];
    for (const d of this.fields) {
      const s = this.st[d.id];
      if (s.input) out.push([d.id, s.input]);
      else if (s.rows) s.rows.forEach((r, i) => { out.push([`${d.id}.${i}.k`, r.k], [`${d.id}.${i}.v`, r.v]); });
    }
    return out;
  }

  focusOn([id, s]) {
    this.at = Math.max(0, this.fields.findIndex((d) => d.id === id.split(".")[0]));
    s.focus();
  }

  tab(by) {
    const stops = this.stops();
    const i = stops.findIndex(([id]) => id === this.focus);
    const next = stops[(i + by + stops.length) % stops.length];
    if (next) this.focusOn(next);
  }

  // NORMAL -> the cursor field types (its first input).
  edit() {
    const d = this.fields[this.at];
    const stop = d && this.stops().find(([id]) => id.split(".")[0] === d.id);
    if (stop) this.focusOn(stop);
  }

  cycle(d, by) {
    const s = this.st[d.id];
    const i = d.choices.findIndex(([v]) => v === s.value);
    s.value = d.choices[(i + by + d.choices.length) % d.choices.length][0];
    this.error = null;
  }

  // What was typed, in memory only: text, [[key, value]] rows (empty keys left out), a choice.
  values() {
    const v = {};
    for (const d of this.fields) {
      const s = this.st[d.id];
      v[d.id] = s.rows ? s.rows.map((r) => [r.k.value().trim(), r.v.value()]).filter(([k]) => k) : s.input ? s.input.value() : s.value;
    }
    return v;
  }

  submit(cx) {
    if (this.step !== "form") return;
    this.step = "planning";
    this.error = null;
    const values = this.values();
    cx.spawn(async (cx) => {
      try {
        const plan = await this.m.plan(values, this.ctx);
        if (plan.error) { this.error = plan.error; this.step = "form"; }
        else { this.plan = plan; this.step = "confirm"; this.handle.focus(); }
      } catch (e) {
        this.error = String(e?.message ?? e);
        this.step = "form";
      }
      cx.notify();
    });
  }

  back() {
    this.plan?.cancel?.();
    this.plan = null;
    this.step = "form";
    this.edit();
  }

  run(cx) {
    if (this.step !== "confirm") return;
    this.step = "running";
    const plan = this.plan;
    cx.spawn(async (cx) => {
      let n;
      try { n = await plan.run(); } catch (e) { n = { level: "error", title: tr("failed"), body: String(e?.message ?? e) }; }
      this.plan = null; // ran: its cleanup is its own
      notify({ ...n, timeout: n.level === "success" ? 5000 : 10000 });
      closeOverlay(props().overlay);
      cx.notify();
    });
  }

  close() {
    this.plan?.cancel?.();
    this.plan = null;
    closeOverlay(props().overlay);
  }

  // The view goes (closed, Esc): a prepared plan (a clone) is cleaned up.
  async dispose() {
    await this.plan?.cancel?.();
    this.plan = null;
  }

  command(c, cx) {
    if (c.startsWith("form-key:")) {
      if (this.focus) this.handle.focus();
      for (const k of keysOf(c.slice(9))) this.press(k, cx);
    } else if (c.startsWith("form-set:")) {
      const [id, ...rest] = c.slice(9).split("=");
      const value = rest.join("=");
      const d = this.fields.find((x) => x.id === id);
      const s = d && this.st[id];
      if (!s) return;
      if (s.input) s.input.set_value(value);
      else if (s.rows) value.split(";").filter(Boolean).forEach((pair, i) => {
        if (i >= s.rows.length) this.addRow(d);
        const j = pair.indexOf(d.sep.trim());
        s.rows[i].k.set_value(j < 0 ? pair : pair.slice(0, j).trim());
        s.rows[i].v.set_value(j < 0 ? "" : pair.slice(j + d.sep.trim().length).trim());
      });
      else if (d.choices.some(([v]) => v === value)) s.value = value;
    }
  }

  // A key while an input has the keyboard: esc to NORMAL, tab around; the rest is the input's.
  key(e, cx) {
    const { name } = keyOf(e);
    if (this.focus) {
      if (name === "escape") this.handle.focus();
      else if (name === "tab" || name === "shift-tab") this.tab(name === "tab" ? 1 : -1);
      else return;
    } else if (!this.press(e, cx)) return;
    cx.stop_propagation();
    cx.notify();
  }

  // One NORMAL key (an event, or a name from `form-key:`); false: not one the form has.
  press(k, cx) {
    const name = keyOf(k).name;
    if (this.step === "confirm") {
      if (name === "y" || name === "enter") this.run(cx);
      else if (name === "n" || name === "escape") this.back();
      else if (name === "q") this.close();
      else return false;
      return true;
    }
    if (this.step !== "form") {
      if (name !== "escape" && name !== "q") return false;
      this.close();
      return true;
    }
    if (name === "i") { this.edit(); return true; }
    this.vim.normal();
    const a = this.vim.handle(k);
    const d = this.fields[this.at];
    if (["down", "up", "top", "bottom", "next", "prev"].includes(a))
      this.at = Math.max(0, step(a === "next" ? "down" : a === "prev" ? "up" : a, this.at, this.fields.length, this.vim.count, 6));
    else if ((a === "right" || a === "left" || a === "tab-next" || a === "tab-prev") && d?.kind === "choice") this.cycle(d, a === "right" || a === "tab-next" ? 1 : -1);
    else if (a === "filter" || a === "right") this.edit();
    else if (a === "open") this.submit(cx);
    else if (a === "quit" || a === "escape") this.close();
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return Boolean(a);
    return true;
  }

  // ---------- look ----------

  // A field's box: radius 12, in its accent ring (3 px, 15) while it types; the NORMAL cursor's is fainter.
  ring(t, on, cursor, child) {
    return div().flex_1().min_w(0).p(3).rounded(15).bg(on ? alpha(t.accent, "33") : cursor ? alpha(t.accent, "1a") : alpha(t.accent, "00")).child(child);
  }

  box(t, el, on) {
    return el.w_full().h(36).px(12).rounded(12).border(1).border_color(on ? t.accent : t.input).bg(t.background).text_size(13).text_color(t.foreground);
  }

  // The eye of a secret input: shows it in clear while it's typed in (it masks again when left).
  eye(t, id, s) {
    const open = this.reveal === id;
    return h_flex().id(`add-eye-${id}`).size(30).flex_none().items_center().justify_center().rounded(10)
      .text_color(open ? t.accent : t.dim).cursor_pointer().hover((x) => x.bg(t.hover).text_color(t.foreground))
      .tooltip(open ? tr("hide") : tr("show"))
      .on_click((_e, cx) => {
        if (open) { this.reveal = null; s.set_masked(true); }
        else { this.reveal = id; s.set_masked(false); s.focus(); }
        cx.notify();
      })
      .child(svg(`mods/${this.mod}/eye.svg`).size(14));
  }

  field(t, d, i) {
    const s = this.st[d.id];
    const cursor = !this.focus && this.step === "form" && this.handle.is_focused() && i === this.at;
    const head = h_flex().gap(8).items_center().px(3)
      .child(eyebrow(t, d.label, cursor ? t.foreground : t.muted))
      .when(Boolean(d.help), (el) => el.child(div().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(d.help)));
    let body;
    if (d.kind === "choice") {
      // kbrdn.dev's segmented group: the box (12) holds its chips 3 px in (9).
      body = h_flex().flex_wrap().p(3).gap(2).rounded(12).border(1).border_color(cursor ? alpha(t.accent, "99") : t.border)
        .children(d.choices.map(([v, label]) => {
          const on = s.value === v;
          return h_flex().id(`add-c-${d.id}-${v}`).h(28).px(11).items_center().rounded(9).border(1)
            .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00")).when(on, (el) => el.bg(alpha(t.accent, "24")))
            .when(!on, (el) => el.hover((x) => x.bg(t.hover).text_color(t.foreground)))
            .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
            .on_click((_e, cx) => { s.value = v; this.at = i; this.error = null; cx.notify(); })
            .child(label);
        }));
    } else if (d.kind === "pairs") {
      body = v_flex().gap(2)
        .children(s.rows.map((r, j) => {
          const kid = `${d.id}.${j}.k`, vid = `${d.id}.${j}.v`;
          return h_flex().gap(2).items_center()
            .child(div().w(200).flex_none().child(this.ring(t, this.focus === kid, cursor && j === 0, this.box(t, Input.new(r.k), this.focus === kid).font_family(MONO))))
            .child(div().flex_none().font_family(MONO).text_size(12).text_color(t.dim).child(d.sep.trim()))
            .child(this.ring(t, this.focus === vid, false, this.box(t, Input.new(r.v), this.focus === vid).font_family(MONO)))
            .child(this.eye(t, vid, r.v));
        }))
        .child(h_flex().id(`add-row-${d.id}`).h(26).px(6).gap(6).items_center().rounded(8).text_size(12).text_color(t.muted)
          .cursor_pointer().hover((x) => x.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { const j = this.addRow(d); this.focusOn([`${d.id}.${j}.k`, s.rows[j].k]); cx.notify(); })
          .child(svg(I("plus")).size(12)).child(d.more ?? tr("oneMore")));
    } else if (d.kind === "json") {
      // Typed in: the text as is; left: masked (`mask`), a click types in it again.
      const on = this.focus === d.id;
      const text = s.input.value();
      body = this.ring(t, on, cursor, div().relative()
        .child(Textarea.new(s.input).w_full().h(150).p(10).rounded(12).border(1).border_color(on ? t.accent : t.input).bg(t.background)
          .font_family(MONO).text_size(12).text_color(t.foreground))
        .when(!on && Boolean(text.trim()), (el) => el.child(v_flex().id(`add-mask-${d.id}`).absolute().inset_0().p(10).rounded(12).border(1).border_color(t.input)
          .bg(t.background).overflow_hidden().cursor_text().font_family(MONO).text_size(12).line_height("18px").text_color(t.muted)
          .on_click((_e, cx) => { s.input.focus(); cx.notify(); })
          .children(String(d.mask ? d.mask(text) : text).split("\n").slice(0, 8).map((l) => div().whitespace_nowrap().child(l || " "))))));
    } else {
      const on = this.focus === d.id;
      body = h_flex().gap(2).items_center()
        .child(this.ring(t, on, cursor, this.box(t, Input.new(s.input), on).when(Boolean(d.mono), (el) => el.font_family(MONO))))
        .when(Boolean(d.secret), (el) => el.child(this.eye(t, d.id, s.input)))
        .when(d.kind === "folder", (el) => el.child(h_flex().id(`add-pick-${d.id}`).h(36).px(12).gap(6).flex_none().items_center().rounded(12).border(1)
          .border_color(t.border).text_size(12).text_color(t.muted).cursor_pointer().hover((x) => x.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => {
            cx.spawn(async (cx) => {
              const f = await pickFolder({ prompt: tr("choose") }).catch(() => null);
              if (f) s.input.set_value(f);
              cx.notify();
            });
          })
          .child(svg(I("folder")).size(13)).child(tr("chooseDots"))));
    }
    return v_flex().gap(6).child(head).child(body);
  }

  block(t, text, color) {
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.raised).px(12).py(10)
      .font_family(MONO).text_size(11.5).line_height("18px").text_color(color ?? t.foreground)
      .children(String(text).split("\n").map((l) => div().child(l || " ")));
  }

  confirmView(t) {
    const p = this.plan;
    return [
      v_flex().gap(6).child(eyebrow(t, p.cwd ? tr("commandIn", { path: tilde(p.cwd) }) : tr("command"))).child(this.block(t, p.shown)),
      p.preview && v_flex().gap(6).child(eyebrow(t, p.previewLabel ?? tr("preview"))).child(this.block(t, p.preview, t.muted)),
      p.note && h_flex().gap(8).items_start().child(svg(I("circle-alert")).size(13).flex_none().mt(2).text_color(t.ansi3))
        .child(div().flex_1().min_w(0).text_size(12.5).line_height("18px").text_color(t.muted).child(p.note)),
    ].filter(Boolean);
  }

  button(t, id, label, solid, onClick) {
    return h_flex().id(id).h(30).px(14).items_center().rounded_full().border(1)
      .border_color(solid ? t.solid : t.input).bg(solid ? t.solid : t.background)
      .text_color(solid ? t.solid_foreground : t.foreground).font_family(MONO).text_size(11)
      .cursor_pointer().hover((s) => s.opacity(0.88))
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .child(label.toUpperCase());
  }

  render(cx) {
    const t = theme();
    const typing = Boolean(this.focus);
    const confirm = this.step === "confirm" || this.step === "running";
    const busy = this.step === "planning" || this.step === "running";
    const kbd = (k) => div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k);
    // The card (radius 20, 4 px around) and its inner card (16), as kt-new.
    const card = v_flex().id("add-form").on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).max_w_full().p(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg().text_size(13)
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(v_flex().id("add-body").max_h(620).overflow_y_scrollbar().p(16).gap(14)
          .child(h_flex().gap(10).items_center()
            .child(svg(this.m.icon).size(16).flex_none().text_color(t.accent))
            .child(div().flex_1().min_w(0).text_size(15).font_semibold().text_color(t.foreground).child(confirm ? tr("confirm") : this.m.title))
            .child(mode(t, typing ? "INSERT" : "NORMAL", typing))
            .child(kbd("esc")))
          .child(div().text_size(12.5).line_height("18px").text_color(t.muted).child(confirm ? tr("nothingYet", { label: this.plan?.label ?? tr("add") }) : this.m.intro))
          .children(confirm && this.plan ? this.confirmView(t) : this.fields.map((d, i) => this.field(t, d, i))))
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
        .child(h_flex().flex_none().px(12).py(10).gap(8).items_center()
          .child(h_flex().flex_1().min_w(0).gap(6).items_center()
            .when(busy, (el) => el.child(svg(I("refresh-cw")).size(12).flex_none().spin(900).text_color(t.dim))
              .child(div().text_size(12).text_color(t.dim).child(this.step === "planning" ? tr("checking") : tr("running"))))
            .when(!busy && Boolean(this.error), (el) => el.child(div().min_w(0).text_size(12).line_height("17px").text_color(t.ansi1).child(this.error)))
            .when(!busy && !this.error, (el) => el.child(h_flex().gap(5).items_center().text_size(11).text_color(t.dim)
              .child(kbd("↵")).child(confirm ? (this.plan?.label ?? tr("add")).toLowerCase() : tr("checkCommand")))))
          .when(!busy, (el) => el
            .child(this.button(t, "add-no", confirm ? tr("back") : tr("cancel"), false, () => (confirm ? this.back() : this.close())))
            .child(this.button(t, "add-yes", confirm ? this.plan?.label ?? tr("add") : tr("verify"), true, (cx) => (confirm ? this.run(cx) : this.submit(cx)))))));
    return div().id("add-veil").size_full().flex().items_center().justify_center().bg(veil())
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
