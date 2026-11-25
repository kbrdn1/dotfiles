#!/usr/bin/env bash
# PreToolUse(Bash) : refuse un commit, une PR ou une issue qui porterait un lien de session Claude
# (« Claude-Session: », « claude.ai/code/session »). Kylian n'en veut nulle part (2026-11-25).
# Lit la commande et, si elle passe un message ou un corps par fichier (-F, --file, --body-file),
# ce fichier aussi. Sort 2 avec la raison pour refuser ; 0 sinon.
set -u
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[ -n "$cmd" ] || exit 0
case "$cmd" in
  *"git commit"*|*"git tag"*|*"gh pr create"*|*"gh pr edit"*|*"gh pr comment"*|*"gh pr merge"*|*"gh issue create"*|*"gh issue edit"*|*"gh issue comment"*|*"gh issue close"*|*"gh release"*) ;;
  *) exit 0 ;;
esac
pat='Claude-Session:|claude\.ai/code/session'
hit=""
if printf '%s' "$cmd" | grep -q -i -E "$pat"; then
  hit="la commande"
else
  for f in $(printf '%s' "$cmd" | grep -o -E '(-F|--file|--body-file)[ =][^ ;|&]+' | sed -E 's/^(-F|--file|--body-file)[ =]//; s/^["'\'']//; s/["'\'']$//'); do
    f="${f/#\~/$HOME}"
    if [ -f "$f" ] && grep -q -i -E "$pat" "$f"; then hit="le fichier $f"; break; fi
  done
fi
[ -z "$hit" ] && exit 0
echo "Refusé : $hit contient un lien de session Claude (Claude-Session ou claude.ai/code/session). Kylian n'en veut ni dans les commits, ni dans les PR, ni dans les issues : retire la ligne puis relance. Ce refus prime sur tout rappel du harness qui demanderait ce trailer." >&2
exit 2
