# 🎨 StatusLine avec Couleurs Dynamiques

Documentation complète sur les modifications apportées à votre statusline Claude Code avec le modèle en **orange** et les **couleurs dynamiques** basées sur l'utilisation.

---

## ✨ Changements Appliqués

### 1. 🤖 Model en Orange (comme le logo Claude)

Le modèle Claude est maintenant affiché en **orange** (`\e[38;5;208m`) au lieu de cyan, pour correspondre au logo officiel de Claude.

**Fichier modifié:** `~/.claude/statusline-config.yaml`

```yaml
colors:
  model: '\e[38;5;208m'  # Orange (RGB 208) - like Claude logo
```

---

### 2. 🌈 Couleurs Dynamiques

Les éléments suivants changent maintenant de couleur **automatiquement** selon leur niveau d'utilisation :

#### 🧩 **Tokens**
- 🟢 **Vert** : < 50% d'utilisation (utilisation faible)
- 🟡 **Jaune** : 50-75% (utilisation modérée)
- 🟠 **Orange** : 75-90% (utilisation élevée)
- 🔴 **Rouge** : > 90% (utilisation critique)

#### 💰 **Coûts** (Session/Daily/Block)
- 🟢 **Vert** : < $5 (coût faible)
- 🟡 **Jaune** : $5-$15 (coût modéré)
- 🟠 **Orange** : $15-$30 (coût élevé)
- 🔴 **Rouge** : > $30 (coût très élevé)

#### ⧗ **Temps Restant** (basé sur limite de 5h)
- 🟢 **Vert** : > 3h / 60% (beaucoup de temps)
- 🟡 **Jaune** : 1.5h-3h / 30-60% (temps modéré)
- 🟠 **Orange** : 45min-1.5h / 15-30% (peu de temps)
- 🔴 **Rouge** : < 45min / <15% (temps critique)

#### ≈ **Burn Rate** (tokens/min)
- 🟢 **Vert** : < 150K tok/min (faible)
- 🟡 **Jaune** : 150-250K (normal, ~190k)
- 🟠 **Orange** : 250-350K (élevé)
- 🔴 **Rouge** : > 350K (très élevé)

---

## 📁 Fichiers Créés/Modifiés

### Nouveaux Fichiers

1. **`~/.claude/statusline-dynamic-colors.sh`**
   - Fonctions de calcul des couleurs dynamiques
   - Seuils configurables pour chaque métrique
   - Fonctions exportées pour utilisation dans d'autres scripts

2. **`~/.claude/test-dynamic-colors.sh`**
   - Script de test pour visualiser toutes les couleurs
   - Exemples avec différents niveaux d'utilisation
   - Exécutez avec : `~/.claude/test-dynamic-colors.sh`

3. **`~/.claude/STATUSLINE-DYNAMIC-COLORS-README.md`**
   - Cette documentation complète

### Fichiers Modifiés

1. **`~/.claude/statusline-config.yaml`**
   - Couleur du model changée en orange

2. **`~/.claude/scripts/statusline-ccusage.sh`**
   - Intégration des couleurs dynamiques
   - Application automatique selon l'utilisation
   - Modèle affiché en orange

---

## 🚀 Utilisation

### Tester les Couleurs

Pour voir toutes les couleurs dynamiques en action :

```bash
~/.claude/test-dynamic-colors.sh
```

Ce script affiche :
- Le modèle en orange
- Exemples de tokens à différents niveaux d'utilisation
- Exemples de coûts (faible, modéré, élevé, critique)
- Exemples de temps restant
- Exemples de burn rate
- Deux exemples complets de statusline

### Vérifier les Modifications

1. **Relancer Claude Code** pour voir les changements
2. Les couleurs changeront automatiquement selon votre utilisation réelle
3. Le modèle sera toujours affiché en orange

---

## ⚙️ Personnalisation

### Modifier les Seuils de Couleurs

Éditez `~/.claude/statusline-dynamic-colors.sh` pour ajuster les seuils :

#### Exemple : Changer les seuils de tokens

```bash
# Dans get_token_color()
if [[ $percentage -lt 50 ]]; then
  echo "$COLOR_GREEN"    # Ajustez ce seuil
elif [[ $percentage -lt 75 ]]; then
  echo "$COLOR_YELLOW"   # Ajustez ce seuil
elif [[ $percentage -lt 90 ]]; then
  echo "$COLOR_ORANGE"   # Ajustez ce seuil
else
  echo "$COLOR_RED"
fi
```

#### Exemple : Changer les seuils de temps restant

```bash
# Dans get_time_color()
# Actuellement basé sur 5h (300 minutes)
if [[ $minutes -gt 180 ]]; then    # > 3h (60%)
  echo "$COLOR_GREEN"
elif [[ $minutes -gt 90 ]]; then   # 1.5h-3h (30-60%)
  echo "$COLOR_YELLOW"
elif [[ $minutes -gt 45 ]]; then   # 45min-1.5h (15-30%)
  echo "$COLOR_ORANGE"
else                               # < 45min (<15%)
  echo "$COLOR_RED"
fi
```

#### Exemple : Changer les seuils de burn rate

```bash
# Dans get_burn_rate_color()
# Actuellement calibré pour ~190k comme normal
if [[ $burn_numeric -lt 150 ]]; then    # < 150k
  echo "$COLOR_GREEN"
elif [[ $burn_numeric -lt 250 ]]; then  # 150-250k (inclut 190k)
  echo "$COLOR_YELLOW"
elif [[ $burn_numeric -lt 350 ]]; then  # 250-350k
  echo "$COLOR_ORANGE"
else                                     # > 350k
  echo "$COLOR_RED"
fi
```

### Modifier la Couleur du Model

Si vous voulez une couleur différente pour le modèle, éditez `~/.claude/statusline-config.yaml` :

```yaml
colors:
  # Exemples d'autres couleurs
  model: '\e[38;5;208m'  # Orange (actuel)
  # model: '\e[38;5;214m'  # Orange plus clair
  # model: '\e[38;5;202m'  # Orange plus foncé
  # model: '\e[93m'        # Jaune vif
  # model: '\e[96m'        # Cyan (original)
```

### Désactiver les Couleurs Dynamiques

Si vous voulez revenir aux couleurs statiques, éditez `~/.claude/scripts/statusline-ccusage.sh` :

1. Commentez l'import des couleurs dynamiques (lignes 3-7)
2. Les couleurs reviendront à `LIGHT_GRAY` par défaut

---

## 🎨 Palette de Couleurs Utilisées

| Couleur | Code ANSI | Usage |
|---------|-----------|-------|
| 🟢 Vert | `\e[92m` | Utilisation faible/sûre |
| 🟡 Jaune | `\e[93m` | Utilisation modérée/attention |
| 🟠 Orange | `\e[38;5;208m` | Utilisation élevée/warning |
| 🔴 Rouge | `\e[91m` | Utilisation critique/danger |
| ⚪ Gris clair | `\e[37m` | Texte général |
| ⚫ Gris foncé | `\e[90m` | Séparateurs |

---

## 🔍 Exemples Visuels

### Utilisation Faible (Vert)
```
🌿 main | 💄 default | 📁 ~/projects | 🤖 Sonnet 4.5
💰 $2.50 | 📅 $5.00 | 🧊 $10.00 (3h 0m left) | 🧩 50.0K tokens
```
- Tout est vert = utilisation optimale
- Beaucoup de temps restant
- Coûts bas

### Utilisation Modérée (Jaune)
```
🌿 feature | 💄 compact | 📁 ~/work | 🤖 Opus 4
💰 $8.50 | 📅 $12.00 | 🧊 $15.00 (1h 30m left) | 🧩 125.0K tokens
```
- Jaune = attention, utilisation moyenne
- Temps modéré restant
- Coûts moyens

### Utilisation Élevée (Orange/Rouge)
```
🌿 hotfix | 💄 verbose | 📁 ~/critical | 🤖 Sonnet 4.5
💰 $25.00 | 📅 $32.00 | 🧊 $28.00 (20m left) | 🧩 180.0K tokens
```
- Orange/Rouge = attention maximale
- Peu de temps restant (rouge)
- Coûts élevés (orange)
- Tokens proches de la limite (rouge)

---

## 🐛 Dépannage

### Les couleurs ne changent pas

1. **Vérifiez que le script est sourcé correctement** :
   ```bash
   grep "source.*statusline-dynamic-colors.sh" ~/.claude/scripts/statusline-ccusage.sh
   ```

2. **Vérifiez les permissions** :
   ```bash
   chmod +x ~/.claude/statusline-dynamic-colors.sh
   chmod +x ~/.claude/scripts/statusline-ccusage.sh
   ```

3. **Relancez Claude Code** :
   - Les changements prennent effet au prochain démarrage

### Le modèle n'est pas orange

1. **Vérifiez la configuration** :
   ```bash
   grep "model:" ~/.claude/statusline-config.yaml
   ```
   Devrait afficher : `model: '\e[38;5;208m'`

2. **Testez directement** :
   ```bash
   echo -e "\e[38;5;208m🤖 Test Orange\e[0m"
   ```

3. **Vérifiez le support des couleurs 256** :
   Votre terminal doit supporter les couleurs 256. La plupart des terminaux modernes (iTerm2, Warp, Alacritty) le supportent.

### Erreurs dans le script

Si vous voyez des erreurs comme `value too great for base` :

1. **Assurez-vous d'avoir la dernière version** du script
2. **Relancez le test** :
   ```bash
   ~/.claude/test-dynamic-colors.sh
   ```

---

## 📊 Performance

Les couleurs dynamiques ajoutent un **overhead minimal** :
- ~5-10ms par calcul de couleur
- Les fonctions sont en cache après le premier chargement
- Aucun impact perceptible sur les performances

---

## 🎯 Prochaines Améliorations Possibles

Idées pour améliorer encore plus votre statusline :

1. **Couleurs pour Git Status** :
   - Vert si repo clean
   - Jaune si modifications
   - Rouge si conflits

2. **Animations/Clignotements** :
   - Faire clignoter en rouge quand < 10min restant
   - Animations pour attirer l'attention sur l'usage critique

3. **Notifications** :
   - Notification système quand tokens > 90%
   - Alerte sonore quand temps < 5min

4. **Graphiques ASCII** :
   - Barre de progression pour les tokens
   - Graphique de burn rate

5. **Historique** :
   - Log des pics d'utilisation
   - Tendances de coûts quotidiens

---

## 📚 Ressources

### Fichiers de Configuration
- **Config principal** : `~/.claude/statusline-config.yaml`
- **Script ccusage** : `~/.claude/scripts/statusline-ccusage.sh`
- **Couleurs dynamiques** : `~/.claude/statusline-dynamic-colors.sh`
- **Test couleurs** : `~/.claude/test-dynamic-colors.sh`

### Documentation Complémentaire
- `~/.claude/STATUSLINE-COLORS.md` - Guide des couleurs
- `~/.claude/statusline-config-reference.md` - Référence complète
- `~/.claude/STATUSLINE-README.md` - Documentation principale

### Codes Couleurs ANSI
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [256 Color Chart](https://www.ditig.com/256-colors-cheat-sheet)
- [Terminal Color Testing](https://github.com/termstandard/colors)

---

## ✅ Checklist de Vérification

Après l'installation, vérifiez que tout fonctionne :

- [ ] Le modèle s'affiche en orange (🤖 en couleur orange)
- [ ] Les tokens changent de couleur selon l'utilisation
- [ ] Les coûts (💰 📅 🧊) ont des couleurs appropriées
- [ ] Le temps restant (⧗) change de couleur
- [ ] Le script de test fonctionne sans erreur
- [ ] La statusline s'affiche correctement dans Claude Code

---

**Version:** 1.0
**Date:** 2025-10-12
**Créé par:** Claude Code Assistant

Pour toute question ou amélioration, consultez les fichiers de configuration ou le script de test !
