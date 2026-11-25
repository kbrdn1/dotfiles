#!/usr/bin/env bash
# PreToolUse hook (matcher Bash) : refuse les commandes qui affichent un secret dans la conversation,
# et renvoie vers ~/.claude/scripts/secret (skill /me:secret).
#   - `env` ou `printenv` nus (tout l'environnement), `printenv` d'un nom sensible ;
#   - cat, less, more, head, tail, bat, grep, rg, awk, sed sur un fichier .env* (sauf .env.example
#     et .env.schema). Un `.env` collé à une apostrophe ou un guillemet est un motif (grep '.env'),
#     pas un fichier : il passe ;
#   - echo ou printf d'une variable dont le nom finit par _KEY, _SECRET, _TOKEN ou contient PASSWORD
#     (`${#VAR}` et `${VAR:+…}` restent permis : ils n'affichent pas la valeur).
# Garde-fou contre la fuite accidentelle, pas contre un agent qui cherche la valeur : il a le shell.
# Un verbe compte en position de commande : début de ligne, après ; & | ( ` $( ou une apostrophe ou un
# guillemet (bash -c '…'). Au moindre doute du parseur, on laisse passer : ce hook ne casse jamais Bash.
#
# Check : bash ~/.claude/scripts/secret.test.sh
set -u
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny",
    permissionDecisionReason: ("Refusé par secret-guard : " + $r + ". Une valeur secrète ne passe jamais par la conversation. " +
      "Noms d’un .env : ~/.claude/scripts/secret names --env <fichier>. Poser, copier : ~/.claude/scripts/secret set NAME --from <source> --to <dest>. " +
      "Contrôler : ~/.claude/scripts/secret verify NAME --from <source> --against <dest> (match/mismatch). Recettes : /me:secret.")}}'
  exit 0
}

AT='(^|[;&|(`'"'"'"]|\$\()[[:space:]]*((sudo|command|exec|builtin|nohup|time)[[:space:]]+)*([^[:space:];&|`'"'"'"]*/)?'
# Pour env/printenv, un mot seul entre guillemets est un argument (jq 'test("env")') : la position de
# commande n'y suit un guillemet qu'après -c (bash -c 'env').
AT1='(^|[;&|(`]|\$\(|-c[[:space:]]+['"'"'"])[[:space:]]*((sudo|command|exec|builtin|nohup|time)[[:space:]]+)*([^[:space:];&|`'"'"'"]*/)?'
SENSITIVE='(_KEY|_SECRET|_TOKEN)$|PASSWORD'
lines() { printf '%s\n' "$cmd"; }

# 1. env / printenv nus, printenv d'un nom sensible. Un motif de grep ou rg n'est pas une commande : il est
# masqué d'abord (grep -E 'a|env|b'). Ni jq ni awk : leur env et leur system() exécutent.
pat() { lines | sed -E "s/((^|[^[:alnum:]_])(grep|egrep|fgrep|rg)([[:space:]]+-[^[:space:]'\"]+)*[[:space:]]+)('[^']*'|\"[^\"]*\")/\1''/g"; }
pat | grep -Eq "${AT1}(env|printenv)[[:space:]]*(\$|[;&|)\`'\"]|[0-9]*>)" && deny "env ou printenv nu affiche tout l’environnement"
pat | grep -oE "${AT1}printenv[[:space:]]+[A-Za-z_][A-Za-z0-9_]*" | grep -oE '[A-Za-z_][A-Za-z0-9_]*$' \
  | grep -Eiq "$SENSITIVE" && deny "printenv d’une variable sensible"

# 2. lecteurs sur un fichier .env*
while IFS= read -r f; do
  case ${f##*/} in .env.example | .env.schema) ;; *) deny "lecture de ${f##*/} par le shell" ;; esac
done < <(lines | grep -oE "${AT}(cat|less|more|head|tail|bat|grep|egrep|fgrep|rg|awk|gawk|sed)([[:space:]][^;&|]*)" \
  | grep -oE '(^|[[:space:]/=<])\.env[A-Za-z0-9_.-]*' | sed -E 's/^[^.]//')

# 3. echo / printf d'une variable sensible
while IFS= read -r r; do
  case $r in '${#'* | *+) continue ;; esac
  name=$(printf '%s' "$r" | sed -E 's/^\$\{?//; s/:?[-+=?]$//')
  printf '%s' "$name" | grep -Eiq "$SENSITIVE" && deny "affichage de \$$name"
done < <(lines | grep -oE "${AT}(echo|printf)([[:space:]][^;&|]*)?" \
  | grep -oE '\$\{?#?[A-Za-z_][A-Za-z0-9_]*(:?[-+=?])?')
exit 0
