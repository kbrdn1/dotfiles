# herdr — Remap des keymaps

> **But** : tu remplis la colonne `Ton bind ✍️`, tu me redonnes ce fichier, je l'applique
> dans `~/.config/herdr/config.toml` (section `[keys]`) puis je valide via
> `herdr server reload-config` (qui renvoie les erreurs de binding).

## Règles de syntaxe (vérifiées sur ta version)

- **Prefix** = `ctrl+b`. Un binding `prefix+X` demande d'abord `ctrl+b`, puis `X`.
- **Lettres/chiffres simples DOIVENT être préfixés.** herdr **rejette en silence** tout
  binding direct qui intercepterait la frappe au clavier. Exemple réel remonté au reload :
  `keys.rename_tab = "shift+c"` → _« would intercept typing; use "prefix+shift+c" »_ →
  binding **désactivé**. (C'est le bug de ta config actuelle.)
- **Chords directs OK** (sans prefix) : seulement avec modificateurs forts type
  `ctrl+alt+...`, `function keys`. `alt+lettre` / `cmd+...` / ponctuation+modif =
  **dépend du terminal/tmux** (Ghostty ici), à éviter si tu veux du fiable.
- **Formes indexées** (confirmées) : `prefix+1..9`, `prefix+shift+1..9`, `prefix+alt+1..9`.
- ⚠️ **À valider empiriquement** : `prefix+ctrl+<lettre>` et `prefix+alt+<lettre>`
  (non-indexés) ne sont _pas_ démontrés dans la config par défaut. Je testerai au reload ;
  s'ils sont rejetés, on bascule sur une alternative.
- Touches spéciales acceptées : `enter tab esc left right up down`, et ponctuation nommée
  `minus comma ampersand plus backtick`.
- `unset` / `""` = action non bindée.

## Philosophie de ma reco (prefix-mode propre, pattern nvim)

- **`b` = previous / `n` = next**, profondeur par modificateur :
  tab = `prefix+b`/`prefix+n` · workspace = `+ctrl` · agent = `+alt`
- **`hjkl`** = focus pane directionnel
- **`shift+<touche de création>`** = variante rename/close
  (`new_tab=c` → `rename_tab=shift+c` · `close_pane=x` → `close_tab=shift+x`)
- Zéro chord direct (tout passe par le prefix) → aucun conflit avec la frappe.

---

## 🪟 Panes

| Action                | Défaut             | Ma reco                         | Ton bind ✍️      |
| --------------------- | ------------------ | ------------------------------- | ---------------- |
| `focus_pane_left`     | `prefix+h`         | `prefix+h`                      | reco             |
| `focus_pane_down`     | `prefix+j`         | `prefix+j`                      | reco             |
| `focus_pane_up`       | `prefix+k`         | `prefix+k`                      | reco             |
| `focus_pane_right`    | `prefix+l`         | `prefix+l`                      | reco             |
| `cycle_pane_next`     | `prefix+tab`       | `prefix+tab`                    | `prefix+shift+n` |
| `cycle_pane_previous` | `prefix+shift+tab` | `prefix+shift+tab`              | `prefix+shift+b` |
| `last_pane`           | _unset_            | `prefix+backtick` _(à valider)_ | `prefix+$`       |
| `split_vertical`      | `prefix+v`         | `prefix+v`                      | reco             |
| `split_horizontal`    | `prefix+minus`     | `prefix+minus`                  | `prefix+s`       |
| `close_pane`          | `prefix+x`         | `prefix+x`                      | reco             |
| `rename_pane`         | `prefix+shift+p`   | `prefix+shift+p`                | reco             |
| `zoom`                | `prefix+z`         | `prefix+z`                      | reco             |
| `resize_mode`         | `prefix+r`         | `prefix+r`                      | reco             |
| `edit_scrollback`     | `prefix+e`         | `prefix+e`                      | reco             |

## 📑 Tabs

| Action         | Défaut           | Ma reco                                       | Ton bind ✍️      |
| -------------- | ---------------- | --------------------------------------------- | ---------------- |
| `new_tab`      | `prefix+c`       | `prefix+c`                                    | reco             |
| `previous_tab` | `prefix+p`       | `prefix+b` _(nvim)_                           | reco             |
| `next_tab`     | `prefix+n`       | `prefix+n`                                    | reco             |
| `rename_tab`   | `prefix+shift+t` | `prefix+shift+c` _(miroir de `c`)_            | `prefix+shift+t` |
| `close_tab`    | `prefix+shift+x` | `prefix+shift+x` _(miroir de close_pane `x`)_ | reco             |
| `switch_tab`   | `prefix+1..9`    | `prefix+1..9`                                 | reco             |

## 🗂️ Workspaces

| Action               | Défaut           | Ma reco                       | Ton bind ✍️      |
| -------------------- | ---------------- | ----------------------------- | ---------------- |
| `new_workspace`      | `prefix+shift+n` | `prefix+shift+n`              | `prefix+shift+c` |
| `rename_workspace`   | `prefix+shift+w` | `prefix+shift+w`              | reco             |
| `close_workspace`    | `prefix+shift+d` | `prefix+shift+d`              | `prefix+ctrl+x`  |
| `previous_workspace` | _unset_          | `prefix+ctrl+b` _(à valider)_ | reco             |
| `next_workspace`     | _unset_          | `prefix+ctrl+n` _(à valider)_ | reco             |
| `workspace_picker`   | `prefix+w`       | `prefix+w`                    | reco             |
| `switch_workspace`   | _unset_          | `prefix+shift+1..9`           | reco             |
| `goto`               | `prefix+g`       | `prefix+g`                    | reco             |

## 🌿 Worktrees

| Action            | Défaut           | Ma reco                              | Ton bind ✍️ |
| ----------------- | ---------------- | ------------------------------------ | ----------- |
| `new_worktree`    | `prefix+shift+g` | `prefix+shift+g`                     | ✅ `prefix+shift+g` |
| `open_worktree`   | _unset_          | `prefix+ctrl+g`                      | ✅ `prefix+shift+o` _(ctrl+g pris par Lazygit)_ |
| `remove_worktree` | _unset_          | _unset_ _(destructif)_               | ✅ _unset_  |

## 🤖 Agents

> ⚠️ `alt` abandonné (cassé par `macos-option-as-alt = false` + tmux). Binds déplacés.

| Action           | Défaut  | Décision                                              | Appliqué |
| ---------------- | ------- | ----------------------------------------------------- | -------- |
| `previous_agent` | _unset_ | _unset_ — `shift+k` pris par `swap_pane_up` (préservé) | ✅ _unset_ |
| `next_agent`     | _unset_ | _unset_ — `shift+j` pris par `swap_pane_down` (préservé) | ✅ _unset_ |
| `focus_agent`    | _unset_ | indexé, seul créneau non-alt libre                    | ✅ `prefix+ctrl+1..9` |

## ⚙️ Système / UI

| Action                     | Défaut           | Ma reco                                           | Ton bind ✍️      |
| -------------------------- | ---------------- | ------------------------------------------------- | ---------------- |
| `help`                     | `prefix+?`       | `prefix+?`                                        | reco             |
| `settings`                 | `prefix+s`       | `prefix+s`                                        | `prefix+;`       |
| `detach`                   | `prefix+q`       | `prefix+q`                                        | reco             |
| `reload_config`            | `prefix+shift+r` | `prefix+shift+r`                                  | reco             |
| `open_notification_target` | `prefix+o`       | `prefix+o`                                        | reco             |
| `toggle_sidebar`           | `prefix+b`       | `prefix+shift+b` _(`b` libéré pour previous_tab)_ | `prefix+shift+v` |

## 🧭 Navigate-mode (mouvement local, sans prefix — pas de risque d'interception)

| Action                    | Défaut | Ma reco | Ton bind ✍️ |
| ------------------------- | ------ | ------- | ----------- |
| `navigate_workspace_up`   | `up`   | `up`    | `shift+k`   |
| `navigate_workspace_down` | `down` | `down`  | `shift+j`   |
| `navigate_pane_left`      | `h`    | `h`     | reco        |
| `navigate_pane_down`      | `j`    | `j`     | reco        |
| `navigate_pane_up`        | `k`    | `k`     | reco        |
| `navigate_pane_right`     | `l`    | `l`     | reco        |

---

## 🎛️ Tasks rapatriées de Zed → `[[keys.command]]` (✅ appliquées)

Tes tasks `~/.config/zed/tasks.json` reproduites en raccourcis herdr.
**Namespace `prefix+ctrl+<lettre>`**, mnémoniques calquées sur ta couche `alt-*` de Zed.

> Contraintes herdr : pas de séquences leader (`prefix+t f` invalide) → 1 combo par task.
> `ctrl+i/m/j/h` évités (octets = Tab/Enter/LF/Backspace, indistinguables par herdr).
> `type = "pane"` = pane temporaire fermé à la sortie ; `type = "shell"` = détaché.

| Outil | Zed `alt-*` | herdr | type | commande |
| --- | --- | --- | --- | --- |
| Claude Code (skip perms) | `alt-C` | `prefix+ctrl+a` | pane | `claude --dangerously-skip-permissions` |
| Lazygit | `alt-g` | `prefix+ctrl+g` | pane | `lazygit` |
| gwm | `alt-w` | `prefix+ctrl+w` | pane | `gwm` |
| Yazi | `alt-y` | `prefix+ctrl+y` | pane | `yazi` |
| FZF (+ $EDITOR) | `alt-f` | `prefix+ctrl+f` | pane | `fzf --preview … --bind enter:execute($EDITOR {})` |
| Rename (FZF) | `alt-R` | `prefix+ctrl+e` | pane | `find … \| fzf … && mv` |
| Project structure | `alt-p` | `prefix+ctrl+l` | shell | `eza --tree … > project-structure.txt` |
| LazySQL | `alt-s` | `prefix+ctrl+s` | pane | `lazysql` |
| Redis CLI | `alt-r` | `prefix+ctrl+r` | pane | `redis-cli` |
| LazyCurl | `alt-c` | `prefix+ctrl+u` | pane | `lazycurl` |
| LazySSH | `alt-S` | `prefix+ctrl+o` | pane | `lazyssh` |
| Lazydocker | `alt-d` | `prefix+ctrl+d` | pane | `lazydocker` |
| Lazykube | `alt-k` | `prefix+ctrl+k` | pane | `lazykube` |
| Lazymake | `alt-m` | `prefix+ctrl+t` | pane | `lazymake` |

**Créneaux `prefix+ctrl` encore libres** (safe) : `q`, `v`, `z`, `c` — pour ajouter d'autres tasks.
**Non rapatriées** (projet-spécifiques, peu pertinentes en global) : Laravel test/migrate/seed,
Ekphos, Obsidian, Superfile, Lumen diff, Git logs, terminaux (tmux/Ghostty/Kitty), variantes Claude.

### ⚠️ À tester au clavier (le reload valide la syntaxe, pas la frappe)
- Tous les `prefix+ctrl+<lettre>` (workspaces, worktree, tasks) + `focus_agent = prefix+ctrl+1..9`.
- Presse `ctrl+b` puis `ctrl+g` → Lazygit doit s'ouvrir dans un pane.
- Si un `prefix+ctrl+…` ne répond pas : c'est la couche tmux/Ghostty, pas herdr (qui l'a accepté).
