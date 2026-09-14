import { PRESETS } from './state.mjs';

// Presentation only. Keep the IDs, radio names and classes used by controls.mjs.
// User text is assigned via textContent/value in controls.mjs, never interpolated here.
const stylesheet = new URL('./controls.css', import.meta.url).href;
const presets = { tone: PRESETS.tones, intensity: PRESETS.intensities, wording: PRESETS.wordings };
const label = value => value[0].toUpperCase() + value.slice(1);
const choices = field => presets[field].map(value => `
  <label class="choice">
    <input type="radio" name="${field}" value="${value}" aria-label="${label(value)}">
    <span class="tile" part="option">${label(value)}</span>
  </label>`).join('');
const microphoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';

export const controlsTemplate = `
  <link rel="stylesheet" href="${stylesheet}">
  <div class="scope" part="selection"><span id="scope"></span><strong id="current"></strong></div>
  <fieldset>
    <legend>Tone</legend>
    <div class="tone-grid">${choices('tone')}</div>
  </fieldset>
  <fieldset>
    <legend>Intensity</legend>
    <div class="intensity-row">${choices('intensity')}</div>
  </fieldset>
  <details part="advanced">
    <summary>Customise wording</summary>
    <fieldset class="wording">
      <legend>Wording</legend>
      <div class="intensity-row">${choices('wording')}</div>
    </fieldset>
    <label for="custom">Custom voice or extra wording</label>
    <textarea id="custom" part="input" placeholder="Warm, lightly playful, no jargon…" maxlength="4000" rows="2"></textarea>
  </details>
  <label for="instruction" class="command-label">Say it or type it</label>
  <textarea id="instruction" part="input" placeholder="Try: Emotional and calm" maxlength="4000" rows="2"></textarea>
  <div class="command-actions">
    <button class="mic" part="button" type="button" aria-pressed="false" aria-describedby="mic-note">${microphoneIcon}<span>Use microphone</span></button>
    <button id="apply" part="button" type="button">Apply instruction</button>
  </div>
  <p class="mic-note" id="mic-note"></p>
  <p class="status" part="status" role="status" aria-live="polite"></p>
  <div class="footer">
    <button class="primary" id="prepare" part="button primary" type="button">Prepare request <span aria-hidden="true">→</span></button>
  </div>`;
