import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const files = new Set(['demo.html', 'demo.mjs', 'controls.mjs', 'state.mjs', 'intent.mjs']);
const server = createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'demo.html';
  if (!files.has(file)) { res.writeHead(404).end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'text/javascript'); res.end(await readFile(new URL(file, import.meta.url))); }
  catch { res.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/demo.html`);
  await page.waitForFunction(() => Boolean(document.querySelector('content-preferences')?.shadowRoot?.querySelector('#prepare')));
  await page.evaluate(() => {
    window.requests = [];
    document.querySelector('content-preferences').addEventListener('content-request', event => window.requests.push(event.detail));
  });

  await test('button and typed selections share state without accidental generation', async () => {
    await page.getByRole('radio', { name: 'Educational', exact: true }).check();
    await page.getByRole('radio', { name: 'Bold', exact: true }).check();
    assert.equal(await page.evaluate(() => requests.length), 0);
    await page.getByLabel('Say it or type it').fill('Tone: emotional and intensity: calm');
    await page.getByRole('button', { name: 'Apply instruction' }).click();
    await page.waitForFunction(() => document.querySelector('content-preferences').preferences.values.tone === 'emotional');
    assert.equal(await page.getByRole('radio', { name: 'Calm', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => requests.length), 0);
    await page.getByRole('button', { name: 'Prepare request' }).click();
    assert.equal(await page.evaluate(() => requests.length), 1);
    assert.match(await page.locator('#prompt').textContent(), /Writing style: emotional/);
  });

  await test('custom requirements survive preset changes and old prompts become stale', async () => {
    await page.getByText('Customise wording', { exact: true }).click();
    await page.getByLabel('Custom voice or extra wording').fill('no slang');
    await page.getByRole('radio', { name: 'Professional', exact: true }).check();
    assert.equal(await page.getByLabel('Custom voice or extra wording').inputValue(), 'no slang');
    assert.equal(await page.getByRole('button', { name: 'Copy Hermes prompt' }).isDisabled(), true);
  });

  await test('unsupported compound commands do not partially apply', async () => {
    await page.getByLabel('Say it or type it').fill('Make it emotional but no jargon');
    await page.getByRole('button', { name: 'Apply instruction' }).click();
    await page.waitForFunction(() => document.querySelector('content-preferences').shadowRoot.querySelector('.status').dataset.error === 'true');
    assert.equal(await page.getByRole('radio', { name: 'Professional', exact: true }).isChecked(), true);
  });

  await test('late voice cannot overwrite a newer click; interim speech does not execute', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('content-preferences');
      el.speechAdapter = { start(callbacks) { window.speechCallbacks = callbacks; callbacks.onStart(); return { stop() { callbacks.onEnd(); }, abort() {} }; } };
    });
    await page.getByRole('button', { name: 'Use microphone' }).click();
    await page.evaluate(() => speechCallbacks.onInterim('Make this emotional'));
    await page.getByRole('radio', { name: 'Educational', exact: true }).check();
    await page.evaluate(() => { speechCallbacks.onFinal('Make this emotional'); speechCallbacks.onEnd(); });
    await page.waitForFunction(() => document.querySelector('content-preferences').shadowRoot.querySelector('.status').textContent.includes('newer choice'));
    assert.equal(await page.getByRole('radio', { name: 'Educational', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => requests.length), 1);
  });

  await test('a completed voice instruction updates controls and emits at most one rewrite', async () => {
    await page.getByRole('button', { name: 'Use microphone' }).click();
    await page.evaluate(() => { speechCallbacks.onFinal('Make this emotional, but keep it subtle'); speechCallbacks.onFinal('Make this emotional, but keep it subtle'); speechCallbacks.onEnd(); });
    await page.waitForFunction(() => window.requests.length === 2);
    assert.equal(await page.getByRole('radio', { name: 'Emotional', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('radio', { name: 'Calm', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => requests[1].action), 'rewrite');
    assert.match(await page.locator('#request-info').textContent(), /no generated draft to rewrite/);
  });

  await test('reaffirming a selected radio protects it from older voice input', async () => {
    await page.getByRole('button', { name: 'Use microphone' }).click();
    await page.getByRole('radio', { name: 'Emotional', exact: true }).click();
    await page.evaluate(() => { speechCallbacks.onFinal('Make this educational'); speechCallbacks.onEnd(); });
    await page.waitForFunction(() => document.querySelector('content-preferences').shadowRoot.querySelector('.status').textContent.includes('newer choice'));
    assert.equal(await page.getByRole('radio', { name: 'Emotional', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => requests.length), 2);
  });

  await test('manually applying a transcript retires its capture and prevents duplicate requests', async () => {
    await page.getByRole('button', { name: 'Use microphone' }).click();
    await page.evaluate(() => speechCallbacks.onInterim('Generate'));
    await page.getByRole('button', { name: 'Apply instruction' }).click();
    await page.waitForFunction(() => window.requests.length === 3);
    await page.evaluate(() => { speechCallbacks.onFinal('Generate'); speechCallbacks.onEnd(); });
    assert.equal(await page.evaluate(() => requests.length), 3);
  });

  await test('cancelled async voice interpretation cannot apply settings or request content', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('content-preferences');
      window.previousInterpreter = el.interpretText;
      el.interpretText = () => new Promise(resolve => { window.resolveIntent = resolve; });
    });
    await page.getByRole('button', { name: 'Use microphone' }).click();
    await page.evaluate(() => { speechCallbacks.onFinal('Make this professional'); speechCallbacks.onEnd(); document.querySelector('content-preferences').cancelVoice(); resolveIntent({ patch: { tone: 'professional' }, action: 'rewrite' }); });
    assert.equal(await page.getByRole('radio', { name: 'Emotional', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => requests.length), 3);
    await page.evaluate(() => { document.querySelector('content-preferences').interpretText = previousInterpreter; });
  });

  await test('scope changes appear on screen and broken speech adapters recover', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('content-preferences');
      el.setAttribute('scope-label', 'Selected caption');
      el.speechAdapter = { start(callbacks) { callbacks.onStart(); return { stop() { throw new Error('test stop failure'); }, abort() { throw new Error('test abort failure'); } }; } };
    });
    assert.equal(await page.locator('content-preferences').getByText('Selected caption', { exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Use microphone' }).click();
    await page.getByRole('button', { name: 'Finish speaking' }).click();
    assert.equal(await page.getByRole('button', { name: 'Use microphone' }).getAttribute('aria-pressed'), 'false');
  });

  await test('browser speech waits for the whole utterance and combines final segments', async () => {
    await page.evaluate(() => {
      window.SpeechRecognition = class {
        constructor() { window.nativeRecognition = this; }
        start() { this.onstart(); }
        stop() { this.onend(); }
        abort() {}
      };
      document.querySelector('content-preferences').speechAdapter = null;
    });
    await page.getByRole('button', { name: 'Use microphone' }).click();
    await page.evaluate(() => nativeRecognition.onresult({ resultIndex: 0, results: [{ 0: { transcript: 'Tone: educational.' }, isFinal: true }, { 0: { transcript: 'Intensity: bold.' }, isFinal: true }] }));
    assert.equal(await page.getByRole('radio', { name: 'Emotional', exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Finish speaking' }).click();
    await page.waitForFunction(() => document.querySelector('content-preferences').preferences.values.tone === 'educational');
    assert.equal(await page.getByRole('radio', { name: 'Bold', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => requests.length), 3);
  });

  await test('missing microphone support leaves keyboard and text controls usable', async () => {
    await page.evaluate(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; document.querySelector('content-preferences').speechAdapter = null; });
    assert.equal(await page.getByRole('button', { name: 'Use microphone' }).isDisabled(), true);
    await page.getByLabel('Say it or type it').fill('Intensity: balanced');
    await page.getByRole('button', { name: 'Apply instruction' }).click();
    await page.waitForFunction(() => document.querySelector('content-preferences').preferences.values.intensity === 'balanced');
    assert.equal(await page.getByRole('radio', { name: 'Balanced', exact: true }).isChecked(), true);
  });

  await test('mobile layout fits and the browser reports no script errors', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
  });
  if (process.env.CONTROLS_SCREENSHOT) {
    await page.setViewportSize({ width: 1280, height: 1050 });
    await page.reload();
    await page.waitForFunction(() => Boolean(document.querySelector('content-preferences')?.shadowRoot?.querySelector('#prepare')));
    await page.screenshot({ path: process.env.CONTROLS_SCREENSHOT, fullPage: true });
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
