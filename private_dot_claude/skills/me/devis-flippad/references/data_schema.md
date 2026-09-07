# Schéma des données — devis-flippad

Le devis se génère à partir d'un objet JSON. Exemples complets et fonctionnels :
`references/exemple_jewely.json` (doré) et `references/exemple_flippad.json` (orange).
Copier l'exemple de la bonne marque et l'adapter est le moyen le plus rapide.

## Structure

```jsonc
{
  "brand": "jewely",            // variante de marque : "jewely" | "flippad" (optionnel)
                                //   jewely  → accent #BC8B2C + logos/jewely.jpeg
                                //   flippad → accent #fc6c25 + logos/flippad.jpg
                                //   (toute valeur explicite ci-dessous prime sur le preset)
  "accent": "#BC8B2C",          // couleur d'accent de la charte (optionnel ; sinon défini par "brand")
  "ttc_bg": "#efe6cf",          // héritage — non utilisé (encadré TTC noir, coins arrondis)
  "tva_taux": 0.20,             // taux unique appliqué à tous les lots

  "meta": {
    "numero": "DEV-2026-05-1422",
    "date_emission": "06 mai 2026",
    "date_expiration": "05 juin 2026",
    "type_vente": "Prestations de services"
  },

  "emetteur": {                 // STABLE d'un devis à l'autre — pré-rempli
    "nom": "JEWELY HBJO",
    "logo_name": "JEWELY",      // texte du logo (si pas d'image)
    "logo_sub": "H B J O",      // sous-texte du logo
    "logo_bg": "#0d0d0d",       // fond du logo (optionnel)
    "logo_img": "logos/jewely.jpeg", // image logo (relatif → assets/) ; remplace le logo CSS
    "adresse": ["11 RUE GAMBETTA", "54000 NANCY - France"],
    "email": "facturation@jewely.fr",
    "tel": "+33 3 65 67 63 12",
    "mentions_legales": "FLIPPAD - JEWELY HBJO | SAS … | N° SIREN … | N° de TVA …"
  },

  "client": {                   // VARIABLE — change à chaque devis
    "nom": "LOUIS JULIAN",
    "numero": "695821447",      // optionnel
    "adresse": ["71 Rue d'Antibes", "06400 Cannes - France"],
    "email": "julian@bijouterie-cannes.com",
    "tva": "FR06695821447"      // optionnel -> affiché « N° de TVA … »
  },

  "projet": { "titre": "DEVELOPPEMENT MODULE SAV HORLOGERIE" },

  "lots": [                     // un bloc « DÉVELOPPEMENT » par lot fonctionnel
    {
      "intitule": "DÉVELOPPEMENT",
      "sous_titre": "Dashboard client – …",
      "jours": 13,              // quantité
      "prix_unitaire": 700,     // € HT/jour (le « TJM ») — saisi, jamais inventé
      "lignes": [               // détail affiché sous le lot
        {"ref": "SAV-5", "desc": "Espace client : …", "acteurs": "Dev Front", "jh": 6}
        // ref vide ("") -> ligne préfixée « ——— »
        // une ligne peut aussi être une simple chaîne, rendue telle quelle
      ]
    }
  ],

  "cgv": { "texte": "Le client reconnaît avoir pris connaissance …" },   // page 2 (optionnel)
  "paiement": { "etablissement": "CIC", "iban": "FR76 …", "bic": "CMCIFRPP" } // page 2 (optionnel)
}
```

## Calculs (faits par le script, jamais saisis)

- `total_ht_lot = jours × prix_unitaire`
- `total_ht = Σ lots`
- `tva = total_ht × tva_taux`
- `ttc = total_ht + tva`

Le rendu d'une ligne de détail : `{ref} : {desc} - ({acteurs}) ={jh}j/h`
(ou `——— {desc} …` si `ref` est vide). Les `jh` sont **informatifs** ; ils ne
recalculent pas le total du lot (qui vient de `jours × prix_unitaire`). Ils peuvent
ne pas sommer à `jours` (mutualisation) — c'est conforme au modèle de référence.

## Lien avec la skill `devis-xlsx`

`devis-xlsx` produit l'estimation interne (jours par lot, fourchette, evidence-based).
Pour le devis commercial : retenir une valeur ferme de jours par lot (souvent le
médian ou la borne basse négociée), reprendre le TJM en `prix_unitaire`, regrouper
les lignes par lot fonctionnel, et remplir ce JSON.

## Personnalisation de la charte

- `accent` : couleur des **titres** (« Devis », noms, sections) et du label TTC.
- `head_bg` / `head_fg` : fond / texte du **thead** du tableau (grande surface).
  Défaut = `accent` / blanc (Jewely : aplat doré). Flippad : orange **clair** + texte
  sombre (preset), pour éviter un aplat orange vif trop agressif.
- `pay_bg` / `pay_fg` : fond / texte du **container Paiement** (mêmes défauts/preset).
- `ttc_bg` : héritage — l'encadré Total TTC est désormais sur **fond `accent`**, texte
  **noir**, coins arrondis ; ce champ n'est plus utilisé par le rendu.
- `logo_img` : pour un vrai logo, fournir un chemin d'image (PNG/JPG). Un chemin
  **relatif** est résolu depuis le dossier `assets/` de la skill ; un chemin absolu,
  une URL `http(s)`, un `data:` ou un `file://` sont aussi acceptés. Sinon le logo
  CSS (carré + nom) est généré. **Logos fournis** avec la skill (`assets/logos/`) :
  `"logos/jewely.jpeg"` (JEWELY HBJO) et `"logos/flippad.jpg"` (Flippad).
- Émetteur, mentions légales et coordonnées de paiement sont stables : les garder
  dans un JSON « émetteur » de base et n'éditer que `client`, `meta`, `projet`, `lots`.
