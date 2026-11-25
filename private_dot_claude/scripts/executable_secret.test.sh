#!/usr/bin/env bash
# Check de ~/.claude/scripts/secret et du hook ~/.claude/hooks/secret-guard.sh.
# Hermétique : HOME et dossier temporaires ; shims gh, ssh (exécute la commande « distante » en local,
# sur des chemins du dossier temporaire) et osascript qui enregistrent argv et stdin ; shims espions
# (argv seul, puis le vrai outil) sur les outils externes que le script appelle ; Trousseau jetable.
# Aucun secret réel, aucun gh ni ssh réel. Le tout tourne sous /bin/bash (3.2) et sous le bash du PATH.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SECRET="$HERE/secret"
GUARD="$HERE/../hooks/secret-guard.sh"
tmp="$(mktemp -d)"
KC="$tmp/test.keychain-db"
kcs_before=$(/usr/bin/security list-keychains)
cleanup() { /usr/bin/security delete-keychain "$KC" 2> /dev/null || true; rm -rf "$tmp"; }
trap cleanup EXIT
/usr/bin/security create-keychain -p test "$KC"
/usr/bin/security unlock-keychain -p test "$KC"

# --- valeurs factices, choisies pour casser un échappement naïf ------------------------------------
VAL1="tok-$$-Alpha'q\"d\\b \$x %s"
VAL2="other-$$-Beta"
PEM="-----BEGIN TEST KEY-----
line-$$-one
line-$$-two
-----END TEST KEY-----"
HOSTKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAdummy$$"

# --- shims ---------------------------------------------------------------------------------------------
mkdir -p "$tmp/bin" "$tmp/home" "$tmp/remote"
LOG="$tmp/argv.log"
spy() {
  local real
  real=$(command -v "$1") || return 0
  cat > "$tmp/bin/$1" << EOF
#!/bin/sh
printf '%s\n' "$1 \$*" >> "$LOG"
exec "$real" "\$@"
EOF
  chmod +x "$tmp/bin/$1"
}
for t in awk cat mv chmod chown mktemp realpath readlink sed sh openssl age security cut; do spy "$t"; done

cat > "$tmp/bin/gh" << EOF
#!/bin/sh
printf '%s\n' "gh \$*" >> "$LOG"
printf '%s\n' "gh \$*" >> "$tmp/gh.calls"
cat > "$tmp/gh.\$3.stdin"
EOF
cat > "$tmp/bin/ssh" << EOF
#!/bin/bash
printf '%s\n' "ssh \$*" >> "$LOG"
while [ \$# -gt 0 ] && [ "\$1" != -- ]; do shift; done
shift 2 # --, l'hôte
exec sh -c "\$*"
EOF
cat > "$tmp/bin/osascript" << EOF
#!/bin/sh
printf '%s\n' "osascript \$*" >> "$LOG"
if [ -f "$tmp/osa.cancel" ]; then echo "execution error: User canceled. (-128)" >&2; exit 1; fi
cat "$tmp/osa.value"
EOF
chmod +x "$tmp/bin/gh" "$tmp/bin/ssh" "$tmp/bin/osascript"

fail() { echo "FAIL [$label]: $*"; [ ! -f "$tmp/out" ] || sed 's/^/  | /' "$tmp/out"; exit 1; }
# run <args…> : le script sous le bash testé ; sortie (stdout+stderr) dans $tmp/out, cumulée dans allout
run() {
  local rc=0
  HOME="$tmp/home" PATH="$tmp/bin:$PATH" SECRET_KEYCHAIN="$KC" "$B" "$SECRET" "$@" > "$tmp/out" 2>&1 || rc=$?
  cat "$tmp/out" >> "$tmp/allout"
  return $rc
}
mode() { /usr/bin/stat -f %Lp "$1"; }
same() { [ "$(cat "$1")" = "$2" ]; } # contenu (sans fins de ligne finales) égal à la valeur

suite() {
  B=$1 label=$2
  local E="$tmp/w-$label/.env" R="$tmp/remote/$label" rc
  mkdir -p "$tmp/w-$label" "$R"

  # 1. .env local : remplace la ligne en place (export gardé, doublon retiré), garde le reste et le mode 600
  printf '%s\n' '# app' 'A=1' 'export API_KEY=old' 'B=two words' 'API_KEY=dup' > "$E"
  chmod 600 "$E"
  printf '%s\n' "$VAL1" > "$tmp/v1"
  run set API_KEY --from "file:$tmp/v1" --to "env:$E" || fail "set → env"
  [ "$(cat "$tmp/out")" = "API_KEY: set → env:$E (len ${#VAL1})" ] || fail "sortie de set inattendue"
  [ "$(cat "$E")" = "$(printf '%s\n' '# app' 'A=1' "export API_KEY=$VAL1" 'B=two words')" ] || fail ".env réécrit mal"
  [ "$(mode "$E")" = 600 ] || fail ".env en mode $(mode "$E"), attendu 600"
  [ "$(ls -A "$tmp/w-$label")" = .env ] || fail "fichier temporaire laissé à côté du .env"
  chmod 640 "$E"; run set API_KEY --from "file:$tmp/v1" --to "env:$E" || fail "set → env (640)"
  [ "$(mode "$E")" = 640 ] || fail ".env en mode $(mode "$E"), attendu 640 (conservé)"
  chmod 600 "$E"

  # 2. verify : match, puis mismatch
  run verify API_KEY --from "file:$tmp/v1" --against "env:$E" || fail "verify devait répondre match"
  [ "$(cat "$tmp/out")" = match ] || fail "verify : attendu match"
  printf '%s\n' "$VAL2" > "$tmp/v2"
  rc=0; run verify API_KEY --from "file:$tmp/v2" --against "env:$E" || rc=$?
  [ "$rc" = 1 ] && [ "$(cat "$tmp/out")" = mismatch ] || fail "verify : attendu mismatch (rc=$rc)"

  # 3. prompt → gh, repo et environnement passés en options, valeur sur stdin sans fin de ligne
  printf '%s\n' "$VAL1" > "$tmp/osa.value"; rm -f "$tmp/osa.cancel" "$tmp/gh.calls"
  run set RESEND_API_KEY --from prompt --to gh:owner/repo@prod || fail "prompt → gh"
  [ "$(cat "$tmp/gh.calls")" = "gh secret set RESEND_API_KEY --repo owner/repo --env prod" ] || fail "argv de gh inattendu"
  cmp -s "$tmp/gh.RESEND_API_KEY.stdin" <(printf '%s' "$VAL1") || fail "stdin de gh ≠ la valeur"

  # 4. prompt annulé : rien d'écrit, gh jamais appelé
  touch "$tmp/osa.cancel"; rm -f "$tmp/gh.calls"
  rc=0; run set NEW_TOKEN --from prompt --to "env:$tmp/w-$label/new.env,gh" || rc=$?
  [ "$rc" != 0 ] || fail "l'annulation devait échouer"
  grep -q annulée "$tmp/out" || fail "pas de message d'annulation"
  [ ! -e "$tmp/w-$label/new.env" ] && [ ! -e "$tmp/gh.calls" ] || fail "l'annulation a écrit quelque chose"
  rm -f "$tmp/osa.cancel"

  # 5. clé hôte : ssh avec filtre local (champs 1-2 du .pub) → gh ; verify contre un ssh-keyscan filtré
  printf '%s root@vps\n' "$HOSTKEY" > "$R/ssh_host_ed25519_key.pub"
  printf '# vps:22 SSH-2.0-OpenSSH_9.6\nvps %s\n' "$HOSTKEY" > "$R/keyscan.txt"
  run set VPS_HOST_KEY --from "ssh:main-vps:$R/ssh_host_ed25519_key.pub:cut -d' ' -f1,2" --to gh || fail "ssh → gh"
  cmp -s "$tmp/gh.VPS_HOST_KEY.stdin" <(printf '%s' "$HOSTKEY") || fail "clé hôte mal extraite"
  run verify VPS_HOST_KEY --from "ssh:main-vps:$R/ssh_host_ed25519_key.pub:cut -d' ' -f1,2" \
    --against "cmd:awk '\$2==\"ssh-ed25519\"{print \$2\" \"\$3}' $R/keyscan.txt" || fail "verify clé hôte vs keyscan"
  rc=0; run verify VPS_HOST_KEY --from "file:$tmp/v1" --against gh || rc=$?
  [ "$rc" = 2 ] && [ "$(cat "$tmp/out")" = "unverifiable (github)" ] || fail "gh doit répondre unverifiable"

  # 6. fichier distant (clé PEM sur plusieurs lignes) : contenu + fin de ligne, mode 600
  printf '%s\n' "$PEM" > "$tmp/pem"
  run set DEPLOY_KEY --from "file:$tmp/pem" --to "ssh:main-vps:$R/deploy.pem" || fail "file → ssh"
  cmp -s "$R/deploy.pem" "$tmp/pem" && [ "$(mode "$R/deploy.pem")" = 600 ] || fail "fichier distant incorrect"
  rc=0; run set DEPLOY_KEY --from "file:$tmp/pem" --to "env:$E" || rc=$?
  [ "$rc" != 0 ] && ! grep -q DEPLOY_KEY "$E" || fail "une valeur multiligne a été écrite dans un .env"

  # 7. .env distant : remplace la ligne, garde le reste et le mode 640 ; verify depuis le distant
  printf '%s\n' 'A=1' 'APP_SECRET=old' 'B=2' > "$R/app.env"; chmod 640 "$R/app.env"
  run set APP_SECRET --from "file:$tmp/v1" --to "ssh-env:main-vps:$R/app.env" || fail "→ ssh-env"
  [ "$(cat "$R/app.env")" = "$(printf '%s\n' 'A=1' "APP_SECRET=$VAL1" 'B=2')" ] || fail ".env distant réécrit mal"
  [ "$(mode "$R/app.env")" = 640 ] || fail ".env distant en mode $(mode "$R/app.env"), attendu 640"
  run verify APP_SECRET --from "file:$tmp/v1" --against "ssh-env:main-vps:$R/app.env" || fail "verify ssh-env"

  # 8. Trousseau (jetable) : écriture sans argv, relue à l'identique, verify
  run set KC_TOKEN --from "file:$tmp/v1" --to keychain || fail "→ keychain"
  [ "$(/usr/bin/security find-generic-password -s secret/KC_TOKEN -w "$KC")" = "$VAL1" ] || fail "Trousseau : valeur altérée"
  run verify KC_TOKEN --from "file:$tmp/v1" --against keychain || fail "verify keychain"

  # 9. age : chiffré pour un destinataire, déchiffrable par son identité ; non vérifiable
  if command -v age > /dev/null; then
    age-keygen -o "$tmp/id-$label.txt" 2> /dev/null
    run set AGE_TOKEN --from "file:$tmp/v1" --to "age:$(age-keygen -y "$tmp/id-$label.txt"):$tmp/w-$label/out.age" || fail "→ age"
    [ "$(age -d -i "$tmp/id-$label.txt" "$tmp/w-$label/out.age")" = "$VAL1" ] || fail "age : déchiffrement ≠ valeur"
  fi

  # 10. gen : 32 octets en hex (64 caractères), b64 sans retour à la ligne
  run set GEN_HEX --from gen --to "env:$E" || fail "gen"
  grep -Eq '^GEN_HEX=[0-9a-f]{64}$' "$E" || fail "gen : pas 64 caractères hex"
  run set GEN_B64 --from gen:b64:96 --to "env:$E" || fail "gen:b64"
  grep -Eq '^GEN_B64=[A-Za-z0-9+/=]{128}$' "$E" || fail "gen:b64:96 : pas 128 caractères base64 sur une ligne"

  # 11. names : les noms, aucune valeur
  run names --env "$E" || fail "names"
  [ "$(cat "$tmp/out")" = "$(printf '%s\n' A API_KEY B GEN_HEX GEN_B64)" ] || fail "names : liste inattendue"

  # 12. une destination invalide arrête tout avant de lire la source
  : > "$LOG.before"; cp "$LOG" "$LOG.before"
  rc=0; run set X_TOKEN --from prompt --to "env:$E,nowhere" || rc=$?
  [ "$rc" != 0 ] && cmp -s "$LOG" "$LOG.before" || fail "une destination invalide a déclenché une lecture"
}

B=/bin/bash; suite "$B" bash32
B=$(command -v bash); [ "$B" = /bin/bash ] || suite "$B" bash-path

# --- aucune valeur dans une sortie du script ni dans un argv enregistré --------------------------
for v in "$VAL1" "$VAL2" "line-$$-one" "line-$$-two" "dummy$$"; do
  ! grep -qF -- "$v" "$tmp/allout" || { label=fuite; fail "valeur dans stdout/stderr du script"; }
  ! grep -qF -- "$v" "$LOG" || { label=fuite; grep -nF -- "$v" "$LOG"; fail "valeur dans un argv"; }
done
[ "$(/usr/bin/security list-keychains)" = "$kcs_before" ] || { label=trousseau; fail "liste des trousseaux modifiée"; }

# --- hook secret-guard ---------------------------------------------------------------------------------
guard() { printf '%s' "$1" | jq -Rs '{tool_name: "Bash", tool_input: {command: .}}' | "$B" "$GUARD"; }
deny_cases=(
  'printenv' 'env' 'env | grep KEY' 'printenv GITHUB_TOKEN' 'cat .env' 'head -5 ./.env.local'
  'grep RESEND .env.production' "awk -F= '{print \$1}' .env" "sed -n '1,5p' config/.env"
  "bash -c 'cat .env'" "sh -c 'env'" '/bin/cat .env' 'ls && tail -n 3 $HOME/.env' 'echo $RESEND_API_KEY'
  'printf "%s" "${NUXT_APP_SECRET}"' 'echo "$DB_PASSWORD"' 'ls && echo ${GH_TOKEN:-none}'
  'grep x f | env' "grep -E 'a|b' f; env" "jq -n '1|env'" "ssh main-vps 'cd /srv; env'"
)
allow_cases=(
  '~/.claude/scripts/secret names --env .env' '~/.claude/scripts/secret set X --from env:.env --to gh'
  'gh secret list' 'gh secret set X --env prod < /tmp/f' 'cat .env.example' 'cat ./.env.schema'
  "grep -rn '.env' src" 'echo ${#RESEND_API_KEY}' 'echo ${RESEND_API_KEY:+set}' 'echo $HOME'
  'env FOO=1 bun run build' '/usr/bin/env bash x.sh' 'git commit -m "fix: lire le .env"'
  'cp .env.example .env' 'cmd 2>&1 | tail -3' 'printf "%s\n" "$PATH"'
  "jq -c '.permissions.deny | map(select(test(\"env\")))' settings.json"
  "grep -E 'a|env|b' f" "rg -n '(env|x)' ." 'git grep -nE "x|env"' "cat f | grep 'a|env' | head"
)
for B in /bin/bash "$(command -v bash)"; do
  label="hook $B"
  for c in "${deny_cases[@]}"; do guard "$c" | grep -q '"deny"' || fail "devait refuser : $c"; done
  for c in "${allow_cases[@]}"; do [ -z "$(guard "$c")" ] || fail "devait laisser passer : $c"; done
done

echo "ok ($(wc -l < "$LOG" | tr -d ' ') appels d'outils enregistrés, ${#deny_cases[@]} refus et ${#allow_cases[@]} passages du hook)"
