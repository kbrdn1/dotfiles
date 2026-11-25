#!/usr/bin/env node
// me:report : captures du rendu d'une branche, depuis captures.json (format : references/captures.md).
// Écrit captures/<id>.png (baseUrl), captures/<id>.before.png (beforeUrl, si la base sait montrer ce plan) et
// captures/sha (HEAD court) seulement quand plus aucune capture n'est en retard ou sans image.
//
// Usage, depuis le worktree de la branche (le serveur de la branche doit tourner sur baseUrl) :
//   node ~/.claude/skills/me/report/capture.mjs              toutes les captures
//   node …/capture.mjs --stale                              les captures en retard ou sans image (facts.json, donc
//                                                           collect.py d'abord : il calcule STALE, ce script non)
//   node …/capture.mjs --only id1,id2                       ces captures-là
// Options : --out DIR (dossier du rapport, sinon `collect.py --dir`), --repo DIR (pour HEAD, sinon le cwd).
// Playwright : aucune dépendance dans le dépôt. playwright-core est pris dans $PLAYWRIGHT_CORE, sinon dans
// node_modules du cwd, sinon dans le cache npx de @playwright/mcp (le plus récent) ; Chromium : celui qu'il attend,
// sinon le chromium_headless_shell le plus récent de ~/Library/Caches/ms-playwright ($PLAYWRIGHT_CHROMIUM force).
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MARGIN = 24
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
}
const JOBS = 3

const die = (msg) => { console.error('capture: ' + msg); process.exit(2) }
const sh = (cmd, args, cwd) => { try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null } }

function args(argv) {
  const a = { only: [], stale: false, out: null, repo: process.cwd() }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--stale') a.stale = true
    else if (k === '--only') a.only.push(...String(argv[++i] || '').split(',').filter(Boolean))
    else if (k === '--out') a.out = argv[++i]
    else if (k === '--repo') a.repo = argv[++i]
    else die('option inconnue : ' + k)
  }
  return a
}

function playwright() {
  const tries = []
  if (process.env.PLAYWRIGHT_CORE) tries.push(process.env.PLAYWRIGHT_CORE)
  tries.push(join(process.cwd(), 'node_modules', 'playwright-core'))
  const npx = join(homedir(), '.npm', '_npx')
  if (existsSync(npx)) {
    readdirSync(npx).map((d) => join(npx, d, 'node_modules', 'playwright-core'))
      .filter((p) => existsSync(join(p, 'package.json')))
      .sort((x, y) => statSync(join(y, 'package.json')).mtimeMs - statSync(join(x, 'package.json')).mtimeMs)
      .forEach((p) => tries.push(p))
  }
  for (const p of tries) {
    try { return { pw: createRequire(join(p, 'package.json'))(p), from: p } } catch { /* suivant */ }
  }
  die('playwright-core introuvable. Une fois : `npx -y @playwright/mcp@latest --help` (remplit le cache npx), ou PLAYWRIGHT_CORE=<dossier de playwright-core>.')
}

function chromiumPath(chromium) {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM
  const want = chromium.executablePath()
  if (want && existsSync(want)) return undefined // celui qu'attend playwright-core
  // ponytail: révision la plus haute du cache, protocole CDP assez stable d'une révision à la voisine
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), 'Library', 'Caches', 'ms-playwright')
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium_headless_shell-\d+$/.test(d)) : []
  dirs.sort((x, y) => +y.split('-')[1] - +x.split('-')[1])
  for (const d of dirs) {
    for (const sub of readdirSync(join(cache, d))) {
      const exe = join(cache, d, sub, 'chrome-headless-shell')
      if (existsSync(exe)) return exe
    }
  }
  die(`aucun Chromium : ${want} absent et pas de chromium_headless_shell-* dans ${cache}. PLAYWRIGHT_CHROMIUM=<exécutable> pour en donner un.`)
}

function writeAtomic(path, buf) {
  const tmp = join(dirname(path), '.tmp-' + process.pid + '-' + Math.random().toString(36).slice(2))
  writeFileSync(tmp, buf)
  renameSync(tmp, path) // la page live ne lit jamais une PNG à moitié écrite
}

async function shoot(browser, m, shot, base) {
  const v = VIEWPORTS[shot.viewport]
  if (!v) throw new Error('viewport inconnu : ' + shot.viewport)
  const theme = shot.theme || 'light'
  const reducedMotion = (shot.reducedMotion ?? m.reducedMotion) ? 'reduce' : 'no-preference'
  const ctx = await browser.newContext({ ...v, colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion })
  // le thème comme le site le stocke (nuxt-color-mode par défaut), plus les réglages fixés par le manifeste
  await ctx.addInitScript(([key, theme, storage]) => {
    try {
      if (key) localStorage.setItem(key, theme)
      for (const k in storage) localStorage.setItem(k, storage[k])
    } catch { /* stockage refusé : le colorScheme reste */ }
  }, [m.themeKey === undefined ? 'nuxt-color-mode' : m.themeKey, theme, m.storage || {}])
  const page = await ctx.newPage()
  try {
    const res = await page.goto(base.replace(/\/$/, '') + (shot.route || '/'), { waitUntil: 'load', timeout: 60_000 })
    if (!res || res.status() >= 400) return { skip: 'HTTP ' + (res ? res.status() : '?') }
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {})
    const css = shot.css ?? m.css
    if (css) await page.addStyleTag({ content: css })
    await page.waitForTimeout(shot.settle ?? m.settle ?? 2000) // entrées animées de la page, données client
    // un thème mal appliqué donne une capture fausse : on s'arrête plutôt
    const bad = await page.evaluate((t) => {
      const h = document.documentElement, has = (x) => h.classList.contains(x) || h.dataset.theme === x
      if (has(t)) return null
      if (t !== 'light' && t !== 'dark') return 'classe ou data-theme « ' + t + ' » absente de <html>'
      return has(t === 'light' ? 'dark' : 'light') ? '<html> porte le thème opposé' : null
    }, theme)
    if (bad) throw new Error('thème non appliqué : ' + bad)
    // mi-course : on retient les animations déjà là (trame, boucles) pour ne figer que celles que les actions lancent
    if (shot.midway != null) await page.evaluate(() => { window.__capPre = new Set(document.getAnimations()) })
    for (const a of shot.actions || []) {
      const [k, val] = Object.entries(a)[0] || []
      const loc = () => page.locator(val).first()
      if (k === 'click') await loc().click({ timeout: 8_000 })
      else if (k === 'hover') await loc().hover({ timeout: 8_000 })
      else if (k === 'focus') await loc().focus({ timeout: 8_000 })
      else if (k === 'scroll') await loc().evaluate((n) => n.scrollIntoView({ block: 'center' }), undefined, { timeout: 8_000 })
      else if (k === 'press') await page.keyboard.press(val)
      else if (k === 'wait') await page.waitForTimeout(+val)
      else throw new Error('action inconnue : ' + JSON.stringify(a))
    }
    if (shot.midway != null) {
      // attendre les animations nées des actions (entrée d'une modale, transition), les poser à `midway` ms, tout figer
      const n = await page.evaluate(async (t) => {
        const pre = window.__capPre || new Set(), fresh = () => document.getAnimations().filter((x) => !pre.has(x))
        for (let i = 0; i < 90 && !fresh().length; i++) await new Promise(requestAnimationFrame)
        await new Promise(requestAnimationFrame) // celles qui partent dans la même image
        const list = fresh()
        document.getAnimations().forEach((x) => x.pause())
        list.forEach((x) => { x.currentTime = t })
        return list.length
      }, shot.midway)
      if (!n) return { skip: 'aucune animation lancée par les actions' }
      await page.waitForTimeout(100)
    }
    let clip
    if (shot.selector) {
      const el = page.locator(shot.selector).first()
      await el.waitFor({ state: 'visible', timeout: 10_000 })
      if (shot.midway == null) await el.scrollIntoViewIfNeeded()
      let b = await el.boundingBox()
      const vp = page.viewportSize()
      if (b.height + 2 * MARGIN > vp.height) {
        // plus haut que la fenêtre : on l'agrandit, le fond fixe reste derrière l'élément (pas de fullPage) ; 120 px
        // de chaque côté pour que les barres fixes du site (en-tête, dock) ne mordent pas sur l'élément centré
        await page.setViewportSize({ width: vp.width, height: Math.ceil(b.height + 2 * MARGIN + 240) })
        await el.evaluate((n) => n.scrollIntoView({ block: 'center' }))
        await page.waitForTimeout(500)
        b = await el.boundingBox()
      }
      const w = page.viewportSize(), x = Math.max(0, b.x - MARGIN), y = Math.max(0, b.y - MARGIN)
      clip = { x, y, width: Math.min(w.width, b.x + b.width + MARGIN) - x, height: Math.min(w.height, b.y + b.height + MARGIN) - y }
    }
    return { png: await page.screenshot(clip ? { clip } : {}) }
  } finally {
    await ctx.close()
  }
}

async function main() {
  const a = args(process.argv.slice(2))
  const out = a.out || sh('python3', [join(HERE, 'collect.py'), '--dir'], a.repo) || die('dossier du rapport introuvable : lancer depuis le worktree, ou --out')
  const mpath = join(out, 'captures.json')
  if (!existsSync(mpath)) die('pas de manifeste : ' + mpath + ' (format : ' + join(HERE, 'references', 'captures.md') + ')')
  let m
  try { m = JSON.parse(readFileSync(mpath, 'utf8')) } catch (e) { die('captures.json invalide : ' + e.message) }
  const shots = (m.shots || []).filter((s) => s && /^[a-z0-9-]+$/.test(s.id || ''))
  if (shots.length !== (m.shots || []).length) die('un plan sans id, ou un id hors a-z0-9-')
  let facts = {}
  try { facts = JSON.parse(readFileSync(join(out, 'facts.json'), 'utf8')).facts || {} } catch { /* pas encore de rapport */ }
  let repo = sh('git', ['rev-parse', '--show-toplevel'], a.repo) || facts.repoPath
  const head = repo && sh('git', ['rev-parse', '--short', 'HEAD'], repo)
  // STALE ne se calcule qu'à un endroit, collect.py ; il n'est valable que pour le HEAD qu'il a vu
  const fresh = head && facts.headShort && head.startsWith(facts.headShort.slice(0, 7)) && facts.captures
  const late = fresh ? new Set(facts.captures.shots.filter((s) => s.stale || s.missing).map((s) => s.id)) : null
  if (a.stale && !late) die('facts.json ne décrit pas HEAD (' + (head || '?') + ') : relancer collect.py, puis --stale')
  const todo = shots.filter((s) => (a.only.length ? a.only.includes(s.id) : a.stale ? late.has(s.id) : true))
  const unknown = a.only.filter((id) => !shots.some((s) => s.id === id))
  if (unknown.length) die('ids inconnus : ' + unknown.join(', '))
  if (!todo.length) { console.log('CAPTURES  rien à refaire'); return }
  if (!m.baseUrl) die('baseUrl manquant dans captures.json')
  try { await fetch(m.baseUrl, { signal: AbortSignal.timeout(8000) }) } catch { die('baseUrl injoignable (' + m.baseUrl + ') : lancer le serveur de la branche') }
  const dirty = repo && sh('git', ['status', '--porcelain', '--untracked-files=no'], repo)
  if (dirty) console.log('ATTENTION des fichiers suivis ne sont pas commités : la capture les montre, captures/sha dira HEAD')

  const { pw, from } = playwright()
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(pw.chromium) })
  const dir = join(out, 'captures')
  mkdirSync(dir, { recursive: true })
  const ok = new Set(), failed = []
  const queue = todo.slice()
  const worker = async () => {
    for (let s; (s = queue.shift());) {
      let line
      try {
        const r = await shoot(browser, m, s, m.baseUrl)
        if (!r.png) throw new Error(r.skip)
        writeAtomic(join(dir, s.id + '.png'), r.png)
        ok.add(s.id); line = 'ok    ' + s.id
      } catch (e) {
        failed.push(s.id); console.log('ÉCHEC ' + s.id + ' : ' + String(e.message || e).split('\n')[0]); continue
      }
      // avant : la base ne sait pas toujours montrer ce plan (route neuve, élément ou action absents) ; alors pas d'avant
      const bf = join(dir, s.id + '.before.png')
      let why = 'pas de beforeUrl'
      if (m.beforeUrl) {
        try {
          const r = await shoot(browser, m, s, m.beforeUrl)
          if (r.png) { writeAtomic(bf, r.png); why = null } else why = r.skip
        } catch (e) { why = String(e.message || e).split('\n')[0] }
      }
      if (why) rmSync(bf, { force: true })
      console.log(line + (why ? ' · sans avant (' + why + ')' : ' · avant ok'))
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOBS, todo.length) }, worker))
  await browser.close()

  // captures/sha n'avance que si plus rien n'est en retard : sinon un --only « rajeunirait » les autres à tort
  // sans facts.json à jour, on ne sait pas qui est en retard : toutes celles qu'on n'a pas refaites comptent
  const pending = shots.filter((s) => !ok.has(s.id) && (!late || late.has(s.id))).map((s) => s.id)
  if (head && !pending.length) writeAtomic(join(dir, 'sha'), head + '\n')
  console.log(`CAPTURES  ${ok.size}/${todo.length} faites` + (failed.length ? ` · ${failed.length} en échec` : '') + ' · ' +
    (head && !pending.length ? 'sha ' + head : 'sha non avancé : ' + (head ? pending.length + ' encore en retard ou sans image (' + pending.slice(0, 6).join(', ') + (pending.length > 6 ? '…' : '') + ')' : 'pas de dépôt')) +
    ' · playwright-core ' + from.replace(homedir(), '~'))
  process.exitCode = failed.length ? 1 : 0
}

main().catch((e) => die(String(e && e.stack || e)))
