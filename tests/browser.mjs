import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// A bounded preview: the server and browser close when this check finishes.
const root = resolve('dist');
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const results = { browser: '', checks: [], widths: [], contrast: {}, requests: [], errors: [], accessibility: [] };
const check = (name, detail) => { results.checks.push({ name, detail, passed: true }); console.log(`PASS ${name}: ${detail}`); };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (path === '/iframe.html' || path === '/opaque.html') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html><html lang="en"><title>Iframe check</title><body style="margin:0"><iframe title="Skyline game" sandbox="allow-scripts${path === '/iframe.html' ? ' allow-same-origin' : ''}" src="/preview/" style="border:0;width:100%;height:900px"></iframe></body></html>`);
  }
  if (!path.startsWith('/preview/')) { res.writeHead(404); return res.end(); }
  const file = resolve(root, '.' + path.slice('/preview'.length), path.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(root + '/')) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] ?? 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;

async function inspectWidth(page, width, height = 900) {
  await page.setViewportSize({ width, height });
  const metrics = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth,
    buttons: [...document.querySelectorAll('button')].map(el => ({ name: el.getAttribute('aria-label') || el.textContent.trim(), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) }));
  assert.ok(metrics.body <= width && metrics.document <= width, `Overflow at ${width}: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.buttons.every(b => b.width >= 44 && b.height >= 44), 'Touch targets at least 44px');
  results.widths.push(metrics);
  check(`Reflow ${width}px`, 'No horizontal overflow; all game button targets at least 44 × 44px');
}

async function alignedDrop(page, count) {
  await page.evaluate(async targetCount => {
    await new Promise((resolve, reject) => {
      const start = performance.now();
      function frame() {
        if (performance.now() - start > 10000) return reject(new Error('Timed out finding an aligned floor'));
        const board = document.querySelector('.blueprint');
        const floor = document.querySelector('[data-floor="moving"]');
        const top = document.querySelector(`[data-floor="${targetCount - 1}"]`);
        const x = Number(floor?.getAttribute('data-x'));
        const target = top ? Number(top.getAttribute('data-x')) : 120;
        if (board?.getAttribute('data-phase') === 'swinging' && Math.abs(x - target) < 2.8) {
          document.querySelector('.scene-hit').click(); resolve(); return;
        }
        requestAnimationFrame(frame);
      }
      frame();
    });
  }, count);
  await page.waitForFunction(expected => Number(document.querySelector('[data-testid="height"]').textContent) === expected, count);
}

try {
  browser = await chromium.launch({ headless: true });
  results.browser = `Chromium ${browser.version()}`;
  const context = await browser.newContext({ viewport: { width: 1200, height: 950 } });
  const page = await context.newPage();
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') results.errors.push(message.text()); });
  page.on('request', request => results.requests.push(request.url().replace(origin, 'LOCAL')));
  page.on('requestfailed', request => results.errors.push(`Request failed: ${request.url()}`));
  await page.goto(`${origin}/preview/`);
  await page.getByRole('heading', { name: 'One floor at a time.' }).waitFor();
  await inspectWidth(page, 1200, 950);
  assert.equal(await page.locator('[data-testid="best"]').textContent(), '00');
  await page.screenshot({ path: `${artifacts}/desktop.png`, fullPage: true });

  for (const width of [768, 744, 560, 360, 320]) await inspectWidth(page, width);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: `${artifacts}/mobile.png`, fullPage: true });
  let audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  results.accessibility.push({ state: 'ready, 360px', violations: audit.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => n.target) })) });
  assert.equal(audit.violations.length, 0, JSON.stringify(results.accessibility));
  check('Accessibility scan, mobile ready', 'No automated WCAG A/AA violations');

  await page.setViewportSize({ width: 1200, height: 950 });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to game');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Skyline, go to game');
  await page.keyboard.press('Tab');
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Start building/);
  await page.screenshot({ path: `${artifacts}/keyboard-focus.png`, fullPage: true });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="height"]').textContent) === 1);
  const firstWidth = await page.locator('[data-floor="1"]').getAttribute('data-width');
  assert.ok(Number(firstWidth) < 160 && Number(firstWidth) > 0);
  check('Keyboard start and drop', `Enter starts, Space drops; first overhang leaves width ${firstWidth}`);

  await page.keyboard.press('p');
  await page.getByRole('heading', { name: 'On hold.' }).waitFor();
  const beforePause = await page.locator('[data-floor="moving"]').getAttribute('data-x');
  await page.waitForTimeout(180);
  assert.equal(await page.locator('[data-floor="moving"]').getAttribute('data-x'), beforePause);
  await page.keyboard.press('p');
  assert.equal(await page.locator('.blueprint').getAttribute('data-paused'), 'false');
  check('Pause and resume', 'P freezes the moving floor and resumes it');

  for (let floor = 2; floor <= 12; floor++) await alignedDrop(page, floor);
  const finalWidth = Number(await page.locator('[data-floor="12"]').getAttribute('data-width'));
  assert.ok(finalWidth <= Number(firstWidth) && finalWidth >= Number(firstWidth) / 2);
  assert.equal(await page.locator('[data-testid="best"]').textContent(), '12');
  await page.keyboard.press('p');
  await page.screenshot({ path: `${artifacts}/paused.png`, fullPage: true });
  await page.keyboard.press('p');
  await page.screenshot({ path: `${artifacts}/building.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  const tallLayout = await page.evaluate(() => ({ moving: document.querySelector('[data-floor="moving"] > rect').getBoundingClientRect().top, counter: document.querySelector('.height-display').getBoundingClientRect().bottom }));
  assert.ok(tallLayout.moving > tallLayout.counter + 18, JSON.stringify(tallLayout));
  await page.screenshot({ path: `${artifacts}/mobile-building.png`, fullPage: true });
  await page.setViewportSize({ width: 1200, height: 950 });
  check('Tower growth and aligned drops', `12 floors; surviving width ${finalWidth}; best updates during run`);

  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const started = performance.now();
      function frame() {
        if (performance.now() - started > 10000) return reject(new Error('Miss timing failed'));
        const moving = document.querySelector('[data-floor="moving"]');
        const top = document.querySelector('[data-floor="12"]');
        const x = Number(moving.getAttribute('data-x')), width = Number(moving.getAttribute('data-width'));
        const target = Number(top.getAttribute('data-x'));
        if (x + width < target - 5 || x > target + width + 5) { document.querySelector('.primary-button').click(); resolve(); }
        else requestAnimationFrame(frame);
      }
      frame();
    });
  });
  await page.waitForFunction(() => document.querySelector('.blueprint').getAttribute('data-phase') === 'over');
  assert.match(await page.locator('.rankings').textContent(), /Build 01/);
  assert.equal(await page.locator('.rank-height').textContent(), '12');
  const perfects = Number((await page.locator('.rankings li > div > span').textContent()).split(' ')[0]);
  assert.ok(perfects >= 6, `Expected multiple perfect drops, got ${perfects}`);
  await page.screenshot({ path: `${artifacts}/game-over.png`, fullPage: true });
  audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  results.accessibility.push({ state: 'complete, 1200px', violations: audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })) });
  assert.equal(audit.violations.length, 0, JSON.stringify(results.accessibility));
  await page.getByRole('button', { name: 'Build again' }).click();
  assert.equal(await page.locator('[data-testid="height"]').textContent(), '00');
  assert.equal(await page.locator('[data-testid="best"]').textContent(), '12');
  check('Build again', 'Result action starts a fresh run and retains the best height');
  await page.reload();
  assert.equal(await page.locator('[data-testid="best"]').textContent(), '12');
  assert.equal(await page.locator('.rank-height').textContent(), '12');
  check('Miss, records, persistence', 'Miss ends run, ranks height 12, and best/leaderboard survive reload');
  await page.getByRole('button', { name: 'Start building' }).click();
  assert.equal(await page.locator('[data-testid="height"]').textContent(), '00');
  check('Restart', 'Fresh tower, retained personal best');

  results.contrast = await page.evaluate(() => {
    function luminance(rgb) { const values = rgb.map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722; }
    function ratio(a, b) { const l1 = luminance(a), l2 = luminance(b); return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)); }
    const rgb = str => str.match(/[\d.]+/g).slice(0, 3).map(Number);
    const pairs = [ ['Body on paper', 'h1', ':root'], ['Muted on paper', '.intro-copy', ':root'], ['Muted on card', '.section-description', '.leaderboard'], ['Button text', '.primary-button', '.primary-button'], ['Tip text', '.guide-tip p', '.guide-tip'] ];
    const output = {};
    for (const [name, fg, bg] of pairs) {
      const foreground = getComputedStyle(document.querySelector(fg)).color;
      const background = getComputedStyle(document.querySelector(bg)).backgroundColor;
      output[name] = { foreground, background, ratio: ratio(rgb(foreground), rgb(background)) };
    }
    // Grid crossings composite 3.5%, 3.5%, 4.7%, 4.7% white on blue.
    const background = rgb(getComputedStyle(document.querySelector('.blueprint')).backgroundColor);
    const grid = [9/255, 9/255, 12/255, 12/255].reduce((color, alpha) => color.map(c => c * (1-alpha) + 255 * alpha), background);
    for (const [name, selector] of [['Blueprint main on grid crossing', '.board-heading'], ['Blueprint muted on grid crossing', '.height-unit']]) output[name] = { ratio: ratio(rgb(getComputedStyle(document.querySelector(selector)).color), grid), background: grid };
    return output;
  });
  assert.ok(Object.values(results.contrast).every(pair => pair.ratio >= 4.5), JSON.stringify(results.contrast));
  check('Contrast', 'Computed text/background pairs, including brightest grid crossings, meet 4.5:1');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  assert.equal(await page.locator('.primary-button').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await page.getByRole('button', { name: 'Start building' }).click();
  await page.getByRole('button', { name: 'Drop floor', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="height"]').textContent) === 1);
  assert.equal(await page.locator('.cut-piece').count(), 0);
  check('Reduced motion', 'No button transitions or cut-piece effect; essential swing remains user-started');

  await page.reload();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${artifacts}/text-enlargement.png`, fullPage: true });
  check('Text enlargement', '200% root font size at 360px has no horizontal overflow (not native browser zoom)');

  const touch = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  const mobile = await touch.newPage();
  await mobile.goto(`${origin}/preview/`);
  await mobile.getByRole('button', { name: 'Start building' }).tap();
  await mobile.locator('.scene-hit').tap();
  await mobile.waitForFunction(() => Number(document.querySelector('[data-testid="height"]').textContent) === 1);
  await mobile.getByRole('button', { name: 'Pause game' }).tap();
  assert.equal(await mobile.locator('.blueprint').getAttribute('data-paused'), 'true');
  check('Mobile touch', 'Tap to start, tap playfield to drop, tap to pause at 360px');
  await touch.close();

  const iframePage = await context.newPage();
  await iframePage.goto(`${origin}/iframe.html`);
  const iframe = iframePage.frameLocator('iframe');
  await iframe.getByRole('button', { name: 'Start building' }).click();
  await iframe.getByRole('button', { name: 'Drop floor', exact: true }).click();
  await iframe.locator('[data-testid="height"]').filter({ hasText: '01' }).waitFor();
  check('Iframe', 'Game starts and stacks a floor inside a sandbox with scripts and same-origin access');
  await iframePage.goto(`${origin}/opaque.html`);
  const opaque = iframePage.frameLocator('iframe');
  await opaque.getByText('Storage is unavailable. Records last for this session only.').waitFor();
  await opaque.getByRole('button', { name: 'Start building' }).click();
  await opaque.getByRole('button', { name: 'Drop floor', exact: true }).click();
  await opaque.locator('[data-testid="height"]').filter({ hasText: '01' }).waitFor();
  check('Storage-denied iframe', 'Game remains playable with an explicit session-only record notice');
  assert.ok(results.requests.every(url => url.startsWith('LOCAL/')), JSON.stringify(results.requests));
  assert.deepEqual(results.errors, []);
  check('Network and console', 'All observed app requests are local static assets; no errors or failed requests');
} catch (error) {
  results.failure = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(`${artifacts}/browser-results.json`, JSON.stringify(results, null, 2) + '\n');
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
