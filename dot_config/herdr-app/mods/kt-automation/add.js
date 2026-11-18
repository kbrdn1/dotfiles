// kt-automation's two ways to create (form.js draws them, as kt-skills' « Avec l'assistant »): a loop
// (/me:create-loop) and a Herdr automation (the herdr-automations skill), both by the ONE session
// « Automatisation » (session.js). The description first, then a confirmation showing exactly what the
// session gets (its task, or the intention typed into the live one), then « Ouvrir » / « Envoyer ».
// Nothing is written by the page: the session asks, then writes.

import { home } from "herdr";
import { session, dedicated, intention } from "./session.js";
import { TASK, intents, tilde } from "./auto.js";

export const NAME = "Automatisation"; // the session's tab (and new space)
const OWN = (name) => `mods/kt-automation/${name}.svg`;
const T = (name) => `mods/kt-threads/${name}.svg`;
const clean = (s) => String(s ?? "").trim().replace(/\s+/g, " ");

// Where the session opens when it isn't alive: ~/.claude for what is global, the project for the rest.
function plan(intent, folder) {
  const live = session(NAME);
  const shown = live
    ? `# la session ${NAME} vit (${live.space.name}) : l'intention y est tapée entre deux tours\n${intention(intent)}`
    : `claude\n# sa première tâche :\n${TASK}\n${intention(intent)}`;
  return {
    shown, cwd: live ? null : folder, label: live ? "Envoyer" : "Ouvrir la session",
    note: live ? "Si la session travaille ou attend une réponse, rien n'est tapé : la page le dit." : `Une session Claude dans ${tilde(folder, home())}. Elle demande avant d'écrire quoi que ce soit.`,
    run: async () => {
      const r = await dedicated({ name: NAME, folder, task: TASK, intent });
      if (r.why) return { level: "warning", title: "Intention non envoyée", body: r.why };
      return { level: "success", title: r.done === "sent" ? `Intention envoyée à la session ${NAME}` : `Session ${NAME} ouverte`, body: intent };
    },
  };
}

export const METHODS = [
  {
    id: "loop", label: "Créer un loop", hint: "/me:create-loop dans la session Automatisation", icon: OWN("repeat"),
    title: "Créer un loop avec Claude",
    intro: "La session Automatisation lance /me:create-loop avec ta description : elle demande la portée et les dimensions (mode, déclenchement, exécution), puis écrit la skill me:loop:<nom> et sa cale.",
    fields: (ctx) => [
      { id: "desc", label: "Le loop", kind: "text", placeholder: "son but, et la commande qui dit qu'il a fini" },
      { id: "scope", label: "Portée", kind: "choice", value: "global",
        choices: ctx.root ? [["global", "globale · ~/.claude"], ["project", `projet · ${ctx.root.split("/").pop()}`]] : [["global", "globale · ~/.claude"]],
        help: ctx.root ? "un loop de projet vit dans <repo>/.claude et part par une PR" : "pas de projet affiché : globale seulement" }],
    async plan(v, ctx) {
      const desc = clean(v.desc);
      if (!desc) return { error: "Décris le loop à créer : son but et ce qui dit qu'il a fini." };
      const repo = v.scope === "project" && ctx.root ? ctx.root : null;
      return plan(intents.createLoop(desc, repo ? tilde(repo, home()) : null), repo ?? `${home()}/.claude`);
    },
  },
  {
    id: "automation", label: "Créer une automatisation", hint: "skill herdr-automations dans la session Automatisation", icon: T("clock"),
    title: "Créer une automatisation Herdr",
    intro: "La session Automatisation écrit le script Luau avec la skill herdr-automations, lance sheprd-automate check et te montre le plan. L'approbation reste la tienne, dans le dialogue de Sheprd.",
    fields: (ctx) => [
      { id: "desc", label: "L'automatisation", kind: "text", placeholder: "quand elle tourne, et ce qu'elle fait" },
      { id: "scope", label: "Portée", kind: "choice", value: ctx.root ? "project" : "personal",
        choices: [...(ctx.root ? [["project", `projet · ${ctx.root.split("/").pop()}`]] : []), ["personal", "personnelle · sh et notify seulement"]],
        help: "un script de projet vit dans <repo>/.herdr/automations" }],
    async plan(v, ctx) {
      const desc = clean(v.desc);
      if (!desc) return { error: "Décris l'automatisation : quand elle tourne, et ce qu'elle fait." };
      const repo = v.scope === "project" && ctx.root ? ctx.root : null;
      return plan(intents.createAutomation(desc, repo ? tilde(repo, home()) : null), repo ?? `${home()}/.claude`);
    },
  },
];
