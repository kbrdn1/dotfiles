// kt-history's words (I18N.md). The dates go through i18n.js' date(); "N commits" is git's word in
// both languages.
export default {
  fr: {
    close: "Fermer",
    copied: "Copié",
    detached: "HEAD détachée",
    diffFailed: "git diff a échoué",
    files: { one: "{n} fichier", other: "{n} fichiers" },
    noFiles: "Aucun fichier modifié.",
    noRepo: "Pas de dépôt git ici.",
    noCommits: "Aucun commit dans ce dépôt.",
    refresh: "Actualiser",
    activity: { one: "{n} commit sur les {days} derniers jours", other: "{n} commits sur les {days} derniers jours" },
    activityNone: "Aucun commit sur les {days} derniers jours.",
    // #82: a commit another mod asked for (open.js).
    "open.notListed": "Ce commit n'est pas parmi les 200 derniers de ce dépôt.",
    "open.ambiguous": "Ce sha court désigne plusieurs commits.",
  },
  en: {
    close: "Close",
    copied: "Copied",
    detached: "detached HEAD",
    diffFailed: "git diff failed",
    files: { one: "{n} file", other: "{n} files" },
    noFiles: "No file changed.",
    noRepo: "No git repository here.",
    noCommits: "No commits in this repository.",
    refresh: "Refresh",
    activity: { one: "{n} commit over the last {days} days", other: "{n} commits over the last {days} days" },
    activityNone: "No commits over the last {days} days.",
    // #82: a commit another mod asked for (open.js).
    "open.notListed": "This commit isn't among this repo's last 200.",
    "open.ambiguous": "This short sha names several commits.",
  },
};
