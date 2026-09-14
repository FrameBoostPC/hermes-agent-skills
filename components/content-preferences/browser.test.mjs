import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const files = new Set(['demo.html', 'demo.css', 'demo.mjs', 'generation-view.mjs', 'controls.mjs', 'controls-template.mjs', 'controls.css', 'state.mjs', 'intent.mjs']);
// Model fixtures exercise the UI only; these are not real inference results.
const example = JSON.parse(await readFile(new URL('../../skills/idea-to-content/examples/example-output.json', import.meta.url), 'utf8'));
const fixture = { result: example, model: 'test-model', provider: 'test-provider' };
const generationCalls = [];
const server = createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'demo.html';
  if (file === 'api/model') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ model: fixture.model, provider: fixture.provider })); return; }
  if (file === 'api/generate') {
    let body = '';
    for await (const chunk of req) body += chunk;
    generationCalls.push(JSON.parse(body));
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(fixture)); return;
  }
  if (!files.has(file)) { res.writeHead(404).end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await readFile(new URL(file, import.meta.url))); }
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
  await page.waitForFunction(() => Boolean(document.querySelector('content-preferences').shadowRoot.querySelector('link[rel=stylesheet]')?.sheet));
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
    await page.getByRole('button', { name: 'Generate content' }).click();
    assert.equal(await page.evaluate(() => requests.length), 1);
    await page.waitForFunction(() => document.querySelector('#request-info').textContent === 'Ready.');
    assert.match(generationCalls.at(-1).preferenceContext, /Writing style: emotional/);
    assert.equal(await page.locator('#results .content-copy').first().textContent(), example.data.assets[0].content);
  });

  await test('custom requirements survive preset changes and old content becomes stale', async () => {
    await page.getByText('Customise wording', { exact: true }).click();
    await page.getByLabel('Custom voice or extra wording').fill('no slang');
    await page.getByRole('radio', { name: 'Professional', exact: true }).check();
    assert.equal(await page.getByLabel('Custom voice or extra wording').inputValue(), 'no slang');
    assert.equal(await page.getByRole('button', { name: 'Copy video script' }).isDisabled(), true);
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
    await page.waitForFunction(() => document.querySelector('#request-info').textContent === 'Ready.');
    assert.equal(generationCalls.at(-1).action, 'rewrite');
    assert.deepEqual(generationCalls.at(-1).previousResult, example);
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
    await page.waitForFunction(() => document.querySelector('#request-info').textContent === 'Ready.');
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
  await page.setViewportSize({ width: 1280, height: 1050 });
  await page.reload();
  await page.waitForFunction(() => Boolean(document.querySelector('content-preferences')?.shadowRoot?.querySelector('#prepare')));
  await page.evaluate(() => {
    const first = document.querySelector('content-preferences');
    first.id = 'primary-controls';
    const mirror = document.createElement('content-preferences');
    mirror.id = 'mirror-controls';
    mirror.store = first.store;
    document.body.append(mirror);
    window.requests = [];
    for (const control of [first, mirror]) control.addEventListener('content-request', event => requests.push(event.detail));
  });
  const primary = page.locator('#primary-controls');
  const mirror = page.locator('#mirror-controls');

  await test('multiple views and outgoing requests agree after button, text, voice and direct store changes', async () => {
    await primary.getByRole('radio', { name: 'Educational', exact: true }).check();
    assert.equal(await mirror.getByRole('radio', { name: 'Educational', exact: true }).isChecked(), true);
    await page.evaluate(async () => {
      await document.querySelector('#mirror-controls').submitInstruction('Emotional and calm', { source: 'voice', eventId: 'shared-voice' });
    });
    assert.equal(await primary.getByRole('radio', { name: 'Emotional', exact: true }).isChecked(), true);
    assert.equal(await primary.getByRole('radio', { name: 'Calm', exact: true }).isChecked(), true);
    await primary.getByLabel('Say it or type it').fill('Tone: professional');
    await primary.getByRole('button', { name: 'Apply instruction' }).click();
    await page.waitForFunction(() => document.querySelector('#mirror-controls').preferences.values.tone === 'professional');
    assert.equal(await mirror.getByRole('radio', { name: 'Professional', exact: true }).isChecked(), true);
    await primary.getByRole('button', { name: 'Generate content' }).click();
    await page.evaluate(() => document.querySelector('#primary-controls').store.apply({ wording: 'plain', intensity: 'bold', customVoice: 'no slang' }, { source: 'voice' }));
    for (const control of [primary, mirror]) {
      assert.equal(await control.getByRole('radio', { name: 'Bold', exact: true }).isChecked(), true);
      assert.equal(await control.locator('input[name=wording][value=plain]').isChecked(), true);
      assert.equal(await control.locator('#custom').inputValue(), 'no slang');
      assert.equal(await control.locator('#current').textContent(), 'Professional · Bold · Plain');
    }
    assert.equal(await page.locator('#results').getAttribute('data-stale'), 'true');
    await page.evaluate(() => document.querySelector('#mirror-controls').requestContent('generate', { state: { values: { tone: 'emotional' } }, preferenceContext: 'stale override', action: 'rewrite', scope: 'wrong scope' }));
    const request = await page.evaluate(() => requests.at(-1));
    assert.equal(request.state.values.tone, 'professional');
    assert.equal(request.action, 'generate');
    assert.match(request.preferenceContext, /Writing style: professional/);
    assert.match(request.preferenceContext, /supersede older choices/);
    assert.notEqual(request.scope, 'wrong scope');
  });

  await test('reaffirming wording blocks delayed speech and requests wait for interpretation', async () => {
    await primary.getByText('Customise wording', { exact: true }).click();
    await page.evaluate(() => {
      const control = document.querySelector('#primary-controls');
      window.realInterpreter = control.interpretText;
      control.interpretText = () => new Promise(resolve => { window.resolvePending = resolve; });
      window.pendingResult = control.submitInstruction('Polished', { source: 'voice' });
    });
    assert.equal(await primary.getByRole('button', { name: 'Generate content' }).isDisabled(), true);
    assert.equal(await page.evaluate(() => document.querySelector('#primary-controls').requestContent()), false);
    await primary.getByRole('radio', { name: 'Plain', exact: true }).click();
    await page.evaluate(() => resolvePending({ patch: { wording: 'polished' }, action: 'rewrite' }));
    assert.equal(await page.evaluate(async () => (await pendingResult).status), 'conflict');
    assert.equal(await primary.getByRole('radio', { name: 'Plain', exact: true }).isChecked(), true);
    assert.equal(await mirror.locator('input[name=wording][value=plain]').isChecked(), true);
    assert.equal(await primary.getByRole('button', { name: 'Generate content' }).isEnabled(), true);
    await page.evaluate(() => { document.querySelector('#primary-controls').interpretText = realInterpreter; });
  });

  await test('replacing the active store synchronises controls and invalidates old pending input', async () => {
    await page.evaluate(async () => {
      const { createPreferenceStore } = await import('/state.mjs');
      const control = document.querySelector('#primary-controls');
      window.oldStore = control.store;
      control.interpretText = () => new Promise(resolve => { window.resolveOldScope = resolve; });
      window.oldScopeResult = control.submitInstruction('Emotional', { source: 'text' });
      control.store = createPreferenceStore({ tone: 'educational', intensity: 'calm', wording: 'polished' });
      resolveOldScope({ patch: { tone: 'emotional' }, action: 'rewrite' });
    });
    assert.equal(await page.evaluate(async () => (await oldScopeResult).status), 'superseded');
    assert.equal(await primary.locator('#current').textContent(), 'Educational · Calm · Polished');
    await page.evaluate(() => oldStore.apply({ tone: 'entertaining' }));
    assert.equal(await mirror.getByRole('radio', { name: 'Entertaining', exact: true }).isChecked(), true);
    assert.equal(await primary.getByRole('radio', { name: 'Educational', exact: true }).isChecked(), true);
    await page.evaluate(() => { document.querySelector('#primary-controls').interpretText = realInterpreter; });
  });

  await test('a synchronous host scope change cannot launch a rewrite in the new scope', async () => {
    const before = await page.evaluate(() => requests.length);
    const result = await page.evaluate(async () => {
      const { createPreferenceStore } = await import('/state.mjs');
      const control = document.querySelector('#primary-controls');
      control.addEventListener('preferences-change', () => {
        control.store = createPreferenceStore({ tone: 'professional' });
      }, { once: true });
      return await control.submitInstruction('Make this emotional', { source: 'voice' });
    });
    assert.equal(result.status, 'superseded');
    assert.equal(await primary.getByRole('radio', { name: 'Professional', exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => requests.length), before);
  });

  await test('disconnecting and reconnecting a view restores the current shared choices', async () => {
    await page.evaluate(() => {
      const control = document.querySelector('#mirror-controls');
      control.remove();
      oldStore.apply({ tone: 'emotional', intensity: 'balanced' });
      document.body.append(control);
    });
    assert.equal(await mirror.getByRole('radio', { name: 'Emotional', exact: true }).isChecked(), true);
    assert.equal(await mirror.getByRole('radio', { name: 'Balanced', exact: true }).isChecked(), true);
  });

  const freshDemo = async () => {
    await page.reload();
    await page.waitForFunction(() => Boolean(document.querySelector('content-preferences')?.shadowRoot?.querySelector('#prepare')));
  };
  await test('content and captions render as safe text and copy only the actual asset', async () => {
    await freshDemo();
    const content = '<img src=x onerror="window.injected=true">\nOne small step.\nTry it today.';
    const payload = structuredClone(fixture);
    payload.result.data.assets[0].content = content;
    payload.result.data.assets[0].call_to_action = 'Try it today.';
    await page.route('**/api/generate', route => route.fulfill({ json: payload }));
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedContent = text; } } }));
    await page.getByRole('button', { name: 'Generate content' }).click();
    await page.waitForFunction(() => document.querySelector('#request-info').textContent === 'Ready.');
    assert.equal(await page.locator('#results .content-copy').first().textContent(), content);
    assert.equal(await page.locator('#results img').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.injected)), false);
    assert.equal(await page.locator('#prompt').count(), 0);
    assert.equal(await page.locator('#results details').first().getAttribute('open'), null);
    await page.getByRole('button', { name: 'Copy video script' }).click();
    assert.equal(await page.evaluate(() => copiedContent), content);
    await page.getByRole('button', { name: 'Copy caption', exact: true }).click();
    assert.equal(await page.evaluate(() => copiedContent), payload.result.data.assets[0].caption);
    await page.unroute('**/api/generate');
  });

  await test('server errors offer retry and recover with real response content', async () => {
    await freshDemo();
    let attempts = 0;
    await page.route('**/api/generate', route => ++attempts === 1
      ? route.fulfill({ status: 503, json: { error: 'Local model is unavailable.' } })
      : route.fulfill({ json: fixture }));
    await page.getByRole('button', { name: 'Generate content' }).click();
    await page.getByRole('button', { name: 'Try again' }).waitFor();
    assert.equal(await page.locator('#request-info').textContent(), 'Local model is unavailable.');
    assert.equal(await page.locator('#results .asset').count(), 0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.waitForFunction(() => document.querySelector('#request-info').textContent === 'Ready.');
    assert.equal(attempts, 2);
    assert.equal(await page.locator('#results .asset').count(), 3);
    await page.unroute('**/api/generate');
  });

  await test('invalid model responses are rejected without inventing content', async () => {
    await freshDemo();
    await page.route('**/api/generate', route => route.fulfill({ json: { ...fixture, result: { content: 'Unsupported answer' } } }));
    await page.getByRole('button', { name: 'Generate content' }).click();
    await page.getByRole('button', { name: 'Try again' }).waitFor();
    assert.match(await page.locator('#request-info').textContent(), /invalid content result/);
    assert.equal(await page.locator('#results').textContent(), '');
    await page.unroute('**/api/generate');
  });

  await test('missing original drafts and needs-input results remain actionable', async () => {
    await freshDemo();
    await page.getByLabel('Say it or type it').fill('Rewrite this');
    await page.getByRole('button', { name: 'Apply instruction' }).click();
    await page.waitForFunction(() => document.querySelector('#request-info').textContent.includes('No generated draft'));
    const payload = { ...fixture, result: { ...example, status: 'needs_input', data: null, questions: ['Who is the audience?'] } };
    await page.route('**/api/generate', route => route.fulfill({ json: payload }));
    await page.getByRole('button', { name: 'Generate content' }).click();
    await page.getByText('Who is the audience?', { exact: true }).waitFor();
    assert.equal(await page.locator('#results .asset').count(), 0);
    await page.unroute('**/api/generate');
  });

  const deferGeneration = async () => page.evaluate(() => {
    const originalFetch = window.fetch;
    window.pendingGeneration = [];
    window.fetch = (url, options) => url === '/api/generate'
      ? new Promise(resolve => pendingGeneration.push({ resolve, signal: options.signal, body: JSON.parse(options.body) }))
      : originalFetch(url, options);
  });
  const finishGeneration = async (index, content) => {
    const payload = structuredClone(fixture);
    payload.result.data.assets[0].content = content;
    await page.evaluate(({ index, payload }) => pendingGeneration[index].resolve(new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } })), { index, payload });
  };
  await test('cancelling stops waiting and ignores a response even if transport ignores abort', async () => {
    await freshDemo();
    await deferGeneration();
    await page.getByRole('button', { name: 'Generate content' }).click();
    assert.equal(await page.getByRole('button', { name: 'Generate content' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Cancel generation' }).click();
    assert.equal(await page.evaluate(() => pendingGeneration[0].signal.aborted), true);
    await finishGeneration(0, 'Cancelled response');
    assert.equal(await page.locator('#results .asset').count(), 0);
    assert.match(await page.locator('#request-info').textContent(), /Stopped waiting/);
    assert.equal(await page.getByRole('button', { name: 'Generate content' }).isEnabled(), true);
  });

  for (const change of ['brief', 'preferences', 'scope', 'store']) {
    await test(`a changed ${change} retires generation and late content cannot replace the newer result`, async () => {
      await freshDemo();
      await deferGeneration();
      await page.getByRole('button', { name: 'Generate content' }).click();
      if (change === 'brief') await page.getByLabel('Brief', { exact: true }).fill('How to speak confidently to a new team');
      else if (change === 'preferences') await page.getByRole('radio', { name: 'Emotional', exact: true }).check();
      else if (change === 'scope') await page.evaluate(() => document.querySelector('content-preferences').setAttribute('scope-label', 'Another draft'));
      else await page.evaluate(async () => {
        const { createPreferenceStore } = await import('/state.mjs');
        document.querySelector('content-preferences').store = createPreferenceStore({ tone: 'professional' });
      });
      assert.equal(await page.evaluate(() => pendingGeneration[0].signal.aborted), true);
      await page.getByRole('button', { name: 'Generate content' }).click();
      await finishGeneration(1, 'Newer content');
      await page.waitForFunction(() => document.querySelector('#request-info').textContent === 'Ready.');
      await finishGeneration(0, 'Stale content');
      assert.equal(await page.locator('#results .content-copy').first().textContent(), 'Newer content');
      assert.equal(await page.getByRole('button', { name: 'Copy video script' }).isEnabled(), true);
    });
  }

  await test('generated content fits the mobile view with no browser script errors', async () => {
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
