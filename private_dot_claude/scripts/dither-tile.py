#!/usr/bin/env python3
"""dither-tile.py : les favicons des pages HTML des skills, sur la tuile des logos de projets (Herdr, kbrdn.dev).

Carré de 24, rx 6, rampe de 4 tons tramés par une Bayer 8×8 du haut gauche au bas droit, glyphe vectoriel
par-dessus : le format de public/favicon.svg et public/images/tiles/ de kbrdn.dev (le glyphe de gwm-cli pour modèle).

  dither-tile.py                           réécrit toutes les icônes de ICONS (après un changement de glyphe ou de rampe)
  dither-tile.py --inject <nom> <page>…    pose l'icône <nom> en data URI dans le <head> de chaque page
                                           (remplace ses <link rel="icon">) : une page file:// n'a rien d'autre à charger
  dither-tile.py --check                   la trame sort-elle toujours, à l'octet, celle du favicon de kbrdn.dev ? et --inject
                                           remplace-t-il bien une favicon existante, une seule fois ?
"""
import base64, hashlib, os, re, sys

# --- la trame : background() de ~/.config/herdr-app/brand/projects-dither.py, recopiée à l'identique (ce script-là
# exécute sa boucle dès l'import) ; --check tient l'égalité avec le favicon de kbrdn.dev.
B = [[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
     [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]]
LEVELS, DEPTH = 4, 0.30


def mix(c, to, a):
    c = [int(c[i:i+2], 16) for i in (1, 3, 5)]; t = [int(to[i:i+2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * a):02x}" for x, y in zip(c, t))


def background(base, to, uid):
    tones = [mix(base, to, k / (LEVELS - 1)) if to else mix(base, "#000000", DEPTH * k / (LEVELS - 1))
             for k in range(LEVELS)]
    rows = {k: [] for k in range(1, LEVELS)}
    for y in range(24):
        run = None  # (tone, first x) of the current horizontal run
        for x in range(25):
            k = -1
            if x < 24:
                v = (x + y) / 46 * (LEVELS - 1); k = int(v)
                if k < LEVELS - 1 and v - k > (B[y % 8][x % 8] + 0.5) / 64: k += 1
            if run and run[0] != k:
                if run[0] > 0: rows[run[0]].append(f"M{run[1]} {y}h{x - run[1]}v1h-{x - run[1]}z")
                run = None
            if run is None and x < 24: run = (k, x)
    paths = "".join(f'<path fill="{tones[k]}" d="{"".join(d)}"/>' for k, d in rows.items() if d)
    note = f"{base} {to}" if to else base
    return (f'<!-- dither {note} --><clipPath id="{uid}"><rect width="24" height="24" rx="6"/></clipPath>'
            f'<rect width="24" height="24" rx="6" fill="{tones[0]}"/><g clip-path="url(#{uid})">{paths}</g><!-- /dither -->')


# sha1 de background('#505050', '#262626', 'bg-favicon') = le bloc <!-- dither --> de kbrdn.dev/public/favicon.svg
FAVICON_SHA1 = 'd8482c22acc8b3335a9a0ab87663696e5db6ee09'

# --- les glyphes : du SVG libre, au langage du K de kbrdn.dev et du glyphe de gwm-cli : peu de formes, grosses,
# franches. Règles : 3 formes au plus, 2 accents au plus, rien de dessiné dans une forme, traits d'au moins 2 unités
# de tuile, 60 à 70 % de la tuile, un liseré du ton de la rampe sous chaque accent pour le détacher du tramé. Le
# critère : à 16 px, chaque icône se reconnaît à sa silhouette et les cinq se distinguent d'un coup d'œil.
# Dessinés sur une grille de 24 que PLACE pose sur la tuile (×0,75 : un trait de 2,7 y fait 2 unités) ; chaque glyphe
# est une fonction de rim(x, y), le ton de la rampe sous ce point de sa grille.
NEUTRAL = ('#505050', '#262626')  # la rampe de kbrdn.dev ; (teinte, None) = la teinte puis 30 % plus sombre (dotfiles)
PLACE = 'translate(3 3) scale(0.75)'
LIGHT, GREY, BLUE, GREEN, ORANGE = '#e0e0e0', '#a3a3a3', '#7ab8ff', '#86e89a', '#d4825d'  # la base et les accents de gwm-cli
RED, INK = '#ff7b72', '#262626'  # le rouge d'une ligne retirée ; l'encre posée sur un accent (le « ! »)
ROUND = 'stroke-linecap="round" stroke-linejoin="round"'


def stroke(d, color, width, rim):
    """Un trait à bouts ronds sur son liseré (`rim`, le ton de la rampe dessous), 1 unité de part et d'autre."""
    return (f'<path d="{d}" fill="none" stroke="{rim}" stroke-width="{width + 2}" {ROUND}/>'
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" {ROUND}/>')


GLYPHS = {
    # rapport de branche : le diff, un « + » vert sur un « − » rouge
    'report': lambda rim: (stroke('M12 3v10.5M6.75 8.25h10.5', GREEN, 3.8, rim(12, 8.25))
                           + stroke('M6.75 19.5h10.5', RED, 3.8, rim(12, 19.5))),
    # plan : un kanban, trois colonnes accrochées en haut, de plus en plus courtes, celle en cours en orange
    'plan': lambda rim: f'''
    <rect x="2" y="2" width="5.5" height="19.5" rx="1.8" fill="{LIGHT}"/>
    <rect x="9.25" y="2" width="5.5" height="13" rx="1.8" fill="{ORANGE}" stroke="{rim(12, 8.5)}" stroke-width="1.2"/>
    <rect x="16.5" y="2" width="5.5" height="8" rx="1.8" fill="{LIGHT}"/>''',
    # codebase-visualizer : un cube isométrique, trois faces de tons différents
    'atlas': lambda rim: f'''
    <polygon points="12,1.5 21.5,6.25 21.5,16.75 12,21.5 2.5,16.75 2.5,6.25" fill="{rim(12, 11.5)}" stroke="{rim(12, 11.5)}"
      stroke-width="2.4" stroke-linejoin="round"/>
    <polygon points="12,1.5 21.5,6.25 12,11 2.5,6.25" fill="{LIGHT}"/>
    <polygon points="2.5,6.25 12,11 12,21.5 2.5,16.75" fill="{GREY}"/>
    <polygon points="12,11 21.5,6.25 21.5,16.75 12,21.5" fill="{BLUE}"/>''',
    # visual-explainer : un diagramme, un bloc racine et son coude vers deux enfants
    'explainer': lambda rim: f'''
    <path d="M12 8.5v4M6 14.5v-2h12v2" fill="none" stroke="{LIGHT}" stroke-width="2.8" {ROUND}/>
    <rect x="6.5" y="2" width="11" height="6.5" rx="1.8" fill="{LIGHT}"/>
    <rect x="1.5" y="14.5" width="9" height="7" rx="1.8" fill="{BLUE}" stroke="{rim(6, 18)}" stroke-width="1.2"/>
    <rect x="13.5" y="14.5" width="9" height="7" rx="1.8" fill="{GREEN}" stroke="{rim(18, 18)}" stroke-width="1.2"/>''',
    # premortem : le panneau d'avertissement
    'premortem': lambda rim: f'''
    <path d="M12 3L21.5 19.75H2.5Z" fill="{rim(12, 14)}" stroke="{rim(12, 14)}" stroke-width="4.6" stroke-linejoin="round"/>
    <path d="M12 3L21.5 19.75H2.5Z" fill="{ORANGE}" stroke="{ORANGE}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M12 8.6v5" stroke="{INK}" stroke-width="2.8" {ROUND}/><circle cx="12" cy="17" r="1.7" fill="{INK}"/>''',
}

SKILLS = os.path.expanduser('~/.claude/skills')
# nom → (fichier de l'icône, libellé, rampe)
ICONS = {
    'report': (f'{SKILLS}/me/report/icons/report.svg', 'rapport de branche', NEUTRAL),
    'plan': (f'{SKILLS}/me/report/icons/plan.svg', 'plan', NEUTRAL),
    'atlas': (f'{SKILLS}/me/codebase-visualizer/icons/atlas.svg', 'atlas', NEUTRAL),
    'explainer': (f'{SKILLS}/me/visual-explainer/icons/explainer.svg', 'visual explainer', NEUTRAL),
    'premortem': (f'{SKILLS}/premortem/icons/premortem.svg', 'premortem', NEUTRAL),
}


def tile(name):
    path, label, (base, to) = ICONS[name]
    end = to or mix(base, '#000000', DEPTH)
    # le ton moyen de la rampe sous le point (x, y) de la grille du glyphe, une fois posé par PLACE
    rim = lambda x, y: mix(base, end, min(1, (6 + 0.75 * (x + y)) / 46))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" role="img" aria-label="{label}">\n'
            f'  {background(base, to, "bg-" + name)}\n'
            f'  <g transform="{PLACE}" shape-rendering="geometricPrecision">{GLYPHS[name](rim)}\n  </g>\n</svg>\n')


# une balise <link> entière, guillemets compris : un favicon en data URI SVG brut porte des « > » dans son href
LINK = re.compile(r'[ \t]*<link\b(?:[^>"\']|"[^"]*"|\'[^\']*\')*>\n?', re.I)
IS_ICON = re.compile(r'\srel=["\']?(?:shortcut\s+)?icon\b', re.I)  # pas apple-touch-icon


def put(s, tag):
    """La page `s` avec `tag` pour seule favicon : avant </head>, sinon après <title> ou <meta charset> (un template
    d'artifact n'a pas de <head>). None quand il n'y a aucun de ces repères."""
    s = LINK.sub(lambda m: '' if IS_ICON.search(m.group()) else m.group(), s)
    for at, before in ((r'</head>', True), (r'</title>', False), (r'<meta charset[^>]*>', False)):
        m = re.search(at, s, re.I)
        if m:
            i = m.start() if before else m.end()
            return s[:i] + ('' if before else '\n') + tag + ('\n' if before else '') + s[i:]
    return None


def inject(name, page):
    tag = ('<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,'
           + base64.b64encode(open(ICONS[name][0], 'rb').read()).decode() + '">')
    s = put(open(page, encoding='utf-8').read(), tag)
    if s is None:
        sys.exit(f'{page} : ni </head>, ni <title>, ni <meta charset> où poser la favicon')
    open(page, 'w', encoding='utf-8').write(s)
    print(f'{page} : favicon {name}')


def check():
    got = hashlib.sha1(background(*NEUTRAL, 'bg-favicon').encode()).hexdigest()
    assert got == FAVICON_SHA1, f'trame : {got} ≠ {FAVICON_SHA1} (le favicon de kbrdn.dev)'
    page = ('<HEAD>\n<title>t</title>\n<link rel="icon" href="data:image/svg+xml,<svg><text>x</text></svg>">\n'
            '<link rel="apple-touch-icon" href="a.png">\n</HEAD>')
    t = '<link rel="icon" href="T">'
    once = put(page, t)
    assert once.count(t) == 1 and '<text>' not in once and 'apple-touch-icon' in once, once
    assert put(once, t) == once, 'pas idempotent'
    assert put('<meta charset="utf-8">\n<title>a</title>\n<style>', t) == f'<meta charset="utf-8">\n<title>a</title>\n{t}\n<style>'
    assert put('<p>rien</p>', t) is None
    print('dither-tile : ok')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['--check']:
        check()
        sys.exit()
    if a[:1] == ['--inject'] and len(a) > 2 and a[1] in ICONS:
        for p in a[2:]:
            inject(a[1], p)
    elif not a:
        for n in ICONS:
            os.makedirs(os.path.dirname(ICONS[n][0]), exist_ok=True)
            open(ICONS[n][0], 'w', encoding='utf-8').write(tile(n))
            print(ICONS[n][0])
    else:
        sys.exit(__doc__ + '\nicônes : ' + ', '.join(ICONS))
