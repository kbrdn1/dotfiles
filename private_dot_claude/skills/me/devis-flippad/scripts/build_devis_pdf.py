#!/usr/bin/env python3
"""
Génère un devis PDF à la charte FLIPPAD/JEWELY à partir d'un fichier JSON.

Usage :
    python build_devis_pdf.py <donnees.json> <sortie.pdf>

Le JSON décrit l'émetteur, le client, les métadonnées, le projet et les lots
(chaque lot = intitulé + sous-titre + jours + prix unitaire + lignes détaillées).
Les totaux (HT par lot, HT global, TVA, TTC) sont CALCULÉS ici — jamais saisis.
Schéma complet et exemple : references/data_schema.md et references/exemple_jewely.json
"""
import json, os, sys, tempfile
from pathlib import Path
from jinja2 import Template

NBSP = "\u00a0"  # espace insécable

# ---------- Formatage français ----------
def fmt_eur(x):
    s = f"{x:,.2f}"                      # 39,200.00
    s = s.replace(",", " ").replace(".", ",")   # 39 200,00
    return s.replace(" ", NBSP) + NBSP + "€"

def fmt_jours(x):
    n = int(x) if float(x).is_integer() else x
    s = str(n).replace(".", ",")
    unite = "jour" if x == 1 else "jours"
    return f"{s}{NBSP}{unite}"

def fmt_pct(taux):
    p = taux * 100
    p = int(p) if float(p).is_integer() else p
    return f"{str(p).replace('.', ',')}%"

def fmt_detail(d):
    """d : dict {ref?, desc, acteurs?, jh?} ou chaîne brute (rendue telle quelle)."""
    if isinstance(d, str):
        return d
    head = f"{d['ref']} : {d['desc']}" if d.get("ref") else f"——— {d['desc']}"
    tail = ""
    if d.get("acteurs") or d.get("jh") is not None:
        act = d.get("acteurs", "")
        jh = d.get("jh", "")
        jh = str(jh).replace(".", ",") if not isinstance(jh, str) else jh
        tail = f" - ({act}) ={jh}j/h"
    return head + tail

# ---------- Construction ----------
def _resolve_logo(logo_img):
    """Résout `logo_img` en source utilisable par le rendu Chromium (chargé en file://).

    - URL http(s), data: ou file:// → retournée telle quelle ;
    - chemin relatif → résolu depuis le dossier `assets/` de la skill
      (ex. "logos/jewely.jpeg" → assets/logos/jewely.jpeg) ;
    - chemin absolu → converti en URI file://.
    """
    if not logo_img:
        return None
    if logo_img.startswith(("http://", "https://", "data:", "file://")):
        return logo_img
    p = logo_img
    if not os.path.isabs(p):
        assets = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
        p = os.path.join(assets, p)
    return Path(os.path.abspath(p)).as_uri()


# Presets de marque : sélectionnés par le champ racine "brand". Le fond TTC
# (logo_bg) reste sombre pour rester lisible (label = accent sur fond sombre).
# Toute valeur explicite du JSON (accent, emetteur.logo_img, emetteur.logo_bg)
# prime sur le preset.
# Presets de marque (sélectionnés par le champ racine "brand") :
# - accent   : couleur des titres / lignes / label TTC (texte fin)
# - head_*/pay_* : fond + texte des GRANDES surfaces (thead du tableau, bloc Paiement).
#   Jewely les laisse en aplat doré (défauts) ; Flippad les passe en orange CLAIR +
#   texte sombre pour éviter un aplat orange vif trop agressif.
# - logo_bg  : fond de l'encadré TTC (toujours sombre).
# Toute valeur explicite du JSON prime sur le preset.
BRANDS = {
    "jewely": {
        "accent": "#BC8B2C", "logo_img": "logos/jewely.jpeg", "logo_bg": "#0d0d0d",
        "head_bg": "#faf6ec", "head_fg": "#2b2b2b",
        "pay_bg": "#faf6ec",  "pay_fg": "#111111",
    },
    "flippad": {
        "accent": "#e2611f", "logo_img": "logos/flippad.jpg", "logo_bg": "#0d0d0d",
        "head_bg": "#fce3d4", "head_fg": "#2b2b2b",
        "pay_bg": "#fce3d4",  "pay_fg": "#111111",
    },
}


def build(data):
    preset = BRANDS.get((data.get("brand") or "").lower(), {})
    em = data.get("emetteur", {})
    accent = data.get("accent") or preset.get("accent") or "#BC8B2C"
    logo_bg = em.get("logo_bg") or preset.get("logo_bg") or "#0d0d0d"
    logo_img = em.get("logo_img") or preset.get("logo_img")
    # Grandes surfaces (thead, bloc Paiement) : défaut = aplat accent + texte clair/sombre.
    head_bg = data.get("head_bg") or preset.get("head_bg") or accent
    head_fg = data.get("head_fg") or preset.get("head_fg") or "#ffffff"
    pay_bg = data.get("pay_bg") or preset.get("pay_bg") or accent
    pay_fg = data.get("pay_fg") or preset.get("pay_fg") or "#1f1f1f"
    taux = data["tva_taux"]
    lots = []
    total_ht = 0.0
    for lot in data["lots"]:
        ht = round(lot["jours"] * lot["prix_unitaire"], 2)
        total_ht += ht
        lots.append({
            "intitule": lot.get("intitule", "DÉVELOPPEMENT"),
            "sous_titre": lot.get("sous_titre", ""),
            "qte_str": fmt_jours(lot["jours"]),
            "pu_str": fmt_eur(lot["prix_unitaire"]),
            "total_str": fmt_eur(ht),
            "lignes": [fmt_detail(d) for d in lot.get("lignes", [])],
        })
    total_ht = round(total_ht, 2)
    tva = round(total_ht * taux, 2)
    ttc = round(total_ht + tva, 2)

    ctx = dict(
        accent=accent,
        head_bg=head_bg, head_fg=head_fg,
        pay_bg=pay_bg, pay_fg=pay_fg,
        logo_bg=logo_bg,
        logo_img=_resolve_logo(logo_img),
        logo_name=data.get("emetteur", {}).get("logo_name", data["emetteur"]["nom"].split()[0].upper()),
        logo_sub=data.get("emetteur", {}).get("logo_sub", ""),
        ttc_bg=data.get("ttc_bg", "#efe6cf"),
        meta=data["meta"], emetteur=data["emetteur"], client=data["client"],
        projet=data["projet"], lots=lots,
        tva_pct=fmt_pct(taux),
        tva_str=fmt_eur(tva), base_ht_str=fmt_eur(total_ht),
        total_ht_str=fmt_eur(total_ht), total_ttc_str=fmt_eur(ttc),
        cgv=data.get("cgv"), paiement=data.get("paiement"),
    )
    return ctx

def _add_footer(in_pdf, out_pdf, legal):
    """Incruste le pied (mentions légales + pagination i/n) sur chaque page.
    Fiable quelle que soit la build wkhtmltopdf (les options --footer-* et
    position:fixed sont ignorées en 'unpatched qt')."""
    from io import BytesIO
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
    from reportlab.pdfbase.pdfmetrics import stringWidth

    reader = PdfReader(in_pdf)
    n = len(reader.pages)
    writer = PdfWriter()
    margin = 12 * mm
    for i, page in enumerate(reader.pages, 1):
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)
        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=(w, h))
        y = 11 * mm
        c.setStrokeColorRGB(0.87, 0.87, 0.87)
        c.setLineWidth(0.5)
        c.line(margin, y + 11, w - margin, y + 11)
        # réduit la police si la ligne légale dépasse la largeur dispo
        size = 7.0
        avail = w - 2 * margin - 20 * mm
        while size > 5 and stringWidth(legal, "Helvetica", size) > avail:
            size -= 0.25
        c.setFont("Helvetica", size)
        c.setFillColorRGB(0.6, 0.6, 0.6)
        c.drawString(margin, y, legal)
        c.drawRightString(w - margin, y, f"{i} / {n}")
        c.save()
        buf.seek(0)
        page.merge_page(PdfReader(buf).pages[0])
        writer.add_page(page)
    with open(out_pdf, "wb") as f:
        writer.write(f)


def _html_to_pdf(html_path, out_pdf):
    """Rend le HTML en PDF du corps via Chromium (Playwright).

    Les marges A4 (T 12mm / B 20mm / L 12mm / R 12mm) sont définies par le CSS
    `@page` du template : Chromium donne la priorité au `@page` sur les marges de
    l'API, donc on active `prefer_css_page_size=True` et on laisse le CSS piloter
    taille + marges (sinon le contenu se colle aux bords). Le bas de 20mm réserve la
    zone où _add_footer incruste ensuite le pied. `print_background` rend les fonds."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.goto(Path(html_path).as_uri(), wait_until="load")
            page.pdf(
                path=out_pdf,
                print_background=True,
                prefer_css_page_size=True,
            )
        finally:
            browser.close()


def render(data, out_pdf):
    here = os.path.dirname(os.path.abspath(__file__))
    tpl_path = os.path.join(here, "..", "assets", "devis_template.html.j2")
    with open(tpl_path, encoding="utf-8") as f:
        tpl = Template(f.read())
    ctx = build(data)
    html = tpl.render(**ctx)
    legal = data.get("emetteur", {}).get("mentions_legales", "")
    with tempfile.TemporaryDirectory() as tmp:
        hp = os.path.join(tmp, "devis.html")
        body = os.path.join(tmp, "body.pdf")
        with open(hp, "w", encoding="utf-8") as fh:
            fh.write(html)
        _html_to_pdf(hp, body)
        if not os.path.exists(body):
            raise SystemExit("La génération du corps PDF a échoué")
        if legal:
            _add_footer(body, out_pdf, legal)
        else:
            os.replace(body, out_pdf)
    return out_pdf

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__); raise SystemExit(1)
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    out = render(data, sys.argv[2])
    print("Devis généré :", out)
