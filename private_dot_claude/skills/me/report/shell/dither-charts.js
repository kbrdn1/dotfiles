/* dither-charts.js : les visuels tramés de Monocode pour le web, en Canvas 2D.
   Un fichier, aucune dépendance, aucun build. <script src="dither-charts.js"> pose window.DitherCharts ;
   sous Node, require() rend la même API (fonctions pures vérifiées par dither-charts.check.js).
   Réutilisable tel quel ailleurs : les couleurs viennent des variables CSS de la page, rien n'est propre
   à me:report.

   Porté de Monocode (github.com/hardbeat920/monocode), crates/monocode-gpui/src/visuals/dither.rs et
   charts.rs, au commit 09d04436babb39ad72198cdf22f735067027fc04. Même logique que le port Herdr
   (mods/kt-keys/viz.js) pour que les deux se ressemblent : cellules de 3 px, Bayer 4x4, ligne en cellules.

   Licence de Monocode :

     MIT License

     Copyright (c) 2026 Nick

     Permission is hereby granted, free of charge, to any person obtaining a copy
     of this software and associated documentation files (the "Software"), to deal
     in the Software without restriction, including without limitation the rights
     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     copies of the Software, and to permit persons to whom the Software is
     furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in all
     copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     SOFTWARE.

   Principe : un ton 0..1 encre cette part de cellules de 3 px par une matrice de Bayer 4x4 (seuils à
   mi-pas : 0,25 encre exactement un quart), une quad par suite horizontale de cellules, une lueur douce
   dessous (plus douce en clair, où elle tourne au gris sale).

   API : chaque visuel rend un contrôleur { el, update(opts), redraw(), destroy() } ; insérer el.
     DitherCharts.chart({ kind: 'bar' | 'line' | 'area', series: [{ label, values, color }], labels, height,
                          stacked, axis, integer, titles, notes, format, readout, onHover(i), onSelect(i) })
       une valeur NaN ou null ne dessine rien (« pas de donnée » n'est jamais un zéro) ; height: 'fill' prend
       la hauteur du conteneur ; notes[i] (texte ou liste) s'ajoute à la carte de lecture de la catégorie i.
     DitherCharts.gauge({ label, value, min, max, unit, color, size })
     DitherCharts.donut({ slices: [{ label, value, color }], label, value, size, legend })
     DitherCharts.progress({ label, value, max, detail, color, segments: [{ value, color }], track, bare, glow })
     DitherCharts.heatmap({ values, rows, columns, color, fill, readout(r, c), onSelect(r, c) })
     DitherCharts.trend({ values, color, height })
     DitherCharts.stat({ label, value, detail, trend, lowerIsBetter, color })
     DitherCharts.delta(text, { lowerIsBetter })   un <span> : flèche et couleur selon le sens
   Couleurs : un jeton de Monocode (ink, muted, faint, accent, positive, negative, warning, series1..6),
   le nom d'une variable CSS sans ses tirets (ok, err, info…) ou une couleur CSS. Elles sont lues sur
   l'élément du visuel, donc dans le thème qui s'applique à lui, et relues quand <html> change de thème
   (attribut data-theme ou class, prefers-color-scheme). DitherCharts.configure({ tokens }) remappe.
   Largeur : celle du conteneur, suivie au redimensionnement. Netteté : cellules alignées sur les pixels
   de l'écran (devicePixelRatio). Entrée : au premier affichage, une seule fois par `id` (un visuel
   reconstruit avec un id déjà entré se dessine à l'état final), aucune sous prefers-reduced-motion. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DitherCharts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CELL = 3;
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var TAU = Math.PI * 2, DEG = 180 / Math.PI;
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function num(v) { return v == null || v === '' ? NaN : +v; }
  function fin(v) { return typeof v === 'number' && isFinite(v); }

  // ================================================================ fonctions pures

  /** La cellule (col, row) est-elle encrée pour `tone` ? Seuils à mi-pas : 0,25 encre un quart exactement. */
  function inked(col, row, tone) { return tone > (BAYER4[(row & 3) * 4 + (col & 3)] + 0.5) / 16; }

  /** Les cellules d'une grille cols × rows en rectangles [col, row, w, h, clé], en cellules : une suite
   *  horizontale par clé, et une suite identique à celle du dessus allonge son rectangle vers le bas. */
  function runs(cols, rows, ink) {
    var out = [], above = new Map();
    for (var row = 0; row < rows; row++) {
      var here = new Map(), start = 0, key = null;
      for (var col = 0; col <= cols; col++) {
        var k = col < cols ? ink(col, row) : null;
        if (k === undefined) k = null;
        if (k === key) continue;
        if (key !== null) {
          var id = start + ':' + col + ':' + key, r = above.get(id);
          if (r) r[3]++; else { r = [start, row, col - start, 1, key]; out.push(r); }
          here.set(id, r);
        }
        start = col; key = k;
      }
      above = here;
    }
    return out;
  }

  /** 1.2K, 48K, 3.4M ; un nombre simple garde les décimales de `step`. */
  function compact(value, step) {
    var trim = function (s) { return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };
    var abs = Math.abs(value);
    if (abs >= 1e9) return trim((value / 1e9).toFixed(1)) + 'B';
    if (abs >= 1e6) return trim((value / 1e6).toFixed(1)) + 'M';
    if (abs >= 1e4) return trim((value / 1e3).toFixed(1)) + 'K';
    var d = 0;
    for (; d < 4; d++) { var s = Math.abs(step) * Math.pow(10, d); if (Math.abs(s - Math.round(s)) < 1e-6) break; }
    return trim(value.toFixed(d));
  }
  function reading(v) { return compact(v, 0.01); }

  /** Un domaine en y aux graduations rondes qui couvre toutes les valeurs. */
  function Scale(min, max, step) { this.min = min; this.max = max; this.step = step; }
  Scale.nice = function (values, zero) {
    var low = zero ? 0 : Infinity, high = zero ? 0 : -Infinity;
    values.forEach(function (v) { if (fin(v)) { low = Math.min(low, v); high = Math.max(high, v); } });
    if (low > high) { low = 0; high = 1; }
    var span = high - low > 0 ? high - low : Math.abs(high) > 0 ? Math.abs(high) : 1;
    var raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = ([1, 2, 2.5, 5, 10].filter(function (c) { return c * mag >= raw; })[0] || 10) * mag;
    var s = new Scale(Math.floor(low / step) * step, Math.ceil(high / step) * step, step);
    if (s.max <= s.min) s.max = s.min + s.step; // une série plate a besoin d'une étendue
    return s;
  };
  Scale.prototype.ticks = function () {
    var n = Math.round((this.max - this.min) / this.step), out = [];
    for (var i = 0; i <= Math.min(n, 12); i++) out.push(this.min + this.step * i);
    return out;
  };
  /** Où tombe `v` : 0 au max, 1 au min. */
  Scale.prototype.depth = function (v) { return (this.max - v) / (this.max - this.min); };
  Scale.prototype.label = function (v) { return compact(v, this.step); };

  /** Une courbe lisse par des points, qui ne les dépasse jamais (cubique monotone, Fritsch-Carlson). */
  function Curve(points) {
    var xs = points.map(function (p) { return p[0]; }), ys = points.map(function (p) { return p[1]; });
    var n = points.length, ms = new Array(n).fill(0);
    if (n >= 2) {
      var d = [];
      for (var k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / Math.max(xs[k + 1] - xs[k], 1e-6));
      ms[0] = d[0]; ms[n - 1] = d[n - 2];
      for (k = 1; k < n - 1; k++) ms[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
      for (k = 0; k < n - 1; k++) {
        if (d[k] === 0) { ms[k] = 0; ms[k + 1] = 0; continue; }
        var a = ms[k] / d[k], b = ms[k + 1] / d[k], s = a * a + b * b;
        if (s > 9) { var t = 3 / Math.sqrt(s); ms[k] = t * a * d[k]; ms[k + 1] = t * b * d[k]; }
      }
    }
    this.xs = xs; this.ys = ys; this.ms = ms;
  }
  Curve.prototype.first = function () { return this.xs.length ? this.xs[0] : 0; };
  Curve.prototype.last = function () { return this.xs.length ? this.xs[this.xs.length - 1] : 0; };
  /** Le y de la courbe en `x`, borné à ses extrémités. */
  Curve.prototype.at = function (x) {
    var xs = this.xs, ys = this.ys, ms = this.ms, n = xs.length;
    if (!n) return 0;
    if (n === 1 || x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    var k = 0; while (k < n - 2 && xs[k + 1] <= x) k++;
    var h = Math.max(xs[k + 1] - xs[k], 1e-6), t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * ms[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * ms[k + 1];
  };
  /** Des points tous les `step` px le long de la courbe. */
  Curve.prototype.samples = function (step) {
    if (this.xs.length < 2) return this.xs.map(function (x, i) { return [x, this.ys[i]]; }, this);
    var a = this.first(), b = this.last(), count = Math.max(1, Math.ceil((b - a) / step)), out = [];
    for (var i = 0; i <= count; i++) { var x = a + (b - a) * i / count; out.push([x, this.at(x)]); }
    return out;
  };
  /** Les rangées [haut, bas] qu'une ligne suivant `curve` encre dans la colonne `col` (toutes celles que
   *  la courbe traverse sur la largeur de la colonne, pour qu'une pente raide reste jointive), ou null. */
  function lineRows(curve, col, cell, rows) {
    var a = Math.max(col * cell, curve.first()), b = Math.min((col + 1) * cell, curve.last());
    if (a > b || !curve.xs.length) return null;
    var ys = [curve.at(a), curve.at((a + b) / 2), curve.at(b)];
    curve.xs.forEach(function (x, i) { if (x > a && x < b) ys.push(curve.ys[i]); });
    return [clamp(Math.floor(Math.min.apply(null, ys) / cell), 0, rows - 1), clamp(Math.floor(Math.max.apply(null, ys) / cell), 0, rows - 1)];
  }
  /** "+12.4% vs octobre" -> ["+12.4%", "vs octobre"] ; null sans nombre signé en tête. */
  function splitDelta(detail) {
    var s = String(detail == null ? '' : detail);
    if (!/^[+\-−]\d/.test(s)) return null;
    var i = s.indexOf(' ');
    return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1).trim()];
  }

  // ================================================================ couleurs, thème

  var TOKENS = { ink: 'text-hi', muted: 'label', faint: 'dim', accent: 'accent', positive: 'ok', negative: 'err', warning: 'warn',
    surface: 'card-bg', series1: 'info', series2: 'special', series3: 'ok', series4: 'warn', series5: 'cyan', series6: 'accent' };
  var MONO_VAR = '--font-mono';
  function configure(o) {
    if (o && o.tokens) for (var k in o.tokens) TOKENS[k] = o.tokens[k];
    if (o && o.monoVar) MONO_VAR = o.monoVar;
    gen++; repaintAll();
  }
  /** Le jeton en valeur CSS : var(--nom, nom) pour un nom, la couleur telle quelle sinon. */
  function cssColor(name) {
    var s = String(name == null ? 'accent' : name);
    if (TOKENS[s]) s = TOKENS[s];
    return /^[a-z][a-z0-9-]*$/i.test(s) ? 'var(--' + s + ', ' + s + ')' : s;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : Math.round(a * 1000) / 1000) + ')'; }
  function luminance(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }

  // ================================================================ cycle de vie partagé

  var live = new Set(), entered = new Set(), gen = 0;
  var watching = false, probeCtx = null, styled = false;
  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  function reducedMotion() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function repaintAll() { live.forEach(function (c) { if (c.el.isConnected) schedule(c); }); }
  function watchTheme() {
    if (watching || typeof MutationObserver === 'undefined') return;
    watching = true;
    var bump = function () { gen++; repaintAll(); };
    new MutationObserver(bump).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    if (typeof matchMedia === 'function') {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', bump);
    }
  }
  // un visuel sorti de la page n'est plus repeint au changement de thème ; il n'est pas détruit pour autant :
  // remis dans la page (une vue rebasculée), son observateur le reprend et il se redessine aux couleurs du moment
  function prune() {
    live.forEach(function (c) { if (c.attached && !c.el.isConnected) { live.delete(c); if (c.raf) cancelAnimationFrame(c.raf); c.raf = 0; } });
  }
  // un observateur par visuel, pas un partagé : un visuel détaché que plus rien ne tient part avec le sien
  function observe(c) {
    if (typeof ResizeObserver === 'undefined' || typeof IntersectionObserver === 'undefined') { c.settled = true; return; }
    watchTheme(); prune();
    c.ro = new ResizeObserver(function () { c.attached = true; live.add(c); schedule(c); });
    c.io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) c.seen(); }, { rootMargin: '0px 0px -6% 0px' });
    live.add(c); c.ro.observe(c.el); c.io.observe(c.el);
  }
  var STYLE = '.dc{position:relative;width:100%;min-width:0}.dc canvas{display:block;max-width:100%}'
    + '.dc-probe{display:none}.dc-mono{font-family:var(' + '--font-mono, ui-monospace, monospace)}'
    + '.dc-legend{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:12px;font-size:11px}'
    + '.dc-key{display:inline-flex;align-items:center;gap:6px}.dc-sw{position:relative;width:10px;height:10px;flex:none}'
    + '.dc-sw i{position:absolute;inset:0 0 auto;height:2px}'
    + '.dc-readout{position:absolute;z-index:5;pointer-events:none;padding:10px;border-radius:10px;font-size:12px;line-height:20px;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.18)}'
    + '.dc-readout .h{font-size:10px;line-height:16px;letter-spacing:.02em}.dc-readout .r{display:flex;align-items:center;gap:8px}'
    + '.dc-readout .r b{font-weight:400;margin-left:auto;padding-left:16px}.dc-readout .r i{width:8px;height:8px;flex:none}'
    + '.dc-donut{display:flex;flex-wrap:wrap;align-items:center;gap:24px}.dc-ring{position:relative;flex:none}'
    + '.dc-dlegend{flex:1;min-width:140px;max-width:320px;display:flex;flex-direction:column;gap:8px;font-size:12px}'
    + '.dc-dlegend .dc-key{display:flex;gap:8px}.dc-dlegend .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.dc-prow{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}.dc-prow .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}'
    + '.dc-prow .p{font-size:12px}.dc-pdetail{margin-top:8px;font-size:12px}'
    + '.dc-delta{display:inline-flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap}'
    + '.dc-stat .l{font-size:12px}.dc-stat .v{font-size:26px;font-weight:600;line-height:1.25}.dc-stat .d{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:2px 0 8px;font-size:12px}';
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ================================================================ un visuel

  function make(kind, opts, R) {
    if (!styled && !document.getElementById('dc-style')) { var st = h('style'); st.id = 'dc-style'; st.textContent = STYLE; document.head.appendChild(st); }
    styled = true;
    var c = { kind: kind, opts: opts || {}, R: R, hover: null, hit: null, start: null, settled: false, raf: 0, gen: -1, colors: {}, attached: false };
    c.el = h('div', 'dc dc-' + kind);
    c.canvas = h('canvas');
    c.canvas.setAttribute('role', 'img');
    c.ctx = c.canvas.getContext('2d');
    R.mount(c);
    var h0 = R.height(c, 0, CELL);
    if (h0 > 0) c.canvas.style.height = h0 + 'px'; // pas de saut de mise en page au premier tracé
    var at = function (ev) { var r = c.canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    c.canvas.addEventListener('pointermove', function (ev) { c.hover = at(ev); schedule(c); });
    c.canvas.addEventListener('pointerleave', function () { c.hover = null; schedule(c); });
    c.canvas.addEventListener('click', function (ev) {
      if (!c.opts.onSelect) return;
      c.hover = at(ev); paint(c);
      if (c.hit != null) c.opts.onSelect.apply(null, [].concat(c.hit));
    });
    c.seen = function () {
      if (c.start != null || c.settled) return;
      var id = c.opts.id;
      if (reducedMotion() || (id != null && entered.has(id))) c.settled = true; else c.start = now();
      if (id != null) entered.add(id);
      if (c.io) c.io.disconnect();
      schedule(c);
    };
    c.update = function (o) { for (var k in o || {}) c.opts[k] = o[k]; if (R.refresh) R.refresh(c); schedule(c); return c; };
    c.redraw = function () { c.gen = -1; schedule(c); return c; };
    c.destroy = function () {
      if (c.raf) cancelAnimationFrame(c.raf);
      c.raf = 0; live.delete(c);
      if (c.ro) c.ro.disconnect();
      if (c.io) c.io.disconnect();
    };
    observe(c);
    return c;
  }
  function schedule(c) { if (!c.raf && typeof requestAnimationFrame === 'function') c.raf = requestAnimationFrame(function () { c.raf = 0; paint(c); }); }

  function paint(c) {
    var el = c.el, cv = c.canvas;
    if (!el.isConnected) return;
    var W = c.R.width ? c.R.width(c) : el.clientWidth;
    if (!(W > 0)) return;
    if (c.gen !== gen) {
      c.gen = gen; c.colors = {};
      var cs = getComputedStyle(el);
      c.mono = (cs.getPropertyValue(MONO_VAR) || '').trim() || 'ui-monospace, monospace';
      c.sans = cs.fontFamily || 'system-ui, sans-serif';
      c.light = luminance(color(c, 'ink')) < 0.5;
      if (c.R.recolor) c.R.recolor(c);
    }
    var dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio > 0) ? devicePixelRatio : 1;
    var cell = Math.max(1, Math.round(CELL * dpr)) / dpr;
    var H = c.R.height(c, W, cell);
    if (!(H > 0)) return;
    var bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    if (cv.style.height !== H + 'px') cv.style.height = H + 'px';
    var ctx = c.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bw, bh); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.busy = false; c.shown = false;
    var prev = c.hit == null ? '' : String(c.hit);
    c.hit = null;
    var E = env(c, W, H, dpr, cell);
    c.R.draw(E, c.opts, c);
    var next = c.hit == null ? '' : String(c.hit);
    if (next !== prev && c.opts.onHover) c.opts.onHover.apply(null, c.hit == null ? [null] : [].concat(c.hit));
    cv.style.cursor = c.hit != null && c.opts.onSelect ? 'pointer' : '';
    cv.setAttribute('aria-label', c.opts.aria || (c.R.aria ? c.R.aria(c.opts) : c.kind));
    if (!c.shown && c.readoutEl) c.readoutEl.hidden = true;
    if (c.busy) schedule(c);
  }

  /** La couleur d'un jeton sur l'élément du visuel, en [r, g, b] (relue à chaque changement de thème). */
  function color(c, name) {
    var key = String(name == null ? 'accent' : name);
    if (c.colors[key]) return c.colors[key];
    var p = c.probe || (c.probe = h('span', 'dc-probe'));
    if (p.parentNode !== c.el) c.el.appendChild(p);
    p.style.color = ''; p.style.color = cssColor(key);
    var s = getComputedStyle(p).color;
    if (!probeCtx) { var pc = h('canvas'); pc.width = pc.height = 1; probeCtx = pc.getContext('2d', { willReadFrequently: true }); }
    probeCtx.clearRect(0, 0, 1, 1); probeCtx.fillStyle = '#000'; probeCtx.fillStyle = s; probeCtx.fillRect(0, 0, 1, 1);
    var d = probeCtx.getImageData(0, 0, 1, 1).data;
    return (c.colors[key] = [d[0], d[1], d[2]]);
  }

  /** Ce qu'un tracé reçoit : le contexte, la taille, la cellule, le mouvement, les couleurs. */
  function env(c, W, H, dpr, cell) {
    var ctx = c.ctx;
    var E = {
      ctx: ctx, w: W, h: H, dpr: dpr, cell: cell, light: c.light, hover: c.hover,
      snap: function (v) { return Math.round(v * dpr) / dpr; },
      rgb: function (name) { return color(c, name); },
      col: function (name, a) { return rgba(color(c, name), a); },
      ink: function (a) { return rgba(color(c, 'ink'), a); },
      mono: function (size) { return size + 'px ' + c.mono; },
      sans: function (size, weight) { return (weight || 400) + ' ' + size + 'px ' + c.sans; },
      /** Progression adoucie (quartique) d'une étape de `ms` qui commence à `delay` ms. */
      at: function (delay, ms) {
        if (c.settled) return 1;
        if (c.start == null) return 0;
        var t = clamp((now() - c.start - delay) / ms, 0, 1);
        if (t < 1) c.busy = true;
        return 1 - Math.pow(1 - t, 4);
      },
      /** Les cellules `rects` (en cellules) depuis (ox, oy), chaque clé dans sa couleur. */
      cells: function (ox, oy, rects, colorOf) {
        var cur = null;
        for (var i = 0; i < rects.length; i++) {
          var r = rects[i], fill = colorOf(r[4]);
          if (!fill) continue;
          if (fill !== cur) ctx.fillStyle = cur = fill;
          ctx.fillRect(ox + r[0] * cell, oy + r[1] * cell, r[2] * cell, r[3] * cell);
        }
      },
      text: function (s, x, y, align, font, fill) {
        ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
      },
      measure: function (s, font) { ctx.font = font; return ctx.measureText(s).width; },
      /** Une lueur douce sur (x, y, w, h), dedans comme autour : elle se voit par les trous de la trame. */
      glow: function (x, y, w, hh, name, strength) {
        if (!(w > 0 && hh > 0)) return;
        ctx.save();
        ctx.shadowColor = rgba(color(c, name), strength * (c.light ? 0.4 : 1));
        ctx.shadowBlur = 14 * dpr; ctx.shadowOffsetX = 10000 * dpr; ctx.fillStyle = '#000';
        ctx.fillRect(x - 10000, y, w, hh);
        ctx.restore();
      },
      /** Deux halos lisses sous une ligne en cellules, plus larges et plus pâles. */
      halos: function (ox, oy, pts, width, name) {
        if (pts.length < 2) return;
        var dim = c.light ? 0.45 : 1;
        [[10, 0.07], [5, 0.14]].forEach(function (hw) {
          ctx.beginPath();
          pts.forEach(function (p, i) { if (i) ctx.lineTo(ox + p[0], oy + p[1]); else ctx.moveTo(ox + p[0], oy + p[1]); });
          ctx.lineWidth = width + hw[0]; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = rgba(color(c, name), hw[1] * dim); ctx.stroke();
        });
      },
      /** Un repère carré dans un halo pâle de sa couleur. */
      marker: function (x, y, side, name) {
        var s2 = side + 6;
        ctx.fillStyle = rgba(color(c, name), 0.25); ctx.fillRect(E.snap(x - s2 / 2), E.snap(y - s2 / 2), s2, s2);
        ctx.fillStyle = rgba(color(c, name), 1); ctx.fillRect(E.snap(x - side / 2), E.snap(y - side / 2), side, side);
      },
      /** La carte de lecture d'un point survolé : un titre, puis une ligne par série. */
      readout: function (title, rows, ax, ay) { readout(c, E, title, rows, ax, ay); },
      empty: function (s) { E.text(s || 'aucune donnée', W / 2, H / 2, 'center', E.mono(11), E.ink(0.45)); }
    };
    return E;
  }

  function readout(c, E, title, rows, ax, ay) {
    var r = c.readoutEl;
    if (!r) { r = c.readoutEl = h('div', 'dc-readout'); c.el.appendChild(r); }
    c.shown = true; r.hidden = false; r.textContent = '';
    r.style.background = E.col('surface', 0.96); r.style.border = '1px solid ' + E.ink(0.12); r.style.color = E.ink(0.75);
    r.appendChild(h('div', 'h dc-mono', title)).style.color = E.ink(0.55);
    rows.forEach(function (row) {
      var line = h('div', 'r'), sw = h('i');
      if (row[0]) sw.style.background = rgba(row[0]); else sw.style.visibility = 'hidden';
      line.appendChild(sw); line.appendChild(h('span', '', row[1]));
      if (row[2] != null && row[2] !== '') { var v = h('b', 'dc-mono', row[2]); v.style.color = E.ink(1); line.appendChild(v); }
      r.appendChild(line);
    });
    var cvx = c.canvas.offsetLeft, cvy = c.canvas.offsetTop, w = r.offsetWidth, hh = r.offsetHeight;
    var x = ax + 14; if (x + w > E.w) x = ax - 14 - w;
    x = Math.max(0, x);
    var y = clamp(ay - hh / 2, 0, Math.max(0, E.h - hh));
    r.style.left = Math.round(cvx + x) + 'px'; r.style.top = Math.round(cvy + y) + 'px';
  }

  function swatch() { var s = h('span', 'dc-sw'); s.appendChild(h('i')); return s; }
  function paintSwatch(c, s, name) { s.style.background = rgba(color(c, name), 0.4); s.firstChild.style.background = rgba(color(c, name), 1); }
  function seriesColor(s, i) { return s && s.color != null ? s.color : 'series' + ((i % 6) + 1); }

  // ================================================================ bar, line, area

  var BAR_LEVEL = 0.75, BAR_FLOOR = 0.125, BAR_FADE = 0.7, MAX_BAR = 36;
  var AREA_LEVEL = 0.625, AREA_REST = 0.2;
  var AREA_BANDS = [[0.05, 1], [0.13, 0.8], [0.25, 0.65], [0.4, 0.5], [0.6, 0.35]]; // [profondeur, couverture]

  function chart(opts) {
    return make('chart', opts, {
      mount: function (c) { c.el.appendChild(c.canvas); this.refresh(c); },
      refresh: function (c) {
        var s = c.opts.series || [];
        if (c.legend) { c.legend.remove(); c.legend = null; }
        if (s.length > 1 && c.opts.legend !== false) {
          c.legend = h('div', 'dc-legend dc-mono');
          s.forEach(function (x, i) { var k = h('span', 'dc-key'); k.appendChild(swatch()); k.appendChild(h('span', '', x.label == null ? '#' + (i + 1) : x.label)); c.legend.appendChild(k); });
          c.el.appendChild(c.legend); c.gen = -1;
        }
      },
      recolor: function (c) {
        if (!c.legend) return;
        (c.opts.series || []).forEach(function (x, i) { var k = c.legend.children[i]; if (!k) return; paintSwatch(c, k.firstChild, seriesColor(x, i)); k.style.color = rgba(color(c, 'ink'), 0.6); });
      },
      height: function (c) { return c.opts.height === 'fill' ? c.el.clientHeight : (c.opts.height || 220); },
      draw: cartesian,
      aria: function (o) { return (o.series || []).map(function (s) { return (s.label || '') + ' : ' + (s.values || []).map(function (v) { return fin(num(v)) ? reading(num(v)) : '?'; }).join(', '); }).join(' ; '); }
    });
  }

  function cartesian(E, o, c) {
    var kind = o.kind || 'bar', bars = kind === 'bar', axis = o.axis !== false, stacked = bars && !!o.stacked;
    var series = o.series || [], labels = o.labels || [];
    var values = series.map(function (s) { return (s.values || []).map(num); });
    var count = Math.max(labels.length, values.reduce(function (m, v) { return Math.max(m, v.length); }, 0));
    var all = [].concat.apply([], values).filter(fin);
    if (!count || !all.length) return E.empty(o.empty);
    var idx = []; for (var q = 0; q < count; q++) idx.push(q);
    var domain = stacked ? idx.map(function (i) { return values.reduce(function (s, v) { return s + (fin(v[i]) && v[i] > 0 ? v[i] : 0); }, 0); }) : all;
    var scale = Scale.nice(domain, kind !== 'line');
    // integer : des comptes, pas de graduation à 0,25
    if (o.integer && scale.step < 1) scale = new Scale(Math.floor(scale.min), Math.max(Math.ceil(scale.max), Math.floor(scale.min) + 1), 1);
    var ticks = axis ? scale.ticks() : [], tl = ticks.map(function (t) { return scale.label(t); });
    var left = axis ? Math.ceil(Math.max.apply(null, tl.map(function (s) { return E.measure(s, E.mono(10)); }).concat([6]))) + 10 : 0;
    var top = bars ? (axis ? 16 : 3) : 8, bottom = axis ? 22 : 0, right = E.w - (bars ? 0 : 6);
    var cell = E.cell, ox = E.snap(left), oy = E.snap(top);
    var cols = Math.max(0, Math.floor((right - ox) / cell)), rows = Math.max(1, Math.floor((E.h - oy - bottom) / cell));
    var pw = cols * cell, ph = rows * cell;
    var yOf = function (v) { return scale.depth(v) * ph; };
    var band = pw / count;
    var xOf = function (i) { return bars ? band * (i + 0.5) : count <= 1 ? pw / 2 : i * pw / (count - 1); };
    var ctx = E.ctx, fmt = o.format || reading;
    var colors = series.map(function (s, i) { return E.col(seriesColor(s, i)); });
    var rgbs = series.map(function (s, i) { return E.rgb(seriesColor(s, i)); });

    // graduations et lignes de grille
    ticks.forEach(function (t, i) {
      var y = oy + E.snap(yOf(t));
      ctx.fillStyle = E.ink(0.07); ctx.fillRect(ox, y, pw, 1 / E.dpr * Math.max(1, Math.round(E.dpr)));
      E.text(tl[i], ox - 10, y, 'right', E.mono(10), E.ink(0.45));
    });
    if (axis) {
      var stride = Math.max(1, Math.ceil(count / Math.max(1, Math.floor(pw / 72))));
      labels.forEach(function (l, i) {
        if (i % stride) return;
        var align = bars ? 'center' : i === 0 ? 'left' : i + 1 === count ? 'right' : 'center';
        var s = String(l); if (s.length > 12) s = s.slice(0, 11) + '…';
        E.text(s, ox + xOf(i), oy + ph + 13, align, E.mono(10), E.ink(0.45));
      });
    }
    var hx = E.hover ? E.hover.x - ox : null;
    if (hx != null && (hx < 0 || hx > pw)) hx = null;
    var title = function (i) { return o.titles && o.titles[i] != null ? String(o.titles[i]) : labels[i] != null ? String(labels[i]) : '#' + (i + 1); };
    var rowsOf = function (i) {
      var out = [];
      series.forEach(function (s, j) { var v = values[j][i]; if (fin(v)) out.push([rgbs[j], s.label == null ? '#' + (j + 1) : String(s.label), fmt(v)]); });
      if (o.notes && o.notes[i]) [].concat(o.notes[i]).forEach(function (n) { out.push([null, String(n), '']); });
      return out;
    };

    if (bars) {
      var hovered = hx == null ? null : Math.min(count - 1, Math.floor(hx / band));
      if (hovered != null) { c.hit = hovered; ctx.fillStyle = E.ink(0.04); ctx.fillRect(ox + E.snap(band * hovered), oy, E.snap(band), ph); }
      var n = stacked ? 1 : Math.max(series.length, 1);
      var wide = Math.max(1, Math.round(Math.min((band * 0.7 - cell * (n - 1)) / n, MAX_BAR) / cell));
      var group = wide * n + (n - 1);
      var rowOf = function (v) { return Math.round(scale.depth(v) * ph / cell); };
      var zero = rowOf(Math.min(Math.max(scale.min, 0), scale.max));
      var fade = Math.max(rows * BAR_FADE, 1), last = count - 1, settled = true, lastTop = null;
      var columns = new Array(cols).fill(null);
      for (var i = 0; i < count; i++) {
        // chaque groupe monte depuis l'axe, un temps après le précédent
        var rise = E.at(Math.min(i * 30, 360), 700);
        if (rise < 1) settled = false;
        var start = Math.round(band * (i + 0.5) / cell - group / 2);
        var lift = function (r) { return zero + Math.round((r - zero) * rise); };
        if (stacked) {
          var acc = 0, segs = [];
          values.forEach(function (vs, j) {
            var v = vs[i]; if (!fin(v) || v <= 0) return;
            var a = lift(rowOf(acc)), b = lift(rowOf(acc + v)); acc += v;
            if (a !== b) segs.push([Math.min(a, b), Math.max(a, b), j]);
          });
          if (!segs.length) continue;
          var topRow = Math.min.apply(null, segs.map(function (s) { return s[0]; }));
          for (var col = Math.max(0, start); col < Math.min(cols, start + wide); col++) columns[col] = { i: i, top: topRow, segs: segs };
          if (i === last) lastTop = topRow;
        } else {
          values.forEach(function (vs, j) {
            var v = vs[i]; if (!fin(v)) return;
            var end = lift(rowOf(v)), t = Math.min(end, zero), b2 = Math.max(end, zero), first = start + j * (wide + 1);
            for (var cc = Math.max(0, first); cc < Math.min(cols, first + wide); cc++) columns[cc] = { i: i, top: t, segs: [[t, b2, j]] };
            if (i === last) lastTop = t;
          });
        }
      }
      var rects = runs(cols, rows, function (col, row) {
        var k = columns[col]; if (!k) return null;
        for (var s = 0; s < k.segs.length; s++) {
          var sg = k.segs[s]; if (row < sg[0] || row >= sg[1]) continue;
          // empilé : chaque segment a son liseré plein et son fondu, sinon celui du bas disparaîtrait près de l'axe
          var tone = BAR_LEVEL - (BAR_LEVEL - BAR_FLOOR) * Math.min((row - sg[0]) / fade, 1);
          if (hovered === k.i) tone = 0.5 + tone * 0.5; // le groupe survolé s'allume : trame plus dense, jamais pleine
          return row === sg[0] || inked(col, row, tone) ? sg[2] : null;
        }
        return null;
      });
      E.cells(ox, oy, rects, function (j) { return colors[j]; });
      // une seule série : sa dernière valeur s'écrit au-dessus de sa barre, une fois montée
      if (axis && series.length === 1 && lastTop != null && settled && hovered == null && fin(values[0][last]))
        E.text(compact(values[0][last], scale.step / 10), ox + band * (last + 0.5), oy + lastTop * cell - 9, 'center', E.mono(10), E.ink(0.9));
      if (hovered != null && o.readout !== false) {
        var peak = Math.max.apply(null, values.map(function (vs) { return fin(vs[hovered]) ? vs[hovered] : -Infinity; }).concat([stacked ? domain[hovered] : -Infinity]));
        E.readout(title(hovered), rowsOf(hovered), ox + band * (hovered + 0.5), oy + (fin(peak) ? Math.min(yOf(peak), ph - 20) : ph / 2));
      }
      return;
    }

    // lignes et aires : elles se tracent depuis la gauche, les aires se remplissent derrière
    var points = values.map(function (vs) { var p = []; vs.forEach(function (v, i) { if (fin(v)) p.push([xOf(i), yOf(v)]); }); return p; });
    var curves = points.map(function (p) { return new Curve(p); });
    var reach = E.at(0, 900) * pw;
    var baseline = yOf(Math.max(scale.min, 0));
    if (kind === 'area') curves.forEach(function (cv, j) {
      var s = cv.samples(4).filter(function (p) { return p[0] <= reach; });
      if (s.length < 2) return;
      ctx.beginPath(); s.forEach(function (p, k) { if (k) ctx.lineTo(ox + p[0], oy + p[1]); else ctx.moveTo(ox + p[0], oy + p[1]); });
      ctx.lineTo(ox + s[s.length - 1][0], oy + baseline); ctx.lineTo(ox + s[0][0], oy + baseline); ctx.closePath();
      ctx.fillStyle = rgba(rgbs[j], E.light ? 0.04 : 0.07); ctx.fill();
    });
    var hoveredL = hx == null ? null : count <= 1 ? 0 : Math.round(hx / pw * (count - 1));
    if (hoveredL != null) {
      c.hit = hoveredL;
      ctx.fillStyle = E.ink(0.35);
      for (var y = 0; y < ph; y += 5) ctx.fillRect(ox + E.snap(xOf(hoveredL)), oy + y, 1, Math.min(2, ph - y));
    }
    curves.forEach(function (cv, j) {
      var s = cv.samples(4).filter(function (p) { return p[0] <= reach; });
      if (reach > cv.first() && reach < cv.last()) s.push([reach, cv.at(reach)]);
      E.halos(ox, oy, s, cell, seriesColor(series[j], j));
    });
    var lines = curves.map(function (cv) { var out = []; for (var col = 0; col < cols; col++) out.push(lineRows(cv, col, cell, rows)); return out; });
    var ys = curves.map(function (cv) { var out = []; for (var col = 0; col < cols; col++) { var x = (col + 0.5) * cell; out.push(cv.xs.length >= 2 && x >= cv.first() && x <= cv.last() ? cv.at(x) : null); } return out; });
    var lead = Math.max(2 * cell / Math.max(ph, 1), AREA_BANDS[0][0]);
    var rectsL = runs(cols, rows, function (col, row) {
      if ((col + 0.5) * cell > reach) return null;
      for (var j = lines.length - 1; j >= 0; j--) { var r = lines[j][col]; if (r && row >= r[0] && row <= r[1]) return j; }
      if (kind !== 'area') return null;
      var yy = (row + 0.5) * cell;
      if (yy > baseline) return null;
      // les séries suivantes passent devant, comme du papier empilé
      for (j = ys.length - 1; j >= 0; j--) {
        var t = ys[j][col]; if (t == null || yy < t) continue;
        var depth = (yy - t) / Math.max(ph, 1), share = AREA_REST;
        if (depth < lead) share = 1; else for (var b = 0; b < AREA_BANDS.length; b++) if (depth < AREA_BANDS[b][0]) { share = AREA_BANDS[b][1]; break; }
        return inked(col, row, Math.round(AREA_LEVEL * share * 16) / 16) ? j : null;
      }
      return null;
    });
    E.cells(ox, oy, rectsL, function (j) { return colors[j]; });
    curves.forEach(function (cv, j) {
      if (!cv.xs.length) return;
      var name = seriesColor(series[j], j);
      if (hoveredL == null) {
        // le repère de fin suit la tête de la ligne pendant qu'elle se trace
        var hxEnd = Math.min(reach, cv.last());
        if (hxEnd >= cv.first()) E.marker(ox + hxEnd, oy + cv.at(hxEnd), 2 * cell, name);
      } else if (fin(values[j][hoveredL])) E.marker(ox + xOf(hoveredL), oy + yOf(values[j][hoveredL]), 2 * cell, name);
    });
    if (hoveredL != null && o.readout !== false) {
      var topY = ph;
      values.forEach(function (vs) { if (fin(vs[hoveredL])) topY = Math.min(topY, yOf(vs[hoveredL])); });
      E.readout(title(hoveredL), rowsOf(hoveredL), ox + xOf(hoveredL), oy + topY);
    }
  }

  // ================================================================ sparkline

  function trend(opts) {
    return make('trend', opts, {
      mount: function (c) { c.el.appendChild(c.canvas); },
      height: function (c) { return c.opts.height || 56; },
      draw: function (E, o) {
        var LEVELS = [10 / 16, 6 / 16, 3 / 16, 1 / 16], DEPTH = 7, cell = E.cell;
        var vs = (o.values || []).map(num).filter(fin);
        if (vs.length < 2) return;
        var cols = Math.floor(E.w / cell), rows = Math.floor(E.h / cell), w = cols * cell, hh = rows * cell;
        var low = Math.min.apply(null, vs), high = Math.max.apply(null, vs), range = high > low ? high - low : 1;
        var top = 6, floor = hh * 0.3;
        var curve = new Curve(vs.map(function (v, i) { return [i / (vs.length - 1) * w, top + (1 - (v - low) / range) * (hh - top - floor)]; }));
        var reach = E.at(150, 900) * w, name = o.color || 'accent';
        var s = curve.samples(4).filter(function (p) { return p[0] <= reach; });
        if (reach > 0 && reach < w) s.push([reach, curve.at(reach)]);
        E.halos(0, 0, s, 1.5, name);
        var rects = runs(cols, rows, function (col, row) {
          if ((col + 0.5) * cell > reach) return null;
          var r = lineRows(curve, col, cell, rows);
          if (r && row >= r[0] && row <= r[1]) return 1;
          var depth = (row + 0.5) * cell - curve.at((col + 0.5) * cell);
          return depth >= 0 && inked(col, row, LEVELS[Math.min(Math.floor(depth / DEPTH), LEVELS.length - 1)]) ? 1 : null;
        });
        var tint = E.col(name);
        E.cells(0, 0, rects, function () { return tint; });
        var end = s[s.length - 1];
        if (end) E.marker(Math.min(end[0], w - cell), end[1], 2 * cell, name);
      },
      aria: function (o) { return 'tendance : ' + (o.values || []).map(num).filter(fin).map(reading).join(', '); }
    });
  }

  /** Un écart signé, flèche et couleur du bon ou du mauvais sens. */
  function delta(text, o) {
    var s = String(text), lower = !!(o && o.lowerIsBetter), down = /^[-−]/.test(s);
    var zero = Number(s.replace(/[^\d.]/g, '')) === 0;
    var e = h('span', 'dc-delta dc-mono');
    e.style.color = zero ? cssColor('muted') : cssColor(down !== lower ? 'negative' : 'positive');
    if (!zero) e.appendChild(h('span', '', down ? '▼' : '▲'));
    e.appendChild(h('span', '', s));
    return e;
  }

  /** Une mesure : libellé, valeur, écart signé et détail, puis sa sparkline. */
  function stat(opts) {
    var o = opts || {}, e = h('div', 'dc-stat');
    e.appendChild(h('div', 'l', o.label == null ? '' : o.label)).style.color = cssColor('muted');
    e.appendChild(h('div', 'v', o.value == null ? '' : o.value)).style.color = cssColor(o.color || 'ink');
    var sd = splitDelta(o.detail);
    if (o.detail) {
      var d = h('div', 'd');
      if (sd) d.appendChild(delta(sd[0], o));
      var rest = sd ? sd[1] : String(o.detail);
      if (rest) d.appendChild(h('span', '', rest)).style.color = cssColor('muted');
      e.appendChild(d);
    }
    var t = o.trend && o.trend.length > 1 ? trend({ values: o.trend, color: o.trendColor || o.color || 'accent', id: o.id }) : null;
    if (t) e.appendChild(t.el);
    return { el: e, trend: t };
  }

  // ================================================================ jauge

  function gauge(opts) {
    var SEGMENTS = 36, SPAN = 270, START = -135;
    var dims = function (c) {
      var size = Math.min(c.opts.size || 220, c.el.clientWidth || c.opts.size || 220);
      var outer = size / 2 - 1 - CELL;
      return { size: size, height: Math.ceil(size / 2 + (outer + CELL) * Math.SQRT1_2 + 18) };
    };
    return make('gauge', opts, {
      mount: function (c) { c.el.appendChild(c.canvas); },
      height: function (c) { return dims(c).height; },
      draw: function (E, o, c) {
        var min = fin(num(o.min)) ? num(o.min) : 0, max = fin(num(o.max)) ? num(o.max) : 100, value = num(o.value);
        if (!fin(value) || !(max > min)) return E.empty(o.empty);
        var ratio = clamp((value - min) / (max - min), 0, 1), cell = E.cell, size = dims(c).size;
        var unit = o.unit, fmt = function (v) { return unit === '%' ? compact(v, 1) + '%' : unit ? compact(v, 0.1) + ' ' + unit : compact(v, 0.1); };
        var ox = E.snap((E.w - size) / 2), cols = Math.floor(size / cell), rows = Math.floor(E.h / cell);
        var cx = size / 2, outer = size / 2 - 1 - cell, thickness = Math.max(2, Math.round(size * 0.12 / cell)) * cell;
        var inner = outer - thickness, step = SPAN / SEGMENTS, middle = outer - thickness / 2, gap = 2 / middle * DEG;
        // les blocs se remplissent un à un pendant que la lecture compte
        var grow = E.at(0, 1000), filled = ratio * grow * SEGMENTS, active = Math.max(0, Math.ceil(filled - 1e-6));
        var rects = runs(cols, rows, function (col, row) {
          var dx = (col + 0.5) * cell - cx, dy = (row + 0.5) * cell - cx, r = Math.sqrt(dx * dx + dy * dy);
          if (r < inner || r > outer + cell) return null;
          var along = Math.atan2(dx, -dy) * DEG - START;
          if (!(along >= 0 && along < SPAN)) return null;
          var index = Math.floor(along / step), within = along - index * step;
          if (within < gap / 2 || within > step - gap / 2) return null;
          var head = active > 0 && index === active - 1;
          if (r > outer && !head) return null; // le bloc de la valeur sort d'une cellule, comme une aiguille
          if (index >= active) return 't';
          if (head) {
            var part = clamp(filled - index, 0, 1);
            if (within > gap / 2 + (step - gap) * Math.max(part, 0.15)) return r <= outer ? 't' : null;
            return 'i';
          }
          return inked(col, row, Math.max(1 - (active - 1 - index) / 16, 9 / 16)) ? 'i' : null;
        });
        var name = o.color || 'accent', tint = E.col(name), track = E.col(name, 0.14);
        E.cells(ox, 0, rects, function (k) { return k === 'i' ? tint : track; });
        E.text(fmt(min + (value - min) * grow), ox + cx, cx - 4, 'center', E.sans(Math.round(size * 0.15), 600), E.ink(1));
        if (o.label) E.text(String(o.label), ox + cx, cx + size * 0.1 + 6, 'center', E.sans(12), E.ink(0.6));
        var ends = middle * Math.SQRT1_2;
        E.text(compact(min, 1), ox + cx - ends, cx + ends + thickness / 2 + 12, 'center', E.mono(10), E.ink(0.45));
        E.text(compact(max, 1), ox + cx + ends, cx + ends + thickness / 2 + 12, 'center', E.mono(10), E.ink(0.45));
      },
      aria: function (o) { return (o.label || 'jauge') + ' : ' + o.value + (o.unit === '%' ? ' %' : o.unit ? ' ' + o.unit : '') + ' sur ' + (o.max == null ? 100 : o.max); }
    });
  }

  // ================================================================ anneau

  function donut(opts) {
    var FLOOR = 3 / 16;
    var size = function (c) { return c.opts.size || 184; };
    var vals = function (o) { return (o.slices || []).map(function (s) { var v = num(s.value); return fin(v) ? v : 0; }); };
    return make('donut', opts, {
      mount: function (c) {
        c.el.className = 'dc dc-donut';
        c.ring = h('div', 'dc-ring'); c.ring.appendChild(c.canvas); c.el.appendChild(c.ring);
        this.refresh(c);
      },
      refresh: function (c) {
        var o = c.opts, s = size(c);
        c.ring.style.width = c.ring.style.height = s + 'px'; c.canvas.style.width = s + 'px';
        if (c.legendEl) { c.legendEl.remove(); c.legendEl = null; }
        if (o.legend === false) return;
        var v = vals(o), total = v.reduce(function (a, b) { return a + Math.max(b, 0); }, 0);
        c.legendEl = h('div', 'dc-dlegend');
        (o.slices || []).forEach(function (sl, i) {
          var k = h('div', 'dc-key'); k.appendChild(swatch());
          k.appendChild(h('span', 'n', sl.label == null ? '' : String(sl.label)));
          k.appendChild(h('span', 'dc-mono', compact(v[i], 0.1) + ' · ' + (total > 0 ? Math.round(v[i] / total * 100) : 0) + '%'));
          c.legendEl.appendChild(k);
        });
        c.el.appendChild(c.legendEl); c.gen = -1;
      },
      recolor: function (c) {
        if (!c.legendEl) return;
        (c.opts.slices || []).forEach(function (sl, i) {
          var k = c.legendEl.children[i]; if (!k) return;
          paintSwatch(c, k.firstChild, seriesColor(sl, i)); k.children[1].style.color = rgba(color(c, 'ink'), 0.8); k.children[2].style.color = rgba(color(c, 'ink'), 0.5);
        });
      },
      width: function (c) { return size(c); },
      height: function (c) { return size(c); },
      draw: function (E, o, c) {
        var slices = o.slices || [], v = vals(o), total = v.reduce(function (a, b) { return a + Math.max(b, 0); }, 0);
        if (!(total > 0)) return E.empty(o.empty);
        var cell = E.cell, cols = Math.floor(E.w / cell), half = cols * cell / 2, sz = E.w;
        var outer = half - (sz >= 64 ? 2 * cell : 0), inner = outer - Math.max(1, Math.round(sz * 0.17 / cell)) * cell;
        var angleOf = function (dx, dy) { var a = Math.atan2(dx, -dy); return a < 0 ? a + TAU : a; };
        var running = 0, edges = v.map(function (x) { var e = running / Math.max(total, 1e-9) * TAU; running += Math.max(x, 0); return e; });
        var parts = edges.filter(function (_, i) { return v[i] > 0; });
        var sliceAt = function (a) { for (var i = edges.length - 1; i >= 0; i--) if (a >= edges[i] && v[i] > 0) return i; for (i = edges.length - 1; i >= 0; i--) if (a >= edges[i]) return i; return -1; };
        // l'anneau balaie depuis midi
        var sweep = E.at(0, 900) * TAU, hovered = null;
        if (E.hover) {
          var hdx = E.hover.x - half, hdy = E.hover.y - half, hr = Math.sqrt(hdx * hdx + hdy * hdy);
          if (hr >= inner - cell && hr <= outer + cell) { hovered = sliceAt(angleOf(hdx, hdy)); if (hovered < 0) hovered = null; }
        }
        if (hovered != null) c.hit = hovered;
        var rects = runs(cols, cols, function (col, row) {
          var dx = (col + 0.5) * cell - half, dy = (row + 0.5) * cell - half, r = Math.sqrt(dx * dx + dy * dy);
          if (r < inner || r > outer) return null;
          var angle = angleOf(dx, dy);
          if (angle > sweep) return null;
          var index = sliceAt(angle); if (index < 0) return null;
          var outline = r > outer - cell || r < inner + cell;
          if (parts.length > 1) {
            // distance en cellules au bord de tranche le plus proche : un jour, puis un liseré plein
            var near = Infinity;
            parts.forEach(function (e) { var d = Math.abs(angle - e); d = Math.min(d, TAU - d); if (d <= Math.PI / 2) near = Math.min(near, r * Math.sin(d) / cell); });
            if (near < 0.75) return null;
            outline = outline || near < 1.75;
          }
          var depth = (outer - r) / (outer - inner);
          return outline || inked(col, row, FLOOR + (1 - FLOOR) * Math.pow(1 - depth, 1.4)) ? index : null;
        });
        // la tranche survolée reste vive, les autres pâlissent
        var fills = slices.map(function (s, i) { return E.col(seriesColor(s, i), hovered != null && hovered !== i ? 0.25 : 1); });
        E.cells(0, 0, rects, function (i) { return fills[i]; });
        var caption = o.label, figure, share = null;
        if (hovered != null) { caption = slices[hovered].label; figure = reading(v[hovered]); share = Math.round(v[hovered] / Math.max(total, 1e-9) * 100) + '%'; }
        else figure = o.value != null ? String(o.value) : total >= 1e4 ? Math.round(total).toString().replace(/\B(?=(\d{3})+$)/g, ' ') : compact(total, 0.1);
        if (o.legend === false && hovered == null) return;
        if (caption != null && caption !== '') E.text(String(caption).toUpperCase().slice(0, 18), half, half - 16, 'center', E.mono(10), E.ink(0.45));
        var fit = Math.floor(Math.min(26, (inner * 2 - 16) / (Math.max(1, String(figure).length) * 0.62)));
        E.text(String(figure), half, half + (caption != null && caption !== '' ? 4 : 0), 'center', E.sans(fit, 600), E.ink(1));
        if (share) E.text(share, half, half + 24, 'center', E.mono(10), E.ink(0.45));
      },
      aria: function (o) { return (o.label ? o.label + ' : ' : '') + (o.slices || []).map(function (s) { return (s.label || '') + ' ' + s.value; }).join(', '); }
    });
  }

  // ================================================================ progression

  function progress(opts) {
    var B = function (c) { return c.opts.glow === false ? 0 : 6; };
    var segsOf = function (o) {
      if (o.segments && o.segments.length) return o.segments.map(function (s) { return { value: num(s.value), color: s.color || 'accent' }; });
      return [{ value: num(o.value), color: o.color || 'accent' }];
    };
    var ratioOf = function (o) {
      var max = fin(num(o.max)) ? num(o.max) : 100, sum = segsOf(o).reduce(function (a, s) { return a + (fin(s.value) ? Math.max(s.value, 0) : 0); }, 0);
      return max > 0 ? clamp(sum / max, 0, 1) : 0;
    };
    return make('progress', opts, {
      mount: function (c) {
        if (!c.opts.bare) { c.row = h('div', 'dc-prow'); c.row.appendChild(h('span', 'n')); c.row.appendChild(h('span', 'p dc-mono')); c.el.appendChild(c.row); }
        c.el.appendChild(c.canvas);
        c.canvas.style.margin = -B(c) + 'px 0';
        if (!c.opts.bare) { c.detail = h('div', 'dc-pdetail'); c.el.appendChild(c.detail); }
        this.refresh(c);
      },
      refresh: function (c) {
        if (!c.row) return;
        c.row.firstChild.textContent = c.opts.label == null ? '' : c.opts.label;
        c.row.lastChild.textContent = Math.round(ratioOf(c.opts) * 100) + '%';
        c.detail.textContent = c.opts.detail == null ? '' : c.opts.detail; c.detail.hidden = c.opts.detail == null;
        c.gen = -1;
      },
      recolor: function (c) {
        if (!c.row) return;
        c.row.firstChild.style.color = rgba(color(c, 'ink'), 1); c.row.lastChild.style.color = rgba(color(c, 'ink'), 0.55); c.detail.style.color = rgba(color(c, 'ink'), 0.55);
      },
      height: function (c, w, cell) { return 3 * cell + 2 * B(c); },
      draw: function (E, o, c) {
        var cell = E.cell, by = B(c), cols = Math.floor(E.w / cell), segs = segsOf(o);
        var max = fin(num(o.max)) ? num(o.max) : 100, grow = E.at(0, 800);
        var trackName = o.track || segs[0].color, track = E.col(trackName, 0.14);
        // les bornes de chaque segment, en colonnes, à la croissance courante
        var acc = 0, spans = segs.map(function (s) {
          var a = Math.round(cols * clamp(acc / max, 0, 1) * grow); acc += fin(s.value) ? Math.max(s.value, 0) : 0;
          return [a, Math.round(cols * clamp(acc / max, 0, 1) * grow)];
        });
        var head = spans.length ? spans[spans.length - 1][1] : 0;
        if (by) spans.forEach(function (sp, k) { if (sp[1] > sp[0]) E.glow(sp[0] * cell, by, (sp[1] - sp[0]) * cell, 3 * cell, segs[k].color, 0.3); });
        E.ctx.fillStyle = track; E.ctx.fillRect(0, by, cols * cell, 3 * cell);
        var rects = runs(cols, 3, function (col, row) {
          if (col >= head) return null;
          for (var k = 0; k < spans.length; k++) {
            var sp = spans[k]; if (col < sp[0] || col >= sp[1]) continue;
            // une comète : clairsemée au départ, pleine à la tête
            var tone = 0.3 + 0.7 * Math.pow((col - sp[0]) / Math.max(sp[1] - sp[0], 1), 1.5);
            return col >= sp[1] - 3 || inked(col, row, tone) ? k : null;
          }
          return null;
        });
        var tints = segs.map(function (s) { return E.col(s.color); });
        E.cells(0, by, rects, function (k) { return tints[k]; });
      },
      aria: function (o) { return (o.label ? o.label + ' : ' : '') + Math.round(ratioOf(o) * 100) + ' %'; }
    });
  }

  // ================================================================ carte de chaleur

  function heatmap(opts) {
    var SQUARE = 4, PITCH = 5;
    // la géométrie dépend de la largeur : la hauteur et le tracé la calculent pareil
    var layout = function (c, W, cell) {
      var o = c.opts, values = o.values || [], n = values.reduce(function (m, r) { return Math.max(m, (r || []).length); }, 0);
      var rowsL = o.rows || [], colsL = o.columns || [];
      c.ctx.font = '10px ' + (c.mono || 'monospace');
      var gutter = rowsL.length ? Math.min(Math.ceil(Math.max.apply(null, rowsL.map(function (l) { return c.ctx.measureText(String(l)).width; }))) + 10, Math.round(W * 0.4)) : 0;
      var top = colsL.length ? 18 : 0, cols = Math.max(0, Math.floor((W - gutter) / cell));
      // carrés de 4 cellules au pas de 5, une tuile de Bayer chacun ; un calendrier étroit garde ses dernières colonnes.
      // fill : les cases s'étirent en largeur jusqu'au bord, pour quelques colonnes seulement (des passes, des semaines)
      var tw = SQUARE, th = SQUARE, px = PITCH, fits = Math.max(1, Math.floor((cols + PITCH - SQUARE) / PITCH));
      if (o.fill && n) { px = Math.max(PITCH, Math.floor((cols + 1) / n)); tw = px - 1; fits = n; }
      return { values: values, n: n, gutter: gutter, top: top, cols: cols, tw: tw, th: th, px: px, py: th + 1, fits: fits, skip: Math.max(0, n - fits) };
    };
    return make('heatmap', opts, {
      mount: function (c) { c.el.appendChild(c.canvas); },
      height: function (c, w, cell) { var L = layout(c, w, cell); return L.top + Math.max(1, L.values.length) * L.py * cell; },
      draw: function (E, o, c) {
        var cell = E.cell, L = layout(c, E.w, cell), values = L.values, SQUARE = L.th, PITCH = L.py;
        if (!L.n || ![].concat.apply([], values).map(num).some(fin)) return E.empty(o.empty);
        var high = Math.max.apply(null, [1e-9].concat([].concat.apply([], values).map(num).filter(fin)));
        var ox = E.snap(L.gutter), oy = E.snap(L.top), pitch = PITCH * cell;
        var levels = []; for (var k = 0; k < L.fits; k++) levels.push(E.at(k * 14, 420)); // la trame de chaque colonne s'épaissit, de gauche à droite
        var hovered = null;
        if (E.hover) {
          var hx = E.hover.x - ox, hy = E.hover.y - oy;
          if (hx >= 0 && hy >= 0) { var hc = Math.floor(hx / (L.px * cell)), hr = Math.floor(hy / pitch); if (hc < L.fits && hr < values.length && fin(num((values[hr] || [])[hc + L.skip]))) hovered = [hr, hc + L.skip]; }
        }
        if (hovered) c.hit = hovered;
        var rects = runs(L.cols, values.length * PITCH, function (col, row) {
          var x = col % L.px, y = row % PITCH, tc = Math.floor(col / L.px);
          if (x >= L.tw || y >= SQUARE || tc >= L.fits) return null;
          var r = Math.floor(row / PITCH), v = num((values[r] || [])[tc + L.skip]);
          if (!fin(v)) return null;
          if (v <= 0) return 't';
          var tone = (0.25 + 0.75 * v / high) * levels[tc];
          if (hovered && hovered[0] === r && hovered[1] === tc + L.skip) tone = Math.min(tone + 0.3, 14 / 16); // la case survolée s'allume, toujours tramée
          return inked(x, y, Math.round(tone * 16) / 16) ? 'i' : 't';
        });
        var tint = E.col(o.color || 'accent'), track = E.ink(0.07);
        E.cells(ox, oy, rects, function (key) { return key === 'i' ? tint : track; });
        (o.rows || []).forEach(function (l, i) {
          if ((o.rows || []).length > 4 && i % 2 === 1 && !o.fill) return; // une rangée sur deux, comme un calendrier
          var s = String(l), maxW = L.gutter - 10;
          while (s.length > 1 && E.measure(s, E.mono(10)) > maxW) s = s.slice(0, -2) + '…';
          E.text(s, 0, oy + i * pitch + SQUARE * cell / 2, 'left', E.mono(10), E.ink(0.45));
        });
        var prev = null;
        (o.columns || []).slice(L.skip).forEach(function (l, i) {
          var x = i * L.px * cell;
          if (prev && (prev[0] === l || x - prev[1] < 36)) return; // une étiquette où elle commence, si elle dégage la précédente
          prev = [l, x];
          E.text(String(l), ox + x, L.top / 2, 'left', E.mono(10), E.ink(0.45));
        });
        if (hovered) {
          var custom = o.readout ? o.readout(hovered[0], hovered[1]) : null;
          var name = [(o.rows || [])[hovered[0]], (o.columns || [])[hovered[1]]].filter(function (x) { return x != null; }).join(' · ');
          var cx = ox + (hovered[1] - L.skip) * L.px * cell + L.tw * cell, cy = oy + hovered[0] * pitch + SQUARE * cell / 2;
          if (custom) E.readout(custom.title || name, custom.rows.map(function (r) { return [r[0] ? E.rgb(r[0]) : null, r[1], r[2]]; }), cx, cy);
          else E.readout(name, [[E.rgb(o.color || 'accent'), 'valeur', reading(num(values[hovered[0]][hovered[1]]))]], cx, cy);
        }
      },
      aria: function (o) { return 'carte de chaleur, ' + (o.values || []).length + ' rangées'; }
    });
  }

  return {
    CELL: CELL, inked: inked, runs: runs, compact: compact, Scale: Scale, Curve: Curve, lineRows: lineRows, splitDelta: splitDelta,
    cssColor: cssColor, configure: configure,
    chart: chart, gauge: gauge, donut: donut, progress: progress, heatmap: heatmap, trend: trend, stat: stat, delta: delta
  };
});
