#!/usr/bin/env bash
# Note de reprise d'une session qui en tient une : ~/.claude/handoff/<session_id>.md (en général un lien vers la
# note du lead, carry/lead/HANDOFF.md). Sans note pour cette session, ne fait rien.
#   precompact : photographie les workers hc lancés depuis ce terminal, puis donne au résumé ce qu'il doit garder
#                (le stdout d'un PreCompact sert de consignes au résumé, 10 000 caractères au plus).
#   start      : après une compaction ou une reprise, remet la note et la photo dans le contexte (stdout de SessionStart).
set -u
mode="${1:-}"
sid=$(jq -r '.session_id // empty' 2>/dev/null)
dir="$HOME/.claude/handoff"
note="$dir/$sid.md"
[ -n "$sid" ] && [ -e "$note" ] || exit 0
snap="$dir/$sid.snapshot.md"

case "$mode" in
  precompact)
    if [ -n "${HC_TERMINAL_ID:-}" ] && command -v hc >/dev/null 2>&1; then
      {
        echo "# Workers de $HC_TERMINAL_ID au $(date '+%Y-%m-%d %H:%M')"
        echo
        hc ls --json 2>/dev/null | jq -r --arg p "$HC_TERMINAL_ID" \
          '.terminals[] | select(.parent == $p) | "- \(.name // .address) (\(.address)) : \(.agent), \(.status // .state), \(.where)"'
      } > "$snap.tmp" && mv "$snap.tmp" "$snap"
    fi
    echo "Cette session tient sa note de reprise dans $note (photo des workers : $snap). Le résumé garde, mot pour mot pour les identifiants : chaque worker (nom, adresse, brief, dernier état), les hashes commités et ce qui est posé sans commit (fichiers exacts), les règles en vigueur, les décisions et questions qui attendent l'utilisateur, l'étape en cours et la suivante. Pour le reste, il renvoie à la note."
    ;;
  start)
    echo "Note de reprise de cette session ($note), à relire avant toute action :"
    echo
    head -c 12000 "$note"
    if [ -f "$snap" ]; then
      echo
      head -c 3000 "$snap"
    fi
    ;;
esac
exit 0
