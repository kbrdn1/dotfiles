"""
devis_xlsx — Boîte à outils pour construire des classeurs de devis paramétrables.

Principe directeur : on saisit des **jours** (estimation evidence-based) ; le **TJM
est une cellule paramètre**, jamais inventé. Tous les totaux sont des **formules**
(intégrité arithmétique), jamais des nombres recopiés.

API publique :
    style(cell, ...)                  -> applique police/couleur/format/bordure
    title(ws, text, sub=None)         -> titre + sous-titre d'un onglet
    params_block(ws, params, ...)     -> bloc de paramètres jaunes (TJM, TVA, sélecteurs)
    estimation_sheet(ws, blocks, ...) -> onglet d'estimation (sections + lignes + sous-totaux)
    notes_sheet(ws, sections)         -> onglet Notes (écarts, hypothèses, décisions)
    recalc(path)                      -> recalcule et vérifie 0 erreur (via skill xlsx)

Conventions de couleur : bleu = saisie, noir = formule, vert = lien inter-feuille,
fond jaune = cellule à remplir, navy = titres de section.

Dépend de openpyxl. La vérification recalc s'appuie sur la skill publique xlsx.
"""
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

FONT = "Arial"
COLORS = {
    "blue": "0000FF", "black": "000000", "green": "008000", "yellow": "FFFF00",
    "navy": "1F3864", "light": "D9E1F2", "grey": "808080", "white": "FFFFFF",
}
EUR = '#,##0 "€";-#,##0 "€";"-"'   # zéro -> tiret
DAY = '0.0;-0.0;"-"'
PCT = '0.0%'
INT = '#,##0;-#,##0;"-"'

_thin = Side(style="thin", color="BFBFBF")
BOX = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)


def _c(name):
    return COLORS.get(name, name)


def _safe_label(text):
    """Excel interprète une chaîne commençant par '=' comme une formule.
    On remplace le '=' de tête par 'Σ ' pour les libellés de total (ex. '= Total')."""
    if isinstance(text, str) and text.startswith("="):
        return "Σ " + text[1:].lstrip()
    return text


def style(cell, *, bold=False, color="black", size=10, fill=None, align=None,
          italic=False, numfmt=None, border=False, wrap=False):
    cell.font = Font(name=FONT, bold=bold, color=_c(color), size=size, italic=italic)
    if fill:
        cell.fill = PatternFill("solid", fgColor=_c(fill))
    cell.alignment = (Alignment(horizontal=align, vertical="center", wrap_text=wrap)
                      if align else Alignment(vertical="center", wrap_text=wrap))
    if numfmt:
        cell.number_format = numfmt
    if border:
        cell.border = BOX
    return cell


def title(ws, text, sub=None):
    ws.sheet_view.showGridLines = False
    style(ws["A1"], bold=True, size=15, color="navy")
    ws["A1"] = text
    if sub:
        style(ws["A2"], italic=True, color="grey", size=9)
        ws["A2"] = sub


def params_block(ws, params, *, start_row=4, header="PARAMÈTRES — à saisir", span="BCDEF"):
    """Écrit un bloc de paramètres (cellules jaunes à saisir).

    params : liste de dict {key, label, value, fmt, note}.
        value peut être un nombre (saisie, bleu) ou une formule '=...' (noir),
        ex. un TJM secondaire dont le défaut renvoie au TJM principal.
    Retourne (refs, next_row) où refs[key] = 'B{row}' (réf. relative ;
    préfixer le nom de l'onglet pour un usage inter-feuille, ex. f"Synthese!${ref}").
    """
    r = start_row
    style(ws.cell(row=r, column=1, value=header), bold=True, color="white", fill="navy", size=11)
    for col in span:
        style(ws[f"{col}{r}"], fill="navy")
    refs = {}
    r += 1
    for p in params:
        style(ws.cell(row=r, column=1, value=p["label"]))
        v = p["value"]
        is_formula = isinstance(v, str) and v.startswith("=")
        cell = ws.cell(row=r, column=2, value=v)
        style(cell, bold=True, color=("black" if is_formula else "blue"),
              fill="yellow", numfmt=p.get("fmt"), align="center", border=True)
        if p.get("note"):
            style(ws.cell(row=r, column=3, value=p["note"]), italic=True, color="grey", size=9)
        refs[p["key"]] = f"B{r}"
        r += 1
    return refs, r + 1


# Colonnes fixes de l'onglet d'estimation
EST_COLS = ["Catégorie", "Poste", "Classe", "Bas", "Haut", "€ bas", "€ médian", "€ haut", "Notes / fichiers"]
EST_WIDTHS = {"A": 16, "B": 50, "C": 18, "D": 8, "E": 8, "F": 11, "G": 11, "H": 11, "I": 48}


def estimation_sheet(ws, blocks, *, tjm_ref=None, header_row=1):
    """Construit l'onglet d'estimation : sections -> lignes -> sous-totaux (par formule).

    blocks : liste de dict
        {"section": "TITRE",  # facultatif
         "lines": [ {"cat":.., "poste":.., "cls":.., "low":n, "high":n,
                     "files":"", "tjm":"Synthese!$B$5"(facultatif)} ... ],
         "subtotal": "Libellé du sous-total" or None}
    tjm_ref : réf. TJM par défaut pour les colonnes € (ex. "Synthese!$B$5").
        Si None et aucune ligne ne fournit "tjm", les colonnes € restent vides
        (onglet jours seuls).
    Retourne {libellé_sous_total: numéro_de_ligne} pour câbler la Synthèse.
    """
    for col, w in EST_WIDTHS.items():
        ws.column_dimensions[col].width = w
    for i, h in enumerate(EST_COLS):
        style(ws.cell(row=header_row, column=1 + i, value=h), bold=True, fill="light",
              align=("left" if i in (0, 1, 2, 8) else "center"), border=True, wrap=True)

    r = header_row + 1
    subtotals = {}
    for blk in blocks:
        if blk.get("section"):
            ws.cell(row=r, column=1, value=blk["section"])
            for c in range(1, 10):
                style(ws.cell(row=r, column=c), bold=True, color="white", fill="navy", border=True)
            r += 1
        first = r
        for ln in blk.get("lines", []):
            style(ws.cell(row=r, column=1, value=ln.get("cat", "")), size=9, color="grey", border=True)
            style(ws.cell(row=r, column=2, value=ln.get("poste", "")), wrap=True, size=9, border=True)
            style(ws.cell(row=r, column=3, value=ln.get("cls", "")), size=9, align="center", border=True, wrap=True)
            style(ws.cell(row=r, column=4, value=ln.get("low")), color="blue", numfmt=DAY, align="center", border=True)
            style(ws.cell(row=r, column=5, value=ln.get("high")), color="blue", numfmt=DAY, align="center", border=True)
            tjm = ln.get("tjm", tjm_ref)
            if tjm:
                ws.cell(row=r, column=6, value=f"=D{r}*{tjm}")
                ws.cell(row=r, column=8, value=f"=E{r}*{tjm}")
                ws.cell(row=r, column=7, value=f"=(F{r}+H{r})/2")
                for c in (6, 7, 8):
                    style(ws.cell(row=r, column=c), numfmt=EUR, align="center", border=True)
            else:
                for c in (6, 7, 8):
                    style(ws.cell(row=r, column=c), border=True)
            style(ws.cell(row=r, column=9, value=ln.get("files", "")), italic=True, size=8, color="grey", wrap=True, border=True)
            r += 1
        last = r - 1
        if blk.get("subtotal") and last >= first:
            style(ws.cell(row=r, column=2, value=_safe_label(blk["subtotal"])), bold=True, align="right", border=True, fill="light")
            for c in (1, 3, 9):
                style(ws.cell(row=r, column=c), fill="light", border=True)
            for col, L in zip((4, 5, 6, 7, 8), ("D", "E", "F", "G", "H")):
                ws.cell(row=r, column=col, value=f"=SUM({L}{first}:{L}{last})")
                style(ws.cell(row=r, column=col), bold=True,
                      numfmt=(DAY if col in (4, 5) else EUR), align="center", border=True, fill="light")
            subtotals[blk["subtotal"]] = r
            r += 1
        r += 1  # ligne vide entre blocs
    return subtotals


def notes_sheet(ws, sections, *, col_b_width=112):
    """Onglet Notes. sections : liste de dict {title, items:[str], marker:'•'(def)}.
    Idéal pour : écarts source↔code, hypothèses, décisions ouvertes."""
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = col_b_width
    r = 1
    for sec in sections:
        if sec.get("heading_top"):
            style(ws.cell(row=r, column=2, value=sec["heading_top"]), bold=True, size=14, color="navy")
            r += 2
        style(ws.cell(row=r, column=2, value=sec["title"]), bold=True, color="white", fill="navy", size=11)
        style(ws.cell(row=r, column=1), fill="navy")
        r += 1
        marker = sec.get("marker", "•")
        numbered = sec.get("numbered", False)
        for i, item in enumerate(sec["items"], 1):
            mk = str(i) if numbered else marker
            style(ws.cell(row=r, column=1, value=mk), bold=True, align="center", color="navy")
            style(ws.cell(row=r, column=2, value=item), wrap=True, size=10)
            ws.row_dimensions[r].height = 44
            r += 1
        r += 1
    return ws


def move_first(wb, name):
    """Place l'onglet `name` en première position (ex. Synthese)."""
    wb._sheets.sort(key=lambda ws: 0 if ws.title == name else 1)


def recalc(path, timeout=60):
    """Recalcule le classeur et vérifie l'absence d'erreur via la skill publique xlsx.
    Retourne le dict de résultat, ou None si le script de recalc est introuvable."""
    import json, subprocess, os, sys
    candidates = [
        "/mnt/skills/public/xlsx/scripts/recalc.py",                  # claude.ai code-execution
        os.path.expanduser("~/.claude/skills/xlsx/scripts/recalc.py"),  # Claude Code local
    ]
    script = next((c for c in candidates if os.path.exists(c)), None)
    if script is None:
        print("recalc.py introuvable — lance la vérification via la skill xlsx.")
        return None
    out = subprocess.run([sys.executable, script, path, str(timeout)], capture_output=True, text=True)
    txt = out.stdout.strip()
    try:
        return json.loads(txt)
    except Exception:
        # tolère un préambule : isole le dernier objet JSON
        i = txt.find("{")
        try:
            return json.loads(txt[i:])
        except Exception:
            print(out.stdout, out.stderr)
            return None
