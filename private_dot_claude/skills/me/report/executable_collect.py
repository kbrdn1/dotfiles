#!/usr/bin/env python3
"""me:report : collecte les faits d'une branche et écrit data.js (0 token).

Usage (depuis le worktree de la branche) :
  collect.py                 faits + notes.json fusionnés, coquille copiée, data.js écrit
  collect.py --stale-diff    en plus : diff restreint aux fichiers des sections en retard
Options : --repo PATH, --base BRANCH, --out DIR, --offline (pas de gh).
Racine des rapports : $ME_REPORTS_ROOT, sinon ~/Reports (pas de dossier caché : Sheprd
refuse de servir une page rangée sous un dossier qui commence par un point).
"""
import argparse, base64, contextlib, fnmatch, glob, hashlib, io, json, os, re, shutil, subprocess, sys, tempfile
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SHELL = os.path.join(HERE, 'shell')
SHELL_FILES = ('view.css', 'dither-charts.js', 'view.js')  # copiés dans chaque rapport ; dither-charts.js : graphes tramés
ROOT = os.environ.get('ME_REPORTS_ROOT') or os.path.expanduser('~/Reports')
DIFF_LINES_PER_FILE = 1500
DIFF_TOTAL_BYTES = 1_500_000
STALE_DIFF_LINES = 600


def run(args, cwd, ok=(0,)):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    return p.stdout if p.returncode in ok else None


def git(cwd, *a):
    # chemins non ASCII en clair et préfixes a/ b/ garantis : sinon les regex de split_patch ne matchent plus
    return run(['git', '-c', 'core.quotePath=false', '-c', 'diff.noprefix=false', '-c', 'diff.mnemonicPrefix=false', *a], cwd)


def slug_of(remote):
    m = re.search(r'github\.com[:/]+([^/]+/[^/]+?)(?:\.git)?/?$', remote or '')
    return m.group(1) if m else None


def parse_status(z):
    """git diff --name-status -z : R100\0old\0new\0 / M\0path\0"""
    out, parts, i = [], z.split('\0'), 0
    while i < len(parts) and parts[i]:
        st = parts[i]
        if st[0] in 'RC':
            out.append({'status': st[0], 'old': parts[i + 1], 'path': parts[i + 2]}); i += 3
        else:
            out.append({'status': st[0], 'path': parts[i + 1]}); i += 2
    return out


def parse_numstat(z):
    """git diff --numstat -z : add\tdel\tpath\0 ou add\tdel\t\0old\0new\0"""
    res, parts, i = {}, z.split('\0'), 0
    while i < len(parts) and parts[i]:
        a, d, p = parts[i].split('\t', 2)
        if p == '':
            p = parts[i + 2]; i += 3
        else:
            i += 1
        res[p] = (None if a == '-' else int(a), None if d == '-' else int(d))
    return res


def split_patch(patch):
    """({path: patch}, {path: hunks coupés}) depuis un git diff complet. Un fichier trop long est coupé à
    la frontière d'un hunk, jamais au milieu : le patch reste valide pour @pierre/diffs."""
    files, cut, total = {}, {}, 0
    for chunk in re.split(r'(?m)^(?=diff --git )', patch or ''):
        m = re.search(r'(?m)^\+\+\+ b/(.*)$', chunk) or re.search(r'(?m)^--- a/(.*)$', chunk) or re.match(r'diff --git a/.* b/(.*)', chunk)
        if not m:
            continue
        lines = chunk.splitlines()
        if len(lines) > DIFF_LINES_PER_FILE:
            starts = [i for i, l in enumerate(lines) if l.startswith('@@')]
            within = [i for i in starts if i <= DIFF_LINES_PER_FILE]
            keep = within[-1] if len(within) > 1 else (starts[1] if len(starts) > 1 else len(lines))
            dropped = len([i for i in starts if i >= keep])
            if dropped:
                cut[m.group(1)] = dropped
            lines = lines[:keep]
        text = '\n'.join(lines)
        if total + len(text) > DIFF_TOTAL_BYTES:
            continue  # ce fichier seul saute ; les suivants plus petits passent encore
        files[m.group(1)] = text; total += len(text)
    return files, cut


def first_lines(u0):
    """premier numéro de ligne ajouté/modifié par fichier, depuis un diff -U0."""
    res, path = {}, None
    for l in (u0 or '').splitlines():
        if l.startswith('+++ '):
            path = l[6:] if l.startswith('+++ b/') else None
        elif l.startswith('@@') and path and path not in res:
            m = re.search(r'\+(\d+)', l)
            if m:
                res[path] = max(1, int(m.group(1)))
    return res


def read_tsv(path, cols):
    if not os.path.exists(path):
        return []
    rows = []
    for l in open(path, encoding='utf-8'):
        if not l.strip() or l.startswith('#'):
            continue
        v = l.rstrip('\n').split('\t')
        rows.append({c: (v[i] if i < len(v) else '') for i, c in enumerate(cols)})
    return rows


RESUME = re.compile(r'RESUME:\s*P0=(\d+)\s+P1=(\d+)\s+P2=(\d+)\s+P3=(\d+)')
FINDING = re.compile(r'^\s*-\s*\[P([0-3])\]\s*(.+?)\s*$((?:\n(?![ \t]*-\s*\[P)[ \t]+\S.*)*)', re.M)


# deux reviewers, deux séries de passes : claude (deux axes) et codex (un rapport). Jamais mélangées.
REVIEWERS = {
    'claude': {'files': r'pass-(\d+)-(?:standards|spec)\.md$', 'axes': ('standards', 'spec'), 'md': 'pass-{n}-{axis}.md', 'sha': 'pass-{n}.sha', 'id': 'p'},
    'codex': {'files': r'codex-(\d+)\.md$', 'axes': ('codex',), 'md': 'codex-{n}.md', 'sha': 'codex-{n}.sha', 'id': 'c'},
}


def parse_review(out, who='claude'):
    """Rapports des loops de review copiés tels quels : review/pass-N-{standards,spec}.md (claude-review-pr) ou
    review/codex-N.md (codex-review-pr), + le .sha de la passe (facultatif) + review/decisions.tsv
    (id, fixed|discarded|open, sha-ou-raison ; id p<N>-<axe>-<rang> pour claude, c<N>-codex-<rang> pour codex)."""
    R = REVIEWERS[who]
    d = os.path.join(out, 'review')
    if not os.path.isdir(d):
        return None
    nums = sorted({int(m.group(1)) for f in os.listdir(d) for m in [re.match(R['files'], f)] if m})
    if not nums:
        return None
    decisions = {r['id']: r for r in read_tsv(os.path.join(d, 'decisions.tsv'), ['id', 'status', 'ref'])}
    passes, findings = [], []
    for n in nums:
        row = {'pass': n, 'p0': 0, 'p1': 0, 'p2': 0, 'p3': 0}
        shaf = os.path.join(d, R['sha'].format(n=n))
        row['sha'] = open(shaf).read().strip() if os.path.exists(shaf) else ''
        for axis in R['axes']:
            p = os.path.join(d, R['md'].format(n=n, axis=axis))
            if not os.path.exists(p):
                row[axis] = {'state': 'absent'}; continue
            txt = open(p, encoding='utf-8').read()
            if 'SPEC_SKIPPED=1' in txt:
                row[axis] = {'state': 'non lancé'}; continue
            m = RESUME.search(txt)
            if not m:  # garde anti-faux-propre : pas de RESUME chiffré = l'axe n'a pas tourné
                row[axis] = {'state': 'non exécuté'}; continue
            c = [int(x) for x in m.groups()]
            row[axis] = {'state': 'ok', 'p0': c[0], 'p1': c[1], 'p2': c[2], 'p3': c[3]}
            for k, v in zip(('p0', 'p1', 'p2', 'p3'), c):
                row[k] += v
            for i, fm in enumerate(FINDING.finditer(txt.split('RESUME:')[0]), 1):
                head, detail = fm.group(2), ' '.join(l.strip() for l in fm.group(3).splitlines() if l.strip())
                parts = re.split(r'\s+[—–]\s+|\s+-\s+(?=\S*[/.]\S*$)', head)
                title, loc = (parts[0], parts[-1].strip('`* ')) if len(parts) > 1 else (head, '')
                fid = f"{R['id']}{n}-{axis}-{i}"
                dec = decisions.get(fid, {})
                findings.append({'id': fid, 'pass': n, 'axis': axis, 'prio': 'P' + fm.group(1), 'title': title, 'loc': loc,
                                 'detail': detail, 'status': dec.get('status') or 'open', 'ref': dec.get('ref') or ''})
        passes.append(row)
    # une décision dont le rang dépasse les puces de son rapport n'est rattachée à rien : on le dit
    known = {x['id'] for x in findings}
    return {'reviewer': who, 'axes': list(R['axes']), 'passes': passes, 'findings': findings,
            'orphans': sorted(k for k in decisions if re.match(R['id'] + r'\d', k) and k not in known)}


def agent_facts(repo):
    """Les sessions d'agent que gwm voit sur ce worktree, enrichies de leur transcript Claude Code
    (modèle, dernière action, dernier message, mission). 0 token."""
    j = run(['gwm', 'list', '--format=json'], repo)
    if not j:
        return []
    try:
        data = json.loads(j)
    except ValueError:
        return []
    ws = data if isinstance(data, list) else data.get('worktrees', [])
    w = next((x for x in ws if os.path.realpath((x.get('path') or '').rstrip('/')) == os.path.realpath(repo)), None)
    out = []
    for s in ((w or {}).get('agents') or {}).get('sessions', [])[:3]:
        a = {'id': s.get('id'), 'name': s.get('name'), 'kind': s.get('kind'), 'freshness': s.get('freshness'),
             'lastActivity': (s.get('last_activity') or 0) * 1000}
        if s.get('kind') == 'claude' and s.get('id'):
            a.update(transcript_facts(s['id']))
        out.append(a)
    return out


def transcript_facts(sid):
    import glob
    paths = glob.glob(os.path.expanduser(f'~/.claude/projects/*/{sid}.jsonl'))
    if not paths:
        return {}
    res = {'transcript': paths[0]}
    with open(paths[0], 'rb') as f:
        f.seek(0, 2); f.seek(max(0, f.tell() - 400_000))
        lines = f.read().decode('utf-8', 'replace').splitlines()[1:]
    for l in lines:
        try:
            o = json.loads(l)
        except ValueError:
            continue
        t = o.get('type')
        if t == 'last-prompt':
            res['mission'] = (o.get('lastPrompt') or '')[:400]
        elif t == 'pr-link':
            res['pr'] = o.get('prNumber')
        elif t == 'assistant':
            m = o.get('message') or {}
            res.update({'model': m.get('model'), 'effort': o.get('effort'), 'at': o.get('timestamp'), 'cwd': o.get('cwd'), 'gitBranch': o.get('gitBranch')})
            for c in m.get('content') or []:
                if not isinstance(c, dict):
                    continue
                if c.get('type') == 'tool_use':
                    i = c.get('input') or {}
                    what = i.get('description') or (i.get('command') or '').split('\n')[0] or i.get('file_path') or i.get('pattern') or i.get('skill') or i.get('prompt', '')[:80]
                    res['lastTool'] = {'name': c.get('name'), 'what': str(what)[:160], 'at': o.get('timestamp')}
                elif c.get('type') == 'text' and c.get('text', '').strip():
                    res['lastText'] = c['text'].strip()[:360]
    return res


def matches(path, pats):
    for p in pats:
        p = p.rstrip('/')
        if p == '*' or path == p or path.startswith(p + '/') or fnmatch.fnmatch(path, p):
            return True
    return False


def write_atomic(path, text):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.tmp-')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(tmp, path)


def record_pass(out, sha, std, spec):
    """Étape (D) de me:loop:claude-review-pr en un seul appel (`--pass`) : la passe est copiée telle quelle
    dans review/ (pass-N-standards.md, pass-N-spec.md, pass-N.sha), et la suite du main régénère le
    rapport. Les sessions recopiaient les fichiers et sautaient la régénération (facts.json figé sur la
    passe 1), ou sautaient l'étape entière. spec '-' : axe non lancé, jamais un RESUME à zéro (il
    s'afficherait « propre »). Rejouer (C) sur les mêmes rapports ne crée pas de passe en double."""
    d = os.path.join(out, 'review')
    os.makedirs(d, exist_ok=True)
    read = lambda p: open(p, encoding='utf-8', errors='replace').read()
    texts = {'standards': read(std), 'spec': 'SPEC_SKIPPED=1\n' if spec == '-' else read(spec)}
    nums = sorted(int(m.group(1)) for f in os.listdir(d) for m in [re.match(r'pass-(\d+)-standards\.md$', f)] if m)
    last = nums[-1] if nums else 0
    if last and all(os.path.exists(os.path.join(d, f'pass-{last}-{k}.md')) and read(os.path.join(d, f'pass-{last}-{k}.md')) == v
                    for k, v in texts.items()):
        print('PASS    ', f'passe {last} déjà enregistrée (mêmes rapports)')
        return
    n = last + 1
    for k, v in texts.items():
        write_atomic(os.path.join(d, f'pass-{n}-{k}.md'), v)
    write_atomic(os.path.join(d, f'pass-{n}.sha'), sha + '\n')
    print('PASS    ', f'passe {n} enregistrée')


def jsonc(text):
    """JSON avec commentaires et virgules finales (les réglages de Zed), sans toucher aux chaînes."""
    out, i, n, q = [], 0, len(text), False
    while i < n:
        c = text[i]
        if q:
            out.append(c)
            if c == '\\':
                out.append(text[i + 1:i + 2]); i += 2; continue
            q = c != '"'
        elif c == '"':
            q = True; out.append(c)
        elif text.startswith('//', i):
            j = text.find('\n', i); i = n if j < 0 else j; continue
        elif text.startswith('/*', i):
            j = text.find('*/', i); i = n if j < 0 else j + 2; continue
        else:
            out.append(c)
        i += 1
    return json.loads(re.sub(r',(\s*[}\]])', r'\1', ''.join(out)))


ZED_BUILTIN = {'One Dark': 'one-dark-pro', 'One Light': 'one-light'}  # thèmes intégrés à Zed, absents du disque


def zed_themes():
    """Le thème de Zed, sombre et clair, pour colorer les diffs comme l'éditeur (moteur tree-sitter de Pierre). 0 token.
    Cherché dans ~/.config/zed/themes puis les extensions ; un thème intégré à Zed se prend dans le catalogue de Pierre."""
    try:
        st = jsonc(open(os.path.expanduser('~/.config/zed/settings.json'), encoding='utf-8').read()).get('theme')
    except (OSError, ValueError):
        return None
    names = {'dark': st, 'light': st} if isinstance(st, str) else {'dark': (st or {}).get('dark'), 'light': (st or {}).get('light')}
    found = {}
    for path in glob.glob(os.path.expanduser('~/.config/zed/themes/*.json')) + glob.glob(os.path.expanduser('~/Library/Application Support/Zed/extensions/installed/*/themes/*.json')):
        try:
            for t in json.load(open(path, encoding='utf-8')).get('themes') or []:
                found.setdefault(t.get('name'), t)
        except (OSError, ValueError, AttributeError):
            continue
    out = {}
    for mode, name in names.items():
        if name in found:
            out[mode] = {'label': name, 'name': 'zed:' + name, 'theme': {**found[name], 'name': 'zed:' + name}}
        elif name:  # intégré à Zed : son équivalent du catalogue, sinon One pour ce mode (approché, dit comme tel)
            out[mode] = {'label': name, 'name': ZED_BUILTIN.get(name) or ('one-light' if mode == 'light' else 'one-dark-pro'), 'approx': name not in ZED_BUILTIN}
    return out if out.get('dark') and out.get('light') else None


PREVIEW_KINDS = (('image', re.compile(r'\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$', re.I)),
                 ('pdf', re.compile(r'\.pdf$', re.I)), ('md', re.compile(r'\.(md|markdown|mdx)$', re.I)))
ASSET_MAX = 20 * 1024 * 1024       # par blob
ASSETS_TOTAL = 120 * 1024 * 1024   # par rapport
DOC_MAX = 400_000                  # caractères de markdown par côté


def previews(repo, base_ref, files, out):
    """Avant / après des images, PDF et markdown, comme les vues Changes et History de Herdr. Les blobs git sont
    copiés dans assets/ sous leur empreinte (la page, et Sheprd, ne lisent que le dossier du rapport) ; le markdown
    part dans docs.js, chargé au premier dépli. 0 token. Côté avant = la base de fusion, comme le diff."""
    mb = (git(repo, 'merge-base', base_ref, 'HEAD') or '').strip() or base_ref
    adir, keep, docs, total = os.path.join(out, 'assets'), set(), {}, 0
    for f in files:
        kind = next((k for k, rx in PREVIEW_KINDS if rx.search(f['path'])), None)
        if not kind:
            continue
        pv = {'kind': kind}
        for side, rev, path in (('before', mb, f.get('old') or f['path']), ('after', 'HEAD', f['path'])):
            if (side == 'before' and f['status'] == 'A') or (side == 'after' and f['status'] == 'D'):
                continue
            spec = f'{rev}:{path}'
            h = (git(repo, 'rev-parse', '--verify', '-q', spec) or '').strip()
            size = int((git(repo, 'cat-file', '-s', spec) or '0').strip() or 0)
            if not h or not size:
                continue
            if kind == 'md':
                docs.setdefault(f['path'], {})[side] = (git(repo, 'show', spec) or '')[:DOC_MAX]
                pv[side] = {'size': size}
                continue
            if size > ASSET_MAX or total + size > ASSETS_TOTAL:
                pv[side] = {'size': size, 'skipped': True}
                continue
            name = f"{h}.{path.rsplit('.', 1)[-1].lower()}"
            dst = os.path.join(adir, name)
            if not os.path.exists(dst):
                os.makedirs(adir, exist_ok=True)
                blob = subprocess.run(['git', 'cat-file', 'blob', spec], cwd=repo, capture_output=True).stdout
                with open(dst + '.tmp', 'wb') as fh:
                    fh.write(blob)
                os.replace(dst + '.tmp', dst)
            keep.add(name); total += size
            pv[side] = {'src': 'assets/' + name, 'size': size}
        if len(pv) > 1:
            f['preview'] = pv
    for n in os.listdir(adir) if os.path.isdir(adir) else []:
        if n not in keep:
            os.remove(os.path.join(adir, n))  # blob d'une version passée de la branche
    write_atomic(os.path.join(out, 'docs.js'), 'window.__docs=' + json.dumps(docs, ensure_ascii=False) + ';\n')


# le diff touche au rendu : les captures deviennent obligatoires à l'entrée en review. Motifs fnmatch (« * » traverse
# les dossiers). Par projet : ~/Reports/<owner>-<repo>/front-patterns.txt, un motif par ligne (# commentaire), remplace
# cette liste ; un fichier vide = jamais de captures exigées. Pas de `app/*` ici : c'est du front en Nuxt, du back en
# Laravel ou Rails ; un dépôt Nuxt le met dans son front-patterns.txt.
FRONT = ('*.vue', '*.css', '*.scss', '*.sass', '*.less', '*.tsx', '*.jsx', '*.svelte', '*.astro', '*.html',
         '*.blade.php', '*.twig', '*.erb', '*components/*', '*pages/*', '*layouts/*', '*i18n/*', '*locales/*', '*styles/*',
         'public/*.png', 'public/*.jpg', 'public/*.jpeg', 'public/*.webp', 'public/*.avif', 'public/*.gif', 'public/*.svg',
         '*app.config.*', '*tailwind.config.*', '*uno.config.*')


def front_patterns(slug, repo):
    p = os.path.join(ROOT, (slug or os.path.basename(repo)).replace('/', '-'), 'front-patterns.txt')
    if not os.path.exists(p):
        return FRONT
    return [l.strip() for l in open(p, encoding='utf-8') if l.strip() and not l.lstrip().startswith('#')]


def png_size(path):
    with open(path, 'rb') as f:
        h = f.read(24)
    return (int.from_bytes(h[16:20], 'big'), int.from_bytes(h[20:24], 'big')) if h[:8] == b'\x89PNG\r\n\x1a\n' else (None, None)


def capture_img(path, rel):
    """une image de capture pour la page : src versionné (la PNG refaite garde son nom, le cache du navigateur non)."""
    st = os.stat(path)
    w, h = png_size(path)
    return {'src': f"{rel}?v={int(st.st_mtime)}-{st.st_size}", 'w': w, 'h': h, 'size': st.st_size}


def capture_facts(repo, head, out):
    """captures.json (écrit par le modèle) + captures/*.png (capture.mjs) → le fait `captures`. STALE comme une
    section : un fichier de `files` a changé depuis captures/sha ; sha absent ou hors de l'historique = toutes."""
    mpath = os.path.join(out, 'captures.json')
    if not os.path.exists(mpath):
        return None
    try:
        m = json.load(open(mpath, encoding='utf-8'))
    except ValueError as e:
        return {'error': f'captures.json invalide ({e})', 'shots': [], 'stale': [], 'missing': []}
    d = os.path.join(out, 'captures')
    shaf = os.path.join(d, 'sha')
    sha = open(shaf).read().strip() if os.path.exists(shaf) else None
    rewritten = bool(sha) and run(['git', 'merge-base', '--is-ancestor', sha, head], repo) is None
    changed = [l for l in (git(repo, 'diff', '--name-only', sha, head) or '').splitlines() if l] if sha and not rewritten else []
    shots = []
    for s in m.get('shots') or []:
        if not isinstance(s, dict) or not re.fullmatch(r'[a-z0-9-]+', str(s.get('id') or '')):
            continue
        row = {k: s[k] for k in ('id', 'title', 'route', 'selector', 'viewport', 'theme', 'note', 'midway', 'files') if k in s}
        png, bef = os.path.join(d, s['id'] + '.png'), os.path.join(d, s['id'] + '.before.png')
        if os.path.exists(png):
            row['after'] = capture_img(png, f"captures/{s['id']}.png")
            if os.path.exists(bef):
                row['before'] = capture_img(bef, f"captures/{s['id']}.before.png")
        row['missing'] = 'after' not in row
        row['stale'] = not row['missing'] and bool(s.get('files')) and (not sha or rewritten or matches_any(changed, s['files']))
        shots.append(row)
    return {'sha': sha, 'rewritten': rewritten, 'baseUrl': m.get('baseUrl'), 'beforeUrl': m.get('beforeUrl'), 'shots': shots,
            'stale': [x['id'] for x in shots if x['stale']], 'missing': [x['id'] for x in shots if x['missing']]}


def install_shell(out, kind='report'):
    os.makedirs(out, exist_ok=True)
    write_atomic(os.path.join(out, 'zed-theme.js'), 'window.__zedThemes=' + json.dumps(zed_themes(), ensure_ascii=False) + ';\n')
    for name in SHELL_FILES:
        shutil.copyfile(os.path.join(SHELL, name), os.path.join(out, name))
    # liens versionnés : un rechargement prend toujours la coquille à jour, jamais celle du cache
    html = open(os.path.join(SHELL, 'index.html'), encoding='utf-8').read()
    for name in SHELL_FILES:
        v = hashlib.sha1(open(os.path.join(SHELL, name), 'rb').read()).hexdigest()[:8]
        html = html.replace(f'"{name}"', f'"{name}?v={v}"')
    # favicon du type de page, icons/<kind>.svg (~/.claude/scripts/dither-tile.py) en data URI : sans le fichier, celle de la coquille reste
    ico = os.path.join(HERE, 'icons', kind + '.svg')
    if os.path.exists(ico):
        tag = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' + base64.b64encode(open(ico, 'rb').read()).decode() + '">'
        html = re.sub(r'<link rel="icon"[^>]*>', lambda m: tag, html, count=1)
    write_atomic(os.path.join(out, 'index.html'), html)


def write_payload(out, payload):
    payload['rev'] = hashlib.sha1(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    payload['generatedAt'] = datetime.now(timezone.utc).isoformat()
    write_atomic(os.path.join(out, 'data.js'), 'window.__report=' + json.dumps(payload, ensure_ascii=False) + ';\n')
    # les mêmes faits en JSON pur, pour les lecteurs qui ne sont pas la page (Herdr, mod kt-threads)
    write_atomic(os.path.join(out, 'facts.json'), json.dumps(payload, ensure_ascii=False) + '\n')


def read_notes(out):
    npath = os.path.join(out, 'notes.json')
    if not os.path.exists(npath):
        return None, 'absentes', npath
    try:
        return json.load(open(npath, encoding='utf-8')), 'ok', npath
    except ValueError as e:
        return None, f'invalides ({e})', npath


CI_OK = {'SUCCESS', 'NEUTRAL', 'SKIPPED'}
CI_KO = {'FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'}


def rollup(checks):
    """statusCheckRollup de gh (check-runs + statuses) → {total, ok, fail, pending}."""
    st = [(c.get('conclusion') or c.get('state') or c.get('status') or '').upper() for c in checks or []]
    ok, ko = sum(x in CI_OK for x in st), sum(x in CI_KO for x in st)
    return {'total': len(st), 'ok': ok, 'fail': ko, 'pending': len(st) - ok - ko} if st else None


def plan_captures(rep_dir, n, out, keep):
    """Les captures du rapport de la branche, telles que sa dernière collecte les a vues (STALE compris : pas de git en
    mode plan). Les PNG sont liées dans plans/<slug>/captures/ : la page, et Sheprd, ne lisent que leur propre dossier."""
    try:
        cap = json.load(open(os.path.join(rep_dir, 'facts.json'), encoding='utf-8'))['facts'].get('captures') or {}
    except (OSError, ValueError, KeyError, AttributeError):
        return []
    if not cap.get('shots'):
        return []
    os.makedirs(os.path.join(out, 'captures'), exist_ok=True)
    shots = []
    for s in cap.get('shots') or []:
        s = dict(s)
        for side in ('after', 'before'):
            if not s.get(side):
                continue
            src = os.path.join(rep_dir, s[side]['src'].split('?')[0])
            name = f"{n}-{s['id']}" + ('.before' if side == 'before' else '') + '.png'
            dst = os.path.join(out, 'captures', name)
            try:
                if not os.path.exists(dst) or not os.path.samefile(src, dst):
                    tmp = dst + '.tmp'
                    with contextlib.suppress(FileNotFoundError):
                        os.remove(tmp)
                    try:
                        os.link(src, tmp)
                    except OSError:
                        shutil.copyfile(src, tmp)  # autre volume : une copie
                    os.replace(tmp, dst)
            except OSError:
                s.pop(side); continue
            keep.add(name)
            s[side] = {**s[side], 'src': 'captures/' + name + '?' + s[side]['src'].split('?', 1)[-1]}
        shots.append(s)
    return shots


def plan_facts(repo, slug, items, offline, out):
    """État vivant des issues d'un plan, 0 token : issue (GraphQL, un appel), PR liée (Closes #N, sinon branche
    #N-), sa CI, le worktree gwm et ses agents, le rapport me:report de la branche s'il existe.
    La structure (quelles issues, quelles dépendances) vient de notes.json : c'est le plan lui-même."""
    nums = sorted({int(i['n']) for i in items if str(i.get('n', '')).isdigit()})
    info, prs, ws = {}, [], []
    if nums and slug and not offline:
        owner, name = slug.split('/', 1)
        q = 'query{repository(owner:%s,name:%s){%s}}' % (json.dumps(owner), json.dumps(name),
                                                        ' '.join(f'i{n}:issue(number:{n}){{number title state url}}' for n in nums))
        j = run(['gh', 'api', 'graphql', '-f', 'query=' + q], repo, ok=(0, 1))  # 1 : une issue introuvable, les autres restent
        try:
            info = {v['number']: v for v in ((json.loads(j or '{}').get('data') or {}).get('repository') or {}).values() if v}
        except ValueError:
            pass
        j = run(['gh', 'pr', 'list', '--state', 'all', '--limit', '100', '--json',
                 'number,title,state,isDraft,url,headRefName,closingIssuesReferences,statusCheckRollup'], repo)
        prs = json.loads(j) if j else []
    if repo:
        j = run(['gwm', 'list', '--format=json'], repo)
        try:
            d = json.loads(j) if j else []
            ws = d if isinstance(d, list) else d.get('worktrees', [])
        except ValueError:
            ws = []
    issue_of = lambda ref: (lambda m: int(m.group(1)) if m else None)(re.search(r'#(\d+)(?!\d)', ref or ''))
    rows, keep = [], set()
    for i in items:
        if not str(i.get('n', '')).isdigit():
            continue
        n = int(i['n']); x = info.get(n, {})
        mine = [p for p in prs if n in [c.get('number') for c in p.get('closingIssuesReferences') or []] or issue_of(p.get('headRefName')) == n]
        pr = max(mine, key=lambda p: p['number']) if mine else None
        wt = next((w for w in ws if issue_of(w.get('branch')) == n), None)
        branch = (pr or {}).get('headRefName') or (wt or {}).get('branch')
        rep_dir = branch and slug and os.path.join(ROOT, slug.replace('/', '-'), re.sub(r'[/#]+', '-', branch).strip('-'))
        sessions = ((wt or {}).get('agents') or {}).get('sessions') or []
        rows.append({'n': n, 'title': x.get('title') or i.get('title') or '', 'state': x.get('state'), 'url': x.get('url'),
                     'deps': [int(dd) for dd in i.get('deps') or [] if str(dd).isdigit()],
                     'pr': pr and {'number': pr['number'], 'state': pr['state'], 'isDraft': pr.get('isDraft'), 'url': pr['url'],
                                   'branch': pr.get('headRefName'), 'ci': rollup(pr.get('statusCheckRollup'))},
                     'worktree': wt and {'path': wt.get('path'), 'branch': wt.get('branch'),
                                         'agents': [{'name': a.get('name'), 'kind': a.get('kind'), 'freshness': a.get('freshness')} for a in sessions[:3]]},
                     'report': os.path.relpath(os.path.join(rep_dir, 'index.html'), out) if rep_dir and os.path.exists(os.path.join(rep_dir, 'index.html')) else None,
                     'captures': plan_captures(rep_dir, n, out, keep) if rep_dir else []})
    cdir = os.path.join(out, 'captures')
    for f in os.listdir(cdir) if os.path.isdir(cdir) else []:
        if f not in keep:
            os.remove(os.path.join(cdir, f))  # capture retirée de son rapport, ou issue sortie du plan
    # statut dérivé, une seule source pour la page et pour Herdr : fait > review > en cours > bloqué > à faire
    done = {r['n'] for r in rows if r['state'] == 'CLOSED' or (r['pr'] or {}).get('state') == 'MERGED'}
    for r in rows:
        p = r['pr'] or {}
        r['status'] = ('done' if r['n'] in done else 'review' if p.get('state') == 'OPEN' and not p.get('isDraft')
                       else 'wip' if r['worktree'] or p.get('state') == 'OPEN' else 'blocked' if any(dd not in done for dd in r['deps']) else 'todo')
    return rows


def collect_plan(a):
    """Mode plan : notes.json écrit par le modèle (sections, questions, sources, issues + dépendances), faits vivants
    par issue. Marche hors dépôt (plan de ~/.claude par exemple) : pas de diff, de PR ni de CI de branche."""
    name = re.sub(r'[^\w.-]+', '-', a.plan).strip('-') or 'plan'
    repo = (git(a.repo, 'rev-parse', '--show-toplevel') or '').strip() or None
    slug = repo and slug_of((git(repo, 'remote', 'get-url', 'origin') or '').strip())
    # toujours le dépôt principal, jamais un worktree : un plan couvre plusieurs branches
    common = repo and (git(repo, 'rev-parse', '--path-format=absolute', '--git-common-dir') or '').strip()
    if common and os.path.basename(common) == '.git':
        repo = os.path.dirname(common)
    where = (slug or os.path.basename(repo or '')).replace('/', '-')
    out = a.out or (os.path.join(ROOT, where, 'plans', name) if repo else os.path.join(ROOT, '_plans', name))
    if a.dir:
        print(out)
        return
    install_shell(out, 'plan')
    notes, notes_state, npath = read_notes(out)
    issues = plan_facts(repo, slug, (notes or {}).get('issues') or [], a.offline, out) if repo else []
    write_payload(out, {'kind': 'plan', 'facts': {'plan': name, 'repo': slug, 'repoPath': repo, 'issues': issues,
                                                  'notesState': notes_state}, 'notes': notes})
    c = {k: sum(r['status'] == k for r in issues) for k in ('done', 'review', 'wip', 'blocked', 'todo')}
    print('REPORT ', os.path.join(out, 'index.html'))
    print('FACTS  ', f"plan {name} · " + (slug or repo or 'hors dépôt') + (f" · {len(issues)} issues : {c['done']} faites, {c['review']} en review, "
          f"{c['wip']} en cours, {c['blocked']} bloquées, {c['todo']} à faire" if issues else ' · aucune issue suivie'))
    print('NOTES  ', notes_state + (' → écrire ' + npath if notes is None else ''))
    caps = [(r['n'], s) for r in issues for s in r.get('captures') or []]
    if caps:
        miss = sum(not s.get('after') for _, s in caps)
        print('CAPTURES', f"{len(caps)} sur {len({n for n, _ in caps})} issue(s) ({sum(bool(s.get('stale')) for _, s in caps)} en retard"
              + (f", {miss} sans image" if miss else '') + ')')


def refresh_plans(slug, repo, issue, offline):
    """Les plans de ce dépôt qui suivent l'issue de la branche sont relus avec elle : le kanban bouge au rythme des
    loops (review, codex, CI) qui relancent déjà collect.py, sans rien de plus à lancer. 0 token, ~2 appels gh par plan."""
    d = slug and issue and os.path.join(ROOT, slug.replace('/', '-'), 'plans')
    done = []
    for name in sorted(os.listdir(d)) if d and os.path.isdir(d) else []:
        try:
            notes = json.load(open(os.path.join(d, name, 'notes.json'), encoding='utf-8'))
            if any(str(i.get('n')) == str(issue) for i in notes.get('issues') or []):
                with contextlib.redirect_stdout(io.StringIO()):
                    collect_plan(argparse.Namespace(plan=name, repo=repo, out=os.path.join(d, name), dir=False, offline=offline))
                done.append(name)
        except Exception:
            continue  # un plan illisible ne casse jamais le rapport de branche
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default=os.getcwd())
    ap.add_argument('--base')
    ap.add_argument('--out')
    ap.add_argument('--offline', action='store_true')
    ap.add_argument('--stale-diff', action='store_true')
    ap.add_argument('--dir', action='store_true', help='affiche le dossier du rapport et sort')
    ap.add_argument('--plan', metavar='SLUG', help='mode plan : ~/Reports/<owner>-<repo>/plans/<slug>/ (hors dépôt : ~/Reports/_plans/<slug>/)')
    ap.add_argument('--pass', dest='pass_', nargs=2, metavar=('STANDARDS', 'SPEC'),
                    help="me:loop:claude-review-pr (D) : enregistre la passe dans review/ puis régénère ; SPEC '-' = axe spec non lancé")
    a = ap.parse_args()
    if a.plan:
        return collect_plan(a)

    repo = (git(a.repo, 'rev-parse', '--show-toplevel') or '').strip()
    if not repo:
        sys.exit('collect: pas un dépôt git : ' + a.repo)
    branch = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').strip()
    head = git(repo, 'rev-parse', 'HEAD').strip()
    slug = slug_of((git(repo, 'remote', 'get-url', 'origin') or '').strip())
    issue = (re.search(r'#(\d+)', branch) or [None, None])[1]
    out = a.out or os.path.join(ROOT, (slug or os.path.basename(repo)).replace('/', '-'), re.sub(r'[/#]+', '-', branch).strip('-'))
    if a.dir:  # pour les loops : le dossier du rapport, sans réseau ni écriture
        print(out)
        return
    if a.pass_:
        record_pass(out, (git(repo, 'rev-parse', '--short', 'HEAD') or head[:7]).strip(), *a.pass_)

    pr = None
    if not a.offline:
        j = run(['gh', 'pr', 'view', '--json', 'number,title,state,isDraft,url,baseRefName'], repo)
        if j:
            d = json.loads(j)
            pr = {'number': d['number'], 'title': d['title'], 'state': d['state'], 'isDraft': d['isDraft'], 'url': d['url'], 'base': d['baseRefName']}

    def ref_exists(r):
        return git(repo, 'rev-parse', '--verify', '-q', r) is not None
    base = a.base or (pr and pr['base']) or ('dev' if ref_exists('origin/dev') or ref_exists('dev') else None)
    if not base:
        base = (git(repo, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD') or 'origin/main').strip().split('/', 1)[-1]
    base_ref = 'origin/' + base if ref_exists('origin/' + base) else base
    if re.fullmatch(r'[0-9a-f]{40}', base):  # --base <sha> : affiché court, utilisé complet
        base = base[:7]
    # branche déjà fusionnée par merge commit : base...HEAD serait vide, on compare à la base d'avant la fusion
    if not a.base and run(['git', 'merge-base', '--is-ancestor', 'HEAD', base_ref], repo) is not None \
            and (git(repo, 'rev-parse', base_ref) or '').strip() != head:
        merges = (git(repo, 'rev-list', '--ancestry-path', '--merges', '--reverse', 'HEAD..' + base_ref) or '').split()
        if merges:
            base_ref, base = merges[0] + '^1', base + ' avant ' + merges[0][:7]

    rng = base_ref + '...HEAD'
    status = parse_status(git(repo, 'diff', '--name-status', '-M', '-z', rng) or '')
    nums = parse_numstat(git(repo, 'diff', '--numstat', '-M', '-z', rng) or '')
    firsts = first_lines(git(repo, 'diff', '-U0', '-M', rng))
    files = []
    for f in status:
        ad = nums.get(f['path'], (None, None))
        files.append({**f, 'add': ad[0], 'del': ad[1], 'line': firsts.get(f['path']),
                      'anchor': hashlib.sha256(f['path'].encode()).hexdigest()})
    totals = {'files': len(files), 'add': sum(x['add'] or 0 for x in files), 'del': sum(x['del'] or 0 for x in files)}
    commits = []
    for l in (git(repo, 'log', '--format=%H%x1f%h%x1f%s%x1f%cI', base_ref + '..HEAD') or '').splitlines():
        sha, short, subj, date = l.split('\x1f')
        commits.append({'sha': sha, 'short': short, 'subject': subj, 'date': date})

    up = git(repo, 'rev-parse', '--verify', '-q', '@{u}')
    pushed = bool(up) and up.strip() == head
    dirty = len([l for l in (git(repo, 'status', '--porcelain') or '').splitlines() if l])

    ci = None
    if slug and pushed and not a.offline:
        j = run(['gh', 'api', f'repos/{slug}/commits/{head}/check-runs?per_page=100'], repo)
        runs = []
        for c in (json.loads(j).get('check_runs', []) if j else []):
            st = 'en cours' if c.get('status') != 'completed' else ('ok' if c.get('conclusion') in ('success', 'skipped', 'neutral') else 'ko')
            runs.append({'name': c.get('name'), 'state': st, 'url': c.get('html_url')})
        if runs:
            ci = {'total': len(runs), 'ok': sum(r['state'] == 'ok' for r in runs), 'fail': sum(r['state'] == 'ko' for r in runs),
                  'pending': sum(r['state'] == 'en cours' for r in runs), 'runs': sorted(runs, key=lambda r: (r['state'] == 'ok', r['name'] or ''))}

    install_shell(out)
    previews(repo, base_ref, files, out)

    captures = capture_facts(repo, head, out)
    fpats = front_patterns(slug, repo)
    front = [f['path'] for f in files if f['status'] != 'D' and matches(f['path'], fpats)]
    review = parse_review(out)
    review_codex = parse_review(out, 'codex')
    passes = review['passes'] if review else []
    agents = agent_facts(repo)

    based, stale, changed = None, [], []
    notes, notes_state, npath = read_notes(out)
    if notes:
        based = notes.get('basedOn')
        secs = [s for s in notes.get('sections', []) if isinstance(s, dict) and s.get('id')]
        if not based or run(['git', 'merge-base', '--is-ancestor', based, head], repo, ok=(0,)) is None:
            stale = [s['id'] for s in secs if s.get('files')]  # basedOn absent ou historique réécrit
            notes_state += ' · historique réécrit' if based else ' · basedOn absent'
        else:
            changed = [l for l in (git(repo, 'diff', '--name-only', based, head) or '').splitlines() if l]
            stale = [s['id'] for s in secs if changed and matches_any(changed, s.get('files') or [])]

    payload = {'kind': 'report', 'facts': {
        'repo': slug, 'repoPath': repo, 'branch': branch, 'head': head, 'headShort': head[:7], 'base': base, 'issue': issue,
        'pushed': pushed, 'dirty': dirty, 'pr': pr, 'files': files, 'totals': totals, 'commits': commits, 'ci': ci, 'review': review, 'reviewCodex': review_codex, 'agents': agents,
        'captures': captures, 'capturesMissing': front[:30] if captures is None and front else None,
        'stale': stale, 'notesState': notes_state, 'basedOn': based}, 'notes': notes}
    write_payload(out, payload)
    dfiles, dcut = split_patch(git(repo, 'diff', '-M', rng))
    write_atomic(os.path.join(out, 'diffs.js'), 'window.__diffs=' + json.dumps(dfiles, ensure_ascii=False) + ';\nwindow.__diffsCut=' + json.dumps(dcut, ensure_ascii=False) + ';\n')

    # interface compacte lue par le modèle
    cis = f"ci {ci['ok']}/{ci['total']}" + (f" · {ci['fail']} ko" if ci['fail'] else '') + (f" · {ci['pending']} en cours" if ci['pending'] else '') if ci else ('ci : rien' if pushed else 'ci : HEAD non poussé')
    rvs = (lambda p: f"review passe {p['pass']} P0 {p['p0']} P1 {p['p1']} P2 {p['p2']}")(passes[-1]) if passes else 'review : aucune passe'
    if review_codex and review_codex['passes']:
        c = review_codex['passes'][-1]
        rvs += f" · codex passe {c['pass']} P0 {c['p0']} P1 {c['p1']} P2 {c['p2']}"
    orph = (review or {}).get('orphans', []) + (review_codex or {}).get('orphans', [])
    if orph:
        rvs += f" · {len(orph)} décision(s) sans finding"
    if agents:
        rvs += ' · agent ' + ', '.join(f"{a.get('name') or a['id'][:8]} ({a.get('freshness')})" for a in agents)
    print('REPORT ', os.path.join(out, 'index.html'))
    print('FACTS  ', f"head {head[:7]} · base {base}" + (f" · PR #{pr['number']} {pr['state'].lower()}" if pr else ' · pas de PR')
          + f" · {totals['files']} fichiers +{totals['add']} -{totals['del']} · {len(commits)} commits · {cis} · {rvs}"
          + (f" · {dirty} non commité" + ('s' if dirty > 1 else '') if dirty else ''))
    if notes is None:
        print('NOTES  ', notes_state, '→ écrire', npath)
    else:
        print('NOTES  ', notes_state, '· basedOn', (based or '-')[:7], '· STALE=' + ','.join(stale))
    cap = os.path.join(HERE, 'capture.mjs')
    if captures is not None:
        k, miss = len(captures['stale']), len(captures['missing'])
        print('CAPTURES', f"{len(captures['shots'])} ({k} en retard" + (f", {miss} sans image" if miss else '') + ')'
              + (f" · {captures['error']}" if captures.get('error') else '') + (f" · sha {captures['sha']}" if captures['sha'] else ' · pas de captures/sha')
              + (f" → node {cap} --stale" if k or miss else ''))
    elif front:
        print('CAPTURES', f"absentes → le diff touche au rendu ({len(front)} fichiers : {', '.join(front[:4])}{'…' if len(front) > 4 else ''}) :"
              f" écrire {os.path.join(out, 'captures.json')} (format : {os.path.join(HERE, 'references', 'captures.md')}), puis node {cap}")
    plans = refresh_plans(slug, repo, issue, a.offline)
    if plans:
        print('PLANS  ', ', '.join(plans), '· relus avec la branche')
    if a.stale_diff and stale and notes:
        pats = sorted({p for s in notes.get('sections', []) if isinstance(s, dict) and s.get('id') in stale for p in (s.get('files') or [])})
        scope = [] if '*' in pats or not changed else [c for c in changed if matches(c, pats)]
        d = git(repo, 'diff', (based or base_ref) if changed else base_ref, head, '--', *scope) or ''
        lines = d.splitlines()
        print('\n'.join(lines[:STALE_DIFF_LINES]) + (f'\n… {len(lines) - STALE_DIFF_LINES} lignes de plus' if len(lines) > STALE_DIFF_LINES else ''))


def matches_any(paths, pats):
    return any(matches(p, pats) for p in paths)


if __name__ == '__main__':
    main()
