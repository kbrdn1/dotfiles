// session.js' own words (I18N.md), copied with it byte for byte into kt-automation and
// kt-workflow. The intention itself (« Intention : … ») goes to Claude and stays in French.
export default {
  fr: {
    blocked: "La session {name} attend une réponse de ta part : l'intention n'est pas partie.",
    unknown: "état inconnu",
    working: "La session {name} travaille ({status}) : l'intention n'est pas partie.",
    gone: "La session {name} n'a plus d'agent : Claude en est sorti.",
    refused: "La session {name} n'a pas pris l'intention : {why}",
    code: "code {code}",
  },
  en: {
    blocked: "The {name} session is waiting for your answer: the intention didn't go.",
    unknown: "unknown state",
    working: "The {name} session is working ({status}): the intention didn't go.",
    gone: "The {name} session has no agent anymore: Claude left it.",
    refused: "The {name} session didn't take the intention: {why}",
    code: "code {code}",
  },
};
