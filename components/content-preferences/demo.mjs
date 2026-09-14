import './controls.mjs';

const controls = document.querySelector('content-preferences');
const request = document.querySelector('#request');
let preparedRevision = null;
let preparedBrief = '';
function markOutdated() {
  if (preparedRevision !== null && (controls.preferences.revision !== preparedRevision || document.querySelector('#topic').value !== preparedBrief)) {
    document.querySelector('#request-info').textContent = 'Choices changed. Prepare a new request.';
    document.querySelector('#copy').disabled = true;
  }
}
controls.addEventListener('preferences-change', markOutdated);
document.querySelector('#topic').addEventListener('input', markOutdated);
controls.addEventListener('content-request', event => {
  request.hidden = false;
  const brief = document.querySelector('#topic').value.trim();
  if (!brief) { document.querySelector('#request-info').textContent = 'Add a brief first.'; document.querySelector('#copy').disabled = true; return; }
  const { state, preferenceContext, action } = event.detail;
  if (action === 'rewrite') {
    document.querySelector('#request-info').textContent = 'Choices updated; no generated draft to rewrite. Use Prepare request.';
    document.querySelector('#copy').disabled = true;
    return;
  }
  preparedRevision = state.revision;
  preparedBrief = document.querySelector('#topic').value;
  document.querySelector('#prompt').textContent = `/idea-to-content\n\nUser content brief:\n${brief}\n\nCurrent writing preferences:\n${preferenceContext}\n\nReturn dashboard JSON.`;
  document.querySelector('#request-info').textContent = 'Prompt ready. Content has not been generated.';
  document.querySelector('#copy-status').textContent = '';
  document.querySelector('#copy').disabled = false;
});
document.querySelector('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(document.querySelector('#prompt').textContent); document.querySelector('#copy-status').textContent = 'Copied.'; }
  catch { document.querySelector('#copy-status').textContent = 'Clipboard unavailable. Select and copy the request above.'; }
});
