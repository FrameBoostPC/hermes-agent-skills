import './controls.mjs';
import { buildPreferenceContext } from './intent.mjs';
import { renderContent, validateGenerationResponse } from './generation-view.mjs';

const controls = document.querySelector('content-preferences');
const topic = document.querySelector('#topic');
const request = document.querySelector('#request');
const info = document.querySelector('#request-info');
const results = document.querySelector('#results');
const cancel = document.querySelector('#cancel');
const retry = document.querySelector('#retry');
const copyStatus = document.querySelector('#copy-status');
const modelInfo = document.querySelector('#model-info');
let active = null;
let sequence = 0;
let lastResult = null;
let retryRequest = null;

function status(message, error = false) {
  request.hidden = false;
  info.textContent = message;
  info.dataset.error = String(error);
}
function busy(value) {
  controls.toggleAttribute('busy', value);
  request.setAttribute('aria-busy', String(value));
  cancel.hidden = !value;
  retry.hidden = value || !retryRequest;
}
function stale() {
  results.dataset.stale = 'true';
  results.querySelectorAll('[data-copy]').forEach(button => { button.disabled = true; });
  copyStatus.textContent = '';
}
function stop(message) {
  sequence++;
  active?.controller.abort();
  active = null;
  busy(false);
  if (message) status(message);
}
function changed(clearDraft = false) {
  retryRequest = null;
  const wasRunning = Boolean(active);
  stop();
  if (clearDraft) lastResult = null;
  stale();
  if (wasRunning || results.childElementCount) status('Choices changed. Generate content to update the result.');
}
controls.addEventListener('preferences-change', event => changed(event.detail.source === 'binding'));
topic.addEventListener('input', () => changed(true));
new MutationObserver(records => {
  if (records.some(record => record.attributeName === 'scope-label')) changed(true);
}).observe(controls, { attributes: true, attributeFilter: ['scope-label'] });

async function generate({ action = 'generate', instruction } = {}) {
  stop();
  retryRequest = null;
  retry.hidden = true;
  const brief = topic.value.trim();
  if (!brief) { status('Add a brief first.', true); return; }
  if (action === 'rewrite' && !lastResult?.result.data) {
    status('No generated draft to rewrite. Generate content first.', true);
    return;
  }
  const state = controls.preferences;
  const current = {
    token: ++sequence, controller: new AbortController(), store: controls.store,
    revision: state.revision, brief: topic.value, scope: controls.getAttribute('scope-label'),
  };
  active = current;
  stale();
  busy(true);
  status(action === 'rewrite' ? 'Rewriting… Local generation may take a few minutes.' : 'Generating… Local generation may take a few minutes.');
  const isCurrent = () => active === current && sequence === current.token && controls.isConnected
    && controls.store === current.store && controls.preferences.revision === current.revision
    && topic.value === current.brief && controls.getAttribute('scope-label') === current.scope;
  try {
    const body = { brief, action, preferenceContext: buildPreferenceContext(state) };
    if (instruction) body.instruction = instruction;
    if (action === 'rewrite') body.previousResult = lastResult.result;
    const response = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: current.controller.signal,
    });
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error('Could not read the model response. Check the local server and try again.'); }
    if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Generation failed. Try again.');
    validateGenerationResponse(payload);
    if (!isCurrent()) return;
    lastResult = { result: payload.result };
    renderContent(results, payload.result, async text => {
      try { await navigator.clipboard.writeText(text); copyStatus.textContent = 'Copied.'; }
      catch { copyStatus.textContent = 'Clipboard unavailable. Select and copy the content above.'; }
    });
    results.dataset.stale = 'false';
    modelInfo.textContent = `${payload.model} · ${payload.provider}`;
    status(payload.result.status === 'needs_input' ? 'A little more detail is needed.'
      : payload.result.status === 'partial' ? 'Draft ready. Check User guidance for limitations.' : 'Ready.');
  } catch (error) {
    if (!isCurrent()) return;
    retryRequest = { action, instruction };
    status(error.name === 'AbortError' ? 'Stopped waiting for this result.' : error.message || 'Could not connect to the local model server. Try again.', true);
  } finally {
    if (active === current) { active = null; busy(false); }
  }
}
controls.addEventListener('content-request', ({ detail }) => generate(detail));
cancel.addEventListener('click', () => {
  retryRequest = null;
  stop('Stopped waiting. The local model may finish its current run before another can start.');
});
retry.addEventListener('click', () => { if (retryRequest) generate(retryRequest); });
window.addEventListener('pagehide', () => stop());

try {
  const response = await fetch('/api/model');
  const configured = await response.json();
  if (!response.ok || typeof configured.model !== 'string' || typeof configured.provider !== 'string') throw new Error('Missing model settings');
  modelInfo.textContent = `Configured: ${configured.model} · ${configured.provider}`;
} catch {
  modelInfo.textContent = 'Local model server unavailable. Start it to generate content.';
}
