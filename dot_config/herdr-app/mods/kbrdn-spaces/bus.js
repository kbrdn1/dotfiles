// kt bus: mods that share data without knowing each other. An action bumps the topics it changed
// (a commit bumps its repo, an install bumps "plugins"); every mod that shows that data reads the
// counters in render and reloads when one moved. One shared key per topic, so two mods bumping at
// once never lose each other's write. Copied as is into every mod that uses it (cmp to check).
// Topics and who bumps or listens: data/orchestrator/DATA-SYNC.md.
import { shared, setShared } from "herdr";

const KEY = (topic) => `kt.bus.${topic}`;

// After an action succeeded (or failed after a partial change): bump("git:/repo", "git").
export function bump(...topics) {
  for (const t of topics) setShared(KEY(t), Math.max(Date.now(), (shared(KEY(t)) ?? 0) + 1));
}

// The repo topics an action on `root` (the worktree's toplevel) changes.
export const gitTopics = (root) => (root ? [`git:${root}`, "git"] : ["git"]);

// Whether any of `topics` moved since `seen` last looked (pure: `values` maps topic to counter).
// A topic seen for the first time is recorded, not fired: mounting is not a change.
export function moved(seen, values) {
  let any = false;
  for (const [t, v] of Object.entries(values)) {
    if (!(t in seen)) seen[t] = v;
    else if (seen[t] !== v) { seen[t] = v; any = true; }
  }
  return any;
}

// In render: refreshOn(this, cx, "status", gitTopics(root), async (cx) => { await this.loadStatus(); }).
// Coalesced per name: a bump during a reload runs it once more after, never twice at once.
export function refreshOn(view, cx, name, topics, reload) {
  const st = ((view._bus ??= {})[name] ??= { seen: {}, running: false, again: false });
  const values = {};
  for (const t of topics) values[t] = shared(KEY(t)) ?? 0;
  if (!moved(st.seen, values)) return false;
  if (st.running) { st.again = true; return true; }
  st.running = true;
  cx.spawn(async (cx) => {
    try {
      do { st.again = false; await reload(cx); } while (st.again);
    } catch (e) {
      console.log(`kt bus: ${name} reload failed: ${e?.message ?? e}`);
    } finally {
      st.running = false;
      cx.notify();
    }
  });
  return true;
}
