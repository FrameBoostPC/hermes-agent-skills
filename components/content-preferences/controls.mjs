import { createPreferenceStore } from './state.mjs';
import { interpretPreferenceText, buildPreferenceContext } from './intent.mjs';

const tones = [
  ['engaging', 'Engaging', 'Create curiosity. Get to the point.'],
  ['educational', 'Educational', 'Make an idea click with an example.'],
  ['entertaining', 'Entertaining', 'A playful angle. A little personality.'],
  ['emotional', 'Emotional', 'Make the feeling recognisable.'],
  ['professional', 'Professional', 'Clear, measured and considered.'],
  ['custom', 'Custom', 'Describe a voice of your own.'],
];
const intensityNotes = { calm: 'Gentle emphasis, measured pacing.', balanced: 'Natural pacing with a little punch.', bold: 'A sharper opening and stronger emphasis.' };
const microphoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
const styles = `
  :host{display:block;color:var(--voice-ink,#e8ece9);font-family:inherit;font-size:15px;--line:var(--voice-border,#333c36);--accent:var(--voice-accent,#d5f6a5)}
  *{box-sizing:border-box} fieldset{padding:0;border:0;margin:0 0 26px;min-width:0}legend{padding:0;margin:0 0 12px;font-size:13px;font-weight:650;letter-spacing:.025em}
  .scope{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:20px;margin-bottom:22px;border-bottom:1px solid var(--line);font-size:12px;color:#a5b2a9}.scope strong{color:var(--accent);font-weight:500}
  .tone-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.choice{position:relative;display:block;cursor:pointer}.choice input{position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer}.tile{height:100%;min-height:88px;border:1px solid var(--line);border-radius:10px;padding:14px;display:block;background:#19201b;transition:border-color .15s,background .15s}.tile strong{font-size:14px;display:block;font-weight:550}.tile small{display:block;margin-top:7px;color:#9ca99f;font-size:12px;line-height:1.45}.choice input:checked+.tile{border-color:var(--accent);background:#263422}.choice input:checked+.tile strong{color:var(--accent)}.choice input:focus-visible+.tile{outline:2px solid #fff;outline-offset:3px}.choice:hover .tile{border-color:#82967d}
  .intensity-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:5px;border:1px solid var(--line);border-radius:10px;background:#121814}.intensity-row .tile{border:0;background:none;min-height:0;text-align:center;padding:10px;border-radius:6px}.intensity-row input:checked+.tile{background:var(--accent);color:#1b2a10}.intensity-row input:checked+.tile strong{color:#1b2a10}.help{font-size:12px;color:#9ca99f;line-height:1.6;margin:10px 0 0}
  details{border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:0 0 24px;padding:15px 0}summary{cursor:pointer;color:#c3cec6;font-size:13px}details label{display:block;margin:17px 0 8px;font-size:13px}select,textarea{width:100%;background:#111713;border:1px solid var(--line);border-radius:8px;color:#eef0eb;padding:11px 12px;font:inherit;font-size:14px;line-height:1.5}textarea{resize:vertical;min-height:76px}select:focus-visible,textarea:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}textarea::placeholder{color:#7d8a81}
  .command-label{display:block;font-size:13px;font-weight:650;margin-bottom:6px}.lead{font-size:12px;color:#9ca99f;margin:0 0 11px;line-height:1.5}.command-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}button{border:1px solid var(--line);border-radius:8px;background:#263027;color:#e5ece5;padding:10px 14px;cursor:pointer;font:inherit;font-size:13px;font-weight:550}button:hover:enabled{border-color:#9daf97}button:disabled{opacity:.5;cursor:not-allowed}.mic{display:flex;gap:8px;align-items:center;background:transparent}.mic svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7}.mic[aria-pressed=true]{border-color:#d7a96b;color:#f2c990}.mic-note{font-size:11px;color:#8e9b91;line-height:1.5;margin:9px 0 0}.status{font-size:12px;line-height:1.55;min-height:38px;margin:18px 0 0;color:var(--accent)}.status[data-error=true]{color:#ffc6a8}.footer{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding-top:20px;border-top:1px solid var(--line)}.footer span{font-size:12px;color:#9ca99f}.primary{background:var(--accent);color:#1c2a15;border-color:var(--accent);padding:12px 20px}
  @media(max-width:520px){.tone-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.scope{align-items:flex-start}.footer{align-items:stretch;flex-direction:column}.tile{padding:12px}.primary{width:100%}}
  @media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;

export class ContentPreferences extends HTMLElement {
  static get observedAttributes() { return ['scope-label']; }
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.store = createPreferenceStore();
    this.interpretText = interpretPreferenceText;
    this._speechAdapter = null;
    this._capture = null;
    this._captureToken = 0;
    this._inputToken = 0;
  }

  connectedCallback() {
    if (!this.shadowRoot.childElementCount) this.render();
    this.sync();
    this.syncMicrophone();
  }

  disconnectedCallback() { this.cancelVoice(); this._inputToken++; }
  attributeChangedCallback(name, previous, next) {
    if (previous !== next) { this.cancelVoice(); this._inputToken++; this.sync(); }
  }

  get preferences() { return this.store.snapshot(); }
  set speechAdapter(adapter) { this.cancelVoice(); this._speechAdapter = adapter; if (this.isConnected) this.syncMicrophone(); }
  get speechAdapter() { return this._speechAdapter; }

  setPreferences(patch, options = {}) {
    const result = this.store.apply(patch, options);
    if (result.status === 'conflict') {
      this.message(`A newer choice changed ${result.conflicts.join(', ')}. Repeat your instruction to use it now.`, true);
      return result;
    }
    if (result.status !== 'duplicate') {
      this.sync();
      this.dispatchEvent(new CustomEvent('preferences-change', { detail: { ...result, source: options.source ?? 'button' }, bubbles: true, composed: true }));
    }
    return result;
  }

  async submitInstruction(text, options = {}) {
    const source = options.source ?? 'text';
    if (source !== 'voice') this.cancelVoice();
    const original = this.preferences;
    const baseRevision = options.baseRevision ?? original.revision;
    const eventId = options.eventId ?? crypto.randomUUID();
    const token = ++this._inputToken;
    this.message('Understanding your instruction…');
    try {
      const intent = await this.interpretText(text, original.values, { source, baseRevision, eventId });
      if (token !== this._inputToken || !this.isConnected || (options.captureToken !== undefined && options.captureToken !== this._captureToken)) return { status: 'superseded' };
      if (!intent || !['settings', 'generate', 'rewrite', 'clarify'].includes(intent.action)) throw new Error('The instruction could not be interpreted.');
      if (intent.action === 'clarify') { this.message(intent.message || 'Please clarify the writing voice.', true); return { status: 'clarify' }; }
      const result = this.setPreferences(intent.patch, { source, baseRevision, eventId });
      if (['conflict', 'duplicate'].includes(result.status)) return result;
      this.message(intent.message || `Set to ${this.describe()}.`);
      if (intent.action !== 'settings') this.requestContent(intent.action, { source, instruction: text, eventId });
      return result;
    } catch (error) {
      if (token === this._inputToken) this.message(error.message || 'Could not apply that instruction. Try again.', true);
      return { status: 'error' };
    }
  }

  requestContent(action = 'generate', extra = {}) {
    if (!['generate', 'rewrite'].includes(action)) throw new Error('Unsupported content action.');
    const state = this.preferences;
    if (state.values.tone === 'custom' && !state.values.customVoice.trim()) {
      this.shadowRoot.querySelector('details').open = true;
      this.shadowRoot.querySelector('#custom').focus();
      this.message('Describe your custom voice before preparing the request.', true);
      return false;
    }
    this.dispatchEvent(new CustomEvent('content-request', {
      detail: { action, state, preferenceContext: buildPreferenceContext(state), scope: this.getAttribute('scope-label') || 'Current brief', ...extra }, bubbles: true, composed: true,
    }));
    this.message('Writing preferences prepared.');
    return true;
  }

  render() {
    this.shadowRoot.innerHTML = `<style>${styles}</style>
      <div class="scope"><span id="scope"></span><strong id="current"></strong></div>
      <fieldset><legend>Tone</legend><div class="tone-grid">${tones.map(([value, label, description]) => `<label class="choice"><input type="radio" name="tone" value="${value}" aria-label="${label}"><span class="tile"><strong>${label}</strong><small>${description}</small></span></label>`).join('')}</div></fieldset>
      <fieldset><legend>Intensity</legend><div class="intensity-row">${['calm', 'balanced', 'bold'].map(value => `<label class="choice"><input type="radio" name="intensity" value="${value}" aria-label="${value[0].toUpperCase() + value.slice(1)}"><span class="tile"><strong>${value[0].toUpperCase() + value.slice(1)}</strong></span></label>`).join('')}</div><p class="help" id="intensity-help"></p></fieldset>
      <details><summary>Customise wording</summary><label for="wording">Wording</label><select id="wording"><option value="plain">Plain</option><option value="conversational">Conversational</option><option value="polished">Polished</option></select><label for="custom">Custom voice or extra wording</label><textarea id="custom" placeholder="Warm, lightly playful, no jargon…" maxlength="4000"></textarea><p class="help">These directions stay when you change tone or intensity.</p></details>
      <label for="instruction" class="command-label">Say it or type it</label><p class="lead">Try “Make this emotional, but keep it subtle” or “Tone: educational”.</p>
      <textarea id="instruction" placeholder="Describe how it should sound…" maxlength="4000"></textarea>
      <div class="command-actions"><button class="mic" type="button" aria-pressed="false">${microphoneIcon}<span>Use microphone</span></button><button id="apply" type="button">Apply instruction <span aria-hidden="true">↗</span></button></div>
      <p class="mic-note" id="mic-note"></p><p class="status" role="status" aria-live="polite"></p>
      <div class="footer"><span>One voice across your selected draft.</span><button class="primary" id="prepare" type="button">Prepare request <span aria-hidden="true">→</span></button></div>`;
    const root = this.shadowRoot;
    root.addEventListener('click', event => {
      const el = event.target;
      // A click on the already selected radio is still a deliberate reaffirmation.
      // Changed radios are handled once by their subsequent change event.
      if (el.type === 'radio' && this.preferences.values[el.name] === el.value) {
        this.setPreferences({ [el.name]: el.value }, { source: 'button' });
        this.message(`Set to ${this.describe()}.`);
      }
    });
    root.addEventListener('change', event => {
      const el = event.target;
      if (el.name === 'tone' || el.name === 'intensity') {
        this.setPreferences({ [el.name]: el.value }, { source: 'button' });
        this.message(`Set to ${this.describe()}.`);
        if (el.value === 'custom') { root.querySelector('details').open = true; root.querySelector('#custom').focus(); }
      } else if (el.id === 'wording') this.setPreferences({ wording: el.value }, { source: 'button' });
    });
    root.querySelector('#custom').addEventListener('input', event => this.setPreferences({ customVoice: event.target.value }, { source: 'text' }));
    root.querySelector('#apply').addEventListener('click', () => this.submitInstruction(root.querySelector('#instruction').value));
    root.querySelector('#instruction').addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.submitInstruction(event.target.value); }
    });
    root.querySelector('#prepare').addEventListener('click', () => this.requestContent());
    root.querySelector('.mic').addEventListener('click', () => this._capture ? this.finishVoice() : this.startVoice());
  }

  sync() {
    if (!this.shadowRoot.childElementCount) return;
    const root = this.shadowRoot, values = this.preferences.values;
    root.querySelectorAll('input[type=radio]').forEach(el => { el.checked = values[el.name] === el.value; });
    root.querySelector('#wording').value = values.wording;
    if (root.querySelector('#custom').value !== values.customVoice) root.querySelector('#custom').value = values.customVoice;
    root.querySelector('#scope').textContent = this.getAttribute('scope-label') || 'Current brief';
    root.querySelector('#current').textContent = this.describe();
    root.querySelector('#intensity-help').textContent = intensityNotes[values.intensity];
  }
  describe() { const v = this.preferences.values; return [v.tone, v.intensity].map(x => x[0].toUpperCase() + x.slice(1)).join(' · '); }
  message(text, error = false) { const el = this.shadowRoot.querySelector('.status'); if (el) { el.textContent = text; el.dataset.error = String(error); } }

  syncMicrophone() {
    const supported = Boolean(this._speechAdapter || window.SpeechRecognition || window.webkitSpeechRecognition);
    this.shadowRoot.querySelector('.mic').disabled = !supported;
    this.shadowRoot.querySelector('#mic-note').textContent = this._speechAdapter ? 'Voice uses the connected speech service.' : supported ? 'Your browser’s speech service may process audio online. Recording starts only when you click.' : 'Microphone transcription is unavailable in this browser. You can type here; a Hermes speech service can be connected.';
  }

  startVoice() {
    this.cancelVoice();
    const baseRevision = this.preferences.revision, eventId = crypto.randomUUID(), token = ++this._captureToken;
    const adapter = this._speechAdapter || browserSpeechAdapter();
    if (!adapter) { this.syncMicrophone(); return; }
    let delivered = false, finished = false;
    const current = () => token === this._captureToken && this.isConnected && !finished;
    const finish = () => {
      if (!current()) return;
      finished = true;
      this._capture = null;
      const button = this.shadowRoot.querySelector('.mic'); button.setAttribute('aria-pressed', 'false'); button.querySelector('span').textContent = 'Use microphone';
    };
    try {
      this.message('Starting microphone…');
      const capture = adapter.start({
        onStart: () => { if (current()) { this.message('Listening…'); const b = this.shadowRoot.querySelector('.mic'); b.setAttribute('aria-pressed', 'true'); b.querySelector('span').textContent = 'Finish speaking'; } },
        onInterim: text => { if (current()) this.shadowRoot.querySelector('#instruction').value = text; },
        onFinal: text => { if (!current() || delivered) return; delivered = true; this.shadowRoot.querySelector('#instruction').value = text; this.submitInstruction(text, { source: 'voice', baseRevision, eventId, captureToken: token }); },
        onError: message => { if (current()) { delivered = true; this.message(message, true); finish(); } },
        onEnd: () => { if (current() && !delivered) this.message('No final speech was received. Try again or type your instruction.', true); finish(); },
      });
      if (!capture || typeof capture.stop !== 'function' || typeof capture.abort !== 'function') throw new Error('The speech adapter must provide stop and abort controls.');
      if (!finished) this._capture = capture;
    } catch (error) { this.message(error.message || 'Could not start the microphone.', true); finish(); }
  }
  finishVoice() {
    try { this._capture?.stop?.(); }
    catch { this.cancelVoice(); this.message('Could not finish speech input. Please type the instruction or try again.', true); }
  }
  cancelVoice() {
    this._captureToken++;
    try { this._capture?.abort?.(); }
    catch { this.message('The speech service reported a cancellation error. Late input will be ignored.', true); }
    finally {
      this._capture = null;
      const button = this.shadowRoot.querySelector('.mic');
      if (button) { button.setAttribute('aria-pressed', 'false'); button.querySelector('span').textContent = 'Use microphone'; }
    }
  }
}

export function browserSpeechAdapter() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;
  return {
    start(callbacks) {
      const recognition = new Recognition();
      const finalParts = new Map();
      let failed = false;
      recognition.lang = document.documentElement.lang || 'en-AU';
      recognition.continuous = false; recognition.interimResults = true;
      recognition.onstart = callbacks.onStart;
      recognition.onresult = event => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalParts.set(i, text); else interim += text;
        }
        callbacks.onInterim([...finalParts.values(), interim].filter(Boolean).join(' '));
      };
      recognition.onerror = event => { failed = true; callbacks.onError(({ 'not-allowed': 'Microphone access was declined. You can continue by typing.', 'service-not-allowed': 'This browser’s speech service is unavailable. You can type instead.', 'network': 'Speech transcription could not connect. Try again or type instead.', 'no-speech': 'No speech was detected. Try again or type instead.', 'aborted': 'Voice input cancelled.' })[event.error] || 'Speech input failed. Try again or type instead.'); };
      recognition.onend = () => {
        if (!failed && finalParts.size) callbacks.onFinal([...finalParts.values()].join(' '));
        callbacks.onEnd();
      };
      recognition.start();
      return { stop: () => recognition.stop(), abort: () => recognition.abort() };
    },
  };
}

if (!customElements.get('content-preferences')) customElements.define('content-preferences', ContentPreferences);
