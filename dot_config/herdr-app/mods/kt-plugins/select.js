// select.js: multi-selection over a page's list (kt-gwm, kt-skills, kt-mcp; kt-inbox next). Written
// once in mods/kt-gwm/select.js and copied byte for byte into each mod that uses it (a mod can't
// import from another folder): edit here, then copy. Pure: no herdr, no gpui-kit, no module state
// (copies of a mod share module code), so node checks it (select.test.mjs).
//
// One Select per mod copy: `this.multi = new Select()`. Ids are the rows' own keys; `order` is every
// selectable id the list shows now, in order (all pages; no headers, no folds).
// Mouse: `click(modifiers, id, order)` -> true when ⌘ (toggle) or ⇧ (a range from the anchor) made it
// a selection click; a plain click empties the selection and answers false: do what it did before.
// Keys, NORMAL only, before vim.js (`key(keyOf(e).name, cursorId, order)` -> true when taken): x or
// space toggle the cursor's row, V starts a visual range at it (V again ends it), ctrl-a takes every
// listed row, esc ends the visual range, else empties the selection (false when there is none:
// esc then goes on to vim). After vim moved the cursor: `follow(cursorId, order)`.

export class Select {
  constructor() {
    this.ids = new Set();
    this.anchor = null; // where ⇧-click and V ranges start
    this.visual = false; // V: j / k extend from the anchor
    this.base = new Set(); // the selection before V, kept under the visual range
  }

  get size() { return this.ids.size; }
  has(id) { return this.ids.has(id); }

  clear() {
    this.ids.clear();
    this.base.clear();
    this.visual = false;
    this.anchor = null;
  }

  toggle(id) {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
    this.anchor = id;
    this.visual = false;
  }

  // Every id from `a` to `b` in `order`, both included (none when either isn't listed).
  static span(order, a, b) {
    const i = order.indexOf(a), j = order.indexOf(b);
    if (i < 0 || j < 0) return [];
    return order.slice(Math.min(i, j), Math.max(i, j) + 1);
  }

  click(m, id, order) {
    if (m?.platform) { this.toggle(id); return true; }
    if (m?.shift) {
      const span = Select.span(order, this.anchor, id);
      if (!span.length) this.toggle(id);
      else { for (const x of span) this.ids.add(x); this.visual = false; }
      return true;
    }
    this.clear();
    return false;
  }

  key(name, cur, order) {
    const listed = order.includes(cur);
    if (name === "x" || name === "space") {
      if (listed) this.toggle(cur);
      return true;
    }
    if (name === "V") {
      if (this.visual) this.visual = false;
      else if (listed) {
        this.base = new Set(this.ids);
        this.anchor = cur;
        this.visual = true;
        this.ids.add(cur);
      }
      return true;
    }
    if (name === "ctrl-a") {
      this.ids = new Set(order);
      this.visual = false;
      return true;
    }
    if (name === "escape") {
      if (this.visual) { this.visual = false; return true; }
      if (this.ids.size) { this.clear(); return true; }
    }
    return false;
  }

  // V: the selection is what it was before V plus the anchor-to-cursor range.
  follow(cur, order) {
    if (!this.visual) return;
    const span = Select.span(order, this.anchor, cur);
    if (span.length) this.ids = new Set([...this.base, ...span]);
  }

  // Rows gone from the data (removed, another repo) leave the selection.
  keep(all) {
    const live = new Set(all);
    for (const id of [...this.ids]) if (!live.has(id)) this.ids.delete(id);
  }

  // The selected items, in the list's order.
  pick(items, idOf) {
    return items.filter((x) => this.ids.has(idOf(x)));
  }
}

// A bulk action's plan: { ok, refused: [{ item, why }] }, `why(item)` saying why one can't (or null).
export function partition(items, why) {
  const ok = [], refused = [];
  for (const item of items) {
    const w = why(item);
    if (w) refused.push({ item, why: w });
    else ok.push(item);
  }
  return { ok, refused };
}

// A confirm's list: one "• line" each, at most `max`, then `more(N)` for the rest: the mod's words
// ("… et N autres", I18N.md), "… +N" without one.
export function lines(list, max = 10, more = (n) => `… +${n}`) {
  const out = list.slice(0, max).map((s) => `• ${s}`);
  if (list.length > max) out.push(more(list.length - max));
  return out.join("\n");
}
