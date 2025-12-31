# StatusLine Configuration Complete Reference

Documentation complète pour `~/.claude/statusline-config.yaml`

---

## 📋 Table des Matières

1. [Structure du Fichier](#structure-du-fichier)
2. [Features - Fonctionnalités](#features---fonctionnalités)
3. [Display - Affichage](#display---affichage)
4. [Symbols - Symboles](#symbols---symboles)
5. [Performance - Optimisation](#performance---optimisation)
6. [Variables d'Environnement](#variables-denvironnement)
7. [Profils Pré-configurés](#profils-pré-configurés)
8. [Exemples d'Utilisation](#exemples-dutilisation)

---

## Structure du Fichier

Le fichier de configuration utilise le format YAML avec une structure imbriquée :

```yaml
features:
  git: { ... }
  versions: { ... }
  devops: { ... }
  tokens: { ... }
  system: { ... }

display:
  show_date: true
  # ...

symbols:
  # ...

performance:
  # ...
```

### Priorité de Configuration

1. **Variables d'environnement** (priorité maximale)
2. **Fichier YAML** (`~/.claude/statusline-config.yaml`)
3. **Valeurs par défaut** (tout activé)

---

## Features - Fonctionnalités

### Git Features

```yaml
features:
  git:
    enabled: true                    # Master toggle - désactive tout Git
    show_branch: true                # Afficher ⎇ main
    show_status: true                # Afficher *2 !5 ?1
    show_ahead_behind: true          # Afficher ↑3 ↓2
    show_stash: true                 # Afficher ⊟2
    show_conflict: true              # Afficher ⚠CONFLICT
    clean_indicator: true            # Afficher ✓ si propre (pas implémenté)
```

**Variables d'environnement équivalentes** :
```bash
STATUSLINE_GIT_ENABLED=false         # Désactive complètement Git
STATUSLINE_GIT_SHOW_BRANCH=false
STATUSLINE_GIT_SHOW_STATUS=false
STATUSLINE_GIT_AHEAD_BEHIND=false
STATUSLINE_GIT_STASH=false
STATUSLINE_GIT_CONFLICT=false
```

**Impact performance** :
- `show_ahead_behind: false` → ~30-50ms saved
- `show_stash: false` → ~10ms saved

---

### Language Versions

```yaml
features:
  versions:
    enabled: true                    # Master toggle - désactive toutes les versions
    node: true                       # ⬢ 23.9.0
    php: true                        # ◆ 8.4
    go: true                         # ◈ 1.24
    python: true                     # ⊙ 3.13
    rust: true                       # ⚙ 1.75
    ruby: true                       # ◊ 3.3
    java: true                       # ◈ 21
    smart_detection: true            # Affiche uniquement si utilisé
```

**Variables d'environnement** :
```bash
STATUSLINE_VERSIONS_ENABLED=false    # Désactive toutes les versions
STATUSLINE_NODE=false
STATUSLINE_PHP=false
STATUSLINE_GO=false
STATUSLINE_PYTHON=false
STATUSLINE_RUST=false
STATUSLINE_RUBY=false
STATUSLINE_JAVA=false
```

**Smart Detection** :
- Détecte automatiquement si le projet utilise un langage
- Basé sur les fichiers : `package.json`, `go.mod`, `Cargo.toml`, etc.
- Priorité à `.tool-versions` si présent

---

### DevOps Integration

```yaml
features:
  devops:
    docker: true                     # ◧ 3 (containers running)
    kubernetes: true                 # ⎈ prod (k8s context)
    k8s_max_length: 15              # Longueur max du nom de contexte
```

**Variables d'environnement** :
```bash
STATUSLINE_DOCKER=false
STATUSLINE_KUBERNETES=false
STATUSLINE_K8S_MAX_LENGTH=20
```

**Impact performance** :
- `docker: false` → ~20ms saved
- `kubernetes: false` → ~30ms saved

---

### Token Usage & Stats

```yaml
features:
  tokens:
    enabled: true                    # Master toggle pour ccusage
    show_input_output: true          # ⇣1200 ⇡4990
    show_burn_rate: true             # ≈ 222k tok/min
    show_cost: true                  # $6.32
    show_time_remaining: true        # ⧗ 4h 2m
```

**Variables d'environnement** :
```bash
STATUSLINE_TOKENS_ENABLED=false
STATUSLINE_SHOW_INPUT_OUTPUT=false
STATUSLINE_SHOW_BURN_RATE=false
STATUSLINE_SHOW_COST=false
STATUSLINE_SHOW_TIME_REMAINING=false
```

---

### System Information

```yaml
features:
  system:
    show_model: true                 # ◉ Sonnet 4.5, Opus 4, Haiku 3.5, etc.
    show_path: true                  # ⌂ ~/path
    use_path_aliases: true           # ◆ Perso au lieu de ~/Projects/Perso
```

**Variables d'environnement** :
```bash
STATUSLINE_SHOW_MODEL=false
STATUSLINE_SHOW_PATH=false
```

---

## Display - Affichage

### Date & Time

```yaml
display:
  show_date: true                    # ◫ 07/10/25
  show_time: true                    # ◷ 14:30
  date_format: "%d/%m/%y"           # Format strftime
  time_format: "%H:%M"              # Format strftime
```

**Variables d'environnement** :
```bash
STATUSLINE_SHOW_DATE=false
STATUSLINE_SHOW_TIME=false
STATUSLINE_DATE_FORMAT="%Y-%m-%d"   # Format ISO
STATUSLINE_TIME_FORMAT="%H:%M:%S"   # Avec secondes
```

**Formats strftime courants** :
- `%d/%m/%y` → 07/10/25
- `%Y-%m-%d` → 2025-10-07
- `%d %b %Y` → 07 Oct 2025
- `%H:%M` → 14:30
- `%I:%M %p` → 02:30 PM
- `%H:%M:%S` → 14:30:45

---

### Path Display

```yaml
display:
  max_path_length: 50               # Longueur max avant truncation
  path_truncate_strategy: "middle"  # "middle", "start", "end" (pas implémenté)
  show_full_path: false             # Path complet vs basename (pas implémenté)
```

**Variables d'environnement** :
```bash
STATUSLINE_MAX_PATH_LENGTH=30
```

---

### Git Display

```yaml
display:
  git_stats_style: "compact"        # "compact" (*2) ou "verbose" (2 staged)
  show_clean_branch: true           # Afficher branch même si propre
```

**Options pas encore implémentées** :
- `git_stats_style: "verbose"` → à venir
- `show_clean_branch` → comportement actuel

---

### Separators & Spacing

```yaml
display:
  separator: "  "                   # Séparateur entre sections
  compact_mode: false               # Mode compact (pas implémenté)
```

---

## Symbols - Symboles

Personnalisez les icônes Unicode utilisées :

```yaml
symbols:
  model: "◉"
  folder: "⌂"
  git: "⎇"
  git_clean: "✓"
  git_modified: "✗"
  node: "⬢"
  php: "◆"
  go: "◈"
  rust: "⚙"
  python: "⊙"
  ruby: "◊"
  java: "◈"
  token: "◉"
  burn: "≈"
  time: "◷"
  calendar: "◫"
  input: "⇣"
  output: "⇡"
  remaining: "⧗"
  ahead: "↑"
  behind: "↓"
  stash: "⊟"
  conflict: "⚠"
  docker: "◧"
  k8s: "⎈"
```

**Note** : La personnalisation des symboles n'est pas encore implémentée dans le code.

---

## Performance - Optimisation

```yaml
performance:
  disable_slow_git: false           # Désactive ahead/behind si lent
  cache_duration: 2                 # Cache résultats (secondes, 0 = désactivé)
  parallel_execution: true          # Exécution parallèle des checks
  timeout_ms: 200                   # Timeout max par check (ms)
```

**Note** : Les options de performance ne sont pas encore implémentées.

---

## Variables d'Environnement

### Liste Complète

```bash
# ── Git ───────────────────────────────────────────
STATUSLINE_GIT_ENABLED=true|false
STATUSLINE_GIT_SHOW_BRANCH=true|false
STATUSLINE_GIT_SHOW_STATUS=true|false
STATUSLINE_GIT_AHEAD_BEHIND=true|false
STATUSLINE_GIT_STASH=true|false
STATUSLINE_GIT_CONFLICT=true|false

# ── Versions ──────────────────────────────────────
STATUSLINE_VERSIONS_ENABLED=true|false
STATUSLINE_NODE=true|false
STATUSLINE_PHP=true|false
STATUSLINE_GO=true|false
STATUSLINE_PYTHON=true|false
STATUSLINE_RUST=true|false
STATUSLINE_RUBY=true|false
STATUSLINE_JAVA=true|false

# ── DevOps ────────────────────────────────────────
STATUSLINE_DOCKER=true|false
STATUSLINE_KUBERNETES=true|false
STATUSLINE_K8S_MAX_LENGTH=15

# ── Tokens ────────────────────────────────────────
STATUSLINE_TOKENS_ENABLED=true|false
STATUSLINE_SHOW_INPUT_OUTPUT=true|false
STATUSLINE_SHOW_BURN_RATE=true|false
STATUSLINE_SHOW_COST=true|false
STATUSLINE_SHOW_TIME_REMAINING=true|false

# ── System ────────────────────────────────────────
STATUSLINE_SHOW_MODEL=true|false
STATUSLINE_SHOW_PATH=true|false

# ── Display ───────────────────────────────────────
STATUSLINE_SHOW_DATE=true|false
STATUSLINE_SHOW_TIME=true|false
STATUSLINE_DATE_FORMAT="%d/%m/%y"
STATUSLINE_TIME_FORMAT="%H:%M"
STATUSLINE_MAX_PATH_LENGTH=50
```

### Ajouter au Shell

**zsh** (`~/.zshrc`) :
```bash
# StatusLine Configuration
export STATUSLINE_DOCKER=false
export STATUSLINE_KUBERNETES=false
```

**bash** (`~/.bashrc`) :
```bash
# StatusLine Configuration
export STATUSLINE_DOCKER=false
export STATUSLINE_KUBERNETES=false
```

---

## Profils Pré-configurés

### Profile: Minimal

```yaml
features:
  git:
    enabled: true
    show_ahead_behind: false
    show_stash: false
  versions:
    enabled: true
    smart_detection: true
  devops:
    docker: false
    kubernetes: false
  tokens:
    enabled: false
display:
  show_date: false
  show_time: true
```

**Résultat** : `⌂ ~/path  ⎇ main *2  ⬢ 23.9.0  ◷ 14:30`

---

### Profile: Performance

```yaml
features:
  git:
    enabled: true
    show_ahead_behind: false
    show_stash: false
  versions:
    enabled: true
  devops:
    docker: false
    kubernetes: false
  tokens:
    enabled: true
    show_burn_rate: false
performance:
  disable_slow_git: true
  cache_duration: 5
```

**Gain** : ~100ms par refresh

---

### Profile: DevOps

```yaml
features:
  git:
    enabled: true
    show_ahead_behind: true
    show_stash: true
  versions:
    enabled: true
  devops:
    docker: true
    kubernetes: true
  tokens:
    enabled: true
display:
  show_date: true
  show_time: true
```

**Résultat** : Statusline complète avec focus DevOps

---

### Profile: Complete (Default)

Tous les features activés avec les valeurs par défaut.

---

## Exemples d'Utilisation

### Cas 1 : Désactiver uniquement Docker

**Via YAML** :
```yaml
features:
  devops:
    docker: false
```

**Via Env Var** :
```bash
export STATUSLINE_DOCKER=false
```

---

### Cas 2 : Masquer les versions sauf Node.js

**Via YAML** :
```yaml
features:
  versions:
    enabled: true
    node: true
    php: false
    go: false
    python: false
    rust: false
    ruby: false
    java: false
```

**Via Env Var** :
```bash
export STATUSLINE_PHP=false
export STATUSLINE_GO=false
export STATUSLINE_PYTHON=false
# etc...
```

---

### Cas 3 : Format de Date US

**Via YAML** :
```yaml
display:
  date_format: "%m/%d/%y"    # 10/07/25
  time_format: "%I:%M %p"    # 02:30 PM
```

**Via Env Var** :
```bash
export STATUSLINE_DATE_FORMAT="%m/%d/%y"
export STATUSLINE_TIME_FORMAT="%I:%M %p"
```

---

### Cas 4 : Statusline Ultra-Minimaliste

**Via YAML** :
```yaml
features:
  git:
    enabled: true
    show_status: false
    show_ahead_behind: false
    show_stash: false
  versions:
    enabled: false
  devops:
    docker: false
    kubernetes: false
  tokens:
    enabled: false
display:
  show_date: false
  show_time: false
```

**Résultat** : `⌂ ~/path  ⎇ main`

---

### Cas 5 : Focus Tokens/Performance

**Via YAML** :
```yaml
features:
  git:
    enabled: false
  versions:
    enabled: false
  devops:
    docker: false
    kubernetes: false
  tokens:
    enabled: true
display:
  show_date: false
```

**Résultat** : `◉ Sonnet 4.5  ⌂ ~/path  ◉ ⇣1200 ⇡4990 • ≈ 222k tok/min • $6.32 • ⧗ 4h 2m  ◷ 14:30`

---

## 🔧 Troubleshooting

### La configuration YAML n'est pas prise en compte

1. **Vérifier que yq est installé** :
   ```bash
   which yq
   # Si absent : brew install yq
   ```

2. **Vérifier la syntaxe YAML** :
   ```bash
   yq eval '.' ~/.claude/statusline-config.yaml
   ```

3. **Tester une option spécifique** :
   ```bash
   yq '.features.git.enabled' ~/.claude/statusline-config.yaml
   ```

---

### Les variables d'environnement ne fonctionnent pas

1. **Vérifier qu'elles sont exportées** :
   ```bash
   echo $STATUSLINE_DOCKER
   ```

2. **Recharger le shell** :
   ```bash
   source ~/.zshrc  # ou ~/.bashrc
   ```

---

### Comportement inattendu

1. **Priorité de configuration** : Les env vars overrident le YAML
2. **Valeurs true/false** : Sensible à la casse, utiliser lowercase
3. **Quotes YAML** : Pas de quotes autour de `true`/`false` dans YAML

---

## 📚 Voir Aussi

- **STATUSLINE-README.md** - Guide général d'utilisation
- **statusline-options.md** - Liste des options disponibles
- **statusline-aliases.md** - Documentation des alias de chemins
- **statusline-p10k.sh** - Code source du script

---

**Version** : 3.0
**Dernière mise à jour** : 07/10/2025
