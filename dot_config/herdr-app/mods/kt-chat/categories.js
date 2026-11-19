// categories.js: the one color code of the agent's categories (#81), the same everywhere: kt-chat's
// completions, its field and its transcript, #93's attachments (pieceChip), kt-market and kt-workflow.
// Written once in mods/kt-keys/categories.js and copied byte for byte (cmp) into each mod that uses it,
// with workflows.js beside it (imported). Checked by categories.check.mjs.
//
// One hue, one meaning (the lead, 2026-11-19). Five hues for five categories: the only theme colors
// outside the agents' states in both appearances (ansi2 is done's #2a7f40 in light, ansi1 the errors,
// done / blocked / working the states). accent is working's hex in dark: MCP keeps it (its color on three
// pages before this), its plug marks it. Everything else is neutral (muted): a file, an image, a built-in
// command, a plugin as a source badge, the Marketplaces page.
// Light: 4 of the 5 hues fall under 4.5:1 on their own chip, so a label stays foreground there and the
// hue goes on the icon, the fill, the border (FILTERS.md's inactive pills); dark: the label takes it.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { isWorkflow } from "./workflows.js";

const MONO = "Monaspace Krypton";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

// `tint`: a theme color's name (theme()[tint]); null: neutral. `icon`: the sidebar's own glyph.
export const CATEGORIES = {
  workflow: { tint: "ansi3", icon: "mods/kt-threads/workflow.svg" },
  skill: { tint: "ansi4", icon: "mods/kt-threads/sparkles.svg" },
  mcp: { tint: "accent", icon: "mods/kt-threads/plug.svg" },
  loop: { tint: "ansi6", icon: "mods/kt-market/repeat.svg" },
  automation: { tint: "ansi5", icon: "mods/kt-threads/refresh-cw.svg" },
  file: { tint: null, icon: "mods/kt-threads/file.svg" },
  builtin: { tint: null, icon: "mods/kt-chat/terminal.svg" },
  plugin: { tint: null, icon: "mods/kt-threads/puzzle.svg" },
};
// The five, in the order a list groups them; the neutral ones after.
export const ORDER = ["workflow", "skill", "loop", "automation", "mcp", "builtin", "file"];
const IMAGE = "mods/kt-chat/image.svg";

/** The category of a slash command's or a tool's name ("/me:goal", "me:loop:x", "mcp__s__t", "loop").
 *  `builtin`: a Claude Code command of its own (not on disk). Files are the caller's ("file"). */
export function classify(name, { builtin = false } = {}) {
  const bare = String(name ?? "").replace(/^\//, "");
  if (bare.startsWith("mcp__")) return "mcp";
  if (bare === "loop" || bare === "me:run-loop" || bare === "me:create-loop" || bare.startsWith("me:loop:")) return "loop";
  if (bare === "schedule" || bare === "herdr-automations" || bare.endsWith(":herdr-automations")) return "automation";
  if (builtin) return "builtin";
  if (isWorkflow(bare)) return "workflow";
  return "skill";
}

/** A theme color's name for a category, null when it is neutral (or unknown). */
export const tintOf = (category) => CATEGORIES[category]?.tint ?? null;

/** Its color in theme `t`: the category's hue, else muted. */
export const colorOf = (t, category) => (tintOf(category) ? t[tintOf(category)] : t.muted);

/** Its glyph: the category's, an image's own for an image piece. */
export const iconOf = (piece) => (piece?.kind === "image" ? IMAGE : (CATEGORIES[piece?.category] ?? CATEGORIES.file).icon);

/**
 * A piece's chip, the same for #81's tokens and #93's thumbnails' captions: icon, label, a hue fill and
 * border for the five categories, neutral otherwise. No id: the caller's enter(m, chip, id) gives it one.
 * piece: { kind, category, label } (attach.js' shape); `dark`: settings().dark.
 */
export function pieceChip(t, piece, { dark = true } = {}) {
  const tinted = Boolean(tintOf(piece.category));
  const c = colorOf(t, piece.category);
  const mono = piece.kind === "command" || piece.kind === "mcp-tool";
  return h_flex().flex_none().max_w(280).h(22).px(6).gap(5).items_center().rounded(6).border(1)
    .border_color(tinted ? alpha(c, "66") : t.border)
    .bg(tinted ? alpha(c, dark ? "24" : "1f") : alpha(t.foreground, "14"))
    .child(svg(iconOf(piece)).size(13).flex_none().text_color(tinted ? c : t.muted))
    .child(div().min_w(0).truncate().text_size(12.5).when(mono, (el) => el.font_family(MONO))
      .text_color(tinted && dark ? c : t.foreground).child(String(piece.label ?? "")));
}
