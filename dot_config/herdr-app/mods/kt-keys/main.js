// kbrdn Threads' keys (ctrl-b ?): the vim-first keymap, grouped Global / Sidebar / Pages / Panneau /
// Modales, with a filter. A dialog (mod.json, frame "none"): a veil, the card (20) and its inner
// cards (16), kt-new's look. Global is read from keys(): the shown layout's ctrl-b keys as keys.json
// has them. The other groups are this file's table: keep it in step with the mods.
// Opens typing in the filter (INSERT, as every dialog with a field); esc: NORMAL, where j/k move,
// gg/G, ctrl-d/u, tab / shift-tab change group, q or esc close. props.group ("sidebar", "pages",
// "panel", "modals"): opened on that group (a mod's `?`). `kt-keys.key:<keys>` feeds keys, space
// separated ("j", "g g", "escape"), and `kt-keys.group:<id>` picks a group: for tests.
// vim.js is the keys every kt-* mod shares; vim.check.mjs (bun) checks it.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { keys, theme, props, closeOverlay, settings, nextCommand, checking, shared } from "herdr";
import { Vim, keysOf, step } from "./vim.js";

const MONO = "Monaspace Krypton";
const CARD = 720;
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
const GROUPS = [["all", "Tout"], ["global", "Global"], ["sidebar", "Sidebar"], ["pages", "Pages"], ["panel", "Panneau"], ["modals", "Modales"]];

// Global: what each ctrl-b action does, in the order shown (keys.json's action, `command:arg` for
// an object binding).
const LABELS = {
  "pane.go:left": "Aller à gauche : pane, sidebar",
  "pane.go:right": "Aller à droite : pane, panneau",
  "pane.go:down": "Aller en bas",
  "pane.go:up": "Aller en haut",
  "pane.split:right": "Scinder à droite",
  "pane.split:down": "Scinder en bas",
  "pane.zoom": "Zoomer le pane",
  "kt-head.close-pane": "Fermer le pane (confirmé)",
  "mod.open:kt-new": "Nouveau thread",
  "tab.next": "Thread suivant",
  "tab.prev": "Thread précédent",
  "tab.select": "Thread 1 à 9",
  "tab.rename": "Renommer le thread",
  "kt-head.close-tab": "Fermer le thread (confirmé)",
  "space.new": "Nouveau projet",
  "space.next": "Projet suivant",
  "space.prev": "Projet précédent",
  "space.rename": "Renommer le projet",
  "kt-head.picker:2": "Search sur les projets",
  "kt-head.picker:0": "Search, tout",
  "kt-head.worktree": "Nouveau thread dans un worktree",
  "agent.next": "Agent suivant",
  "agent.prev": "Agent précédent",
  "kt-head.attention": "L'agent qui attend (sinon le premier terminé)",
  "layout.select:thread": "Retour au thread",
  "layout.select:inbox": "Page Inbox",
  "layout.select:skills": "Page Skills",
  "layout.select:mcp": "Page MCP",
  "layout.select:gwm": "Page Worktrees",
  "layout.toggle:side": "Montrer / masquer la sidebar",
  "layout.toggle:panel": "Montrer / masquer le panneau",
  "kt-head.panel:files": "Panneau sur Files",
  "kt-head.panel:diff": "Panneau sur Changes",
  "kt-head.panel:history": "Panneau sur History",
  "kt-head.panel:flow": "Panneau sur Flow",
  "kt-head.panel:crosstalk": "Panneau sur Crosstalk",
  "mod.open:kt-keys": "Cette aide",
  "app.settings": "Réglages",
  send: "ctrl-b au programme",
};
const ORDER = Object.keys(LABELS);
function actionKey(action) {
  if (action.startsWith("send:")) return "send";
  if (!action.startsWith("{")) return /^tab\.select:/.test(action) ? "tab.select" : action;
  try {
    const o = JSON.parse(action);
    const arg = o.args?.child ?? o.args?.name ?? o.args?.id;
    return arg ? `${o.command}:${arg}` : o.command;
  } catch {
    return action;
  }
}

// The groups held here: [keys, what, where]. Keys: names separated by spaces, "/" between choices.
const TABLE = {
  sidebar: [
    ["ctrl-b h", "Donner le clavier à la sidebar (depuis le terminal)"],
    ["j / k", "Élément suivant / précédent (aussi ↓ ↑) : navigation, threads"],
    ["gg / G", "Premier élément (le projet) / dernier thread"],
    ["enter", "Sur une ligne de navigation : projet, Nouveau thread, pages, Search"],
    ["ctrl-d / ctrl-u", "Demi-page plus bas / plus haut"],
    ["5 j", "Un compte devant un mouvement"],
    ["tab / shift-tab", "Groupe suivant / précédent : projet, Snoozed"],
    ["h / l", "Replier / déplier le projet (son en-tête ou un de ses threads), Snoozed"],
    ["l", "Sur un thread : le montrer, le clavier reste"],
    ["enter / o", "Ouvrir le thread, le clavier va au terminal"],
    ["a", "Archiver le thread (réversible)"],
    ["dd / x", "Fermer le thread (confirmé)"],
    ["y", "Copier le dossier du thread"],
    ["r", "Rafraîchir les PR"],
    ["H / L", "Défiler la barre des projets"],
    ["esc / q", "Rendre le clavier au terminal"],
    ["?", "Ces touches"],
  ],
  pages: [
    ["ctrl-b i / a / m / shift-o", "Inbox, Skills, MCP, Worktrees"],
    ["j / k", "Ligne suivante / précédente"],
    ["gg / G", "Début / fin"],
    ["ctrl-d / ctrl-u", "Demi-page"],
    ["/", "Filtrer (INSERT)"],
    ["k", "Au-dessus de la première ligne : le champ filtre (INSERT)"],
    ["n / N", "Résultat suivant / précédent"],
    ["tab / shift-tab", "Segment suivant / précédent"],
    ["enter / o", "Ouvrir (MCP : sa config dans Zed)"],
    ["O", "Ouvrir ailleurs : Zed, GitHub"],
    ["y", "Copier : /skill, lien, nom, chemin"],
    ["r", "Rafraîchir"],
    ["dd / x", "Fermer (Inbox) ou retirer un worktree (Worktrees), confirmé"],
    ["q", "Retour au thread"],
    ["esc", "Effacer le filtre, puis rendre le clavier"],
    ["ctrl-n / ctrl-p", "Sélection suivante / précédente sans quitter la saisie", "INSERT"],
    ["ctrl-j / ctrl-k", "Idem", "INSERT"],
    ["enter", "Ouvrir la sélection", "INSERT"],
    ["esc", "Mode NORMAL, le filtre reste", "INSERT"],
  ],
  panel: [
    ["ctrl-b l", "Donner le clavier au panneau (depuis le terminal)"],
    ["ctrl-b f / d / y / e / r", "Files, Changes, History, Flow, Crosstalk"],
    ["[ / ]", "Onglet précédent / suivant du panneau"],
    ["j / k", "Ligne suivante / précédente"],
    ["gg / G", "Début / fin"],
    ["ctrl-d / ctrl-u", "Demi-page"],
    ["h / l", "Replier / déplier : dossier, phase, passe"],
    ["enter / o", "Ouvrir"],
    ["O", "Ouvrir dans Zed (fichier, finding)"],
    ["k", "Au-dessus de la première ligne : le champ (INSERT)", "Files, Changes"],
    ["tab", "Commits ↔ fichiers", "History"],
    ["tab", "Cette session / Toutes", "Crosstalk"],
    ["y", "Copier : chemin, hash, finding, message"],
    ["r", "Rafraîchir"],
    ["dd / x", "Annuler les modifications d'un fichier (confirmé)", "Changes"],
    ["cmd-enter", "Commit, aussi depuis la liste", "Changes"],
    ["esc", "Rendre le clavier au terminal"],
  ],
  modals: [
    ["", "S'ouvrent en INSERT quand elles ont un champ, sinon en NORMAL"],
    ["ctrl-n / ctrl-p", "Sélection suivante / précédente", "INSERT"],
    ["ctrl-j / ctrl-k", "Idem", "INSERT"],
    ["enter", "Valider", "INSERT"],
    ["esc", "Mode NORMAL", "INSERT"],
    ["j / k", "Sélection suivante / précédente", "NORMAL"],
    ["gg / G", "Début / fin", "NORMAL"],
    ["enter / o / l", "Valider la sélection", "NORMAL"],
    ["/", "Retour au champ (INSERT)", "NORMAL"],
    ["q / esc", "Fermer", "NORMAL"],
    ["tab / shift-tab", "Groupe suivant / précédent", "kt-picker"],
    ["dd / x / ctrl-d", "Fermer le thread sélectionné (confirmé)", "kt-picker"],
    ["tab / shift-tab", "Worktrees / branches", "kt-branch"],
    ["j / k", "Ligne Projet, Checkout, Type, Agent (ctrl-n / ctrl-k en INSERT)", "kt-new"],
    ["h / l / tab", "Changer le choix de la ligne", "kt-new"],
    ["enter / o", "Renommer le projet", "kt-projects"],
    ["dd / x", "Retirer le projet (confirmé)", "kt-projects"],
    ["j / k", "Option suivante / précédente", "kt-thread-filter"],
    ["enter / space / l", "Cocher", "kt-thread-filter"],
    ["k", "Au-dessus de la première ligne : le filtre", "Projets"],
    ["y / enter", "Confirmer", "kt-confirm"],
    ["n / esc / q", "Annuler", "kt-confirm"],
    ["h j k l", "Déplacer l'image zoomée", "kt-viewer"],
    ["+ / - / 0 / 1", "Zoom", "kt-viewer"],
    ["[ / ]", "Image précédente / suivante (aussi h / l à 100 %)", "kt-viewer"],
    ["ctrl-p / ctrl-w / ctrl-t / ctrl-a", "Projet, checkout, type, agent (inchangés)", "kt-new"],
  ],
};

export default class Keys extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.vim = new Vim({ field: true, insert: true });
    this.query = "";
    const g = GROUPS.findIndex(([id]) => id === props()?.group);
    this.group = Math.max(0, g);
    this.cur = 0;
    this.rowsShown = [];
    // The dialog isn't keyed yet in init: ask for the keyboard again, briefly, until it has it.
    this.handle.focus();
    for (const ms of [16, 50, 120, 250]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k));
        } else if (c.startsWith("group:")) this.group = Math.max(0, GROUPS.findIndex(([id]) => id === c.slice(6)));
        cx.notify();
      }
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  globals() {
    const section = `layout:${shared("layout") ?? "kbrdn-threads"}`;
    const rows = [];
    for (const b of keys()) {
      if (b.section !== section || !b.keys.startsWith("ctrl-b ")) continue;
      const k = actionKey(b.action);
      if (k === "tab.select") {
        if (!rows.some((r) => r.k === "tab.select")) rows.push({ g: "global", k, keys: "ctrl-b 1…9", what: LABELS[k] });
        continue;
      }
      rows.push({ g: "global", k, keys: b.keys, what: LABELS[k] ?? b.action });
    }
    const at = (r) => (ORDER.includes(r.k) ? ORDER.indexOf(r.k) : ORDER.length);
    rows.sort((a, b) => at(a) - at(b));
    rows.push({ g: "global", keys: "cmd-t / cmd-p / cmd-w / cmd-1…9", what: "Les raccourcis Mac restent (⌘[ ⌘], ⌘⌥ flèches…)", where: "Mac" });
    return rows;
  }

  rows() {
    const all = [...this.globals(), ...Object.entries(TABLE).flatMap(([g, list]) => list.map(([keys, what, where]) => ({ g, keys, what, where })))];
    const group = GROUPS[this.group][0];
    const q = this.query.trim().toLowerCase();
    return all.filter((r) => (group === "all" || r.g === group) && (!q || `${r.keys} ${r.what} ${r.where ?? ""}`.toLowerCase().includes(q)));
  }

  // One vim action (vim.js); null: not a key of ours.
  act(a) {
    if (!a) return false;
    const n = this.rowsShown.length;
    if (a === "type") { this.query += this.vim.char; this.cur = 0; }
    else if (a === "backspace") { this.query = this.query.slice(0, -1); this.cur = 0; }
    else if (a === "submit") this.vim.normal();
    else if (a === "escape" || a === "quit") this.close();
    else if (a === "tab-next" || a === "tab-prev") {
      this.group = (this.group + (a === "tab-next" ? 1 : GROUPS.length - 1)) % GROUPS.length;
      this.cur = 0;
    } else if (a === "next" || a === "prev") this.move(a === "next" ? "down" : "up");
    else if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.move(a);
    return true;
  }

  move(a) {
    this.cur = step(a, this.cur, this.rowsShown.length, this.vim.count, 12);
    this.reveal = true;
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e))) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  kbds(t, keys) {
    return h_flex().w(230).flex_none().gap(4).items_center().flex_wrap()
      .children(keys.split(" ").filter(Boolean).map((k) => (k === "/"
        ? div().text_size(11).text_color(t.dim).child("/")
        : div().flex_none().h(20).px(7).flex().items_center().rounded(6).border(1).border_color(t.border).bg(t.background)
          .font_family(MONO).text_size(11).text_color(t.foreground).child(k))));
  }

  render() {
    const t = theme();
    const rows = (this.rowsShown = this.rows());
    this.cur = Math.min(this.cur, Math.max(0, rows.length - 1));
    const typing = this.vim.insert;
    const focused = this.handle.is_focused();
    const shown = Boolean(this.size);
    const eyebrow = (text) => div().font_family(MONO).text_size(10.5).text_color(t.muted).child(text.toUpperCase());
    const dashed = () => div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
    // The list: a header per group (Tout), one 32 px line per key; the cursor line on the ink.
    const items = [];
    rows.forEach((r, i) => {
      if (GROUPS[this.group][0] === "all" && rows[i - 1]?.g !== r.g)
        items.push(h_flex().px(10).pt(i ? 12 : 4).pb(4).gap(10).items_center()
          .child(eyebrow(GROUPS.find(([id]) => id === r.g)[1]).flex_none())
          .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border)));
      if (i === this.cur && this.reveal) { this.scroll.scroll_to_item(items.length); this.reveal = false; }
      const on = i === this.cur;
      items.push(h_flex().id(`kk-row-${i}`).min_h(32).px(10).py(4).gap(12).items_center().rounded(12).border(1)
        .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
        .when(on, (el) => el.bg(alpha(t.accent, "24")))
        .on_click((_e, cx) => { this.cur = i; cx.notify(); })
        .child(this.kbds(t, r.keys))
        .child(div().flex_1().min_w(0).text_size(12.5).text_color(on ? t.foreground : t.muted).child(r.what))
        .when(Boolean(r.where), (el) => el.child(div().flex_none().h(18).px(7).flex().items_center().rounded_full().border(1)
          .border_color(alpha(t.accent, "4d")).bg(alpha(t.accent, "1a")).font_family(MONO).text_size(9.5).text_color(t.accent).child(r.where.toUpperCase()))));
    });
    const listH = Math.max(160, (this.size?.height ?? 700) - 260);
    // Segments: the card's inner card (16) holds them 4 px in, so their box is 12 and theirs 9.
    const seg = h_flex().flex_none().h(34).p(3).gap(2).items_center().rounded(12).border(1).border_color(t.border).bg(t.background)
      .children(GROUPS.map(([id, label], i) => {
        const on = i === this.group;
        return h_flex().id(`kk-seg-${id}`).h_full().px(10).items_center().rounded(9).border(1)
          .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
          .when(on, (el) => el.bg(alpha(t.accent, "24")))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
          .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
          .on_click((_e, cx) => { this.group = i; this.cur = 0; cx.notify(); })
          .child(label);
      }));
    const field = h_flex().id("kk-filter").flex_1().min_w(0).h(34).px(12).gap(8).items_center().rounded(12).border(1)
      .border_color(focused && typing ? t.accent : t.border).bg(t.background).cursor_text()
      .on_click((_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
      .child(div().flex_none().font_family(MONO).text_size(12).text_color(t.dim).child("/"))
      .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
        .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : "Filtrer"));
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
    const hint = (k, what) => h_flex().gap(5).items_center()
      .child(div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k))
      .child(what);
    const card = v_flex().id("kk-card")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).max_w_full().relative().top(shown ? 0 : 8).transition("top", { duration: 180, easing: "ease-out" })
      .p(4).gap(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg()
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border).p(4).gap(4)
        .child(h_flex().px(10).pt(8).pb(4).gap(10).items_center()
          .child(div().flex_1().text_size(16).font_semibold().text_color(t.foreground).child("Touches"))
          .child(div().font_family(MONO).text_size(11).text_color(t.dim).child(`${rows.length} · préfixe ctrl-b`)))
        .child(h_flex().gap(4).items_center().child(field).child(seg)))
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(v_flex().id("kk-list").max_h(listH).overflow_y_scrollbar().track_scroll(this.scroll).p(4).gap(2)
          .children(items.length ? items : [div().p(16).text_size(13).text_color(t.dim).child("Aucune touche ne correspond.")]))
        .child(dashed())
        .child(h_flex().px(12).py(8).gap(12).items_center().text_size(11).text_color(t.dim)
          .child(mode)
          .child(hint("/", "filtrer"))
          .child(hint("j k", "ligne"))
          .child(hint("tab", "groupe"))
          .child(div().flex_1())
          .child(hint("esc", typing ? "normal" : "fermer"))));
    return div().id("kk-veil").size_full().flex().items_center().justify_center()
      .bg(veil()).opacity(shown ? 1 : 0).transition("opacity", { duration: 160, easing: "ease-out" })
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .on_click(() => this.close())
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
