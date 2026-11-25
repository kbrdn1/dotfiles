---
name: me:secret
description: "Poser, changer, faire tourner (rotation) ou vérifier un secret (clé API, token, mot de passe, variable d'environnement sensible, clé hôte SSH) vers un .env, gh secret, l'env d'un VPS, le Trousseau ou une machine externe, sans que la valeur passe jamais par la conversation. Outil : ~/.claude/scripts/secret. Triggers: /me:secret, poser un secret, gh secret set, ajouter une clé API, mettre à jour le .env, rotation de clé, vérifier un secret, VPS_HOST_KEY, clé hôte, env du VPS, secret runtime."
---

# me:secret — un secret ne passe jamais par la conversation

Tout ce que l'agent voit finit dans le transcript : une valeur lue, affichée ou tapée dans une commande est une valeur fuitée. `~/.claude/scripts/secret` déplace la valeur de sa source à sa destination par un pipe ou une variable de script, et ne rend que le nom, la destination et la longueur, ou `match`/`mismatch`. L'agent manipule des **noms**, jamais des valeurs.

`$ARGUMENTS` = ce qu'il faut faire (« pose RESEND_API_KEY sur GitHub et le VPS », « rotation de NUXT_APP_SECRET », « vérifie VPS_HOST_KEY »…).

## Quand

Poser, changer, faire tourner ou vérifier un secret, une clé API, un token, un mot de passe, une variable d'environnement sensible, une clé hôte SSH. Dès qu'une tâche touche un `.env`, `gh secret`, l'env d'un VPS, le Trousseau, ou qu'une valeur doit aller d'une machine à une autre.

## ⛔ Ce que l'agent ne fait jamais

- `cat`/`head`/`grep`/`sed`/`awk`/`less`/`bat` sur un `.env*` (sauf `.env.example`, `.env.schema`) ; l'outil Read sur un `.env`. Les noms : `secret names --env <fichier>`.
- `printenv`, `env` nu, `echo $X_TOKEN`, `printf "$X_KEY"`. Pour savoir si une variable est définie : `echo ${X_KEY:+définie}` ou `echo ${#X_KEY}`.
- Coller une valeur dans une commande (`gh secret set X --body …`, `export X=…`, `curl -H "Authorization: …"`) : elle part dans argv (visible dans `ps`) **et** dans le transcript.
- Lire un secret « pour vérifier ». On vérifie avec `secret verify`, qui ne répond que `match` ou `mismatch`.
- Demander à l'utilisateur de coller une valeur dans le chat. On lui ouvre la boîte de dialogue (`--from prompt`).

Garde-fous en place : le hook `~/.claude/hooks/secret-guard.sh` (PreToolUse Bash) refuse les formes ci-dessus, et `settings.json` interdit l'outil Read sur `.env` et `.env.*`. Un refus renvoie ici : on change de méthode, on ne contourne pas.

## L'outil

```bash
S=~/.claude/scripts/secret
$S set    NAME --from <source> --to <dest>[,<dest>…]   # copy = alias ; --to répétable
$S verify NAME --from <source> --against <dest>        # match (0) | mismatch (1) | unverifiable (…) (2)
$S names  [--env <fichier>]                            # les noms d'un .env, jamais les valeurs
```

| Sources (`--from`) | |
|---|---|
| `prompt` | boîte de dialogue macOS masquée ; Annuler = rien n'est écrit. Abandon seule après 9 min |
| `gen` · `gen:hex:N` · `gen:b64:N` | `openssl rand` ; `gen` = 32 octets en hex (64 caractères) |
| `ssh:<alias>:<chemin>[:<filtre>]` | le fichier sur la machine ; le filtre (ex. `cut -d' ' -f1,2`) tourne en local |
| `env[:<chemin>]` · `ssh-env:<alias>:<chemin>` | la ligne `NAME=` d'un `.env` local (défaut `./.env`) ou distant |
| `keychain` | Trousseau, service `secret/NAME` |
| `file:<chemin>` · `cmd:<commande>` | un fichier local, la sortie d'une commande locale |

| Destinations (`--to`) | |
|---|---|
| `env[:<chemin>]` | remplace ou ajoute `NAME=…`, écriture atomique, mode et lien conservés |
| `gh[:<owner/repo>][@<environnement>]` | `gh secret set` sur stdin |
| `ssh:<alias>:<chemin>` | fichier distant brut, mode 600 |
| `ssh-env:<alias>:<chemin>` | ligne `NAME=…` d'un `.env` distant, mode et propriétaire conservés |
| `keychain` | Trousseau, service `secret/NAME` |
| `age:<destinataire>:<sortie>` | fichier chiffré (armure) pour une machine sans ssh ; destinataire `age1…`, `ssh-ed25519 …` ou un fichier de destinataires |

Toutes les destinations d'un même `--to` reçoivent **la même** valeur, lue une seule fois. Une destination mal écrite arrête tout avant la lecture. Les `.env` et le Trousseau refusent une valeur sur plusieurs lignes. Une clé PEM va vers `gh`, `ssh:` ou `age:`.

## Recettes

**Saisie humaine** (l'utilisateur a la valeur : clé d'un fournisseur, mot de passe). Dis-lui qu'une boîte de dialogue va s'ouvrir, et lance le Bash avec `timeout: 600000` : le dialogue attend jusqu'à 9 minutes, au-delà du timeout par défaut de 2 minutes.

```bash
$S set RESEND_API_KEY --from prompt --to gh,env:.env
```

**Génération** (un secret applicatif qu'on choisit soi-même) :

```bash
$S set NUXT_APP_SECRET --from gen --to gh,keychain
```

**Copie entre machines** :

```bash
$S copy RESEND_API_KEY --from env:.env --to gh:owner/repo@production
$S copy APP_KEY --from ssh-env:main-vps:/srv/app/.env --to env:.env
$S copy DEPLOY_KEY --from file:$HOME/.ssh/deploy_ed25519 --to gh       # PEM : la fin de ligne est gardée
$S copy API_TOKEN --from keychain --to "age:age1…:/tmp/api-token.age" # machine externe : transférer le fichier, puis là-bas `age -d -i <identité> api-token.age`
```

**Clé hôte SSH** (le cas `VPS_HOST_KEY`). Les champs diffèrent selon la source : dans le `.pub`, ce sont les champs 1-2 (`ssh-ed25519 AAAA…`). `ssh-keyscan` écrit d'abord une ligne de commentaire `# hôte:22 SSH-2.0-…`, puis `hôte ssh-ed25519 AAAA…` : il faut garder la ligne dont `$2=="ssh-ed25519"`, champs 2-3.

```bash
$S set VPS_HOST_KEY --from "ssh:main-vps:/etc/ssh/ssh_host_ed25519_key.pub:cut -d' ' -f1,2" --to gh
$S verify VPS_HOST_KEY --from "ssh:main-vps:/etc/ssh/ssh_host_ed25519_key.pub:cut -d' ' -f1,2" \
  --against "cmd:ssh-keyscan -t ed25519 <hôte> 2>/dev/null | awk '\$2==\"ssh-ed25519\"{print \$2\" \"\$3}'"
```

**Vérification** :

```bash
$S verify RESEND_API_KEY --from keychain --against ssh-env:main-vps:/srv/app/.env   # match | mismatch
```

Un secret GitHub ne se relit pas : `--against gh` répond `unverifiable (github)`, sans rien inventer. On le prouve par ce qui le consomme : le run du workflow, puis le service déployé (health check, envoi réel).

**Rotation** : générer → poser partout → vérifier → redéployer → constater → révoquer l'ancien.

1. Une seule commande pour toutes les destinations, **avec `keychain` dedans** : `gen` tire une valeur différente à chaque appel, et le Trousseau garde une source relisible pour vérifier ou ajouter une destination plus tard.
   ```bash
   $S set NUXT_APP_SECRET --from gen --to keychain,gh,ssh-env:main-vps:/srv/app/.env
   ```
2. `verify` sur chaque destination relisible (`--from keychain --against …`).
3. Redéployer, puis constater sur le service (pas sur le run seul).
4. Révoquer l'ancienne valeur chez le fournisseur, s'il y en a un.
5. Dire ce que la rotation invalide côté utilisateur (sessions, URLs signées, caches).

**Inventaire** : `$S names --env .env` (et `.env.example` se lit normalement : il ne porte que des valeurs factices).

## Projets

Le `CLAUDE.md` du projet dit où vit chaque secret et ce qu'un nouveau secret doit toucher. Lis-le avant de poser quoi que ce soit : `secret` pose la valeur, il ne sait pas où le projet l'attend.

Exemple, kbrdn.dev-v2 : un secret **runtime** touche quatre endroits (les deux workflows, l'allowlist de `scripts/github-deploy.sh`, la liste `-e` de `scripts/deploy.sh`), et `/srv` sur le VPS doit être synchronisé avant le premier déploiement qui l'envoie. Le détail vit dans `docs/CONFIGURATION.md` du repo : lis-le, ne le recopie pas.

## Limites, franchement

- Ça empêche la **fuite accidentelle**, pas un agent qui cherche la valeur : il a le shell (`security find-generic-password -w`, `ssh vps cat`, `python -c open('.env')`…). Le hook est une heuristique sur le texte de la commande : il a des faux négatifs (un `cat` passé par `xargs`, un interpréteur, `gh auth token`) et quelques faux positifs (un `cat .env` dans une chaîne entre guillemets).
- La sortie donne la **longueur** de la valeur. Pas d'empreinte : sur une valeur courte, un hash se casse.
- `cmd:` et le filtre de `ssh:` exécutent une commande locale : c'est leur rôle.
- Le Trousseau passe par `security -i`, qui lit la commande sur stdin. `add-generic-password -w VALEUR` mettrait la valeur dans argv, et `-w` en dernier (invite sur stdin) tronque à 128 caractères sans prévenir. L'écriture est confirmée en relisant.
- Les `.env` reçoivent la valeur brute, sans guillemets : c'est ce que lit `docker --env-file`. À la lecture (`env:`, `verify`), une paire de guillemets englobants est retirée. Les fins de ligne en bout de valeur sont toujours retirées.
- Les règles deny Read (`**/.env`, `**/.env.*`, sauf `!**/.env.example` et `!**/.env.schema`) sont **relatives au dossier de travail** : un `.env` d'un autre dépôt reste lisible par l'outil Read. Une variante `~/**/.env*` ne peut pas prendre d'exception (`!` ne marche qu'en tête de chemin relatif), d'où ce choix. Elles bloquent aussi Write et Edit sur ces fichiers. Une exception `!` ajoutée en cours de session n'agit qu'à la session suivante.

Check : `bash ~/.claude/scripts/secret.test.sh` (HOME temporaire, shims gh/ssh/osascript, Trousseau jetable, hook compris).
