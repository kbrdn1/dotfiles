/* me:report : rendu de data.js (faits de collect.py + notes du modèle), refresh live, intégrations.
   Coquille fixe copiée dans chaque rapport : le modèle n'écrit jamais ce fichier.
   Design : kbrdn.dev v2. Anatomie reprise de Header.vue (barre + encoche), ArticleHeader.vue,
   Panel.vue, Toc.vue / TocSteps.vue, Tag.vue, DottedBackground.vue + DitherCanvas.vue,
   useScrambleText, RollingNumber.vue, SegmentInk.vue, MusicDock. Diffs : @pierre/diffs. */
(function () {
  'use strict';
  var POLL_MS = 2000, AGENT_IDLE_MS = 5 * 60 * 1000;
  var PIERRE = 'https://esm.sh/@pierre/diffs@1.6.2';
  var MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
  var root = document.getElementById('root');
  var S = { cur: null, sigs: {}, openDiffs: {}, diffs: null, diffsRev: null, first: true, lastOk: Date.now(), lastChange: null,
            filter: { status: 'all', q: '' }, axis: 'all', nits: false, current: null, stats: {}, pierre: [] };
  var UI = {};

  // ================= utilitaires =================
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return e;
  }
  function ls(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  var ICONS = {
    sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
    moon: '<path d="M13.2 9.6A5.5 5.5 0 0 1 6.4 2.8a5.5 5.5 0 1 0 6.8 6.8z"/>',
    auto: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11" /><path d="M8 2.5a5.5 5.5 0 0 0 0 11z" fill="currentColor" stroke="none"/>',
    kbd: '<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6"/>',
    ext: '<path d="M6.5 3.5h6v6M12.5 3.5l-8 8"/>',
    pr: '<circle cx="4" cy="3.5" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><path d="M4 5v6M12 11V7a2 2 0 0 0-2-2H7.5M9 3.5 7.5 5 9 6.5"/>',
    chev: '<path d="M6 3.5 10.5 8 6 12.5"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3.5 10.5h-.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1v.5"/>',
    check: '<path d="M3 8.5 6.3 11.8 13 4.5"/>',
    chat: '<path d="M2.5 3.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H7.5L4.5 13.5v-2.5h-1a1 1 0 0 1-1-1z"/>',
    hash: '<path d="M5.5 2.5 4.5 13.5M11.5 2.5l-1 11M2.5 6h11M2 10h11"/>',
    folder: '<path d="M1.5 4.5a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>',
    terminal: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4.5 6.5 6.5 8.5 4.5 10.5M8 10.5h3.5"/>',
    up: '<path d="M8 13V3.5M4 7.5 8 3.5l4 4"/>',
    zoomin: '<circle cx="7" cy="7" r="4.5"/><path d="M13.5 13.5 10.2 10.2M5 7h4M7 5v4"/>',
    zoomout: '<circle cx="7" cy="7" r="4.5"/><path d="M13.5 13.5 10.2 10.2M5 7h4"/>',
    fit: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
    expand: '<path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M13.5 13.5 10.2 10.2"/>',
    note: '<path d="M3 2.5h7l3 3v8H3z"/><path d="M5.5 7.5h5M5.5 10h3"/>',
    send: '<path d="M2.5 8 13.5 2.5 10 13.5 7.5 9z"/><path d="M7.5 9 13.5 2.5"/>'
  };
  function icon(name) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('class', 'i'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICONS[name] || ''; return s; }
  function toast(msg) {
    if (UI.toast) UI.toast.remove();
    UI.toast = el('div', { class: 'toast', role: 'status' }, [icon('check'), msg]);
    document.body.appendChild(UI.toast);
    var t = UI.toast; setTimeout(function () { t.remove(); }, 2200);
  }
  function copy(text, label) {
    // synchrone d'abord : marche en file:// comme dans Sheprd, dans le geste de l'utilisateur
    var focus = document.activeElement, t = el('textarea', { style: 'position:fixed;top:0;left:0;opacity:0', readonly: true });
    t.value = text; document.body.appendChild(t); t.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    t.remove(); if (focus && focus.focus) focus.focus({ preventScroll: true });
    if (ok) return toast(label || 'copié');
    try { navigator.clipboard.writeText(text).then(function () { toast(label || 'copié'); }, function () { toast('copie refusée'); }); } catch (e) { toast('copie impossible'); }
  }
  function zed(abs, line, col) { return 'zed://file' + abs.split('/').map(encodeURIComponent).join('/') + (line ? ':' + line + (col ? ':' + col : '') : ''); }
  // ouvre comme un lien de la page (zed:// demande l'autorisation au premier clic), sans jamais décharger la page
  function openUrl(u) { if (!u) return; var a = el('a', { href: u, target: /^https?:/.test(u) ? '_blank' : null, rel: 'noopener', hidden: true }); document.body.appendChild(a); a.click(); a.remove(); }
  function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  function nvim(abs, line) { return 'nvim ' + (line ? '+' + line + ' ' : '') + shq(abs); }
  function absOf(p) { return p.charAt(0) === '/' ? p : S.cur.facts.repoPath + '/' + p; }
  function gh(path) { return S.cur.facts.repo ? 'https://github.com/' + S.cur.facts.repo + '/' + path : null; }
  function hhmm(iso) { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } }
  function rel(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(s)) return '';
    if (s < 60) return "à l'instant"; if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h'; if (s < 172800) return 'hier';
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function plural(n, w) { return n + ' ' + w + (n > 1 ? 's' : ''); }
  function reduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function inlineMd(s) {
    var span = document.createElement('span');
    span.innerHTML = String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/`([^`]+)`/g, '<code>$1</code>');
    return span;
  }
  function md(src, srcIndex) {
    var h = window.marked ? window.marked.parse(String(src || '')) : '<p>' + String(src || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</p>';
    return h.replace(/\[\^([\w.-]+)\]/g, function (m, id) {
      var s = srcIndex[id];
      return s ? '<a class="ref" href="#src-' + id + '" data-src="' + id + '" aria-label="source ' + s.n + '">' + s.n + '</a>' : m;
    });
  }
  // encadrés WATCH OUT / KEY IDEA / GOOD TO KNOW (références : design-patterns.md) : > [!WATCH] texte
  var CALLOUT = { WATCH: ['watch', 'attention', '!'], WARNING: ['watch', 'attention', '!'], KEY: ['key', 'idée clé', '✦'], IDEA: ['key', 'idée clé', '✦'],
    GOOD: ['good', 'bon à savoir', '✓'], TIP: ['good', 'bon à savoir', '✓'], NOTE: ['note', 'note', 'i'] };
  function callouts(root) {
    Array.prototype.forEach.call(root.querySelectorAll('blockquote'), function (bq) {
      var p = bq.querySelector('p'); if (!p) return;
      var m = p.innerHTML.match(/^\s*\[!(\w+)\]\s*/); var c = m && CALLOUT[m[1].toUpperCase()]; if (!c) return;
      p.innerHTML = p.innerHTML.slice(m[0].length); if (!p.textContent.trim()) p.remove();
      var body = el('div', { class: 'body' }); while (bq.firstChild) body.appendChild(bq.firstChild);
      bq.replaceWith(el('div', { class: 'callout ' + c[0], role: 'note' }, [el('span', { class: 'ico', 'aria-hidden': 'true', text: c[2] }), el('span', { class: 'lbl', text: c[1] }), body]));
    });
    return root;
  }
  function tag(text, cls, dot, attrs) { var a = attrs || {}; a.class = 'tag ' + (cls || ''); return el(a.href ? 'a' : 'span', a, [dot ? el('span', { class: 'dot' }) : null, text]); }
  function ibtn(label, o) {
    o = o || {};
    var a = { class: 'ibtn ' + (o.cls || ''), title: o.title || label, 'aria-label': o.title || label };
    if (o.href) { a.href = o.href; if (/^https?:/.test(o.href)) { a.target = '_blank'; a.rel = 'noopener'; } } else a.type = 'button';
    a.onclick = function (ev) {
      ev.stopPropagation();
      if (o.copy) { ev.preventDefault(); copy(o.copy, o.toast || 'copié'); } else if (o.onclick) o.onclick(ev);
    };
    return el(o.href ? 'a' : 'button', a, [o.icon ? icon(o.icon) : null, label]);
  }
  function openers(abs, line, ghHref) {
    return el('span', { class: 'acts' }, [
      ibtn('zed', { href: zed(abs, line), title: 'ouvrir dans Zed : ' + abs + (line ? ':' + line : '') }),
      ibtn('nvim', { copy: nvim(abs, line), title: 'copier : ' + nvim(abs, line), toast: 'commande nvim copiée' }),
      ghHref ? ibtn('github', { href: ghHref, cls: 'gh', title: 'ouvrir sur GitHub' }) : null
    ]);
  }
  function setExpand(ex, open) {
    var h = ex.firstChild ? ex.firstChild.scrollHeight : 0;
    ex.style.setProperty('--expand-duration', Math.round(Math.min(800, 250 + h * 0.9)) + 'ms');
    if (open) { ex.setAttribute('data-open', ''); ex.firstChild.inert = false; } else { ex.removeAttribute('data-open'); ex.firstChild.inert = true; }
  }
  function expand(open, kids) { var c = el('div', { class: 'expand-content' }, kids); c.inert = !open; return el('div', { class: 'expand', 'data-open': open }, [c]); }

  // ================= effets du portfolio =================
  // useScrambleText (effet « title ») : chaque caractère disparaît puis se retape à travers quelques glyphes
  var GLYPHS = 'abcdefghijklmnopqrstuvwxyz!@#$%^&*-_+=;:<>,';
  function scramble(text) {
    // les caractères sont aria-hidden : le titre qui contient ce span porte l'aria-label (comme Panel.vue)
    var wrap = el('span', { class: 'scramble' });
    var chars = Array.from(text).map(function (c) { var s = el('span', { class: 'ch', 'aria-hidden': 'true', text: c }); wrap.appendChild(s); return s; });
    var frame = 0;
    wrap.play = function () {
      if (reduced()) return;
      cancelAnimationFrame(frame);
      var step = Math.min(60, 1200 / Math.max(1, chars.length)), swaps = 3, hold = 80, settle = 100, start = null, slots = chars.map(function () { return -1; });
      var tick = function (now) {
        if (start == null) start = now;
        var busy = false;
        chars.forEach(function (s, i) {
          if (s.textContent === ' ') return;
          var t = now - start - (i + 1) * step;
          if (t >= swaps * hold + settle) { s.classList.remove('hide'); s.removeAttribute('data-g'); return; }
          busy = true;
          if (t < 0) { s.classList.add('hide'); s.removeAttribute('data-g'); return; }
          var slot = Math.min(swaps - 1, Math.floor(t / hold));
          if (slot !== slots[i]) { slots[i] = slot; s.classList.remove('hide'); s.setAttribute('data-g', GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length))); }
        });
        frame = busy ? requestAnimationFrame(tick) : 0;
      };
      frame = requestAnimationFrame(tick);
    };
    wrap.addEventListener('mouseenter', function () { wrap.play(); });
    return wrap;
  }
  // RollingNumber : un rouleau par chiffre, flou pendant qu'il tourne, gardé de la valeur précédente
  function rolling(value, key) {
    var text = String(value), prev = key != null ? S.stats[key] : undefined;
    if (key != null) S.stats[key] = text;
    var span = el('span', { class: 'rolling' }, [el('span', { class: 'sr', text: text })]);
    var reels = [], from = prev != null && prev.length === text.length ? prev : null;
    Array.from(text).forEach(function (ch, i) {
      if (ch >= '0' && ch <= '9') {
        var strip = el('span', { class: 'reel-strip' });
        var startDigit = from && from[i] >= '0' && from[i] <= '9' ? +from[i] : null;
        var lapStart = startDigit != null ? 1 : 0;
        strip.style.translate = '0 calc(' + -((startDigit != null ? startDigit : +ch) + 10 * lapStart) + ' * 1lh)';
        var reel = el('span', { class: 'reel instant', style: '--i:' + i, 'aria-hidden': 'true' }, [strip]);
        reels.push({ reel: reel, strip: strip, target: +ch, moves: startDigit == null || startDigit !== +ch });
        span.appendChild(reel);
      } else span.appendChild(el('span', { 'aria-hidden': 'true', style: 'white-space:pre', text: ch }));
    });
    var animate = (S.first || from) && !reduced();
    requestAnimationFrame(function () {
      reels.forEach(function (r) {
        if (!animate || !r.moves) { r.strip.style.translate = '0 calc(' + -(r.target + 10) + ' * 1lh)'; r.reel.classList.remove('instant'); return; }
        void r.reel.offsetHeight;
        r.reel.classList.remove('instant'); r.reel.classList.add('spin');
        r.strip.style.translate = '0 calc(' + -(r.target + 10) + ' * 1lh)';
      });
      if (animate) setTimeout(function () { reels.forEach(function (r) { r.reel.classList.remove('spin'); }); }, 900 + text.length * 150);
    });
    return span;
  }
  // SegmentInk : un seul aplat qui glisse vers le segment actif
  function inkify(seg) {
    var ink = el('span', { class: 'segment-ink still', 'aria-hidden': 'true' });
    seg.appendChild(ink); seg.setAttribute('data-ink', '');
    var place = function () {
      var a = seg.querySelector('.segment[aria-pressed="true"], .segment[aria-current="true"]');
      if (!a) { ink.hidden = true; return; }
      ink.hidden = false; ink.style.left = a.offsetLeft + 'px'; ink.style.top = a.offsetTop + 'px'; ink.style.width = a.offsetWidth + 'px'; ink.style.height = a.offsetHeight + 'px';
    };
    new MutationObserver(place).observe(seg, { subtree: true, attributeFilter: ['aria-pressed', 'aria-current'] });
    new ResizeObserver(place).observe(seg);
    requestAnimationFrame(function () { place(); requestAnimationFrame(function () { ink.classList.remove('still'); }); });
    return seg;
  }
  function stagger(parent) { if (!S.first || reduced()) return parent; parent.classList.add('stagger'); Array.prototype.forEach.call(parent.children, function (c, i) { c.style.setProperty('--i', Math.min(i, 14)); }); return parent; }

  // DitherCanvas, simplifié : un champ de bruit qui dérive, quantifié en 4 niveaux d'alpha de l'accent,
  // tramé (Bayer 4×4), plus dense en haut ; 12 images/s, à l'arrêt si l'onglet est caché ou le mouvement réduit
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var ALPHAS = [0, 0.07, 0.13, 0.2];
  function dither(canvas, o) {
    var ctx = canvas.getContext('2d'), img = null, cols = 0, rows = 0, t = Math.random() * 100, last = 0;
    function size() {
      var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return false;
      var c = Math.ceil(w / 4), r = Math.ceil(h / 4);
      if (c !== cols || r !== rows) { cols = c; rows = r; canvas.width = c; canvas.height = r; img = ctx.createImageData(c, r); }
      return true;
    }
    function color() { var m = getComputedStyle(canvas).color.match(/\d+/g) || [212, 130, 93]; return m.map(Number); }
    function draw() {
      if (!size()) return;
      var rgb = color(), d = img.data, light = document.documentElement.getAttribute('data-theme') === 'light', gain = light ? 0.75 : 1;
      for (var y = 0; y < rows; y++) {
        var depth = rows > 1 ? y / (rows - 1) : 0, thr = o.fade === 'down' ? 0.46 + 0.5 * depth * depth : 0.52;
        for (var x = 0; x < cols; x++) {
          var n = 0.5 + 0.28 * Math.sin(x * 0.045 + t * 0.55) * Math.cos(y * 0.06 - t * 0.35) + 0.18 * Math.sin((x * 0.7 + y) * 0.028 + t * 0.25) + 0.12 * Math.sin(x * 0.11 - y * 0.07 + t * 0.9);
          var v = (n - thr) * 4.2 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
          var lv = v < 0 ? 0 : v >= 3 ? 3 : Math.floor(v) + (v > 0 ? 1 : 0); if (lv > 3) lv = 3;
          var i = (y * cols + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = Math.round(ALPHAS[lv] * 255 * gain * (o.alpha || 1));
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    function loop(now) {
      if (!canvas.isConnected) return;
      requestAnimationFrame(loop);
      if (document.visibilityState !== 'visible' || now - last < 83) return;
      last = now; t += 0.06; draw();
    }
    draw();
    if (!reduced()) requestAnimationFrame(loop);
    return { redraw: draw };
  }

  // ================= mermaid =================
  var mermaidP = null;
  function mermaidVars() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? {
      primaryColor: '#ffffff', primaryTextColor: '#1a1a1a', primaryBorderColor: '#d0d0d0', lineColor: '#9a9a9a', secondaryColor: '#f5f5f5', tertiaryColor: '#ececec', background: '#ffffff', mainBkg: '#ffffff', nodeBorder: '#d0d0d0',
      clusterBkg: '#f5f5f5', clusterBorder: '#d0d0d0', titleColor: '#1a1a1a', edgeLabelBackground: '#f5f5f5', nodeTextColor: '#1a1a1a', actorBkg: '#ffffff', actorBorder: '#c15f3c', actorTextColor: '#1a1a1a', signalColor: '#3a3a3a', signalTextColor: '#1a1a1a', noteBkgColor: '#fcf0e0', noteTextColor: '#1a1a1a', activationBkgColor: '#fcf0e0'
    } : {
      primaryColor: '#191919', primaryTextColor: '#f5f5f5', primaryBorderColor: '#333333', lineColor: '#6b6b6b', secondaryColor: '#2a2a2a', tertiaryColor: '#3a3a3a', background: '#191919', mainBkg: '#1f1f1f', nodeBorder: '#3a3a3a',
      clusterBkg: '#0f0f0f', clusterBorder: '#3a3a3a', titleColor: '#e0e0e0', edgeLabelBackground: '#191919', nodeTextColor: '#e0e0e0', actorBkg: '#1f1f1f', actorBorder: '#d4825d', actorTextColor: '#e0e0e0', signalColor: '#a3a3a3', signalTextColor: '#e0e0e0', noteBkgColor: '#2e2618', noteTextColor: '#e0e0e0', activationBkgColor: '#2e2618'
    };
  }
  function mermaid() {
    if (!mermaidP) mermaidP = import(MERMAID).then(function (m) { return m.default; });
    return mermaidP.then(function (m) { m.initialize({ startOnLoad: false, theme: 'base', fontFamily: '"Monaspace Krypton", ui-monospace, monospace', themeVariables: mermaidVars(), securityLevel: 'strict',
      // libellés SVG : les libellés HTML sont mesurés hors du pre mono puis rendus dedans, donc coupés
      htmlLabels: false, flowchart: { htmlLabels: false },
      // la séquence mesure acteurs, messages et notes avec ses propres polices (trebuchet, open sans) : même police que le rendu
      sequence: { actorFontFamily: '"Monaspace Krypton", ui-monospace, monospace', messageFontFamily: '"Monaspace Krypton", ui-monospace, monospace', noteFontFamily: '"Monaspace Krypton", ui-monospace, monospace' } }); return m; });
  }
  function drawDiagrams(scope, force) {
    var nodes = Array.prototype.slice.call(scope.querySelectorAll('pre.mermaid')).filter(function (n) { return force || !n.hasAttribute('data-processed'); });
    if (!nodes.length) return;
    nodes.forEach(function (n) { n.removeAttribute('data-processed'); n.textContent = n.getAttribute('data-src'); });
    mermaid().then(function (m) { return m.run({ nodes: nodes }); }).then(function () {
      nodes.forEach(function (n) { var svg = n.querySelector('svg'); if (svg) n.closest('.diagram').zoom = zoomable(n, svg, false); });
    }).catch(function (e) { console.warn('mermaid', e); nodes.forEach(function (n) { n.style.color = 'inherit'; }); });
  }
  // zoom au pointeur (pinch, ⌘/ctrl + molette, ou molette seule en plein écran), glisser pour déplacer
  function zoomable(view, svg, wheelFree, onChange) {
    if (view._z) { view._z.attach(svg); return view._z; }
    var k = 1, x = 0, y = 0, drag = null;
    view.style.overflow = 'hidden'; view.style.touchAction = wheelFree ? 'none' : 'pan-y pinch-zoom';
    function apply() { if (svg) svg.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')'; if (onChange) onChange(k); }
    function attach(s) {
      svg = s; k = 1; x = 0; y = 0; svg.style.transformOrigin = '0 0'; svg.style.cursor = 'grab';
      svg.addEventListener('pointerdown', function (ev) { drag = { x: ev.clientX - x, y: ev.clientY - y }; try { svg.setPointerCapture(ev.pointerId); } catch (e) {} svg.style.cursor = 'grabbing'; });
      svg.addEventListener('pointermove', function (ev) { if (!drag) return; x = ev.clientX - drag.x; y = ev.clientY - drag.y; apply(); });
      svg.addEventListener('pointerup', function () { drag = null; svg.style.cursor = 'grab'; });
      svg.addEventListener('dblclick', function () { k = 1; x = 0; y = 0; apply(); });
    }
    function at(f, cx, cy) { var nk = Math.max(0.3, Math.min(8, k * f)); x = cx - (cx - x) * (nk / k); y = cy - (cy - y) * (nk / k); k = nk; apply(); }
    function center() { var r = view.getBoundingClientRect(); return [r.width / 2, r.height / 2]; }
    view.addEventListener('wheel', function (ev) {
      if (!wheelFree && !ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      var r = view.getBoundingClientRect();
      at(Math.exp(-ev.deltaY * (ev.ctrlKey && !wheelFree ? 0.01 : 0.0015)), ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });
    attach(svg);
    view._z = { attach: attach, zin: function () { var c = center(); at(1.25, c[0], c[1]); }, zout: function () { var c = center(); at(0.8, c[0], c[1]); }, reset: function () { k = 1; x = 0; y = 0; apply(); }, set: function (nk, nx, ny) { k = nk; x = nx; y = ny; apply(); } };
    return view._z;
  }
  function figure(src, title) {
    var pre = el('pre', { class: 'mermaid', 'data-src': src, text: src });
    var box = el('div', { class: 'diagram' }, [pre]);
    return el('div', { class: 'panel figure' }, [el('div', { class: 'card' }, [box]), el('div', { class: 'fig-foot' }, [
      el('span', { class: 'eyebrow', text: 'diagramme · pinch ou ⌘ + molette pour zoomer, glisser pour déplacer' }),
      ibtn('', { icon: 'zoomout', title: 'dézoomer', onclick: function () { box.zoom && box.zoom.zout(); } }),
      ibtn('', { icon: 'zoomin', title: 'zoomer', onclick: function () { box.zoom && box.zoom.zin(); } }),
      ibtn('', { icon: 'fit', title: 'recadrer (double-clic)', onclick: function () { box.zoom && box.zoom.reset(); } }),
      ibtn('plein écran', { icon: 'expand', title: 'plein écran : la molette zoome', onclick: function () { diagramViewer(pre, title); } }),
      ibtn('source', { icon: 'copy', copy: src, toast: 'source mermaid copiée' })
    ])]);
  }
  // visionneuse plein écran : tout l'écran, fond quadrillé, zoom affiché, ajusté à l'ouverture
  function viewer(title, acts, body, onKey) {
    closeViewer();
    var v = el('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('div', { class: 'v-bar' }, [el('h2', { text: title }), el('div', { class: 'acts' }, acts.concat([
        ibtn('', { icon: 'expand', title: 'plein écran du système', onclick: function () { if (document.fullscreenElement) document.exitFullscreen(); else if (v.requestFullscreen) v.requestFullscreen(); } }),
        ibtn('fermer', { title: 'fermer (échap)', onclick: closeViewer })]))]), body]);
    v.onKey = onKey; UI.viewer = v; document.body.appendChild(v); document.documentElement.style.overflow = 'hidden';
    return v;
  }
  function closeViewer() { if (!UI.viewer) return; if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); UI.viewer.remove(); UI.viewer = null; document.documentElement.style.overflow = ''; }
  function diagramViewer(pre, title) {
    var svg = pre.querySelector('svg'); if (!svg) return;
    var clone = svg.cloneNode(true); clone.removeAttribute('style'); clone.style.maxWidth = 'none';
    var body = el('div', { class: 'v-body' }, [clone, el('div', { class: 'v-hint', text: 'molette ou pinch = zoom · glisser = déplacer · 0 = ajuster · + / − · échap' })]);
    var zl = el('span', { class: 'zoom', text: '100 %' }), z = null;
    function fit() {
      var r = body.getBoundingClientRect(), vb = clone.viewBox && clone.viewBox.baseVal, w = vb && vb.width ? vb.width : clone.getBBox().width, h = vb && vb.height ? vb.height : clone.getBBox().height;
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      var k = Math.min(r.width / w, r.height / h) * 0.9; z.set(k, (r.width - w * k) / 2, (r.height - h * k) / 2);
    }
    viewer(title || 'Diagramme', [ibtn('', { icon: 'zoomout', title: 'dézoomer (−)', onclick: function () { z.zout(); } }), zl, ibtn('', { icon: 'zoomin', title: 'zoomer (+)', onclick: function () { z.zin(); } }),
      ibtn('ajuster', { icon: 'fit', title: 'ajuster à l\'écran (0)', onclick: fit }), ibtn('source', { icon: 'copy', copy: pre.getAttribute('data-src'), toast: 'source mermaid copiée' })], body,
      function (ev) { if (ev.key === '+' || ev.key === '=') z.zin(); else if (ev.key === '-') z.zout(); else if (ev.key === '0') fit(); else return false; return true; });
    z = zoomable(body, clone, true, function (k) { zl.textContent = Math.round(k * 100) + ' %'; });
    requestAnimationFrame(fit);
  }
  // diff en grand : côte à côte ou unifié, annotations comprises
  function diffViewer(path) {
    loadDiffs(function () {
      var patch = (S.diffs || {})[path]; if (!patch) return toast('diff indisponible');
      var f = S.cur.facts, style = ls('me-report:diffstyle') || 'split', entry = (f.files || []).filter(function (x) { return x.path === path; })[0] || {};
      var holder = el('div', { class: 'pdiff' }), body = el('div', { class: 'v-body scroll' }, [holder, patchView(path, patch)]);
      var seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'affichage' }, [['split', 'côte à côte'], ['unified', 'unifié']].map(function (o) {
        return el('button', { class: 'segment', type: 'button', 'aria-pressed': String(style === o[0]), onclick: function (ev) {
          ls('me-report:diffstyle', o[0]); Array.prototype.forEach.call(seg.querySelectorAll('.segment'), function (b) { b.setAttribute('aria-pressed', String(b === ev.currentTarget)); });
          var pi = S.pierre.filter(function (x) { return x.holder === holder; })[0]; if (pi) { pi.extra = { diffStyle: o[0] }; pi.inst.setOptions(pierreOptions(path, pi.extra)); pi.inst.rerender(); }
        } }, [o[1]]);
      }));
      viewer(path, [inkify(seg), ibtn('zed', { href: zed(absOf(path), entry.line) }), f.pr ? ibtn('github', { icon: 'ext', href: f.pr.url + '/files#diff-' + entry.anchor }) : null].filter(Boolean), body);
      pierreRender(holder, path, patch, { diffStyle: style });
    });
  }

  // ================= overlays, popovers =================
  function openOverlay(content) {
    closeOverlay();
    UI.overlay = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', onclick: function (ev) { if (ev.target === UI.overlay) closeOverlay(); } }, [content]);
    document.body.appendChild(UI.overlay);
  }
  function closeOverlay() { if (UI.overlay) { UI.overlay.remove(); UI.overlay = null; } }
  function keysHelp() {
    var rows = [['⌘ K', 'chercher dans le rapport'], ['j / k', 'section suivante / précédente'], ['← / →', 'passe de review précédente / suivante'], ['/', 'filtrer les fichiers'], ['x', 'replier la section courante'], ['t', 'thème suivant'], ['g', 'haut de page'], ['+ / − / 0', 'zoom en plein écran'], ['?', 'cette aide'], ['échap', 'fermer']];
    openOverlay(el('div', { class: 'panel' }, [el('div', { class: 'p-head' }, [el('h2', { text: 'Raccourcis' })]),
      el('div', { class: 'card keys' }, rows.map(function (r) { return el('div', { class: 'k' }, [el('span', { text: r[1] }), el('kbd', { text: r[0] })]); }))]));
  }
  function popAt(anchor, kids) {
    hidePop(true);
    UI.pop = el('div', { class: 'pop', role: 'tooltip', onmouseenter: function () { clearTimeout(UI.popT); }, onmouseleave: function () { hidePop(); } }, kids);
    document.body.appendChild(UI.pop);
    var r = anchor.getBoundingClientRect(), w = UI.pop.offsetWidth;
    UI.pop.style.left = Math.max(12, Math.min(scrollX + r.left - 12, scrollX + document.documentElement.clientWidth - w - 12)) + 'px';
    UI.pop.style.top = (scrollY + r.bottom + 8) + 'px';
    UI.popRef = anchor; if (anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');
  }
  function hidePop(now) {
    clearTimeout(UI.popT);
    var go = function () { if (UI.pop) { UI.pop.remove(); UI.pop = null; } if (UI.popRef && UI.popRef.removeAttribute) UI.popRef.removeAttribute('aria-expanded'); UI.popRef = null; };
    if (now) go(); else UI.popT = setTimeout(go, 220);
  }
  function showSourcePop(ref) {
    var id = ref.getAttribute('data-src'), s = ((S.cur.notes && S.cur.notes.sources) || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var acts = [];
    if (s.path) { var abs = absOf(s.path); acts.push(ibtn('zed', { href: zed(abs, s.line) }), ibtn('nvim', { copy: nvim(abs, s.line), toast: 'commande nvim copiée' }), ibtn('chemin', { icon: 'copy', copy: abs + (s.line ? ':' + s.line : ''), toast: 'chemin copié' })); }
    if (s.href) acts.push(ibtn('ouvrir', { icon: 'ext', href: s.href }));
    acts.push(ibtn('liste', { href: '#src-' + id }));
    popAt(ref, [el('span', { class: 'eyebrow', text: (s.kind || 'source') + ' · ' + ref.textContent }), el('div', { class: 't', text: s.label || s.id }),
      el('div', { class: 's', text: s.path ? s.path + (s.line ? ':' + s.line : '') : (s.href || '') }), el('div', { class: 'acts' }, acts)]);
  }

  // ================= panneaux (Panel.vue) =================
  function foldState() { return ls(S.key + ':fold') || {}; }
  function panel(key, num, title, o) {
    o = o || {};
    var folded = !!foldState()[key];
    var t = scramble(title);
    var acts = el('div', { class: 'acts' }, [el('span', { class: 'tag c-accent upd', text: 'mis à jour' }), o.stale ? tag('en retard', 'c-warn', true) : null].concat(o.acts || []).concat([
      ibtn('', { icon: 'hash', title: 'copier le lien de la section', onclick: function () { copy(location.href.split('#')[0] + '#' + key, 'lien copié'); } }),
      (function () { var b = ibtn('', { cls: 'fold', title: 'replier / déplier (x)', onclick: function () { fold(sec); } }); b.appendChild(el('span', { class: 'fold-ico', 'aria-hidden': 'true' }, [icon('chev')])); return b; })()
    ]));
    var h2 = el('h2', { 'aria-label': title + (o.sub ? ' · ' + o.sub : ''), onclick: function () { fold(sec); } }, [t, o.sub ? el('span', { class: 'sub', 'aria-hidden': 'true', text: o.sub }) : null]);
    var sec = el('section', { class: 'panel', id: key, 'data-key': key, 'data-folded': folded, 'aria-label': title }, [
      el('div', { class: 'p-head' }, [h2, acts]), expand(!folded, o.body || []),
      o.foot ? el('div', { class: 'p-foot' }, [el('span', { class: 'eyebrow' }, [o.foot])].concat(o.footActs || [])) : null]);
    sec.scrambleEl = t;
    return sec;
  }
  function fold(sec, open) {
    var ex = sec.querySelector(':scope > .expand'); if (!ex) return;
    var willOpen = open != null ? open : sec.hasAttribute('data-folded');
    setExpand(ex, willOpen);
    if (willOpen) sec.removeAttribute('data-folded'); else sec.setAttribute('data-folded', '');
    var st = foldState(); if (willOpen) delete st[sec.id]; else st[sec.id] = 1; ls(S.key + ':fold', st);
  }

  // ================= en-tête (ArticleHeader) =================
  var LANG = { rs: ['rust', 't-rust'], js: ['javascript', 't-js'], cjs: ['javascript', 't-js'], mjs: ['javascript', 't-js'], jsx: ['javascript', 't-js'], ts: ['typescript', 't-ts'], tsx: ['typescript', 't-ts'],
    vue: ['vue', 't-vue'], py: ['python', 't-py'], md: ['docs', 't-docs'], mdx: ['docs', 't-docs'], css: ['css', 't-css'], scss: ['css', 't-css'], html: ['html', 't-html'], json: ['config', 't-config'],
    toml: ['config', 't-config'], yml: ['config', 't-config'], yaml: ['config', 't-config'], sh: ['shell', 't-shell'], zsh: ['shell', 't-shell'], swift: ['swift', 't-swift'], go: ['go', 't-go'], php: ['php', 't-php'] };
  function langOf(path) {
    if (/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.\w+$/.test(path)) return ['tests', 't-test'];
    var m = path.match(/\.([a-z0-9]+)$/i); return (m && LANG[m[1].toLowerCase()]) || ['autre', 't-other'];
  }
  // deux reviewers possibles : claude-review-pr (deux axes) et codex-review-pr (un rapport) ; jamais mélangés
  function curReview(f) { return (S.reviewer === 'codex' ? f.reviewCodex : f.review) || f.review || f.reviewCodex; }
  function useReviewer(w) { if (S.reviewer === w) return; S.reviewer = w; S.axis = 'all'; S.rpass = null; delete S.sigs['f-review']; render(S.cur); }
  function lastPass(f) { var r = f.review || f.reviewCodex; return r && r.passes && r.passes.length ? r.passes[r.passes.length - 1] : null; }
  function statusTags(f) {
    var t = [];
    if (f.pr) t.push(tag('pr #' + f.pr.number + ' · ' + String(f.pr.state).toLowerCase() + (f.pr.isDraft ? ' · draft' : ''), f.pr.state === 'MERGED' ? 'c-special' : f.pr.state === 'CLOSED' ? 'c-err' : 'c-ok pulse', true, { href: f.pr.url, target: '_blank', rel: 'noopener' }));
    t.push(tag((f.branch || '?') + ' → ' + (f.base || '?'), 'c-accent', false, { title: 'branche → base' }));
    t.push(tag(f.headShort + (f.pushed ? '' : ' · non poussé'), f.pushed ? 'c-label' : 'c-warn', false, { title: f.head }));
    if (f.ci) t.push(tag('ci ' + f.ci.ok + '/' + f.ci.total + (f.ci.fail ? ' · ' + f.ci.fail + ' ko' : '') + (f.ci.pending ? ' · ' + f.ci.pending + ' en cours' : ''), f.ci.fail ? 'c-err' : f.ci.pending ? 'c-warn' : 'c-ok', true, { href: '#f-ci' }));
    var rv = lastPass(f);
    t.push(tag(rv ? 'review p' + rv.pass + ' · ' + plural(rv.p0 + rv.p1 + rv.p2, 'bloquant') : 'review : aucune passe', rv ? (rv.p0 + rv.p1 + rv.p2 ? 'c-warn' : 'c-ok') : 'c-label', true, { href: '#f-review' }));
    var cx = f.review && f.reviewCodex && f.reviewCodex.passes.length ? f.reviewCodex.passes[f.reviewCodex.passes.length - 1] : null;
    if (cx) t.push(tag('codex p' + cx.pass + ' · ' + plural(cx.p0 + cx.p1 + cx.p2, 'bloquant'), cx.p0 + cx.p1 + cx.p2 ? 'c-warn' : 'c-ok', true, { href: '#f-review' }));
    if (f.stale && f.stale.length) t.push(tag(plural(f.stale.length, 'section') + ' en retard', 'c-warn', true));
    if (f.dirty) t.push(tag(plural(f.dirty, 'fichier') + ' non commité' + (f.dirty > 1 ? 's' : ''), 'c-warn', true, { title: 'le rapport ne couvre que HEAD' }));
    return t;
  }
  function langTags(f) {
    var seen = {}, out = [];
    (f.files || []).forEach(function (x) { var l = langOf(x.path); if (!seen[l[0]]) { seen[l[0]] = { cls: l[1], n: 0 }; out.push(l[0]); } seen[l[0]].n++; });
    return out.map(function (l) { return tag(l + ' ' + seen[l].n, seen[l].cls, false, { title: plural(seen[l].n, 'fichier') + ' ' + l }); });
  }
  function cover(f) {
    var files = (f.files || []).slice().sort(function (a, b) { return ((b.add || 0) + (b.del || 0)) - ((a.add || 0) + (a.del || 0)); }).slice(0, 48);
    var hover = el('span', { class: 'hover', text: 'survoler une colonne : un fichier' });
    var sky = el('div', { class: 'skyline', role: 'list', 'aria-label': 'ampleur du diff par fichier' });
    files.forEach(function (x, c) {
      var tot = (x.add || 0) + (x.del || 0), cells = Math.max(1, Math.min(16, Math.round(Math.log2(tot + 1) * 1.9)));
      var dels = tot ? Math.round(cells * (x.del || 0) / tot) : 0;
      var col = el('a', { class: 'col', href: '#f-files', role: 'listitem', 'aria-label': x.path + ' +' + x.add + ' −' + x.del, style: '--c:' + c,
        onmouseenter: function () { hover.textContent = x.path + '  +' + x.add + ' −' + x.del; }, onclick: function (ev) { ev.preventDefault(); openFile(x.path); } });
      for (var k = 0; k < cells; k++) col.appendChild(el('i', { class: k < dels ? 'd' : '', style: '--k:' + k }));
      sky.appendChild(col);
    });
    var cv = el('canvas', { 'aria-hidden': 'true' });
    var box = el('div', { class: 'cover' }, [cv, sky, el('div', { class: 'legend' }, [el('span', { text: plural((f.files || []).length, 'fichier') + ' · +' + f.totals.add + ' −' + f.totals.del }), hover])]);
    requestAnimationFrame(function () { dither(cv, { fade: 'none', alpha: 0.9 }); });
    return box;
  }
  function stat(label, value, key, cls, href, suffix, st) {
    var v = el('div', { class: 'v ' + (cls || '') }, [typeof value === 'number' ? rolling(value, key) : value, suffix ? el('small', { text: suffix }) : null]);
    return el('div', { class: 'kpi' + (st ? ' st-' + st : '') }, [el('div', { class: 'eyebrow', text: label }), href ? el('a', { href: href }, [v]) : v]);
  }
  function heroBlock(d) {
    var f = d.facts, n = d.notes || {}, rv = lastPass(f), blocking = rv ? rv.p0 + rv.p1 + rv.p2 : null;
    var titleText = n.title || (f.pr && f.pr.title) || f.branch || 'rapport', title = scramble(titleText);
    var date = new Date(d.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var stats = el('div', { class: 'kpis' }, [
      stat('fichiers', (f.files || []).length, 'files', '', '#f-files'),
      stat('lignes', el('span', {}, [el('span', { class: 'c-ok' }, ['+', rolling(f.totals.add, 'add')]), ' ', el('span', { class: 'c-err' }, ['−', rolling(f.totals.del, 'del')])])),
      stat('commits', (f.commits || []).length, 'commits', '', '#f-commits'),
      stat('ci', f.ci ? f.ci.ok : 0, 'ciok', f.ci ? (f.ci.fail ? 'c-err' : f.ci.pending ? 'c-warn' : 'c-ok') : 'c-label', '#f-ci', f.ci ? '/ ' + f.ci.total : 'aucun check', f.ci ? (f.ci.fail ? 'err' : f.ci.pending ? 'warn' : 'ok') : null),
      stat('bloquants', blocking == null ? el('span', { class: 'c-label', text: '–' }) : blocking, 'blocking', blocking ? 'c-warn' : 'c-ok', '#f-review', rv ? 'passe ' + rv.pass : '', blocking == null ? null : blocking ? 'warn' : 'ok')
    ]);
    var body = el('div', { class: 'head-body' }, [
      el('p', { class: 'eyebrow', style: 'margin:0', text: date + ' · ' + (f.repo || '') + (f.issue ? ' · issue #' + f.issue : '') + ' · ' + plural((f.commits || []).length, 'commit') }),
      el('h1', { 'aria-label': titleText }, [title]),
      n.subtitle ? el('p', { class: 'serif', text: n.subtitle }) : null,
      el('div', { class: 'tags' }, statusTags(f)),
      el('div', { class: 'tags', style: 'margin-top:.5rem' }, langTags(f)),
      stats,
      el('div', { class: 'acts' }, [
        f.pr ? el('a', { class: 'btn btn-sm btn-primary', href: f.pr.url + '/files', target: '_blank', rel: 'noopener' }, [icon('pr'), 'fichiers de la pr']) : null,
        f.pr ? el('a', { class: 'btn btn-sm btn-outline', href: f.pr.url, target: '_blank', rel: 'noopener' }, ['pr #' + f.pr.number, icon('ext')]) : null,
        el('a', { class: 'btn btn-sm btn-outline', href: zed(f.repoPath), title: f.repoPath }, [icon('folder'), 'worktree dans zed']),
        el('button', { class: 'btn btn-sm btn-outline', type: 'button', onclick: function () { copy('cd ' + shq(f.repoPath), 'commande cd copiée'); } }, [icon('terminal'), 'copier cd'])
      ])
    ]);
    var kids = [el('div', { class: 'card head-card' }, [(f.files || []).length ? cover(f) : null, body])];
    var ag = agentCard(f); if (ag) kids.push(ag);
    var sec = el('section', { class: 'panel', id: 'top', 'data-key': 'top', 'aria-label': 'en-tête' }, kids);
    sec.scrambleEl = title;
    return sec;
  }
  // ================= mode plan =================
  var PST = { done: ['fait', 'c-ok'], review: ['en review', 'c-info'], wip: ['en cours', 'c-accent'], blocked: ['bloqué', 'c-err'], todo: ['à faire', 'c-label'] };
  function planCounts(f) { var c = { done: 0, review: 0, wip: 0, blocked: 0, todo: 0 }; (f.issues || []).forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; }); return c; }
  function planHero(d) {
    var f = d.facts, n = d.notes || {}, is = f.issues || [], c = planCounts(f);
    var titleText = n.title || 'plan ' + f.plan, title = scramble(titleText);
    var date = new Date(d.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var body = el('div', { class: 'head-body' }, [
      el('p', { class: 'eyebrow', style: 'margin:0', text: date + ' · ' + (f.repo || f.repoPath || 'hors dépôt') + ' · plan ' + f.plan + (is.length ? ' · ' + plural(is.length, 'issue') : '') }),
      el('h1', { 'aria-label': titleText }, [title]),
      n.subtitle ? el('p', { class: 'serif', text: n.subtitle }) : null,
      is.length ? el('div', { class: 'tags' }, Object.keys(PST).filter(function (k) { return c[k]; }).map(function (k) { return tag(c[k] + ' ' + ({ done: 'faite', blocked: 'bloquée' }[k] ? { done: 'faite', blocked: 'bloquée' }[k] + (c[k] > 1 ? 's' : '') : PST[k][0]), PST[k][1], true, { href: '#f-issues' }); })) : null,
      is.length ? el('div', { class: 'kpis' }, [stat('issues', is.length, 'pi', '', '#f-issues'), stat('faites', c.done, 'pd', c.done ? 'c-ok' : 'c-label', '#f-issues', '/ ' + is.length, c.done === is.length ? 'ok' : null),
        stat('en review', c.review, 'pr', c.review ? 'c-info' : 'c-label', '#f-issues'), stat('en cours', c.wip, 'pw', c.wip ? 'c-accent' : 'c-label', '#f-issues'),
        stat('bloquées', c.blocked, 'pb', c.blocked ? 'c-err' : 'c-label', '#f-issues', '', c.blocked ? 'err' : null)]) : null,
      f.repoPath ? el('div', { class: 'acts' }, [el('a', { class: 'btn btn-sm btn-outline', href: zed(f.repoPath), title: f.repoPath }, [icon('folder'), 'dépôt dans zed']),
        f.repo ? el('a', { class: 'btn btn-sm btn-outline', href: 'https://github.com/' + f.repo + '/issues', target: '_blank', rel: 'noopener' }, ['issues', icon('ext')]) : null]) : null
    ]);
    var sec = el('section', { class: 'panel', id: 'top', 'data-key': 'top', 'aria-label': 'en-tête' }, [el('div', { class: 'card head-card' }, [body])]);
    sec.scrambleEl = title;
    return sec;
  }
  // le graphe vient des faits, jamais d'un mermaid écrit par le modèle : il serait faux dès la première issue fermée
  function dagSource(is) {
    var known = {}; is.forEach(function (r) { known[r.n] = true; });
    var lines = ['flowchart LR'];
    is.forEach(function (r) { var t = String(r.title || '').replace(/"/g, '#quot;'); lines.push('  i' + r.n + '["#' + r.n + (t ? ' · ' + (t.length > 38 ? t.slice(0, 37) + '…' : t) : '') + '"]:::' + r.status); });
    is.forEach(function (r) { (r.deps || []).forEach(function (dd) { if (!known[dd]) lines.push('  i' + dd + '["#' + dd + '"]:::ext'); known[dd] = true; lines.push('  i' + dd + ' --> i' + r.n); }); });
    return lines.join('\n');
  }
  function issuesBlock(d, num) {
    var f = d.facts, is = f.issues || [];
    if (!is.length) return panel('f-issues', num, 'Issues', { body: [el('div', { class: 'card' }, [el('div', { class: 'empty hatched' }, [f.repoPath ? 'aucune issue suivie : ajouter ' : 'plan hors dépôt : pas d\'issues GitHub. Dans un dépôt, ajouter ', el('code', { text: '"issues": [{ "n": 23, "deps": [] }]' }), ' à notes.json.'])])] });
    var byN = {}; is.forEach(function (r) { byN[r.n] = r; });
    // carte qui a changé de colonne depuis le dernier rendu : surlignée, c'est le « live » du kanban
    var moved = {}; S.issueSt = S.issueSt || {}; is.forEach(function (r) { if (S.issueSt[r.n] && S.issueSt[r.n] !== r.status) moved[r.n] = true; S.issueSt[r.n] = r.status; });
    var depLinks = function (r) { return (r.deps || []).map(function (dd) { var x = byN[dd]; return el('a', { href: x && x.url ? x.url : gh('issues/' + dd) || '#', target: '_blank', rel: 'noopener', class: x && x.status === 'done' ? 'c-ok' : 'c-warn', text: '#' + dd }); }); };
    var prTag = function (p) { return p ? tag('pr #' + p.number + ' · ' + String(p.isDraft ? 'draft' : p.state).toLowerCase(), p.state === 'MERGED' ? 'c-special' : p.state === 'CLOSED' ? 'c-err' : 'c-ok', true, { href: p.url, target: '_blank', rel: 'noopener' }) : null; };
    var ciTag = function (p) { return p && p.ci ? tag('ci ' + p.ci.ok + '/' + p.ci.total + (p.ci.fail ? ' · ' + p.ci.fail + ' ko' : ''), p.ci.fail ? 'c-err' : p.ci.pending ? 'c-warn' : 'c-ok', true) : null; };
    var COLS = ['todo', 'blocked', 'wip', 'review', 'done'];
    var kanban = el('div', { class: 'kanban' }, COLS.map(function (k) {
      var cards = is.filter(function (r) { return (PST[r.status] ? r.status : 'todo') === k; });
      return el('div', { class: 'kcol' }, [el('div', { class: 'khead' }, [tag(PST[k][0], PST[k][1], true), el('span', { class: 'eyebrow', text: String(cards.length) })])].concat(cards.length ? cards.map(function (r) {
        var deps = depLinks(r);
        return el('div', { class: 'kcard' + (moved[r.n] ? ' moved' : ''), title: r.title }, [
          el('div', { class: 'kn' }, [r.url ? el('a', { href: r.url, target: '_blank', rel: 'noopener', class: PST[k][1], text: '#' + r.n }) : el('span', { class: PST[k][1], text: '#' + r.n }),
            r.report ? ibtn('rapport', { href: r.report }) : null]),
          el('div', { class: 'kt', text: r.title || 'issue #' + r.n }),
          deps.length ? el('div', { class: 'ks' }, ['après '].concat(deps.reduce(function (a, x, i) { return a.concat(i ? [', ', x] : [x]); }, []))) : null,
          r.pr || (r.worktree && r.worktree.agents && r.worktree.agents.length) ? el('div', { class: 'ktags' }, [prTag(r.pr), ciTag(r.pr), r.worktree && (r.worktree.agents || []).some(function (a) { return a.freshness === 'active'; }) ? tag('agent actif', 'c-accent', true) : null]) : null]);
      }) : [el('div', { class: 'kempty', text: '—' })]));
    }));
    var list = el('div', { class: 'list' }, is.map(function (r) {
      var st = PST[r.status] || PST.todo, p = r.pr, w = r.worktree;
      var ci = ciTag(p);
      var deps = depLinks(r);
      return el('div', { class: 'row issue', id: 'issue-' + r.n }, [
        el('span', { class: 'icon-box ' + st[1], title: st[0], text: '#' + r.n }),
        el('div', { class: 'main' }, [el('div', { class: 't' }, [r.url ? el('a', { href: r.url, target: '_blank', rel: 'noopener', text: r.title || 'issue #' + r.n }) : (r.title || 'issue #' + r.n)]),
          el('div', { class: 's' }, [tag(st[0], st[1], true), deps.length ? el('span', { class: 'c-label' }, [' après '].concat(deps.reduce(function (a, x, i) { return a.concat(i ? [', ', x] : [x]); }, []))) : null,
            w ? el('span', { class: 'path', title: w.path, text: ' · ' + w.branch }) : null,
            w && w.agents && w.agents.length ? el('span', { class: 'c-label', title: w.agents.map(function (a) { return a.name || a.kind; }).join('\n'), text: ' · ' + w.agents.map(function (a) { var nm = String(a.name || a.kind); return (nm.length > 24 ? nm.slice(0, 23) + '…' : nm) + (a.freshness === 'active' ? ' (actif)' : ''); }).join(', ') }) : null])]),
        el('span', { class: 'end' }, [
          prTag(p), ci,
          r.report ? ibtn('rapport', { href: r.report, title: 'rapport me:report de la branche' }) : null,
          w ? ibtn('zed', { href: zed(w.path), title: w.path }) : null,
          w ? ibtn('cd', { icon: 'copy', copy: 'cd ' + shq(w.path), toast: 'commande cd copiée' }) : null])]);
    }));
    // trois vues du même état ; le graphe n'est construit que visible (mermaid mesure mal un nœud caché)
    var view = ls(S.key + ':iv') || 'kanban', slot = el('div');
    var show = function (v) {
      view = v; ls(S.key + ':iv', v); slot.textContent = '';
      if (v === 'graphe') { slot.appendChild(el('div', { class: 'dag' }, [figure(dagSource(is), 'dépendances')])); if (slot.isConnected) drawDiagrams(slot); } // au premier rendu, render() dessine une fois le bloc en place
      else slot.appendChild(el('div', { class: 'card' }, [v === 'kanban' ? kanban : list]));
      Array.prototype.forEach.call(seg.querySelectorAll('.segment'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); });
    };
    var seg = inkify(el('div', { class: 'segmented', role: 'group', 'aria-label': 'vue des issues' }, ['kanban', 'graphe', 'liste'].map(function (v) { return el('button', { class: 'segment', type: 'button', 'data-v': v, 'aria-pressed': String(v === view), onclick: function () { show(v); } }, [v]); })));
    show(view);
    return panel('f-issues', num, 'Issues', { sub: plural(is.length, 'issue') + ' · état relu par collect.py', acts: [seg], body: [slot],
      foot: 'live : une carte qui change de colonne s\'allume · graphe : flèche = « doit être fini avant », couleur = état' });
  }
  function agentCard(f) {
    var as = f.agents || [];
    if (!as.length) return null;
    return el('div', { class: 'card agents' }, [el('div', { class: 'eyebrow', style: 'padding:.6rem .85rem 0', text: 'agent sur la tâche' })].concat(as.map(function (a) {
      var mono = a.monocode, active = a.freshness === 'active' && Date.now() - (a.lastActivity || 0) < AGENT_IDLE_MS;
      var initials = String(a.name || a.id).replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
      return el('div', { class: 'agent' }, [
        el('div', { class: 'avatar', text: initials }, [el('span', { class: 'live' + (active ? '' : ' paused'), 'data-agent-at': a.lastActivity || 0, title: 'gwm : ' + a.freshness + ' à la collecte' })]),
        el('div', { class: 'agent-head' }, [el('b', { text: a.name || String(a.id).slice(0, 8) }),
          el('span', { class: 'c-label', text: [a.kind, a.model, a.effort].filter(Boolean).join(' · ') }),
          a.lastActivity ? el('span', { class: 'c-label', 'data-rel': new Date(a.lastActivity).toISOString(), text: '· ' + rel(new Date(a.lastActivity).toISOString()) }) : null,
          el('span', { class: 'acts' }, [
            mono ? tag(mono.attached ? 'monocode : ce worktree' : 'monocode : ' + String(mono.cwd).split('/').pop(), mono.attached ? 'c-ok' : 'c-warn', true, { title: (mono.title || '') + ' · ' + mono.cwd + (mono.attached ? '' : ' : Monocode suit la session sur le checkout principal') }) : null,
            a.transcript ? ibtn('transcript', { href: zed(a.transcript), title: a.transcript }) : null,
            ibtn('id', { icon: 'copy', copy: a.id, toast: 'id de session copié' })])]),
        a.lastTool ? el('div', { class: 'agent-line' }, [el('span', { class: 'eyebrow', text: 'dernière action' }), el('span', {}, [el('code', { text: a.lastTool.name }), ' ', a.lastTool.what, ' ', el('span', { class: 'c-label', 'data-rel': a.lastTool.at, text: rel(a.lastTool.at) })])]) : null,
        a.lastText ? el('div', { class: 'agent-line' }, [el('span', { class: 'eyebrow', text: 'dernier message' }), el('span', { class: 'q' }, [inlineMd(a.lastText)])]) : null,
        a.mission ? el('details', { class: 'agent-line' }, [el('summary', { class: 'eyebrow', text: 'mission' }), el('div', { class: 'mission', text: a.mission })]) : null
      ]);
    })));
  }

  // ================= récit (prose) =================
  function proseBlock(s, num, d, srcIndex, qaIn) {
    var stale = (d.facts.stale || []).indexOf(s.id) >= 0, title = scramble(s.title || s.id);
    var kids = [el('div', { class: 'prose-head' }, [el('span', { class: 'num', 'aria-hidden': 'true', text: String(num).padStart(2, '0') }), el('h2', { 'aria-label': s.title || s.id }, [title]),
      el('div', { class: 'acts' }, [el('span', { class: 'tag c-accent upd', text: 'mis à jour' }), stale ? tag('en retard', 'c-warn', true, { title: 'des fichiers de cette section ont changé depuis basedOn' }) : null,
        ibtn('', { icon: 'hash', title: 'copier le lien', onclick: function () { copy(location.href.split('#')[0] + '#n-' + s.id, 'lien copié'); } })])])];
    if (s.body) kids.push(callouts(el('div', { class: 'md', html: md(s.body, srcIndex) })));
    if (s.mermaid) kids.push(figure(s.mermaid, s.title));
    (qaIn || []).forEach(function (q) { kids.push(el('div', { class: 'panel', style: 'margin-top:1.25rem' }, [questionBox(q)])); });
    var sec = el('section', { class: 'prose', id: 'n-' + s.id, 'data-key': 'n-' + s.id, 'aria-label': s.title }, kids);
    sec.scrambleEl = title;
    return sec;
  }

  // ================= fichiers =================
  function commonDir(paths) {
    if (!paths.length) return '';
    var parts = paths[0].split('/').slice(0, -1);
    paths.forEach(function (p) { var q = p.split('/'); var i = 0; while (i < parts.length && parts[i] === q[i]) i++; parts = parts.slice(0, i); });
    return parts.length ? parts.join('/') + '/' : '';
  }
  function dstat(add, del) {
    var tot = (add || 0) + (del || 0), w = tot ? Math.max(8, Math.min(100, Math.log10(tot + 1) * 40)) : 0;
    return el('span', { class: 'dstat ticks', title: '+' + add + ' −' + del }, [el('i', { style: 'width:' + (tot ? w * (add || 0) / tot : 0) + '%;background:var(--ok)' }), el('i', { style: 'width:' + (tot ? w * (del || 0) / tot : 0) + '%;background:var(--err)' })]);
  }
  function filesBlock(d, num) {
    var f = d.facts, files = f.files || [], pre = commonDir(files.map(function (x) { return x.path; }));
    var counts = { all: files.length };
    files.forEach(function (x) { var s = x.status === 'C' ? 'R' : x.status; counts[s] = (counts[s] || 0) + 1; });
    var seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'filtrer par statut' });
    [['all', 'tous'], ['A', 'ajoutés'], ['M', 'modifiés'], ['D', 'supprimés'], ['R', 'renommés']].forEach(function (s) {
      if (s[0] !== 'all' && !counts[s[0]]) return;
      seg.appendChild(el('button', { class: 'segment', type: 'button', 'aria-pressed': String(S.filter.status === s[0]), onclick: function (ev) {
        S.filter.status = s[0]; Array.prototype.forEach.call(seg.querySelectorAll('.segment'), function (b) { b.setAttribute('aria-pressed', String(b === ev.currentTarget)); }); applyFilter(sec);
      } }, [s[1], el('span', { class: 'n', text: counts[s[0]] })]));
    });
    inkify(seg);
    var field = el('input', { class: 'field', type: 'search', placeholder: 'filtrer les fichiers', value: S.filter.q, 'aria-label': 'filtrer les fichiers (/)', oninput: function (ev) { S.filter.q = ev.target.value; applyFilter(sec); } });
    var list = el('div', { class: 'files' }), groups = {};
    files.forEach(function (x) { var rest = x.path.slice(pre.length), i = rest.lastIndexOf('/'); (groups[i >= 0 ? rest.slice(0, i) : ''] = groups[i >= 0 ? rest.slice(0, i) : ''] || []).push(x); });
    Object.keys(groups).sort().forEach(function (dir) {
      list.appendChild(el('div', { class: 'dir path', 'data-dir': dir }, [icon('folder'), (dir || '.') + '/']));
      groups[dir].sort(function (a, b) { return a.path < b.path ? -1 : 1; }).forEach(function (x) { list.appendChild(fileEntry(x, f)); });
    });
    stagger(list);
    var body = files.length ? [el('div', { class: 'card' }, [el('div', { class: 'files-tools' }, [field, pre ? el('span', { class: 'path', title: 'préfixe commun', text: pre }) : null]), list])]
      : [el('div', { class: 'card' }, [el('div', { class: 'empty hatched', text: 'aucun fichier modifié par rapport à ' + f.base })])];
    var sec = panel('f-files', num, 'Fichiers', { sub: 'git diff ' + f.base + '...HEAD', acts: files.length > 3 ? [seg] : [], body: body,
      foot: plural(files.length, 'fichier') + ' · +' + f.totals.add + ' −' + f.totals.del + ' · clic = diff coloré · numéro de ligne ou symbole = Zed' });
    UI.filesField = field;
    applyFilter(sec);
    Object.keys(S.openDiffs).forEach(function (p) { var row = sec.querySelector('.frow[data-path="' + CSS.escape(p) + '"]'); if (row) toggleDiff(row, true, true); });
    return sec;
  }
  // ================= aperçus avant / après (images, PDF, markdown), repris de Changes et History de Herdr =================
  function fileOf(p) { return ((S.cur.facts || {}).files || []).filter(function (x) { return x.path === p; })[0]; }
  function sizeStr(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : n >= 1024 ? (n / 1024).toFixed(1).replace('.', ',') + ' Ko' : n + ' o'; }
  function previewBlock(x) {
    var pv = x.preview;
    if (pv.kind === 'md') return mdPreview(x);
    var sides = [['avant', pv.before], ['après', pv.after]].filter(function (s) { return s[1]; }), delta = el('div', { class: 'pv-delta' });
    var upd = function () {
      var b = pv.before, a = pv.after; delta.textContent = ''; if (!b || !a) return;
      if (b.w && a.w && (b.w !== a.w || b.h !== a.h)) delta.appendChild(el('span', { text: b.w + '×' + b.h + ' → ' + a.w + '×' + a.h }));
      var d = a.size - b.size; delta.appendChild(el('span', { class: d > 0 ? 'c-err' : d < 0 ? 'c-ok' : 'c-label', text: (d > 0 ? '+' : d < 0 ? '−' : '±') + sizeStr(Math.abs(d)) }));
    };
    var cards = sides.map(function (s, i) {
      var o = s[1], meta = el('span', { class: 'pv-meta', text: (o.skipped ? 'trop lourd pour l\'aperçu · ' : '') + sizeStr(o.size) }), stage;
      if (o.skipped) stage = el('div', { class: 'pv-stage' }, [el('span', { class: 'c-label', text: '—' })]);
      else if (pv.kind === 'image') stage = el('button', { class: 'pv-stage checker', type: 'button', title: 'ouvrir en grand', onclick: function () { mediaViewer(x, i); } }, [
        el('img', { src: o.src, alt: s[0] + ' : ' + x.path, draggable: 'false', onload: function (ev) { o.w = ev.target.naturalWidth; o.h = ev.target.naturalHeight; meta.textContent = (o.w ? o.w + '×' + o.h + ' · ' : '') + sizeStr(o.size); upd(); } })]);
      else stage = el('div', { class: 'pv-stage doc' }, [el('iframe', { src: o.src + '#view=FitH', title: s[0] + ' : ' + x.path })]);
      return el('figure', { class: 'pv-side' }, [el('figcaption', {}, [el('span', { class: 'eyebrow', text: s[0] }), o.skipped ? null : ibtn('en grand', { icon: 'expand', onclick: function () { mediaViewer(x, i); } })]), stage, meta]);
    });
    upd();
    return el('div', { class: 'pv' }, [el('div', { class: 'pv-grid' }, cards), delta]);
  }
  // plein écran façon kt-viewer : ajusté, molette et pinch de 10 à 800 %, glisser, ← → avant / après, comparer côte à côte
  function mediaViewer(x, idx) {
    var pv = x.preview, sides = [['Avant', pv.before], ['Après', pv.after]].filter(function (s) { return s[1] && !s[1].skipped; });
    if (!sides.length) return;
    var i = Math.max(0, Math.min(idx, sides.length - 1)), cmp = false, img = null, z = null;
    var body = el('div', { class: 'v-body' }), zl = el('span', { class: 'zoom', text: '100 %' });
    var opts = sides.map(function (s, k) { return [String(k), s[0]]; }); if (pv.kind === 'image' && sides.length === 2) opts.push(['cmp', 'comparer']);
    var seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'version' }, opts.map(function (o) {
      return el('button', { class: 'segment', type: 'button', 'data-v': o[0], 'aria-pressed': String(o[0] === String(i)), onclick: function () { if (o[0] === 'cmp') cmp = true; else { cmp = false; i = +o[0]; } draw(); } }, [o[1]]);
    }));
    function fit() {
      if (!img || cmp) return;
      var r = body.getBoundingClientRect(), w = img.naturalWidth || 400, h = img.naturalHeight || 300;
      img.style.width = w + 'px'; img.style.height = h + 'px';
      var k = Math.max(0.1, Math.min(8, Math.min(r.width / w, r.height / h) * 0.92)); z.set(k, (r.width - w * k) / 2, (r.height - h * k) / 2);
    }
    function real() { if (!img || cmp) return; var r = body.getBoundingClientRect(); z.set(1, (r.width - img.naturalWidth) / 2, (r.height - img.naturalHeight) / 2); }
    function draw() {
      body.textContent = ''; body.classList.toggle('pv-compare', cmp); img = null;
      Array.prototype.forEach.call(seg.querySelectorAll('.segment'), function (b) { var v = b.getAttribute('data-v'); b.setAttribute('aria-pressed', String(cmp ? v === 'cmp' : v === String(i))); });
      if (pv.kind === 'pdf') { body.appendChild(el('iframe', { class: 'pv-frame', src: sides[i][1].src, title: sides[i][0] + ' : ' + x.path })); return; }
      if (cmp) { sides.forEach(function (s) { body.appendChild(el('figure', { class: 'pv-cmp' }, [el('figcaption', { class: 'eyebrow' }, [s[0] + ' · ', el('span', { class: 'pv-size', text: sizeStr(s[1].size) })]), el('div', { class: 'pv-cmp-stage checker' }, [el('img', { src: s[1].src, draggable: 'false', alt: s[0] + ' : ' + x.path })])])); }); return; }
      img = el('img', { src: sides[i][1].src, draggable: 'false', alt: sides[i][0] + ' : ' + x.path });
      body.appendChild(img);
      body.appendChild(el('div', { class: 'v-hint', text: (sides.length > 1 ? '← → avant / après · c comparer · ' : '') + 'molette = zoom · glisser = déplacer · 0 ajuster · 1 = 100 % · échap' }));
      z = zoomable(body, img, true, function (k) { zl.textContent = Math.round(k * 100) + ' %'; });
      if (img.complete && img.naturalWidth) requestAnimationFrame(fit); else img.addEventListener('load', fit);
    }
    var zoomCtl = pv.kind === 'image' ? [ibtn('', { icon: 'zoomout', title: 'dézoomer (−)', onclick: function () { if (z && !cmp) z.zout(); } }), zl, ibtn('', { icon: 'zoomin', title: 'zoomer (+)', onclick: function () { if (z && !cmp) z.zin(); } }),
      ibtn('ajuster', { icon: 'fit', title: 'ajuster à l\'écran (0)', onclick: fit }), ibtn('100 %', { title: 'taille réelle (1)', onclick: real })] : [];
    viewer(x.path, (opts.length > 1 ? [inkify(seg)] : []).concat(zoomCtl, [ibtn('zed', { href: zed(absOf(x.path)) })]), body, function (ev) {
      if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && sides.length > 1) { cmp = false; i = ev.key === 'ArrowLeft' ? 0 : sides.length - 1; draw(); return true; }
      if (ev.key === 'c' && opts.length > 2) { cmp = !cmp; draw(); return true; }
      if (pv.kind !== 'image' || cmp || !z) return false;
      if (ev.key === '+' || ev.key === '=') z.zin(); else if (ev.key === '-') z.zout(); else if (ev.key === '0') fit(); else if (ev.key === '1') real(); else return false;
      return true;
    });
    draw();
  }
  // markdown du dépôt : rendu dans une iframe sandbox (aucun script), aux couleurs de la page
  function mdFrame(text) {
    var cs = getComputedStyle(document.documentElement), v = function (n) { return cs.getPropertyValue(n).trim(); };
    var css = 'body{margin:0;padding:14px 18px;background:' + v('--card-bg') + ';color:' + v('--text') + ';font:15px/1.65 ' + v('--font-sans') + '}h1,h2,h3,h4{color:' + v('--text-hi') + ';font-weight:500;line-height:1.3}a{color:' + v('--accent-text') + '}'
      + 'code,pre{font-family:' + v('--font-code') + ';font-size:12.5px}pre{padding:10px 12px;border-radius:10px;overflow:auto;background:' + v('--panel-bg') + '}:not(pre)>code{padding:1px 5px;border-radius:5px;background:' + v('--panel-bg') + '}'
      + 'table{border-collapse:collapse}td,th{border:1px solid ' + v('--panel-border') + ';padding:4px 8px}blockquote{margin:0;padding-left:12px;border-left:2px solid ' + v('--accent') + ';color:' + v('--label') + '}img{max-width:100%}hr{border:0;border-top:1px solid ' + v('--panel-border') + '}';
    var html = window.marked ? window.marked.parse(String(text)) : '<pre>' + String(text).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</pre>';
    var f = el('iframe', { class: 'pv-docframe', sandbox: '', title: 'aperçu du document', srcdoc: '<!doctype html><meta charset="utf-8"><style>' + css + '</style>' + html });
    f._text = text; return f;
  }
  function mdPreview(x) {
    var pv = x.preview, sides = [['après', 'after'], ['avant', 'before']].filter(function (s) { return pv[s[1]]; }), cur = sides[0][1];
    var slot = el('div', { class: 'pv-md' }), cap = el('span', { class: 'eyebrow' });
    var draw = function () { cap.textContent = ''; cap.appendChild(document.createTextNode('document rendu · ')); cap.appendChild(el('span', { class: 'pv-size', text: sizeStr(pv[cur].size) })); loadDocs(function () { var t = ((S.docs || {})[x.path] || {})[cur]; slot.textContent = ''; slot.appendChild(t == null ? el('p', { class: 'c-label', text: 'aperçu indisponible' }) : mdFrame(t)); }); };
    var seg = sides.length > 1 ? inkify(el('div', { class: 'segmented', role: 'group', 'aria-label': 'version' }, sides.map(function (s) {
      return el('button', { class: 'segment', type: 'button', 'aria-pressed': String(s[1] === cur), onclick: function (ev) { cur = s[1]; Array.prototype.forEach.call(ev.currentTarget.parentNode.querySelectorAll('.segment'), function (b) { b.setAttribute('aria-pressed', String(b === ev.currentTarget)); }); draw(); } }, [s[0]]);
    }))) : null;
    draw();
    return el('div', { class: 'pv' }, [el('div', { class: 'pv-head' }, [cap, seg]), slot]);
  }
  function fileEntry(x, f) {
    var abs = f.repoPath + '/' + x.path, base = x.path.slice(x.path.lastIndexOf('/') + 1);
    var ghHref = f.pr ? f.pr.url + '/files#diff-' + x.anchor : gh('blob/' + f.head + '/' + x.path + (x.line ? '#L' + x.line : ''));
    var row = el('div', { class: 'frow row', tabindex: '0', role: 'button', 'aria-expanded': 'false', 'data-path': x.path, 'data-status': x.status === 'C' ? 'R' : x.status, title: x.path,
      onclick: function () { toggleDiff(row); }, onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleDiff(row); } } }, [
      el('span', { class: 'chev', 'aria-hidden': 'true' }, [icon('chev')]),
      el('span', { class: 'icon-box s-' + x.status, text: x.status }),
      el('span', { class: 'name' }, [x.old ? el('span', { class: 'old', text: x.old.slice(x.old.lastIndexOf('/') + 1) + ' → ' }) : null, base]),
      el('span', { class: 'stat' }, [dstat(x.add, x.del), el('span', { class: 'c-ok', text: '+' + (x.add == null ? '–' : x.add) }), el('span', { class: 'c-err', text: '−' + (x.del == null ? '–' : x.del) })]),
      (function () { var a = x.status !== 'D' ? openers(abs, x.line, ghHref) : el('span', { class: 'acts' }, [ghHref ? ibtn('github', { href: ghHref, cls: 'gh' }) : null]); a.appendChild(ibtn('', { icon: 'expand', title: 'diff en grand, côte à côte', onclick: function () { diffViewer(x.path); } })); return a; })()
    ]);
    var wrap = el('div', { class: 'diffwrap expand' }, [el('div', { class: 'expand-content' })]);
    wrap.firstChild.inert = true; row.wrap = wrap;
    return el('div', { class: 'fentry', 'data-path': x.path }, [row, wrap]);
  }
  function openFile(path) {
    S.filter.q = ''; S.filter.status = 'all';
    var sec = document.getElementById('f-files'); if (!sec) return;
    if (sec.hasAttribute('data-folded')) fold(sec, true);
    applyFilter(sec);
    var row = sec.querySelector('.frow[data-path="' + CSS.escape(path) + '"]'); if (!row) return;
    if (row.getAttribute('aria-expanded') !== 'true') toggleDiff(row);
    row.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }
  function applyFilter(sec) {
    var q = S.filter.q.trim().toLowerCase(), st = S.filter.status;
    Array.prototype.forEach.call(sec.querySelectorAll('.fentry'), function (e) { e.hidden = !((st === 'all' || e.firstChild.getAttribute('data-status') === st) && (!q || e.getAttribute('data-path').toLowerCase().indexOf(q) >= 0)); });
    Array.prototype.forEach.call(sec.querySelectorAll('.dir'), function (dEl) { var n = dEl.nextElementSibling, any = false; while (n && !n.classList.contains('dir')) { if (!n.hidden) any = true; n = n.nextElementSibling; } dEl.hidden = !any; });
  }
  // diffs.js et docs.js : chargés au premier dépli, rechargés quand la collecte a changé (rev)
  function lazyData(name, cb) {
    if (S[name] && S[name + 'Rev'] === S.cur.rev) return cb();
    var s = document.createElement('script');
    s.src = name + '.js?t=' + Date.now();
    s.onload = function () { S[name] = window['__' + name] || {}; S[name + 'Rev'] = S.cur.rev; s.remove(); cb(); };
    s.onerror = function () { S[name] = {}; s.remove(); cb(); };
    document.head.appendChild(s);
  }
  function loadDiffs(cb) { lazyData('diffs', cb); }
  function loadDocs(cb) { lazyData('docs', cb); }
  function toggleDiff(row, open, instant) {
    var path = row.getAttribute('data-path'), wrap = row.wrap;
    var willOpen = open != null ? open : row.getAttribute('aria-expanded') !== 'true';
    row.setAttribute('aria-expanded', String(willOpen)); row.classList.toggle('on', willOpen);
    if (!willOpen) { delete S.openDiffs[path]; setExpand(wrap, false); return; }
    S.openDiffs[path] = true;
    loadDiffs(function () {
      var c = wrap.firstChild;
      if (!c.firstChild) {
        var patch = (S.diffs || {})[path], fx = fileOf(path), binary = !!patch && /^Binary files /m.test(patch);
        if (fx && fx.preview) c.appendChild(previewBlock(fx));
        // image binaire ou PDF : l'aperçu suffit (le « texte » d'un PDF n'est pas un diff lisible)
        if (fx && fx.preview && (binary || !patch || fx.preview.kind === 'pdf')) patch = null;
      }
      if (patch) {
        var holder = el('div', { class: 'pdiff' });
        c.appendChild(holder); c.appendChild(patchView(path, patch));
        var cutN = (window.__diffsCut || {})[path];
        c.appendChild(el('div', { class: 'diff-hint' }, [cutN ? el('span', { class: 'c-warn' }, [plural(cutN, 'hunk') + ' de plus non affiché' + (cutN > 1 ? 's' : '') + ' : ', el('a', { href: zed(absOf(path)), text: 'ouvrir le fichier' })]) : null,
          el('span', {}, [el('span', { class: 'hl', text: 'numéro de ligne' }), ' → Zed à cette ligne']),
          el('span', {}, [el('span', { class: 'hl', text: 'symbole' }), ' → Zed à la position exacte (son LSP : hover, définition, références)'])]));
        pierreRender(holder, path, patch);
      } else if (!c.firstChild) c.appendChild(patchView(path, null));
      if (instant) wrap.style.setProperty('--expand-duration', '0ms');
      requestAnimationFrame(function () { setExpand(wrap, true); });
    });
  }
  // rendu simple, immédiat et hors ligne ; remplacé par @pierre/diffs dès qu'il est prêt
  function patchView(path, patch) {
    var box = el('div', { class: 'patch' });
    if (!patch) { box.appendChild(el('div', { class: 'cap', text: 'diff indisponible (binaire, ou au-delà du plafond de diffs.js)' })); return box; }
    var abs = absOf(path), tb = el('tbody'), o = 0, n = 0, inHunk = false;
    patch.split('\n').forEach(function (l) {
      var m = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
      if (m) { o = +m[1]; n = +m[2]; inHunk = true; tb.appendChild(el('tr', { class: 'h' }, [el('td', { colspan: '3' }, [l.slice(0, l.indexOf('@@', 2) + 2), el('span', { class: 'c-label', text: m[3] }), el('a', { href: zed(abs, n), text: 'ouvrir L' + n })])])); return; }
      if (!inHunk || l.charAt(0) === '…') { if (/^(new|deleted) file|^rename|^Binary|^…/.test(l)) tb.appendChild(el('tr', { class: 'meta' }, [el('td', { colspan: '3', text: l })])); return; }
      var ch = l.charAt(0), cls = ch === '+' ? 'a' : ch === '-' ? 'd' : ch === '\\' ? 'meta' : '';
      var ol = ch === '+' || ch === '\\' ? '' : o++, nl = ch === '-' || ch === '\\' ? '' : n++;
      tb.appendChild(el('tr', { class: cls }, [el('td', { class: 'ln', text: ol }), el('td', { class: 'ln', text: nl }), el('td', { class: 'code', text: l || ' ' })]));
    });
    box.appendChild(el('table', {}, [tb]));
    return box;
  }
  var pierreP = null, ZT = window.__zedThemes || null;
  function pierreOptions(path, extra) {
    var abs = absOf(path), f = S.cur.facts;
    return Object.assign({
      // thème de Zed s'il est trouvé (collect.py → zed-theme.js) : moteur tree-sitter « highlights », mêmes captures que Zed
      theme: ZT ? { dark: ZT.dark.name, light: ZT.light.name } : { dark: 'pierre-dark', light: 'pierre-light' }, preferredHighlighter: ZT ? 'highlights' : undefined, themeType: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
      diffStyle: 'unified', overflow: 'scroll', disableFileHeader: true, lineDiffType: 'word',
      // calque « unsafe » de Pierre : il passe après son thème, seul endroit où la palette de la page l'emporte
      unsafeCSS: ':host{--diffs-dark-bg:var(--pd-dark-bg);--diffs-light-bg:var(--pd-light-bg);--diffs-dark-addition-color:var(--pd-dark-add);--diffs-dark-deletion-color:var(--pd-dark-del);--diffs-light-addition-color:var(--pd-light-add);--diffs-light-deletion-color:var(--pd-light-del)}',
      onLineNumberClick: function (p) { if (p && p.lineNumber) openUrl(p.side === 'deletions' ? gh('blob/' + f.base + '/' + path + '#L' + p.lineNumber) : zed(abs, p.lineNumber)); },
      onTokenClick: function (p, ev) { if (ev) ev.stopPropagation(); symbolPop(p, path); },
      enableGutterUtility: true,
      onGutterUtilityClick: function (range) { startAnn(path, range); },
      renderAnnotation: function (a) { return renderAnn(a); }
    }, extra || {});
  }
  function symbolPop(p, path) {
    var f = S.cur.facts, abs = absOf(path), old = p.side === 'deletions', col = (p.lineCharStart || 0) + 1, sym = String(p.tokenText || '').trim();
    var acts = old ? [ibtn('version de base', { icon: 'ext', href: gh('blob/' + f.base + '/' + path + '#L' + p.lineNumber) })]
      : [ibtn('zed : définition, références', { href: zed(abs, p.lineNumber, col), title: 'Zed ouvre ' + path + ':' + p.lineNumber + ':' + col + ' ; son LSP fait le reste' }),
        ibtn('nvim', { copy: 'nvim +' + p.lineNumber + ' ' + shq(abs), toast: 'commande nvim copiée' })];
    acts.push(ibtn('git grep', { icon: 'copy', copy: 'git grep -n ' + shq(sym), toast: 'git grep copié' }));
    popAt(p.tokenElement || UI.main, [el('span', { class: 'eyebrow', text: (old ? 'ligne supprimée · ' : 'symbole · ') + path.split('/').pop() + ':' + p.lineNumber + ':' + col }),
      el('div', { class: 't' }, [el('code', { text: sym })]), el('div', { class: 'acts' }, acts)]);
  }
  function pierreRender(holder, path, patch, extra) {
    if (!pierreP) pierreP = import(PIERRE).then(function (mod) {
      if (ZT) ['dark', 'light'].forEach(function (m) { var t = ZT[m]; if (t.theme) mod.registerCustomTheme(t.name, function () { return Promise.resolve(t.theme); }, 'zed'); });
      return mod;
    });
    pierreP.then(function (mod) {
      var parsed = mod.parsePatchFiles(patch), fd = parsed && parsed[0] && parsed[0].files && parsed[0].files[0];
      if (!fd || !holder.isConnected) return;
      var inst = new mod.FileDiff(pierreOptions(path, extra));
      inst.render({ fileDiff: fd, containerWrapper: holder, lineAnnotations: annsFor(path) });
      S.pierre.push({ inst: inst, path: path, holder: holder, extra: extra });
      var tries = 0, ready = function () {
        var c = holder.querySelector('diffs-container'), r = c && (c.shadowRoot || c);
        if (r && r.querySelector('[data-line], pre, code')) holder.setAttribute('data-ready', '');
        else if (++tries < 200) setTimeout(ready, 100); // premier chargement du colorieur : jusqu'à ~10 s en file://
      };
      ready();
    }).catch(function (e) { console.warn('@pierre/diffs indisponible, rendu simple gardé', e); });
  }
  function pierreTheme() {
    S.pierre = S.pierre.filter(function (p) { return p.holder.isConnected; });
    S.pierre.forEach(function (p) { try { p.inst.setOptions(pierreOptions(p.path, p.extra)); p.inst.rerender(); } catch (e) {} });
  }

  // ================= commits, ci, review =================
  var EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;
  function commitsBlock(d, num) {
    var f = d.facts, cs = f.commits || [];
    var rows = cs.map(function (c) {
      var m = c.subject.match(EMOJI), em = m ? m[1] : '•', subj = m ? c.subject.slice(m[0].length) : c.subject, href = gh('commit/' + c.sha);
      return el(href ? 'a' : 'div', { class: 'lrow row', href: href, target: href ? '_blank' : null, rel: href ? 'noopener' : null, title: c.subject }, [
        el('span', { class: 'icon-box', text: em }), el('div', { class: 'main' }, [el('div', { class: 't' }, [inlineMd(subj)]), el('div', { class: 's', text: c.short + ' · ' + rel(c.date) })]),
        el('span', { class: 'end' }, [icon('ext')])]);
    });
    return panel('f-commits', num, 'Commits', { sub: plural(cs.length, 'commit') + ' depuis ' + f.base, body: [el('div', { class: 'card' }, rows.length ? [stagger(el('div', { class: 'list' }, rows))] : [el('div', { class: 'empty hatched', text: 'aucun commit depuis ' + f.base })])] });
  }
  function ciBlock(d, num) {
    var f = d.facts, c = f.ci, inner;
    if (!c) inner = [el('div', { class: 'empty hatched' }, [el('b', { text: f.pushed ? 'aucun check' : 'HEAD non poussé' }), f.pushed ? ' sur ' + f.headShort : ' : la CI se lit sur le sha exact, poussé.'])];
    else inner = [el('div', { class: 'meter ticks', title: c.ok + ' ok · ' + c.fail + ' ko · ' + c.pending + ' en cours' }, [el('i', { style: 'width:' + 100 * c.ok / c.total + '%;background:var(--ok)' }), el('i', { style: 'width:' + 100 * c.fail / c.total + '%;background:var(--err)' }), el('i', { style: 'width:' + 100 * c.pending / c.total + '%;background:var(--warn)' })]),
      stagger(el('div', { class: 'list' }, c.runs.map(function (x) {
        return el(x.url ? 'a' : 'div', { class: 'lrow row', href: x.url, target: x.url ? '_blank' : null, rel: 'noopener' }, [tag(x.state, x.state === 'ok' ? 'c-ok' : x.state === 'ko' ? 'c-err' : 'c-warn', true), el('div', { class: 'main' }, [el('div', { class: 't', text: x.name })]), x.url ? el('span', { class: 'end' }, ['logs', icon('ext')]) : null]);
      })))];
    return panel('f-ci', num, 'CI', { sub: 'sha exact ' + f.headShort, body: [el('div', { class: 'card' }, inner)] });
  }
  var PRIO = { P0: 'c-err', P1: 'c-warn', P2: 'c-info', P3: 'c-label' };
  function axisCell(a) {
    if (!a) return tag('absent', 'c-label');
    if (a.state === 'ok') { var b = a.p0 + a.p1 + a.p2; return tag(b ? plural(b, 'bloquant') + (a.p3 ? ' · ' + a.p3 + ' nit' : '') : 'propre' + (a.p3 ? ' · ' + a.p3 + ' nit' : ''), b ? (a.p0 ? 'c-err' : 'c-warn') : 'c-ok', true, { title: 'P0 ' + a.p0 + ' · P1 ' + a.p1 + ' · P2 ' + a.p2 + ' · P3 ' + a.p3 }); }
    return tag(a.state, a.state === 'non lancé' ? 'c-warn' : 'c-err', true, { title: a.state === 'non exécuté' ? 'rapport sans ligne RESUME chiffrée : cet axe n\'a pas tourné, ce n\'est pas un zéro' : 'axe non lancé' });
  }
  function words(t) { return String(t || '').toLowerCase().replace(/[`'’]/g, ' ').split(/[^a-zà-ÿ0-9_]+/).filter(function (w) { return w.length > 3; }); }
  // même fichier et titres proches : le « même » finding d'une passe à l'autre (rapprochement approximatif, dit comme tel)
  function similar(a, b) { if (String(a.loc).split(':')[0] !== String(b.loc).split(':')[0]) return false; var wa = words(a.title), wb = words(b.title); return wa.filter(function (w) { return wb.indexOf(w) >= 0; }).length / Math.max(1, Math.min(wa.length, wb.length)) >= 0.4; }
  function blocking(x) { return x.prio !== 'P3'; }
  function passPanel(r, k, select) {
    var ps = r.passes, p = ps[k - 1], prev = ps[k - 2], fs = r.findings || [];
    var cur = fs.filter(function (x) { return x.pass === k; }), before = fs.filter(function (x) { return x.pass === k - 1; });
    var b = p.p0 + p.p1 + p.p2, pb = prev ? prev.p0 + prev.p1 + prev.p2 : null;
    var verdict = !prev ? ['première passe', 'c-info'] : b < pb ? ['converge', 'c-ok'] : b === pb ? ['stagne', 'c-warn'] : ['remonte', 'c-err'];
    var changes = [];
    if (prev) changes.push(['mod', 'bloquants ' + pb + ' → ' + b]);
    var fixedPrev = before.filter(function (x) { return x.status === 'fixed'; }), discPrev = before.filter(function (x) { return x.status === 'discarded'; });
    if (fixedPrev.length) changes.push(['del', plural(fixedPrev.length, 'finding') + ' de la passe ' + (k - 1) + ' corrigé' + (fixedPrev.length > 1 ? 's' : '') + ' (' + fixedPrev.map(function (x) { return String(x.ref).slice(0, 7); }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(', ') + ')']);
    if (discPrev.length) changes.push(['del', plural(discPrev.length, 'finding') + ' écarté' + (discPrev.length > 1 ? 's' : '') + ' avec raison']);
    var fresh = cur.filter(blocking).filter(function (x) { return !before.some(function (y) { return similar(x, y); }); });
    var still = cur.filter(blocking).filter(function (x) { return before.some(function (y) { return similar(x, y); }); });
    if (prev && fresh.length) changes.push(['add', fresh.length + ' bloquant' + (fresh.length > 1 ? 's nouveaux' : ' nouveau')]);
    if (prev && still.length) changes.push(['mod', plural(still.length, 'bloquant') + ' déjà vu' + (still.length > 1 ? 's' : '') + ' à la passe ' + (k - 1)]);
    if (!prev) changes.push(['add', plural(cur.filter(blocking).length, 'bloquant') + ', ' + plural(cur.length - cur.filter(blocking).length, 'nit')]);
    return el('div', { class: 'step-panel' }, [
      el('div', { class: 'sp-head' }, [el('span', { class: 'eyebrow', text: 'passe ' + k + ' / ' + ps.length + (p.sha ? ' · ' + p.sha : '') }), tag(verdict[0], verdict[1], true)]),
      el('h3', { text: k === ps.length ? 'Dernière passe : ' + plural(b, 'bloquant') : 'Passe ' + k + ' : ' + plural(b, 'bloquant') }),
      el('div', { class: 'sp-kpis' }, (r.axes || ['standards', 'spec']).map(function (a) { return axisCell(p[a]); })),
      el('div', { class: 'eyebrow', style: 'margin-top:.6rem', text: prev ? 'ce qui a changé depuis la passe ' + (k - 1) : 'ce que la passe a trouvé' }),
      el('div', { class: 'changes' }, changes.map(function (c) { return el('div', { class: 'ch ' + c[0] }, [el('span', { class: 'm', text: c[0] === 'add' ? '+' : c[0] === 'del' ? '−' : '~' }), el('span', { text: c[1] })]); })),
      prev ? el('div', { class: 'path', style: 'margin-top:.35rem', text: 'rapprochement d\'une passe à l\'autre : même fichier, titre proche' }) : null,
      el('div', { class: 'sp-nav' }, [
        el('button', { class: 'btn btn-sm btn-outline', type: 'button', disabled: k === 1, onclick: function () { select(k - 1); } }, ['← passe ' + Math.max(1, k - 1)]),
        el('button', { class: 'btn btn-sm btn-outline', type: 'button', onclick: function () { select(null); } }, ['vue globale']),
        k < ps.length ? el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: function () { select(k + 1); } }, ['passe ' + (k + 1), icon('chev')]) : null])
    ]);
  }
  function reviewBlock(d, num) {
    var f = d.facts, r = curReview(f), inner = [], acts = [], axes = (r && r.axes) || ['standards', 'spec'];
    if (!r || !r.passes || !r.passes.length) return panel('f-review', num, 'Review', { body: [el('div', { class: 'card' }, [el('div', { class: 'empty hatched' }, [el('b', { text: 'aucune passe enregistrée. ' }), 'Le loop de review copie ses rapports (', el('code', { text: 'review/pass-N-*.md' }), ') à côté de ce rapport ; la section se remplit pendant qu\'il tourne.'])])] });
    var ps = r.passes, fs = r.findings || [], last = ps[ps.length - 1].pass;
    if (S.rpass && S.rpass > ps.length) S.rpass = null;
    var max = Math.max.apply(null, ps.map(function (p) { return p.p0 + p.p1 + p.p2 + p.p3; }).concat([1]));
    var chart = el('div', { class: 'passes' }, [el('div', { class: 'pass eyebrow' }, [el('span', { text: 'passe' }), el('span', { text: 'P0 · P1 · P2 · P3' }), el('span', { text: axes.join(' · ') })])].concat(ps.map(function (p) {
      var seg = function (n, c, t) { return n ? el('i', { class: 'ticks', style: 'width:' + 100 * n / max + '%;background:' + c, title: n + ' ' + t }) : null; };
      return el('div', { class: 'pass', style: 'cursor:pointer', onclick: function () { select(p.pass); } }, [el('span', {}, [el('span', { class: 'eyebrow', text: 'passe ' + p.pass }), p.sha ? el('div', { class: 'path', text: p.sha }) : null]),
        el('div', { class: 'bars' }, [seg(p.p0, 'var(--err)', 'P0'), seg(p.p1, 'var(--warn)', 'P1'), seg(p.p2, 'var(--info)', 'P2'), seg(p.p3, 'var(--label)', 'P3 (nits)')]),
        el('span', { class: 'axes' }, axes.map(function (a) { return axisCell(p[a]); }))]);
    })));
    // frise des passes (In this lesson) : « toutes » puis 1…N
    var stepper = el('div', { class: 'stepper', role: 'tablist', 'aria-label': 'passes de review' }, [el('button', { class: 'st all', type: 'button', role: 'tab', 'data-k': '', onclick: function () { select(null); } }, [el('span', { class: 'dot', text: 'toutes' }), el('span', { text: 'vue globale' })])].concat(ps.map(function (p) {
      var b = p.p0 + p.p1 + p.p2;
      return el('button', { class: 'st', type: 'button', role: 'tab', 'data-k': p.pass, title: 'passe ' + p.pass + ' : ' + plural(b, 'bloquant'), onclick: function () { select(p.pass); } }, [el('span', { class: 'dot', text: p.pass }), el('span', { text: 'passe ' + p.pass }), el('span', { class: 'sub', text: plural(b, 'bloquant') })]);
    })));
    var detail = el('div');
    var shown = function (x) { return (S.rpass ? x.pass === S.rpass : true) && (S.axis === 'all' || x.axis === S.axis) && (S.nits || x.prio !== 'P3'); };
    var list = el('div', { class: 'list' });
    var draw = function () { Array.prototype.forEach.call(list.children, function (rw) { rw.hidden = !shown(rw.finding); }); };
    function select(k) {
      S.rpass = k;
      Array.prototype.forEach.call(stepper.children, function (b) { var bk = +b.getAttribute('data-k') || null; b.classList.toggle('on', bk === k); b.classList.toggle('done', !!k && !!bk && bk < k); b.setAttribute('aria-selected', String(bk === k)); });
      detail.textContent = ''; if (k) detail.appendChild(passPanel(r, k, select));
      chart.hidden = !!k; draw();
    }
    UI.reviewSelect = select;
    var seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'axe' });
    [['all', 'tous']].concat(axes.map(function (a) { return [a, a]; })).forEach(function (a) {
      seg.appendChild(el('button', { class: 'segment', type: 'button', 'aria-pressed': String(S.axis === a[0]), onclick: function (ev) { S.axis = a[0]; Array.prototype.forEach.call(seg.querySelectorAll('.segment'), function (b) { b.setAttribute('aria-pressed', String(b === ev.currentTarget)); }); draw(); } },
        [a[1], el('span', { class: 'n', text: fs.filter(function (x) { return a[0] === 'all' || x.axis === a[0]; }).length })]));
    });
    var nits = fs.filter(function (x) { return x.prio === 'P3'; }).length;
    if (r.orphans && r.orphans.length) acts.unshift(tag(plural(r.orphans.length, 'décision') + ' sans finding', 'c-err', true, { title: 'decisions.tsv cite ' + r.orphans.join(', ') + ' : rangs qui ne correspondent à aucune puce des rapports' }));
    if (fs.length && axes.length > 1) acts.push(inkify(seg));
    if (f.review && f.reviewCodex) acts.unshift(inkify(el('div', { class: 'segmented', role: 'group', 'aria-label': 'reviewer' }, [['claude', 'claude'], ['codex', 'codex']].map(function (w) {
      return el('button', { class: 'segment', type: 'button', 'aria-pressed': String(r === f[w[0] === 'codex' ? 'reviewCodex' : 'review']), onclick: function () { useReviewer(w[0]); } }, [w[1], el('span', { class: 'n', text: f[w[0] === 'codex' ? 'reviewCodex' : 'review'].passes.length })]);
    }))));
    if (nits) acts.push(el('div', { class: 'segmented' }, [el('button', { class: 'segment', type: 'button', 'aria-pressed': String(S.nits), title: 'afficher les nits P3 (non bloquants)', onclick: function (ev) { S.nits = !S.nits; ev.currentTarget.setAttribute('aria-pressed', String(S.nits)); draw(); } }, ['nits', el('span', { class: 'n', text: nits })])]));
    fs.slice().sort(function (a, b) { return (b.pass - a.pass) || (a.prio < b.prio ? -1 : a.prio > b.prio ? 1 : 0); }).forEach(function (x) {
      var loc = String(x.loc || ''), m = loc.match(/^(.*?):(\d+)/), file = m ? m[1] : loc, line = m ? +m[2] : null;
      var st = x.status === 'fixed' ? tag('corrigé' + (x.ref ? ' ' + String(x.ref).slice(0, 7) : ''), 'c-ok', true, x.ref ? { href: gh('commit/' + x.ref), target: '_blank', rel: 'noopener' } : null)
        : x.status === 'discarded' ? tag(x.ref ? 'écarté' : 'écarté sans raison', x.ref ? 'c-special' : 'c-err', true, { title: x.ref || 'raison manquante' })
        : x.pass < last ? tag('absent de la passe ' + last, 'c-label', true) : tag('ouvert', 'c-warn', true);
      var rw = el('div', { class: 'finding row', 'data-axis': x.axis, 'data-id': x.id, tabindex: '0', role: 'button', 'aria-expanded': 'false', onclick: function () { rw.setAttribute('aria-expanded', String(rw.getAttribute('aria-expanded') !== 'true')); }, onkeydown: function (ev) { if (ev.key === 'Enter') rw.click(); } }, [
        el('span', { class: 'icon-box ' + PRIO[x.prio], text: x.prio }),
        el('div', { class: 'main' }, [el('div', { class: 't' }, [inlineMd(x.title)]), el('div', { class: 'detail' }, [inlineMd(x.detail)]), el('div', { class: 's' }, [x.axis + ' · passe ' + x.pass + ' · ', el('span', { class: 'path', text: loc })])]),
        el('span', { class: 'end' }, [file ? openers(absOf(file), line) : null, st])]);
      rw.finding = x; list.appendChild(rw);
    });
    inner.push(chart, stepper, detail, fs.length ? list : el('div', { class: 'empty', text: 'aucun finding : les deux axes sont propres.' }));
    select(S.rpass || null);
    var lp = ps[ps.length - 1];
    return panel('f-review', num, 'Review', { sub: plural(ps.length, 'passe') + (lp.sha ? ' · dernière sur ' + lp.sha : ''), acts: acts, body: [el('div', { class: 'card' }, inner)], foot: 'frise = passe par passe (← → au clavier) · clic sur un finding = son explication' });
  }
  function goFinding(x) {
    useReviewer(x.axis === 'codex' ? 'codex' : 'claude'); goTo('f-review'); if (UI.reviewSelect) UI.reviewSelect(x.pass);
    setTimeout(function () { var rw = document.querySelector('.finding[data-id="' + CSS.escape(x.id) + '"]'); if (rw) { if (rw.hidden) { S.axis = 'all'; S.nits = true; if (UI.reviewSelect) UI.reviewSelect(x.pass); } rw.setAttribute('aria-expanded', 'true'); rw.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } }, 350);
  }

  // ================= questions =================
  function qaState() { return ls(S.key + ':qa') || {}; }
  function qaSave(k, v) { var st = qaState(); st[k] = v; ls(S.key + ':qa', st); renderAside(); renderDock(); }
  function questions() { return (S.cur.notes && S.cur.notes.questions) || []; }
  function answerOf(q) { var st = qaState(); return (st[q.id + '_free'] || '').trim() || ((q.options || []).filter(function (o) { return o.id === st[q.id]; })[0] || {}).label || ''; }
  function qaAnswered() { return questions().filter(function (q) { return answerOf(q); }).length; }
  function qaText() {
    var d = S.cur, st = qaState();
    var parts = questions().map(function (q) { var fr = (st[q.id + '_free'] || '').trim(); return q.id + '=' + (fr ? JSON.stringify(fr) : (st[q.id] || '?')); });
    var note = (st.note || '').trim();
    return (d.kind === 'plan' ? 'plan ' + (d.facts.repo ? d.facts.repo + ':' : '') + d.facts.plan : 'rapport ' + d.facts.repo + (d.facts.pr ? '#' + d.facts.pr.number : '@' + d.facts.branch)) + ' · ' + parts.join(' ') + (note ? ' · note: ' + note : '');
  }
  function hasHerdr() { return window.herdr && typeof window.herdr.send === 'function'; }
  // la review complète : réponses + annotations, en un envoi
  function reviewText() { var t = questions().length ? qaText() : ''; var a = anns().length ? annText() : ''; return [t, a].filter(Boolean).join('\n\n'); }
  function sendAnswers() {
    var t = reviewText(); if (!t) return toast('rien à envoyer pour l\'instant');
    if (hasHerdr() && window.herdr.send(t, { doc: S.cur.facts.repo + '@' + S.cur.facts.branch, answers: qaState(), annotations: anns() })) toast('envoyé à l\'agent');
    else copy(t, 'review copiée, à coller à Claude');
  }
  function questionBox(q) {
    var st = qaState();
    var box = el('div', { class: 'card qa', id: 'q-' + q.id }, [el('h3', { text: q.title }), q.why ? el('p', { class: 'why', text: q.why }) : null]);
    var opts = el('div', { class: 'opts', role: 'radiogroup', 'aria-label': q.title });
    (q.options || []).forEach(function (o) {
      opts.appendChild(el('label', { class: 'opt' }, [el('input', { type: 'radio', name: 'q-' + q.id, value: o.id, checked: st[q.id] === o.id, onchange: function () { qaSave(q.id, o.id); } }), el('span', { class: 'radio', 'aria-hidden': 'true' }),
        el('div', {}, [el('b', { text: o.label }), o.reco ? tag('recommandé', 'c-accent') : null, o.why ? el('small', { text: o.why }) : null])]));
    });
    box.appendChild(opts);
    box.appendChild(el('input', { class: 'field free', placeholder: 'autre réponse (remplace le choix)', value: st[q.id + '_free'] || '', oninput: function (ev) { qaSave(q.id + '_free', ev.target.value); } }));
    return box;
  }
  // formulaire pas à pas quand il y a plusieurs questions (frise + précédente / suivante)
  function qaBlock(d, num, rest) {
    var st = qaState(), inner = [];
    if (rest.length > 1) {
      var i = Math.min(S.qstep || 0, rest.length - 1), slot = el('div'), steps = el('div', { class: 'stepper', role: 'tablist' });
      var show = function (k) {
        i = S.qstep = k; slot.textContent = '';
        Array.prototype.forEach.call(steps.children, function (b, j) { b.classList.toggle('on', j === k); b.classList.toggle('done', !!answerOf(rest[j])); });
        slot.appendChild(questionBox(rest[k]));
        slot.appendChild(el('div', { class: 'sp-nav', style: 'padding:0 1.1rem 1rem' }, [
          el('button', { class: 'btn btn-sm btn-outline', type: 'button', disabled: k === 0, onclick: function () { show(k - 1); } }, ['← précédente']),
          k < rest.length - 1 ? el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: function () { show(k + 1); } }, ['question ' + (k + 2) + ' / ' + rest.length, icon('chev')])
            : el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: sendAnswers }, [icon(hasHerdr() ? 'send' : 'copy'), hasHerdr() ? 'envoyer' : 'copier pour Claude'])]));
      };
      rest.forEach(function (q, j) { steps.appendChild(el('button', { class: 'st', type: 'button', role: 'tab', onclick: function () { show(j); } }, [el('span', { class: 'dot', text: j + 1 }), el('span', { text: 'question ' + (j + 1) })])); });
      var tick = function () { Array.prototype.forEach.call(steps.children, function (b, j) { b.classList.toggle('done', !!answerOf(rest[j]) && j !== i); }); };
      slot.addEventListener('change', tick); slot.addEventListener('input', tick); // la pastille se coche dès la réponse
      inner.push(el('div', { class: 'card qa-stepper' }, [steps, slot])); show(i);
    } else inner = rest.map(function (q) { return questionBox(q); });
    inner.push(el('div', { class: 'card qa' }, [el('h3', { text: 'Autre proposition ou remarque' }), el('textarea', { class: 'field', placeholder: 'facultatif', oninput: function (ev) { qaSave('note', ev.target.value); } }, [st.note || ''])]));
    return panel('qa', num, rest.length ? 'Questions' : 'Vos réponses', { body: inner, foot: 'réponses gardées dans la page · récap à gauche · envoyées avec les annotations',
      footActs: [el('div', { style: 'display:flex;gap:.4rem' }, [
        el('button', { class: 'btn btn-sm btn-outline', type: 'button', onclick: previewReview }, ['aperçu']),
        el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: sendAnswers }, [icon(hasHerdr() ? 'send' : 'copy'), hasHerdr() ? 'envoyer à l\'agent' : 'copier pour Claude'])])] });
  }
  function previewReview() {
    var cmd = ghReviewCmd();
    openOverlay(el('div', { class: 'panel', style: 'width:min(52rem,100%)' }, [el('div', { class: 'p-head' }, [el('h2', { text: 'Ce qui sera envoyé' })]),
      el('div', { class: 'card', style: 'padding:1rem 1.2rem' }, [el('pre', { style: 'margin:0;white-space:pre-wrap;font:12.5px/1.6 var(--font-code);color:var(--text-hi)', text: reviewText() || 'rien pour l\'instant' })]),
      cmd ? el('div', { class: 'card', style: 'padding:1rem 1.2rem' }, [el('div', { class: 'eyebrow', text: 'publier les annotations sur la PR (à lancer toi-même)' }), el('pre', { style: 'margin:.6rem 0 0;white-space:pre-wrap;font:12px/1.55 var(--font-code)', text: cmd }), el('div', { style: 'margin-top:.6rem' }, [ibtn('copier la commande gh', { icon: 'copy', copy: cmd, toast: 'commande gh copiée' })])]) : null]));
  }

  // ================= annotations de diff (gouttière « + » de @pierre/diffs) =================
  function anns() { return ls(S.key + ':ann') || []; }
  function annsFor(path) {
    var d = S.draft && S.draft.path === path ? S.draft : null;
    return anns().filter(function (a) { return a.path === path && !(d && d.id === a.id); }).concat(d ? [d] : []).map(function (a) { return { side: a.side, lineNumber: a.line, metadata: a }; });
  }
  function syncAnns() { S.pierre = S.pierre.filter(function (p) { return p.holder.isConnected; }); S.pierre.forEach(function (p) { try { p.inst.setLineAnnotations(annsFor(p.path)); p.inst.rerender(); } catch (e) {} }); } // setLineAnnotations ne fait que préparer : rerender() dessine
  function saveAnns(list) { ls(S.key + ':ann', list); S.draft = null; syncAnns(); renderAside(); renderDock(); }
  function startAnn(path, range) {
    if (!range) return;
    var side = range.endSide || range.side || 'additions', start = Math.min(range.start, range.end), end = Math.max(range.start, range.end);
    S.draft = { id: 'a' + Date.now().toString(36), path: path, side: side, line: end, start: start !== end ? start : null, text: '', draft: true, head: S.cur.facts.head };
    syncAnns();
  }
  function annText() {
    var f = S.cur.facts, l = anns();
    return 'annotations ' + f.repo + (f.pr ? '#' + f.pr.number : '@' + f.branch) + ' · ' + plural(l.length, 'annotation') + '\n' + l.map(function (a) {
      return '- ' + a.path + ':' + (a.start ? a.start + '-' : '') + a.line + (a.side === 'deletions' ? ' (côté supprimé)' : '') + ' : ' + String(a.text).replace(/\s*\n\s*/g, ' ');
    }).join('\n');
  }
  // commande gh qui publie une review COMMENT sur la PR, ancrée au sha relu ; jamais lancée par la page
  // une commande par sha : chaque annotation est ancrée au diff sur lequel elle a été écrite
  function ghReviewCmd() {
    var f = S.cur.facts, l = anns(); if (!f.pr || !f.repo || !l.length) return null;
    var by = {}; l.forEach(function (a) { var h = a.head || f.head; (by[h] = by[h] || []).push(a); });
    return Object.keys(by).map(function (h) {
      var body = { commit_id: h, event: 'COMMENT', body: 'Review depuis me:report (' + plural(by[h].length, 'annotation') + ')', comments: by[h].map(function (a) {
        var c = { path: a.path, line: a.line, side: a.side === 'deletions' ? 'LEFT' : 'RIGHT', body: a.text }; if (a.start) { c.start_line = a.start; c.start_side = c.side; } return c; }) };
      return (h !== f.head ? '# annotations faites sur ' + h.slice(0, 7) + ' : le diff a bougé depuis, vérifier les lignes\n' : '') + 'gh api repos/' + f.repo + '/pulls/' + f.pr.number + "/reviews --method POST --input - <<'JSON'\n" + JSON.stringify(body, null, 2) + '\nJSON';
    }).join('\n\n');
  }
  function stale(a) { return a.head && S.cur && a.head !== S.cur.facts.head; }
  // rendu d'une annotation dans le shadow DOM de Pierre : styles en ligne, variables héritées de la page
  function renderAnn(a) {
    var m = a.metadata || {}, box = 'margin:6px 12px 10px 60px;padding:10px 12px;border:1px solid var(--accent);border-radius:12px;background:var(--card-bg);color:var(--text);font:13px/1.55 Inter,system-ui,sans-serif;white-space:normal;max-width:46rem';
    var btn = function (label, primary, fn) { return el('button', { type: 'button', style: 'font:500 12px/1 Inter,system-ui,sans-serif;height:28px;padding:0 12px;border-radius:999px;cursor:pointer;' + (primary ? 'border:1px solid var(--accent-fill);background:var(--accent-fill);color:var(--on-accent)' : 'border:1px solid var(--control-border);background:transparent;color:var(--text-hi)'), onclick: function (ev) { ev.stopPropagation(); fn(); } }, [label]); };
    var where = (m.start ? 'lignes ' + m.start + '-' + m.line : 'ligne ' + m.line) + (m.side === 'deletions' ? ' · côté supprimé' : '') + (stale(m) ? ' · faite sur ' + String(m.head).slice(0, 7) + ', le diff a bougé' : '');
    if (m.draft) {
      var ta = el('textarea', { rows: '3', placeholder: 'ton commentaire sur cette ligne', style: 'width:100%;margin:6px 0 8px;padding:8px 10px;border:1px solid var(--control-border);border-radius:10px;background:var(--panel-bg);color:var(--text-hi);font:13px/1.5 Inter,system-ui,sans-serif;resize:vertical',
        onkeydown: function (ev) { ev.stopPropagation(); if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) save(); if (ev.key === 'Escape') cancel(); } });
      ta.value = m.text || '';
      var save = function () { var t = ta.value.trim(); if (!t) return cancel(); var l = anns().filter(function (x) { return x.id !== m.id; }); l.push({ id: m.id, path: m.path, side: m.side, line: m.line, start: m.start, text: t, at: new Date().toISOString(), head: m.head || S.cur.facts.head }); saveAnns(l); toast('annotation enregistrée'); };
      var cancel = function () { S.draft = null; syncAnns(); };
      setTimeout(function () { ta.focus(); }, 30);
      return el('div', { style: box }, [el('div', { style: 'font:500 10.5px/1 Monaspace Krypton,ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--label)', text: 'annotation · ' + where }), ta,
        el('div', { style: 'display:flex;gap:6px;align-items:center' }, [btn('enregistrer', true, save), btn('annuler', false, cancel), el('span', { style: 'margin-left:auto;font:11px Monaspace Krypton,ui-monospace,monospace;color:var(--label)', text: '⌘↵ enregistrer · échap annuler' })])]);
    }
    return el('div', { style: box }, [el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px' }, [
      el('span', { style: 'font:500 10.5px/1 Monaspace Krypton,ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-text)', text: 'annotation · ' + where }),
      el('span', { style: 'margin-left:auto;display:flex;gap:6px' }, [btn('modifier', false, function () { S.draft = Object.assign({}, m, { draft: true }); syncAnns(); }), btn('supprimer', false, function () { saveAnns(anns().filter(function (x) { return x.id !== m.id; })); })])]),
      el('div', { style: 'white-space:pre-wrap;color:var(--text-hi)', text: m.text })]);
  }

  // ================= sources =================
  function sourcesBlock(d, num) {
    var srcs = (d.notes && d.notes.sources) || [], secs = ((d.notes && d.notes.sections) || []).filter(function (s) { return s && s.id; });
    var rows = srcs.map(function (s, i) {
      var cited = secs.filter(function (sec) { return String(sec.body || '').indexOf('[^' + s.id + ']') >= 0; }), acts = [];
      if (s.path) { var abs = absOf(s.path); acts.push(ibtn('zed', { href: zed(abs, s.line) }), ibtn('nvim', { copy: nvim(abs, s.line), toast: 'commande nvim copiée' }), ibtn('', { icon: 'copy', copy: abs + (s.line ? ':' + s.line : ''), toast: 'chemin copié', title: 'copier le chemin' })); }
      if (s.href) acts.push(ibtn('ouvrir', { icon: 'ext', href: s.href }));
      return el('div', { class: 'src row', id: 'src-' + s.id }, [el('span', { class: 'icon-box', text: i + 1 }),
        el('div', { class: 'main' }, [el('div', { class: 't', text: s.label || s.id }), el('div', { class: 's' }, [(s.kind || 'source') + ' · ' + (s.path ? s.path + (s.line ? ':' + s.line : '') : (s.href || '').replace(/^https?:\/\//, ''))].concat(cited.length ? [' · cité dans '] : []).concat(cited.map(function (c, j) { return el('a', { href: '#n-' + c.id, text: (j ? ', ' : '') + (c.title || c.id) }); })))]),
        el('span', { class: 'acts' }, acts)]);
    });
    return panel('src', num, 'Sources', { sub: plural(srcs.length, 'source'), body: [el('div', { class: 'card' }, [stagger(el('div', { class: 'srcs' }, rows))])] });
  }

  // ================= assemblage =================
  var FACTS = { files: filesBlock, commits: commitsBlock, review: reviewBlock, ci: ciBlock, issues: issuesBlock };
  var GROUPS = [['synthèse', 'synth'], ['code', 'code'], ['qualité', 'qual'], ['suite', 'suite']];
  function blocks(d) {
    var n = d.notes || {}, secs = (n.sections || []).filter(Boolean), qs = n.questions || [], out = [], num = 0, F = d.facts;
    var srcIndex = {}; (n.sources || []).forEach(function (s, i) { srcIndex[s.id] = { n: i + 1, label: s.label }; });
    var placed = {}; secs.forEach(function (s) { if (s.fact) placed[s.fact] = true; });
    // un plan sans issues suivies (hors dépôt, ou plan d'idées) n'a pas de bloc issues
    var order = [], plan = d.kind === 'plan', first = plan ? ((F.issues || []).length ? 'issues' : null) : 'files';
    secs.forEach(function (s, i) { order.push(s); if (i === 0 && first && !placed[first]) order.push({ fact: first }); });
    if (!secs.length && first) order.push({ fact: first });
    if (!plan) ['commits', 'ci', 'review'].forEach(function (k) { if (!placed[k]) order.push({ fact: k }); });
    var qaIn = {}, rest = [];
    qs.forEach(function (q) { if (q.in && secs.some(function (s) { return s.id === q.in; })) (qaIn[q.in] = qaIn[q.in] || []).push(q); else rest.push(q); });
    if (plan) out.push({ key: 'top', title: 'En-tête', group: 'synth', sig: [F.issues, n.title, n.subtitle, F.repoPath, F.plan], build: function () { return planHero(d); } });
    else out.push({ key: 'top', title: 'En-tête', group: 'synth', sig: [F.branch, F.base, F.pr, F.head, F.pushed, F.dirty, F.totals, F.ci, F.review && F.review.passes, F.reviewCodex && F.reviewCodex.passes, F.stale, n.title, n.subtitle, F.repoPath, F.agents, (F.files || []).length, (F.commits || []).length], build: function () { return heroBlock(d); } });
    var group = 'synth';
    order.forEach(function (s) {
      if (s.fact && FACTS[s.fact]) {
        var k = s.fact, nn = ++num; group = k === 'files' || k === 'commits' || k === 'issues' ? 'code' : 'qual';
        out.push({ key: 'f-' + k, title: { files: 'Fichiers', commits: 'Commits', ci: 'CI', review: 'Review', issues: 'Issues' }[k], fact: k, group: group, sig: [nn, F[k], k === 'files' ? [F.repoPath, F.pr, F.head, F.totals] : k === 'review' ? F.reviewCodex : 0, F.base, F.pushed, F.headShort, F.repo], build: function () { return FACTS[k](d, nn); } });
      } else if (s.id) {
        var m = ++num, g = group === 'qual' ? 'suite' : group;
        out.push({ key: 'n-' + s.id, title: s.title || s.id, prose: true, group: g, stale: (F.stale || []).indexOf(s.id) >= 0, sig: [m, s, (F.stale || []).indexOf(s.id) >= 0, qaIn[s.id], n.sources, F.repoPath], build: function () { return proseBlock(s, m, d, srcIndex, qaIn[s.id]); } });
      }
    });
    if (qs.length) { var qn = ++num; out.push({ key: 'qa', title: rest.length ? 'Questions' : 'Vos réponses', qa: true, group: 'suite', sig: [qn, rest], build: function () { return qaBlock(d, qn, rest); } }); }
    if ((n.sources || []).length) { var sn = ++num; out.push({ key: 'src', title: 'Sources', group: 'suite', sig: [sn, n.sources, secs.map(function (s) { return s.body; }), F.repoPath], build: function () { return sourcesBlock(d, sn); } }); }
    return out;
  }

  // ================= coquille : décor, barre, sommaire, pastille =================
  // monogramme K de kbrdn.dev (components/ui/Logo.vue) : la barre suit currentColor, les pièces sont orange
  var LOGO = '<svg viewBox="0 0 96 96" overflow="visible"><svg width="96" height="96" overflow="hidden"><path class="bar" fill="currentColor" d="M62.83 1.17A4 4 0 0 1 65.66 0L86.34 0A4 4 0 0 1 89.17 6.83L6.83 89.17A4 4 0 0 1 0 86.34L0 65.66A4 4 0 0 1 1.17 62.83Z"/></svg>'
    + '<path class="tri" fill="#d4825d" d="M0 9.66A4 4 0 0 1 6.83 6.83L21.17 21.17A4 4 0 0 1 21.17 26.83L6.83 41.17A4 4 0 0 1 0 38.34Z"/>'
    + '<path class="leg" fill="#d4825d" d="M53.17 58.83A4 4 0 0 1 58.83 58.83L89.17 89.17A4 4 0 0 1 86.34 96L65.66 96A4 4 0 0 1 62.83 94.83L42.83 74.83A4 4 0 0 1 42.83 69.17Z"/></svg>';
  function buildShell() {
    root.textContent = '';
    var zl = el('div', { class: 'zone l' }), zr = el('div', { class: 'zone r' });
    UI.dither = el('canvas', { class: 'dither', 'aria-hidden': 'true' });
    UI.backdrop = el('div', { class: 'backdrop', 'aria-hidden': 'true' }, [UI.dither, zl, zr]);
    UI.navSeg = el('div', { class: 'segmented', role: 'navigation', 'aria-label': 'parties du rapport' }, GROUPS.map(function (g) {
      return el('button', { class: 'segment', type: 'button', 'data-group': g[1], 'aria-current': 'false', onclick: function () { var b = (S.blocks || []).filter(function (x) { return x.group === g[1]; })[0]; if (b) goTo(b.key); } }, [g[0]]);
    }));
    UI.brand = el('a', { class: 'brand', href: '#top' });
    var play = function () { var svg = UI.brand.querySelector('.mark svg'); if (svg) svg.classList.add('play'); };
    UI.brand.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') play(); }); UI.brand.addEventListener('focusin', play);
    UI.themeBtn = el('button', { class: 'icon-btn', type: 'button', title: 'thème (t)', 'aria-label': 'changer de thème', onclick: cycleTheme });
    UI.prBtn = el('a', { class: 'icon-btn', title: 'ouvrir la PR', 'aria-label': 'ouvrir la PR', target: '_blank', rel: 'noopener' }, [icon('pr')]);
    UI.live = el('span', { class: 'live' }); UI.msg = el('span', { class: 'msg' });
    var nav = el('div', { class: 'nav-wrap' }, [
      el('nav', { class: 'panel nav', 'aria-label': 'rapport' }, [UI.brand, el('span', { class: 'sep' }), UI.navSeg, el('span', { class: 'sep' }),
        el('div', { class: 'tools' }, [UI.prBtn, el('button', { class: 'icon-btn', type: 'button', title: 'raccourcis (?)', 'aria-label': 'raccourcis', onclick: keysHelp }, [icon('kbd')]), UI.themeBtn])]),
      el('div', { class: 'notch-row' }, [el('div', { class: 'notch', role: 'status' }, [UI.live, UI.msg])])]);
    UI.flow = el('div', { class: 'flow' });
    UI.main = el('main', { id: 'main' }, [UI.headSlot = el('div'), el('div', { class: 'cols' }, [UI.flow, UI.aside = el('aside', { class: 'aside', 'aria-label': 'sommaire' })])]);
    UI.footer = el('footer', { class: 'foot' });
    UI.dock = el('div', { class: 'dock' });
    root.appendChild(UI.backdrop); root.appendChild(nav);
    root.appendChild(el('div', { class: 'frame' }, [UI.main])); root.appendChild(UI.footer); root.appendChild(UI.dock);
    var kb = function (keys, label) { return el('span', {}, keys.map(function (k) { return el('kbd', { text: k }); }).concat([label])); };
    var kfiles = kb(['/'], 'fichiers'), kpass = kb(['←', '→'], 'passes'); kfiles.setAttribute('data-needs', 'f-files'); kpass.setAttribute('data-needs', 'f-review');
    root.appendChild(UI.keysBar = el('div', { class: 'keys-bar', 'aria-hidden': 'true' }, [kb(['j', 'k'], 'sections'), kb(['⌘', 'K'], 'chercher'), kfiles, kpass, kb(['t'], 'thème'), kb(['?'], 'aide')]));
    inkify(UI.navSeg);
    dither(UI.dither, { fade: 'down' });
    glowLoop(zl, zr);
    UI.spy = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.target.isConnected) { S.current = e.target.getAttribute('data-key'); markSide(); } }); }, { rootMargin: '-18% 0px -70% 0px' });
    UI.reveal = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; e.target.removeAttribute('data-hidden'); if (e.target.scrambleEl) e.target.scrambleEl.play(); UI.reveal.unobserve(e.target); });
    }, { rootMargin: '0px 0px -8% 0px' });
    window.addEventListener('scroll', progress, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('mouseover', function (ev) {
      var r = ev.target.closest && ev.target.closest('.md a.ref');
      if (r && r !== UI.popRef) showSourcePop(r); else if (!r && UI.popRef && UI.popRef.classList && UI.popRef.classList.contains('ref') && !(ev.target.closest && ev.target.closest('.pop'))) hidePop();
    });
    document.addEventListener('focusin', function (ev) { var r = ev.target.closest && ev.target.closest('.md a.ref'); if (r) showSourcePop(r); });
    // un clic dans un diff Pierre (shadow DOM) remonte ici retargeté sur son hôte : c'est lui qui vient d'ouvrir la carte
    document.addEventListener('click', function (ev) { if (UI.pop && !(ev.target.closest && (ev.target.closest('.pop') || ev.target.closest('.pdiff')))) hidePop(true); if (UI.dockPop && !(ev.target.closest && ev.target.closest('.dock'))) toggleDock(false); });
    setInterval(tick, 1000);
  }
  function glowLoop(zl, zr) {
    if (reduced()) return;
    setTimeout(function next() {
      if (document.visibilityState === 'visible') {
        var z = Math.random() < 0.5 ? zl : zr, g = el('span', { class: 'glow' + (Math.random() < 0.5 ? ' up' : ''), style: z === zl ? 'right:-1px' : 'left:-1px' });
        z.appendChild(g); g.addEventListener('animationend', function () { g.remove(); });
      }
      setTimeout(next, 7000 + Math.random() * 9000);
    }, 2500);
  }
  function renderNav() {
    var f = S.cur.facts, repo = S.cur.kind === 'plan' ? f.plan : String(f.repo || '').split('/').pop() || 'repo';
    UI.brand.textContent = '';
    var mark = el('span', { class: 'mark', 'aria-hidden': 'true' }); mark.innerHTML = LOGO; UI.brand.appendChild(mark);
    mark.firstChild.addEventListener('animationend', function (ev) { ev.currentTarget.classList.remove('play'); }); // l'animation va toujours au bout, comme sur kbrdn.dev
    var used = {}, keys = {}; (S.blocks || []).forEach(function (b) { used[b.group] = true; keys[b.key] = true; });
    if (UI.keysBar) Array.prototype.forEach.call(UI.keysBar.querySelectorAll('[data-needs]'), function (k) { k.hidden = !keys[k.getAttribute('data-needs')]; }); // pas de « / fichiers » sur un plan
    Array.prototype.forEach.call(UI.navSeg.children, function (b) { var g = b.getAttribute('data-group'); if (!g) return; b.hidden = !used[g]; if (g === 'code') b.firstChild.nodeValue = S.cur.kind === 'plan' ? 'issues' : 'code'; });
    UI.brand.appendChild(el('span', {}, [el('span', { class: 'who', text: S.cur.kind === 'plan' ? 'plan' : 'rapport' }), el('span', { class: 'at', text: '@' }), el('span', { class: 'repo', text: repo })]));
    if (f.pr) { UI.prBtn.hidden = false; UI.prBtn.href = f.pr.url; } else UI.prBtn.hidden = true;
    var th = ls('me-report:theme') || 'auto';
    UI.themeBtn.textContent = ''; UI.themeBtn.appendChild(icon(th === 'light' ? 'sun' : th === 'dark' ? 'moon' : 'auto'));
    UI.themeBtn.title = 'thème : ' + ({ auto: 'auto', light: 'clair', dark: 'sombre' })[th] + ' (t pour changer)';
  }
  function renderAside() {
    if (!UI.aside || !S.cur) return;
    var d = S.cur, f = d.facts, bs = S.blocks || [];
    var steps = el('div', { class: 'card steps' });
    bs.forEach(function (b, i) {
      var cnt = null, cls = '';
      if (b.fact === 'files') cnt = (f.files || []).length;
      else if (b.fact === 'issues') { var pc = planCounts(f); cnt = pc.done + '/' + (f.issues || []).length; cls = pc.blocked ? 'c-err' : pc.done === (f.issues || []).length ? 'c-ok' : ''; }
      else if (b.fact === 'commits') cnt = (f.commits || []).length;
      else if (b.fact === 'ci') { cnt = f.ci ? f.ci.ok + '/' + f.ci.total : '–'; cls = f.ci ? (f.ci.fail ? 'c-err' : f.ci.pending ? 'c-warn' : 'c-ok') : ''; }
      else if (b.fact === 'review') { var rv = lastPass(f); cnt = rv ? rv.p0 + rv.p1 + rv.p2 : '–'; cls = rv ? (rv.p0 + rv.p1 + rv.p2 ? 'c-warn' : 'c-ok') : ''; }
      else if (b.qa) { cnt = qaAnswered() + '/' + questions().length; cls = qaAnswered() === questions().length ? 'c-ok' : 'c-accent'; }
      else if (b.key === 'src') cnt = ((d.notes || {}).sources || []).length;
      steps.appendChild(el('button', { class: 'step row', type: 'button', 'data-to': b.key, onclick: function () { goTo(b.key); } }, [
        el('span', { class: 'mk', text: i === 0 ? '↑' : String(i) }), el('span', { class: 'lbl', text: b.title }),
        b.stale ? el('span', { class: 'stale-dot', title: 'en retard' }) : null, cnt != null ? el('span', { class: 'cnt ' + cls, text: String(cnt) }) : null]));
    });
    UI.aside.textContent = '';
    UI.aside.appendChild(el('div', { class: 'panel toc' }, [
      el('div', { class: 'toc-head', onclick: function () { UI.aside.classList.toggle('open'); } }, [el('span', { class: 'chev' }, [icon('chev')]), el('span', { class: 't', text: 'Sommaire' }),
        el('div', { class: 'progress ticks', role: 'progressbar', 'aria-label': 'lecture' }, [UI.prog = el('div', { style: 'width:0%' })]), UI.stepN = el('span', { class: 'eyebrow', text: '0/' + (bs.length - 1) })]),
      steps]));
    // récap des réponses (You'll learn) : cochée = répondue, clic = la question
    var qs = questions();
    if (qs.length) {
      var n = qaAnswered();
      UI.aside.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'card recap' }, [
        el('div', { class: 'row1' }, [el('span', { class: 'eyebrow', text: 'vos réponses' }), el('span', { class: 'eyebrow ' + (n === qs.length ? 'c-ok' : 'c-accent'), text: n + '/' + qs.length })])].concat(qs.map(function (q, j) {
          var ans = answerOf(q);
          return el('button', { class: 'item ' + (ans ? 'yes' : 'no'), type: 'button', onclick: function () { var e = document.getElementById('q-' + q.id); if (e) e.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); else { S.qstep = j; goTo('qa'); } } }, [
            el('span', { class: 'box', text: ans ? '✓' : '' }), el('span', {}, [q.title, el('span', { class: 'a', text: ans || 'sans réponse' })])]);
        })))]));
    }
    // annotations de diff
    var l = anns();
    if ((f.files || []).length) UI.aside.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'card recap' }, [
      el('div', { class: 'row1' }, [el('span', { class: 'eyebrow', text: 'annotations' }), el('span', { class: 'eyebrow ' + (l.length ? 'c-accent' : 'c-label'), text: String(l.length) })])].concat(l.length ? l.slice(-6).map(function (a) {
        return el('button', { class: 'item yes', type: 'button', title: a.text, onclick: function () { openFile(a.path); } }, [el('span', { class: 'box', text: '✎' }), el('span', {}, [a.path.split('/').pop() + ':' + a.line, stale(a) ? el('span', { class: 'c-warn', text: ' · faite sur ' + String(a.head).slice(0, 7) }) : null, el('span', { class: 'a', text: String(a.text).slice(0, 80) })])]);
      }) : [el('p', { style: 'margin:.2rem 0 0;font-size:12.5px;color:var(--label)', text: 'dans un diff, « + » dans la gouttière annote la ligne.' })]).concat([
        el('div', { class: 'btns' }, [el('button', { class: 'btn btn-sm ' + (n || l.length ? 'btn-primary' : 'btn-outline'), type: 'button', onclick: sendAnswers }, [icon(hasHerdr() ? 'send' : 'copy'), hasHerdr() ? 'envoyer la review' : 'copier la review']),
          el('button', { class: 'btn btn-sm btn-outline', type: 'button', title: 'aperçu, et commande gh pour publier sur la PR', onclick: previewReview }, ['aperçu'])])]))]));
    markSide(); progress();
  }
  function renderDock() {
    var m = questions().length, l = anns().length; UI.dock.hidden = !m && !l; if (UI.dock.hidden) return;
    var n = qaAnswered();
    UI.dock.textContent = '';
    UI.dock.appendChild(el('button', { class: 'dock-btn', type: 'button', title: 'review : réponses et annotations', 'aria-label': 'review : ' + n + ' réponses sur ' + m + ', ' + plural(l, 'annotation'), 'aria-expanded': String(!!UI.dockPop), onclick: function (ev) { ev.stopPropagation(); toggleDock(); } }, [icon('chat'), el('span', { class: 'badge', text: (m ? n + '/' + m : '') + (l ? (m ? ' · ' : '') + '✎' + l : '') })]));
    if (UI.dockPop) UI.dock.appendChild(UI.dockPop);
  }
  function toggleDock(open) {
    var want = open != null ? open : !UI.dockPop;
    if (!want) { UI.dockPop = null; renderDock(); return; }
    UI.dockPop = el('div', { class: 'panel dock-pop' }, [el('div', { class: 'card', style: 'padding:.9rem 1rem' }, [
      el('div', { class: 'eyebrow', text: 'review · ' + qaAnswered() + '/' + questions().length + ' réponses · ' + plural(anns().length, 'annotation') }),
      el('div', { style: 'margin:.5rem 0 .8rem;font-size:13px;color:var(--dim)' }, questions().map(function (q) { var a = answerOf(q); return el('div', { style: 'margin:.25rem 0' }, [el('a', { href: '#q-' + q.id, text: q.title }), el('div', { class: a ? '' : 'c-label', text: a || 'sans réponse' })]); })),
      el('div', { style: 'display:flex;gap:.4rem' }, [el('button', { class: 'btn btn-sm btn-primary', style: 'flex:1', type: 'button', onclick: sendAnswers }, [icon(hasHerdr() ? 'send' : 'copy'), hasHerdr() ? 'envoyer la review' : 'copier la review']),
        el('button', { class: 'btn btn-sm btn-outline', type: 'button', onclick: previewReview }, ['aperçu'])])])]);
    renderDock();
  }
  // palette ⌘K : sections, fichiers, findings, sources, commits
  function palette() {
    closeOverlay();
    var d = S.cur, f = d.facts, items = [], sel = 0, shown = [];
    (S.blocks || []).forEach(function (b) { items.push({ g: 'sections', t: b.title, s: '', go: function () { goTo(b.key); } }); });
    (f.files || []).forEach(function (x) { items.push({ g: 'fichiers', t: x.path.split('/').pop(), s: x.path + '  +' + x.add + ' −' + x.del, go: function () { openFile(x.path); } }); });
    [].concat((f.review || {}).findings || [], (f.reviewCodex || {}).findings || []).forEach(function (x) { items.push({ g: 'findings', t: x.title.replace(/`/g, ''), s: x.prio + ' · ' + x.axis + ' · passe ' + x.pass + ' · ' + x.loc, go: function () { goFinding(x); } }); });
    ((d.notes || {}).sources || []).forEach(function (x) { items.push({ g: 'sources', t: x.label || x.id, s: x.path || x.href || '', go: function () { location.hash = 'src-' + x.id; } }); });
    (f.issues || []).forEach(function (r) { items.push({ g: 'issues', t: '#' + r.n + ' ' + (r.title || ''), s: (PST[r.status] || PST.todo)[0] + (r.pr ? ' · pr #' + r.pr.number : ''), go: function () { goTo('f-issues'); setTimeout(function () { var e = document.getElementById('issue-' + r.n); if (e) e.scrollIntoView({ block: 'center' }); }, 350); } }); });
    (f.commits || []).forEach(function (c) { items.push({ g: 'commits', t: c.subject, s: c.short, go: function () { openUrl(gh('commit/' + c.sha)); } }); });
    var input = el('input', { type: 'text', placeholder: 'section, fichier, finding, source, commit…', 'aria-label': 'rechercher dans le rapport' }), list = el('div', { class: 'pal-list', role: 'listbox' }), count = el('span', { class: 'eyebrow' });
    var hl = function (text, q) { var i = q ? text.toLowerCase().indexOf(q) : -1; return i < 0 ? document.createTextNode(text) : el('span', {}, [text.slice(0, i), el('mark', { text: text.slice(i, i + q.length) }), text.slice(i + q.length)]); };
    var mark = function () { Array.prototype.forEach.call(list.querySelectorAll('.pal-item'), function (b, i) { b.setAttribute('aria-selected', String(i === sel)); if (i === sel) b.scrollIntoView({ block: 'nearest' }); }); };
    var pick = function (i) { var it = shown[i]; if (!it) return; closeOverlay(); it.go(); };
    var draw = function () {
      var q = input.value.trim().toLowerCase(), g = null;
      shown = items.filter(function (it) { return !q || (it.t + ' ' + it.s).toLowerCase().indexOf(q) >= 0; }).slice(0, 80); sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.textContent = '';
      shown.forEach(function (it, i) {
        if (it.g !== g) { g = it.g; list.appendChild(el('div', { class: 'pal-group eyebrow', text: g })); }
        list.appendChild(el('button', { class: 'pal-item', type: 'button', role: 'option', 'aria-selected': String(i === sel), onclick: function () { pick(i); }, onmousemove: function () { if (sel !== i) { sel = i; mark(); } } }, [el('div', { class: 'main' }, [el('div', { class: 't' }, [hl(it.t, q)]), it.s ? el('div', { class: 's', text: it.s }) : null])]));
      });
      if (!shown.length) list.appendChild(el('div', { class: 'empty', text: 'aucun résultat' }));
      count.textContent = plural(shown.length, 'résultat');
    };
    input.addEventListener('input', function () { sel = 0; draw(); });
    input.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); mark(); } else if (ev.key === 'Enter') { ev.preventDefault(); pick(sel); } });
    openOverlay(el('div', { class: 'panel palette' }, [el('div', { class: 'card' }, [el('div', { class: 'pal-in' }, [icon('search'), input, el('kbd', { text: 'esc' })]), list,
      el('div', { class: 'pal-foot eyebrow' }, [el('span', {}, [el('kbd', { text: '↑' }), el('kbd', { text: '↓' }), 'naviguer']), el('span', {}, [el('kbd', { text: '↵' }), 'ouvrir']), count])])]));
    draw(); input.focus();
  }
  function renderFooter() {
    var d = S.cur, F = d.facts;
    UI.footer.textContent = '';
    UI.footer.appendChild(el('span', { class: 'eyebrow', text: 'rev ' + String(d.rev).slice(0, 8) + ' · notes ' + F.notesState + (F.basedOn ? ' sur ' + String(F.basedOn).slice(0, 7) : '') + ' · faits par collect.py, sans token' }));
    UI.footer.appendChild(el('span', { class: 'eyebrow' }, [el('a', { href: '#', onclick: function (ev) { ev.preventDefault(); keysHelp(); }, text: 'raccourcis ( ? )' }), ' · me:report']));
  }
  function markSide() {
    if (!UI.aside) return;
    var keys = (S.blocks || []).map(function (b) { return b.key; }), ci = keys.indexOf(S.current);
    Array.prototype.forEach.call(UI.aside.querySelectorAll('.step'), function (s) {
      var i = keys.indexOf(s.getAttribute('data-to'));
      s.classList.toggle('cur', i === ci); s.classList.toggle('past', ci >= 0 && i < ci);
      if (i === ci) {
        s.setAttribute('aria-current', 'step');
        var card = s.parentNode; if (s.offsetTop < card.scrollTop || s.offsetTop + s.offsetHeight > card.scrollTop + card.clientHeight) card.scrollTop = s.offsetTop - card.clientHeight / 2;
      } else s.removeAttribute('aria-current');
      var mk = s.querySelector('.mk'); if (mk && i > 0) mk.textContent = ci >= 0 && i < ci ? '✓' : String(i);
    });
    if (UI.stepN) UI.stepN.textContent = Math.max(ci, 0) + '/' + (keys.length - 1);
    var b = (S.blocks || [])[ci], g = b ? b.group : 'synth';
    Array.prototype.forEach.call(UI.navSeg.querySelectorAll('.segment'), function (s) { s.setAttribute('aria-current', String(s.getAttribute('data-group') === g)); });
  }
  function progress() { if (!UI.prog) return; var h = document.documentElement.scrollHeight - innerHeight; UI.prog.style.width = (h > 0 ? Math.min(100, 100 * scrollY / h) : 100) + '%'; }
  function tick() {
    if (!UI.msg || !S.cur) return;
    var age = Math.round((Date.now() - S.lastOk) / 1000), hidden = document.visibilityState !== 'visible';
    UI.live.className = 'live' + (hidden ? ' paused' : age > 10 ? ' stuck' : '');
    var text = hidden ? 'en pause · onglet caché' : age > 10 ? 'data.js illisible depuis ' + age + ' s · dernier rendu gardé'
      : S.lastChange ? 'changé à ' + S.lastChange.at + ' : ' + S.lastChange.what : 'live · faits de ' + hhmm(S.cur.generatedAt).slice(0, 5) + ' · ' + rel(S.cur.generatedAt);
    if (UI.msg.getAttribute('data-t') !== text) {
      UI.msg.setAttribute('data-t', text); UI.msg.textContent = '';
      var sw = el('span', { class: 'swap', title: 'faits de ' + hhmm(S.cur.generatedAt) + ' · relu il y a ' + age + ' s' }, [text]);
      UI.msg.appendChild(sw);
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-rel]'), function (e) { var t = rel(e.getAttribute('data-rel')); e.textContent = e.textContent.charAt(0) === '·' ? '· ' + t : t; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-agent-at]'), function (e) { if (Date.now() - +e.getAttribute('data-agent-at') >= AGENT_IDLE_MS) e.classList.add('paused'); });
  }
  function goTo(key) {
    var sec = document.getElementById(key === 'top' ? 'top' : key); if (!sec) return;
    if (sec.hasAttribute('data-folded')) fold(sec, true);
    sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }
  function setTheme(t) {
    ls('me-report:theme', t);
    var light = t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    renderNav(); renderAside(); drawDiagrams(UI.main, true); pierreTheme();
    Array.prototype.forEach.call(document.querySelectorAll('iframe.pv-docframe'), function (fr) { fr.replaceWith(mdFrame(fr._text)); });
  }
  function cycleTheme() { var t = ls('me-report:theme') || 'auto'; setTheme(t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'); toast('thème : ' + ({ auto: 'auto', light: 'clair', dark: 'sombre' })[ls('me-report:theme') || 'auto']); }
  function onKey(ev) {
    // la vraie cible : un champ dans le shadow DOM de Pierre (annotation) a pour cible apparente son hôte
    var t = ev.composedPath ? ev.composedPath()[0] : ev.target, tg = t && t.tagName;
    var typing = tg === 'INPUT' || tg === 'TEXTAREA' || (t && t.isContentEditable);
    if ((ev.metaKey || ev.ctrlKey) && String(ev.key).toLowerCase() === 'k') { ev.preventDefault(); palette(); return; }
    if (ev.key === 'Escape') { if (UI.overlay) closeOverlay(); else if (UI.viewer) closeViewer(); hidePop(true); toggleDock(false); if (!typing && document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    if (typing || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (UI.viewer) { if (UI.viewer.onKey && UI.viewer.onKey(ev)) ev.preventDefault(); return; }
    if (UI.overlay) return;
    var keys = (S.blocks || []).map(function (b) { return b.key; }), i = Math.max(0, keys.indexOf(S.current));
    if (ev.key === 'j') { ev.preventDefault(); goTo(keys[Math.min(keys.length - 1, i + 1)]); }
    else if (ev.key === 'k') { ev.preventDefault(); goTo(keys[Math.max(0, i - 1)]); }
    else if (ev.key === 'g') { ev.preventDefault(); goTo('top'); }
    else if (ev.key === 't') { ev.preventDefault(); cycleTheme(); }
    else if (ev.key === 'x') { var s = document.getElementById(S.current); if (s) fold(s); }
    else if (ev.key === '/' && UI.filesField) { ev.preventDefault(); goTo('f-files'); UI.filesField.focus({ preventScroll: true }); }
    else if (ev.key === '?') { ev.preventDefault(); keysHelp(); }
    else if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && UI.reviewSelect && S.current === 'f-review') {
      var n = ((curReview(S.cur.facts) || {}).passes || []).length; if (!n) return; ev.preventDefault();
      var k = S.rpass || (ev.key === 'ArrowLeft' ? n + 1 : 0); k += ev.key === 'ArrowLeft' ? -1 : 1; UI.reviewSelect(k < 1 || k > n ? null : k);
    }
  }

  // ================= rendu =================
  function render(d) {
    if (!d || !d.facts) return;
    var first = S.first;
    if (first) buildShell();
    S.cur = d; S.key = d.kind === 'plan' ? 'me-report:plan:' + (d.facts.repo || 'local') + ':' + d.facts.plan : 'me-report:' + d.facts.repo + '@' + d.facts.branch;
    document.title = ((d.notes && d.notes.title) || d.facts.branch || d.facts.plan || 'rapport') + ' · ' + (d.kind === 'plan' ? 'plan' : 'rapport');
    var bs = blocks(d); S.blocks = bs;
    var head = bs[0], rest = bs.slice(1), changed = [];
    // en-tête
    var hsig = JSON.stringify(head.sig);
    if (S.sigs.top !== hsig) {
      var hn = head.build(); var old = UI.headSlot.firstChild;
      if (old) { UI.spy.unobserve(old); UI.headSlot.replaceChild(hn, old); } else UI.headSlot.appendChild(hn);
      UI.spy.observe(hn); if (first && !reduced()) hn.scrambleEl.play();
      S.sigs.top = hsig;
    }
    // sections
    var keys = rest.map(function (b) { return b.key; });
    var dom = Array.prototype.map.call(UI.flow.children, function (c) { return c.getAttribute('data-key'); });
    var same = keys.length === dom.length && keys.every(function (k, i) { return k === dom[i]; });
    if (!same) { UI.flow.textContent = ''; Object.keys(S.sigs).forEach(function (k) { if (k !== 'top') delete S.sigs[k]; }); }
    var side = 0;
    rest.forEach(function (b, i) {
      var sig = JSON.stringify(b.sig);
      if (same && S.sigs[b.key] === sig) return;
      var node = b.build(); node.setAttribute('data-key', b.key);
      if (same) { var o = UI.flow.children[i]; UI.spy.unobserve(o); UI.flow.replaceChild(node, o); } else UI.flow.appendChild(node);
      UI.spy.observe(node);
      if (first && !reduced() && node.classList.contains('panel') && i > 0) { node.setAttribute('data-hidden', side++ % 2 ? 'right' : 'left'); UI.reveal.observe(node); }
      else if (first && node.scrambleEl) UI.reveal.observe(node);
      if (!first && S.sigs[b.key] !== undefined) changed.push({ node: node, title: b.title });
      S.sigs[b.key] = sig;
    });
    if (!first && same && changed.length) {
      changed.forEach(function (c) { c.node.classList.add('updated'); setTimeout(function () { c.node.classList.remove('updated'); }, 2600); if (c.node.scrambleEl) c.node.scrambleEl.play(); });
      S.lastChange = { at: hhmm(d.generatedAt).slice(0, 5), what: changed.map(function (c) { return c.title; }).join(', ') };
      setTimeout(function () { S.lastChange = null; tick(); }, 12000);
    }
    renderNav(); renderAside(); renderDock(); renderFooter(); drawDiagrams(UI.main); tick();
    if (first && location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 60); }
    S.first = false;
  }
  function poll() {
    if (document.visibilityState !== 'visible') return;
    var s = document.createElement('script');
    s.src = 'data.js?t=' + Date.now();
    s.onload = function () { s.remove(); S.lastOk = Date.now(); var d = window.__report; if (d && (!S.cur || d.rev !== S.cur.rev)) render(d); };
    s.onerror = function () { s.remove(); };
    document.head.appendChild(s);
  }
  document.addEventListener('visibilitychange', function () { tick(); if (document.visibilityState === 'visible') poll(); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if ((ls('me-report:theme') || 'auto') === 'auto') setTheme('auto'); });

  render(window.__report);
  setInterval(poll, POLL_MS);
})();
