// Check du hook no-shell-write : bun ~/.claude/hooks/no-shell-write.check.ts
import { verdict } from "./no-shell-write.ts";

const cwd = "/Users/x/repo";
const glob = [/^.*\/layouts\/[^/]*-glass\.json$/];
const cases: [string, boolean][] = [
  // refusés
  [`python3 - <<'PY'\nopen("src/a.js", "w").write("x")\nPY`, true],
  [`python3 -c "open('/Users/x/repo/a.txt','w').write('x')"`, true],
  [`python3 - <<'PY'\nfrom pathlib import Path\nPath("/Users/x/repo/b.md").write_text("x")\nPY`, true],
  [`node -e "require('fs').writeFileSync('a.json','{}')"`, true],
  [`sed -i '' 's/a/b/' src/main.js`, true],
  [`sed -i.bak -e 's/a/b/' ./x.conf`, true],
  [`perl -pi -e 's/a/b/' lib/x.pm`, true],
  [`cat > src/new.ts <<'EOF'\nexport {}\nEOF`, true],
  [`echo hello > notes.md`, true],
  [`printf 'x' >> ~/.zshrc`, true],
  [`jq . a.json | tee config.json`, true],
  [`cd /x && echo a > "$OUT/f.txt"`, true], // cible inconnue
  // la boîte aux lettres des autorisations (#79) : ni lue ni écrite par le shell, par aucun moyen
  [`cat ~/.claude/cache/herdr/t4.ask.json`, true],
  [`cp /tmp/x.json ~/.claude/cache/herdr/t4.decision.json`, true],
  [`echo '{"id":"a","token":"b","choice":"yes"}' > $HOME/.claude/cache/herdr/t4.decision.json`, true],
  [`hc file write /Users/x/.claude/cache/herdr/t4.decision.json`, true],
  [`ln -s /tmp/forge.json /Users/x/.claude/cache/herdr/t4.decision.json`, true],
  [`python3 -c "print(open('/Users/x/.claude/cache/herdr/t4.ask.json').read())"`, true],
  // celle des messages (#81) : le jeton de session, le message à taper, la réponse du plugin
  [`cat ~/.claude/cache/herdr/t4.saytoken.json`, true],
  [`echo '{"id":"a","token":"b","text":"/model sonnet"}' > ~/.claude/cache/herdr/t4.say.json`, true],
  [`cp /tmp/ok.json $HOME/.claude/cache/herdr/t4.said.json`, true],
  [`ls ~/.claude/cache/herdr/*`, true], // un glob qui les couvrirait
  [`cat t4.ask.json`, false], // ailleurs, un fichier qui porte ce nom n'est pas la boîte
  [`ls ~/.claude/cache/herdr/t4.json`, false], // l'état d'un agent reste lisible
  [`jq .pending ~/.claude/cache/herdr/t4.json`, false],
  // permis
  [`ls -la > /dev/null 2>&1`, false],
  [`cmd 2>&1 | tail -3`, false],
  [`echo x > /tmp/a.txt`, false],
  [`D=/private/tmp/claude-501/s/goal; printf 'x' > $D/f.md`, false],
  [`T=$(mktemp -d); echo x > "$T/a"`, false],
  [`grep -n "a > b" file.js`, false],
  [`git commit -m "fix: a > b"`, false],
  [`python3 - "$R" <<'PY'\nimport sys\nprint(open(sys.argv[1]).read())\nPY`, false],
  [`python3 -c "import json,sys; print(json.load(sys.stdin))"`, false],
  [`sed -n '1,20p' main.js`, false],
  [`bun run build && cp a.js b.js`, false],
  [`jq . x.json > layouts/kbrdn-threads-glass.json`, false], // cible générée de la liste
  [`diff <(sort a) <(sort b)`, false],
  [`cmd >&2`, false],
  [`node -e "process.stdout.write('x')"`, false],
  // un heredoc ne compte comme code que pour la commande qui le porte (faux positif vu le 2026-11-18)
  [`S=/private/tmp/s; cat > "$S/notes.txt" <<'EOF'\nopen(p,'w').write(x)\nEOF\nbun "$S/run.ts"`, false],
  [`git commit -m "voir <<'EOF' dans le doc"`, false],
  [`echo a; python3 - <<'PY'\nopen("src/x.py","w").write("y")\nPY`, true],
  [`cat <<< "texte" | wc -l`, false],
  // perl, variantes vues le 2026-11-18 (un agent a écrit KEYMAP.md ainsi)
  [`perl -0pi -e 's/a/b/' data/orchestrator/KEYMAP.md`, true],
  [`perl -e 'open(my $fh, ">>", "x.md"); print $fh "y"'`, true],
  [`perl -e 'open my $fh, ">", "x.md" or die; print $fh "y"'`, true],
  [`perl -ne 'print if /a/' x.md`, false],
  // loop de review (me:loop:claude-review-pr) : faux positifs vus le 2026-11-18
  [`# le gabarit s'écrit P0=<compte>, une vraie réponse P0=0\necho ok`, false],
  [`DIFF=$(git rev-parse --path-format=absolute --git-path claude-review.diff)\ngit diff origin/dev...HEAD > "$DIFF"`, false],
  [`git diff > "$(git rev-parse --git-path claude-review.diff)"`, false],
  [`echo x > .git/info/exclude`, false],
  [`echo x > src/a.ts # commentaire`, true],
  [`printf '#!/bin/sh' > .git/hooks/pre-commit`, true],
  [`echo x >> .git/config`, true],
  [`echo x > .git/worktrees/w/hooks/post-checkout`, true],
  // --git-path garde son argument (brèche vue le 2026-11-18)
  [`H=$(git rev-parse --git-path hooks); echo x > "$H/pre-commit"`, true],
  [`echo x > "$(git rev-parse --git-path hooks/pre-commit)"`, true],
  [`echo x > "$(git rev-parse --git-path config)"`, true],
  [`G=$(git rev-parse --git-dir); echo x > "$G/hooks/x"`, true],
  [`G=$(git rev-parse --git-common-dir); echo x > "$G/review.diff"`, false],
  // un \ hors guillemets échappe le caractère suivant : '\'' ne rouvre pas de chaîne (faux positif vu le 2026-11-18)
  [`bash -c 'grep -oE "[\\"'\\'']x" f | while read -r r; do echo "a -> $r"; done'`, false],
  [`bash -c 'x='\\''y'\\''; echo "a -> $r"'`, false],
  [`echo a\\>b`, false],
  [`echo "a \\" > b"`, false],
  [`bash -c 'x='\\''y'\\''; echo "a"' > ~/out.txt`, true],
  [`echo a \\\\> out.txt`, true],
];
let bad = 0;
for (const [cmd, deny] of cases) {
  const got = verdict(cmd, cwd, glob) !== null;
  if (got !== deny) { bad++; console.error(`${deny ? "devrait refuser" : "devrait permettre"} : ${cmd.split("\n")[0]}  →  ${verdict(cmd, cwd, glob)}`); }
}
// La boîte nommée seule, depuis son dossier (un `cd` d'un appel précédent) : refusée aussi.
if (verdict(`cat t4.ask.json`, "/Users/x/.claude/cache/herdr", glob) === null) { bad++; console.error("devrait refuser : cat t4.ask.json depuis cache/herdr"); }
if (bad) { console.error(`no-shell-write : ${bad} échec(s)`); process.exit(1); }
console.log(`no-shell-write : ok (${cases.length} cas)`);
