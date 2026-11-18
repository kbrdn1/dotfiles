// kt-automation's two ways to create (form.js draws them, as kt-skills' « Avec l'assistant »): a loop
// (/me:create-loop) and a Herdr automation (the herdr-automations skill), both by the ONE session
// « Automatisation » (session.js). The description first, then a confirmation showing exactly what the
// session gets (its task, or the intention typed into the live one), then « Ouvrir » / « Envoyer ».
// Nothing is written by the page: the session asks, then writes.

import { home } from "herdr";
import { session, dedicated, intention } from "./session.js";
import { TASK, intents, tilde } from "./auto.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

// A method's words are getters (I18N.md): form.js reads them when it draws, in the language then.
const tr = makeT(strings);
export const NAME = "Automatisation"; // the session's tab (and new space)
const OWN = (name) => `mods/kt-automation/${name}.svg`;
const T = (name) => `mods/kt-threads/${name}.svg`;
const clean = (s) => String(s ?? "").trim().replace(/\s+/g, " ");

// Where the session opens when it isn't alive: ~/.claude for what is global, the project for the rest.
function plan(intent, folder) {
  const live = session(NAME);
  const shown = live
    ? `${tr("add.live", { name: NAME, space: live.space.name })}\n${intention(intent)}`
    : `claude\n${tr("add.firstTask")}\n${TASK}\n${intention(intent)}`;
  return {
    shown, cwd: live ? null : folder, label: live ? tr("send") : tr("openSession"),
    note: live ? tr("add.noteLive") : tr("add.noteNew", { path: tilde(folder, home()) }),
    run: async () => {
      const r = await dedicated({ name: NAME, folder, task: TASK, intent });
      if (r.why) return { level: "warning", title: tr("notSent"), body: r.why };
      return { level: "success", title: r.done === "sent" ? tr("sent", { name: NAME }) : tr("opened", { name: NAME }), body: intent };
    },
  };
}

export const METHODS = [
  {
    id: "loop", icon: OWN("repeat"),
    get label() { return tr("createLoop"); },
    get hint() { return tr("loop.hint"); },
    get title() { return tr("loop.title"); },
    get intro() { return tr("loop.intro"); },
    fields: (ctx) => [
      { id: "desc", label: tr("loop.field"), kind: "text", placeholder: tr("loop.placeholder") },
      { id: "scope", label: tr("scope"), kind: "choice", value: "global",
        choices: ctx.root ? [["global", tr("scope.global")], ["project", tr("scope.project", { name: ctx.root.split("/").pop() })]] : [["global", tr("scope.global")]],
        help: ctx.root ? tr("loop.scopeHelp") : tr("loop.globalOnly") }],
    async plan(v, ctx) {
      const desc = clean(v.desc);
      if (!desc) return { error: tr("loop.describe") };
      const repo = v.scope === "project" && ctx.root ? ctx.root : null;
      return plan(intents.createLoop(desc, repo ? tilde(repo, home()) : null), repo ?? `${home()}/.claude`);
    },
  },
  {
    id: "automation", icon: T("clock"),
    get label() { return tr("createAutomation"); },
    get hint() { return tr("auto.hint"); },
    get title() { return tr("auto.title"); },
    get intro() { return tr("auto.intro"); },
    fields: (ctx) => [
      { id: "desc", label: tr("auto.field"), kind: "text", placeholder: tr("auto.placeholder") },
      { id: "scope", label: tr("scope"), kind: "choice", value: ctx.root ? "project" : "personal",
        choices: [...(ctx.root ? [["project", tr("scope.project", { name: ctx.root.split("/").pop() })]] : []), ["personal", tr("scope.personal")]],
        help: tr("auto.scopeHelp") }],
    async plan(v, ctx) {
      const desc = clean(v.desc);
      if (!desc) return { error: tr("auto.describe") };
      const repo = v.scope === "project" && ctx.root ? ctx.root : null;
      return plan(intents.createAutomation(desc, repo ? tilde(repo, home()) : null), repo ?? `${home()}/.claude`);
    },
  },
];
