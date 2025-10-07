# 🎯 ALT DROITE - Aide-Mémoire Visuel

## 🔑 Configuration Clavier

**⚠️ IMPORTANT : Tous les raccourcis AeroSpace utilisent UNIQUEMENT la touche Alt DROITE !**

```
┌─────────────────────────────────────────────────────┐
│                  Clavier MacBook                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [fn] [ctrl] [⌥ gauche] [⌘]   [⌘] [⌥→DROITE] [ctrl] │
│                                        ↑            │
│                                    UTILISER         │
│                                    CELLE-CI         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## ✅ Pourquoi Alt Droite ?

### 🎯 **Avantages**
- **Pas de conflit** avec les raccourcis macOS natifs
- **Ergonomique** pour la main droite
- **Cohérence** avec votre ancienne config yabai
- **Précision** : impossible de se tromper

### ❌ **Alt Gauche = Problèmes**
- Conflicts avec Spotlight (`⌥ + Space`)
- Conflicts avec caractères spéciaux (`⌥ + e`, `⌥ + u`, etc.)
- Conflicts avec Mission Control
- Behaviors imprévisibles

## 🚀 Raccourcis Essentiels (Alt Droite)

### 🏠 Navigation Workspaces
```
⌥→ + 1   →   💻 Développement
⌥→ + 2   →   🖥 Terminal  
⌥→ + 3   →   🌐 Web
⌥→ + 4   →   📧 Mail
⌥→ + 5   →   🤝 Réunions
```

### 🎯 Navigation Fenêtres (Style Vim)
```
       ⌥→ + K (↑)
         Focus Haut
            │
⌥→ + H ←── ● ──→ ⌥→ + L
Focus      │      Focus
Gauche     │      Droite
           │
       ⌥→ + J (↓)
       Focus Bas
```

### ⚡ Actions Rapides
```
⌥→ + F          →  Plein écran
⌥→ + Space      →  Toggle floating/tiling  
⌥→ + Tab        →  Workspace précédent
⌥→ + ⌃ + E      →  Équilibrer fenêtres
```

## 🔧 Vérification Rapide

### ✅ Test de Fonctionnement
1. **Appuyez sur `⌥→ + 1`** → Devrait aller au workspace 1
2. **Appuyez sur `⌥→ + H`** → Devrait changer le focus à gauche
3. **Appuyez sur `⌥→ + Space`** → Devrait toggle floating/tiling

### ❌ Si ça ne marche pas
```bash
# Recharger skhd
skhd --reload

# Vérifier si skhd est actif
pgrep -f skhd

# Tester AeroSpace
aerospace list-workspaces --all
```

## 🎨 Visualisation des Modifiers

```
┌─────────────────────────────────────────────────┐
│            Combinaisons Possibles               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ⌥→        →  Navigation de base                │
│  ⌥→ + ⇧    →  Déplacement fenêtres             │
│  ⌥→ + ⌃    →  Actions avancées                 │
│  ⌥→ + ⌃ + ⇧ →  Actions experts                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 📱 Configuration Technique

### 🔗 Liaison des Fichiers
- **AeroSpace** (`aerospace.toml`) : utilise `alt-*`
- **skhd** (`skhdrc`) : utilise `ralt-*` (Alt droite uniquement)
- **Résultat** : Seule l'Alt droite fonctionne !

### 🎛 skhd vs AeroSpace
```
┌──────────────┬─────────────┬─────────────────┐
│   Fichier    │   Syntaxe   │   Description   │
├──────────────┼─────────────┼─────────────────┤
│ skhdrc       │ ralt-1      │ Alt droite + 1  │
│ aerospace.toml│ alt-1       │ N'importe Alt  │
└──────────────┴─────────────┴─────────────────┘

⬇️ skhd filtre pour Alt droite uniquement
```

## 🎯 Memo Rapide

### 🧠 Pour Retenir
**"Right Alt for AeroSpace Right!"** 

- **R**ight Alt = **R**ight Hand
- **R**ight Alt = **R**eliable  
- **R**ight Alt = **R**eady to work!

### 🏃‍♂️ Workflow Type
1. **Main gauche** → Reste sur les touches de base
2. **Main droite** → Index sur Alt droite + autres doigts sur touches
3. **Muscle Memory** → Se développe rapidement !

## 🎉 Message de Motivation

```
╔════════════════════════════════════════════╗
║                                            ║
║   🚀 FÉLICITATIONS ! 🚀                   ║
║                                            ║
║   Vous utilisez maintenant la              ║
║   MEILLEURE configuration AeroSpace !     ║
║                                            ║
║   Alt Droite = Productivité Maximale      ║
║                                            ║
╚════════════════════════════════════════════╝
```

---

**💡 Conseil Pro :** Imprimez cette page et gardez-la à côté de votre clavier les premiers jours !

**🎯 Objectif :** En 1 semaine, les raccourcis Alt droite seront dans votre muscle memory !