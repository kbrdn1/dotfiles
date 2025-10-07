# 🏗️ Architecture AeroSpace - Alt Droite Exclusive

## 📋 Vue d'ensemble

Cette configuration utilise une architecture unique où **AeroSpace** gère uniquement la logique de fenêtres et **skhd** gère exclusivement tous les raccourcis clavier avec la touche **Alt droite uniquement**.

## 🎯 Principe de Fonctionnement

### 🔄 Flux d'Interaction
```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Utilisateur   │───▶│     skhd     │───▶│   AeroSpace     │
│  (Alt droite)   │    │ (raccourcis) │    │   (actions)     │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                    │
         │                       ▼                    ▼
         │              ┌──────────────┐    ┌─────────────────┐
         │              │   Filtrage   │    │  Manipulation   │
         └──────────────▶│ Alt droite   │    │   Fenêtres      │
                        │  uniquement  │    │  & Workspaces   │
                        └──────────────┘    └─────────────────┘
```

### 🎨 Séparation des Responsabilités

| Composant | Responsabilité | Configuration |
|-----------|----------------|---------------|
| **AeroSpace** | • Logique de fenêtres<br>• Règles d'applications<br>• Callbacks Sketchybar<br>• Layouts et workspaces | `aerospace.toml`<br>**AUCUN raccourci** |
| **skhd** | • TOUS les raccourcis<br>• Filtrage Alt droite<br>• Commandes vers AeroSpace | `skhdrc`<br>**Exclusivement `ralt`** |
| **Sketchybar** | • Interface visuelle<br>• Status bar<br>• Feedback utilisateur | Intégration via callbacks |

## 🔧 Architecture Technique

### 📁 Structure des Fichiers
```
~/.config/aerospace/
├── aerospace.toml          # Configuration AeroSpace (PAS de raccourcis)
│   ├── Behavior settings   # ✅ Activé
│   ├── Gaps configuration  # ✅ Activé  
│   ├── App rules          # ✅ Activé
│   ├── Callbacks          # ✅ Activé
│   └── Key bindings       # ❌ DÉSACTIVÉ (vide)
│
├── ~/.config/skhd/skhdrc   # TOUS les raccourcis ici
│   ├── ralt-1 through 0   # Navigation workspaces
│   ├── ralt-h/j/k/l       # Navigation fenêtres
│   ├── ralt-shift-*       # Déplacements
│   ├── ralt-ctrl-*        # Actions avancées
│   └── ralt-ctrl-shift-*  # Actions expertes
│
└── Documentation/
    ├── AIDE-MEMOIRE.md    # Raccourcis essentiels
    ├── ALT-DROITE.md      # Guide Alt droite
    └── ARCHITECTURE.md    # Ce document
```

### ⚙️ Configuration AeroSpace (aerospace.toml)
```toml
# ═══════════════════════════════════════════════════════════════
# RACCOURCIS COMPLÈTEMENT DÉSACTIVÉS
# ═══════════════════════════════════════════════════════════════
# [mode.main.binding]  ← SECTION SUPPRIMÉE
# [mode.resize.binding] ← SECTION SUPPRIMÉE  
# [mode.service.binding] ← SECTION SUPPRIMÉE

# ✅ SEULEMENT LES FONCTIONNALITÉS CORE
enable-normalization-flatten-containers = true
start-at-login = true

[gaps]
inner.horizontal = 12
inner.vertical = 12
# ... etc

[[on-window-detected]]
# ... règles d'applications seulement
```

### ⌨️ Configuration skhd (skhdrc)
```bash
# ═══════════════════════════════════════════════════════════════
# TOUS LES RACCOURCIS UTILISENT 'ralt' (Alt droite)
# ═══════════════════════════════════════════════════════════════

# Navigation workspaces
ralt - 1 : aerospace workspace 1
ralt - 2 : aerospace workspace 2
# ... etc

# Navigation fenêtres (vim-style)
ralt - h : aerospace focus left
ralt - j : aerospace focus down
# ... etc

# Actions avancées
ralt + ctrl - e : aerospace balance-sizes
# ... etc
```

## 🎯 Avantages de cette Architecture

### ✅ **Contrôle Total**
- **Précision absolue** : seule Alt droite fonctionne
- **Aucun conflit** avec raccourcis macOS natifs
- **Personnalisation complète** dans un seul fichier (skhd)
- **Debugging facile** : problème = skhd, solution = skhd

### ✅ **Séparation des Préoccupations**
- **AeroSpace** = moteur de fenêtres pur
- **skhd** = interface utilisateur exclusive
- **Maintenance séparée** de chaque composant
- **Évolutions indépendantes** possibles

### ✅ **Robustesse**
- **Pas de dépendance croisée** entre raccourcis
- **Rechargement indépendant** (aerospace vs skhd)
- **Fallback possible** : AeroSpace CLI reste fonctionnel
- **Debugging granulaire** par composant

### ✅ **Performance**
- **AeroSpace optimisé** : pas de parsing de raccourcis
- **skhd spécialisé** : filtrage hardware efficient
- **Moins de conflits** = moins de latence
- **Callbacks directs** vers Sketchybar

## 🔍 Comparaison des Approches

### 📊 Architecture Standard vs Alt Droite Exclusive

| Aspect | Standard AeroSpace | Notre Architecture |
|--------|-------------------|-------------------|
| **Raccourcis** | Dans `aerospace.toml` | Dans `skhdrc` uniquement |
| **Alt gauche** | Fonctionne | **Bloquée** |
| **Alt droite** | Fonctionne | **Exclusive** |
| **Conflits macOS** | Possibles | **Impossibles** |
| **Personnalisation** | 2 fichiers | **1 fichier** (skhd) |
| **Debugging** | Complexe | **Simple** |
| **Maintenance** | Interdépendante | **Séparée** |

### 🎨 Schéma Comparatif
```
┌─────────────────── STANDARD ────────────────────┐
│                                                 │
│ [Alt gauche] ─┬─▶ AeroSpace ──┐                │
│               │                ├─▶ Conflits    │
│ [Alt droite] ─┘                │    possibles   │
│                macOS ──────────┘                │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────── NOTRE APPROCHE ──────────────┐
│                                                 │
│ [Alt gauche] ──▶ macOS (normal) ──▶ ✅ OK       │
│                                                 │  
│ [Alt droite] ──▶ skhd ──▶ AeroSpace ──▶ ✅ OK   │
│                                                 │
│              ✅ AUCUN CONFLIT                   │
└─────────────────────────────────────────────────┘
```

## 🛠 Maintenance et Opérations

### 🔄 Rechargement des Configurations
```bash
# Recharger AeroSpace (règles, comportement)
aerospace reload-config

# Recharger skhd (raccourcis)
skhd --reload

# Tout recharger
aerospace reload-config && skhd --reload
```

### 🔍 Debugging Raccourcis
```bash
# 1. Vérifier que skhd est actif
pgrep -f skhd

# 2. Tester AeroSpace directement
aerospace workspace 1

# 3. Si problème = dans skhd uniquement
# 4. Solution = éditer ~/.config/skhd/skhdrc
```

### 📊 Diagnostic Rapide
```bash
# Status des composants
echo "AeroSpace: $(pgrep -f AeroSpace > /dev/null && echo '✅' || echo '❌')"
echo "skhd: $(pgrep -f skhd > /dev/null && echo '✅' || echo '❌')"

# Test fonctionnalités core
aerospace list-workspaces --all
```

### 🔧 Personnalisation

#### Ajouter un Raccourci
```bash
# Dans ~/.config/skhd/skhdrc UNIQUEMENT
ralt - w : aerospace workspace 5  # Nouveau raccourci

# Puis recharger
skhd --reload
```

#### Modifier une Règle d'Application
```toml
# Dans ~/.config/aerospace/aerospace.toml UNIQUEMENT
[[on-window-detected]]
if.app-id = "com.example.newapp"
run = "move-node-to-workspace 6"

# Puis recharger
aerospace reload-config
```

## 🎉 Résultat Final

Cette architecture vous donne :

- **🎯 Précision absolue** : Alt droite uniquement
- **🔧 Contrôle total** : tous raccourcis dans skhd
- **⚡ Performance optimale** : composants spécialisés
- **🛡️ Robustesse maximale** : aucun conflit possible
- **🎨 Personnalisation facile** : modification centralisée
- **🔍 Debugging simplifié** : responsabilités claires

### 🚀 Mission Accomplie

Votre configuration AeroSpace utilise maintenant l'architecture la plus robuste et efficace possible pour un workflow de développement professionnel !

---

**📝 Note :** Cette architecture est unique et spécialement conçue pour éviter tous les pièges classiques d'AeroSpace sur macOS. Elle privilégie la robustesse et la prévisibilité sur la simplicité de configuration.

**🎯 Objectif atteint :** Alt droite exclusive, aucun conflit, contrôle total !