# StatusLine - Alias de Chemins & Style

## 🎨 **Modèle Claude - Style Amélioré**

| Ancien | Nouveau |
|--------|---------|
| `sonnet-4` | `◉ Claude 4.5` |
| `opus-4` | `◉ Opus 4` |
| `haiku` | `◉ Haiku` |

## 📂 **Alias de Chemins Intelligents**

### Dossiers Projects
| Chemin Complet | Alias | Symbole |
|----------------|-------|---------|
| `~/Projects/Flippad` | `◈ Flippad` | ◈ (Fisheye) |
| `~/Projects/Perso` | `◆ Perso` | ◆ (Diamant plein) |
| `~/Projects/Pro` | `◇ Pro` | ◇ (Diamant vide) |
| `~/Projects/MNS` | `◈ MNS` | ◈ (Fisheye) |
| `~/Projects/Labs` | `◉ Labs` | ◉ (Cercle plein) |
| `~/Projects/Learning` | `◎ Learn` | ◎ (Cercle cible) |
| `~/Projects/Mehdi` | `◊ Mehdi` | ◊ (Losange) |
| `~/Projects` | `⬡ Proj` | ⬡ (Hexagone) |

### Dossiers Système
| Chemin Complet | Alias | Symbole |
|----------------|-------|---------|
| `~/Documents` | `◫ Docs` | ◫ (Calendrier) |
| `~/Downloads` | `⇣ DL` | ⇣ (Flèche bas) |
| `~/Desktop` | `◲ Desk` | ◲ (Carré) |
| `~/Scripts` | `⚙ Scripts` | ⚙ (Engrenage) |
| `~/Pictures` | `◐ Pics` | ◐ (Demi-cercle) |
| `~/Movies` | `◎ Movies` | ◎ (Cible) |
| `~/Music` | `♪ Music` | ♪ (Note musique) |

## ✨ **Exemples de Résultats**

### Projet Perso
```
◉ Claude 4.5  ⌂ ◆ Perso/cv-exporter  ⬢ 23.9.0  ⚡ ⇣1200 ⇡4990 • ≈ 222k tok/min • $6.32 • ⧗ 4h 2m
```

### Projet Flippad
```
◉ Claude 4.5  ⌂ ◈ Flippad/app-name  ⬢ 23.9.0  ⚡ ⇣850 ⇡3200 • ≈ 180k tok/min • $4.50 • ⧗ 3h 30m
```

### Downloads
```
◉ Claude 4.5  ⌂ ⇣ DL  ⚡ ⇣1231 ⇡5024 • ≈ 228k tok/min • $6.46 • ⧗ 2h 15m
```

## 🔧 **Comment Ajouter de Nouveaux Alias**

Édite `~/.claude/statusline-p10k.sh` et ajoute une ligne dans la section "Smart aliases" :

```bash
# Dans la section "Smart aliases for common directories"
dir_path="${dir_path//~\/Projects\/NouveauDossier/◈ Nouveau}"
```

**Ordre important** : Place les chemins les plus spécifiques **AVANT** les génériques.

❌ **Mauvais ordre** :
```bash
dir_path="${dir_path//~\/Projects/⬡ Proj}"           # Générique d'abord
dir_path="${dir_path//~\/Projects\/Perso/◆ Perso}"   # Spécifique après (ne marchera pas!)
```

✅ **Bon ordre** :
```bash
dir_path="${dir_path//~\/Projects\/Perso/◆ Perso}"   # Spécifique d'abord
dir_path="${dir_path//~\/Projects/⬡ Proj}"           # Générique après
```

## 🎯 **Symboles Unicode Disponibles**

Voici quelques symboles Unicode compatibles pour créer tes propres alias :

- **Formes** : ◉ ◎ ◈ ◆ ◇ ◊ ◐ ◑ ◒ ◓ ◔ ◕ ⬡ ⬢ ⬣ ◲ ◳ ◫
- **Flèches** : ⇣ ⇡ ⇠ ⇢ ↓ ↑ ← → ⬆ ⬇ ⬅ ➡
- **Symboles** : ⚙ ⚡ ⚑ ⚐ ⛭ ☆ ★ ✓ ✗ ♪ ♫
- **Tech** : ⎇ ⌂ ⌘ ⌥ ⇧ ⊙ ⊕ ⊗
