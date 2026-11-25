// kt-chat (kbrdn-herdr #18): the card of a request herdr-bridge 0.6.0 lets the Chat answer whole, in
// the composer's « en attente » card: the questions of an AskUserQuestion, an MCP server's form, a link.
// What it holds and sends: bridge-model.js (pure, bridge-model.check.mjs). The inputs are the Chat's
// pool (made in init, bridge-model.js MAX_FIELDS): this module sets them up for a request and reads
// them, never makes one.
// The questions as Claude Code's dialog shows them (Kylian, 2026-11-25): each option on its own row, its
// label and its description, a radio or a box (a multi-select), « Autre » typed; a cursor row (↑/↓ in the
// Chat, or the pointer) and Entrée or a click to pick; a single choice's previews in a monospace block
// beside its options, the one under the cursor (bridge-model.js rowsOf, enterRow, previewOf).

import { div, svg } from "gpui-kit";
import { v_flex, h_flex, Input } from "gpui-base";
import { ink } from "./chat-view.js";
import { OTHER, answersOf, contentOf, dismissedOf, previewOf, rowsOf, slotsOf } from "./bridge-model.js";

const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const CHECK = "mods/kt-threads/check.svg";

/** The pool's inputs ready for `card`: emptied, a field's default typed in, a number's bounds set. */
export function setUp(card, inputs) {
  const slots = slotsOf(card);
  for (const s of inputs) s.set_value("");
  if (card?.kind !== "form") return;
  for (const f of card.fields) {
    const s = inputs[slots[f.key]];
    if (!s) continue;
    if (f.default !== undefined && (f.type === "string" || f.type === "number")) s.set_value(String(f.default));
  }
}

/** What the card holds, with what is typed in the inputs now (each question's or field's `text`). */
export function withText(card, held, inputs) {
  const out = Object.assign(Object.create(null), held);
  for (const [k, i] of Object.entries(slotsOf(card))) out[k] = { ...(out[k] ?? {}), text: inputs[i]?.value() ?? "" };
  return out;
}

/** What the card would send now: { answers } or { action: "accept", content }, or null (not yet complete). */
export function sendable(card, held, inputs) {
  const h = withText(card, held, inputs);
  if (card?.kind === "questions") return answersOf(card.questions, h);
  if (card?.kind === "form") {
    const content = contentOf(card.fields, h);
    return content ? { action: "accept", content } : null;
  }
  return null;
}

/** What « Ignorer » sends: every question closed, or the form declined. */
export const dismissed = (card) => (card?.kind === "questions" ? dismissedOf(card.questions) : { action: "decline" });

/**
 * The card. `s`: { card, held, inputs, id (the request's), tr, busy, cursor (the questions' row under
 * the cursor), mono (the code font) }; `on`: { pick(key, value, cx), toggle(key, value, cx) (a form),
 * hover(row, cx), enter(row, cx) (the questions: the cursor there; Entrée), send(fields, cx),
 * openTerminal(cx) }. The answer is built at the click, from what the card shows (sendable), and sent
 * by the caller (decide.js reply).
 */
export function bridgeCard(t, s, on) {
  const { card, held, inputs, tr } = s;
  const slots = slotsOf(card);
  const chip = (id, label, selected, onClick) => h_flex().id(id).flex_none().h(24).px(8).items_center().rounded(6)
    .border(1).border_color(selected ? alpha(t.accent, "99") : ink(t, 0.12)).bg(selected ? alpha(t.accent, "24") : ink(t, 0.06))
    .text_size(12).text_color(ink(t, selected ? 1 : 0.8)).cursor_pointer().hover((st) => st.bg(selected ? alpha(t.accent, "33") : ink(t, 0.12)))
    .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); })
    .child(label);
  const field = (state) => Input.new(state).h(28).w_full().px(8).rounded(6).border(1).border_color(ink(t, 0.15))
    .bg(ink(t, 0.04)).text_size(13).text_color(ink(t, 1));
  const label = (text, sub) => h_flex().gap(6).items_baseline().min_w(0)
    .child(div().min_w(0).text_size(13).font_medium().text_color(ink(t, 1)).child(text))
    .when(Boolean(sub), (el) => el.child(div().flex_none().text_size(11).text_color(ink(t, 0.5)).child(sub)));
  const hint = (text) => div().text_size(11).text_color(ink(t, 0.5)).child(text);
  const blocks = [];
  const rows = rowsOf(card);
  const at = s.cursor ?? 0;

  if (card.kind === "questions") {
    const index = (q, kind, l) => rows.findIndex((r) => r.q === q && r.kind === kind && (l === undefined || r.label === l));
    // A row: the cursor's ground; the pointer moves the cursor there, a click is its Entrée.
    const line = (r, ...kids) => h_flex().id(`kb-${s.id}-r${r}`).gap(8).items_start().min_w(0).px(8).py(5).rounded(6)
      .when(r === at, (el) => el.bg(ink(t, 0.08))).cursor_pointer()
      .on_hover((h, cx) => { if (h) on.hover(r, cx); })
      .on_click((_e, cx) => { cx.stop_propagation(); on.enter(r, cx); })
      .children(kids);
    // A single choice's radio, a multi-select's box.
    const mark = (multi, set) => (multi
      ? h_flex().size(14).flex_none().mt(2).items_center().justify_center().rounded(3).border(1).border_color(set ? t.accent : ink(t, 0.3))
        .when(set, (el) => el.bg(t.accent).child(svg(CHECK).size(10).text_color(t.accent_foreground ?? t.background)))
      : h_flex().size(14).flex_none().mt(2).items_center().justify_center().rounded_full().border(1).border_color(set ? t.accent : ink(t, 0.3))
        .when(set, (el) => el.child(div().size(6).rounded_full().bg(t.accent))));
    const words = (text, sub) => v_flex().flex_1().min_w(0)
      .child(div().min_w(0).text_size(13).text_color(ink(t, 1)).child(text))
      .when(Boolean(sub), (el) => el.child(div().min_w(0).text_size(12).text_color(ink(t, 0.55)).child(sub)));
    // The preview, line by line as written (its leading spaces and box drawings kept), scrolled past its height.
    const preview = (i, text) => v_flex().id(`kb-${s.id}-pv${i}`).flex_1().min_w(0).max_h(260).overflow_scrollbar().px(10).py(8)
      .rounded(6).border(1).border_color(ink(t, 0.12)).bg(ink(t, 0.04)).font_family(s.mono).text_size(12).line_height("18px")
      .text_color(ink(t, 0.85))
      .children(text ? text.split("\n").map((l) => div().whitespace_nowrap().child(l || " ")) : [div().text_color(ink(t, 0.4)).child(tr("bridge.noPreview"))]);
    for (const [i, q] of card.questions.entries()) {
      const h = held[q.question] ?? {};
      const kind = q.kind ?? "choice";
      const input = inputs[slots[q.question]];
      const one = v_flex().gap(4).min_w(0).child(label(q.question, q.header ?? null));
      if (kind === "text" || kind === "number") {
        const r = index(i, "input");
        // The field takes its own clicks: the pointer only moves the cursor here.
        one.child(h_flex().id(`kb-${s.id}-r${r}`).px(8).py(4).rounded(6).min_w(0).when(r === at, (el) => el.bg(ink(t, 0.08)))
          .on_hover((on2, cx) => { if (on2) on.hover(r, cx); })
          .child(kind === "number" ? field(input).w(140) : field(input)));
        if (kind === "number") one.child(div().px(8).child(hint(tr("bridge.bounds", { min: q.min, max: q.max, unit: q.unit ?? "" }).trim())));
      } else {
        const multi = q.multiSelect === true;
        const picked = (l) => (multi ? (h.picks ?? []).includes(l) : h.pick === l);
        const otherTyped = (input?.value() ?? "").trim() !== "";
        const list = v_flex().gap(2).min_w(0)
          .children((q.options ?? []).map((o) => line(index(i, "option", o.label), mark(multi, picked(o.label)), words(o.label, o.description ?? null))))
          .child(line(index(i, "other"), mark(multi, multi ? otherTyped : h.pick === OTHER), words(tr("bridge.other"), null)));
        // « Autre »'s field under its row: a single choice's once picked, a multi-select's always (its text joins the boxes).
        if (multi || h.pick === OTHER) list.child(div().pl(30).pr(8).pt(2).child(field(input)));
        const pv = previewOf(card, i, held, at);
        one.child(pv === null ? list : h_flex().gap(10).items_start().min_w(0).child(list.flex_1()).child(preview(i, pv)));
      }
      blocks.push(one);
    }
    if (card.extended) blocks.push(hint(tr("bridge.skip")));
  } else if (card.kind === "form") {
    for (const f of card.fields) {
      const h = held[f.key] ?? {};
      const k = `kb-${s.id}-${f.key}`;
      const one = v_flex().gap(6).min_w(0).child(label(f.title, f.required ? tr("bridge.required") : null));
      if (f.description) one.child(hint(f.description));
      if (f.type === "string" || f.type === "number") {
        one.child(field(inputs[slots[f.key]]));
        const bound = f.min !== undefined && f.max !== undefined ? tr("bridge.bounds", { min: f.min, max: f.max, unit: "" }).trim()
          : f.min !== undefined ? tr("bridge.min", { min: f.min }) : f.max !== undefined ? tr("bridge.max", { max: f.max }) : null;
        if (f.type === "number" && bound) one.child(hint(bound));
      } else if (f.type === "boolean") {
        one.child(h_flex().gap(6)
          .child(chip(`${k}-yes`, tr("bridge.yes"), h.pick === true, (cx) => on.pick(f.key, true, cx)))
          .child(chip(`${k}-no`, tr("bridge.no"), h.pick === false, (cx) => on.pick(f.key, false, cx))));
      } else {
        const multi = f.type === "multi";
        one.child(h_flex().flex_wrap().gap(6).children(f.choices.map((c, j) =>
          chip(`${k}-c${j}`, c.label, multi ? (h.picks ?? []).includes(c.value) : h.pick === c.value, (cx) => (multi ? on.toggle(f.key, c.value, cx) : on.pick(f.key, c.value, cx))))));
      }
      blocks.push(one);
    }
  } else if (card.kind === "link") {
    blocks.push(v_flex().gap(4).min_w(0).child(hint(tr("bridge.link"))).child(div().min_w(0).text_size(12).text_color(ink(t, 0.8)).child(card.url)));
  }

  const ready = sendable(card, held, inputs);
  const button = (id, text, primary, enabled, onClick, ring = false) => h_flex().id(id).flex_none().h(24).px(8).items_center().rounded(6)
    .bg(primary && enabled ? t.foreground : ink(t, 0.1)).text_size(12)
    .text_color(primary && enabled ? t.background : ink(t, enabled ? 1 : 0.4))
    .when(ring, (el) => el.border(1).border_color(t.accent))
    .when(enabled && !s.busy, (el) => el.cursor_pointer().hover((st) => st.opacity(0.85)).on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); }))
    .child(text);
  const footer = h_flex().gap(6).items_center().flex_wrap();
  if (card.kind === "link") {
    footer.child(button(`kb-${s.id}-decline`, tr("bridge.decline"), false, true, (cx) => on.send({ action: "decline" }, cx)))
      .child(button(`kb-${s.id}-cancel`, tr("bridge.cancel"), false, true, (cx) => on.send({ action: "cancel" }, cx)));
  } else {
    // The questions' « Envoyer » is their last row: the cursor rings it, Entrée there sends (enter()).
    const send = rows.length - 1;
    footer.child(button(`kb-${s.id}-send`, card.kind === "form" ? tr("bridge.accept") : tr("bridge.send"), true, Boolean(ready),
      (cx) => { const now = sendable(card, held, inputs); if (now) on.send(now, cx); }, card.kind === "questions" && at === send)
      .when(card.kind === "questions", (el) => el.on_hover((h, cx) => { if (h) on.hover(send, cx); })))
      .child(button(`kb-${s.id}-dismiss`, card.kind === "form" ? tr("bridge.decline") : tr("bridge.dismiss"), false, true, (cx) => on.send(dismissed(card), cx)));
    if (card.kind === "form") footer.child(button(`kb-${s.id}-cancel`, tr("bridge.cancel"), false, true, (cx) => on.send({ action: "cancel" }, cx)));
  }
  footer.child(button(`kb-${s.id}-term`, tr("composer.openTerminal"), false, true, (cx) => on.openTerminal(cx)));
  return v_flex().gap(10).min_w(0).children(blocks).child(footer);
}
