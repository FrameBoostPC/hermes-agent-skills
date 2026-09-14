// A deliberately small offline command parser. Hosts can inject a model-backed
// interpreter for unrestricted language without changing the component's store.
const TONES = ['engaging', 'educational', 'entertaining', 'emotional', 'professional', 'custom'];
const INTENSITIES = ['calm', 'balanced', 'bold'];
const WORDINGS = ['plain', 'conversational', 'polished'];

export function interpretPreferenceText(input, values) {
  const text = String(input).trim();
  if (!text) return { patch: {}, action: 'settings', message: 'Enter a writing-style instruction.' };
  if (/^(?:please\s+)?(?:generate|prepare)(?:\s+(?:it|the request|a draft))?[.!]?$/i.test(text)) {
    return { patch: {}, action: 'generate' };
  }
  if (/^(?:please\s+)?rewrite(?:\s+(?:it|this|the draft))?[.!]?$/i.test(text)) {
    return { patch: {}, action: 'rewrite' };
  }
  const custom = text.match(/^(?:use\s+)?custom(?:\s+(?:tone|voice|style))?\s*:\s*(.+)$/is);
  if (custom) return { patch: { tone: 'custom', customVoice: custom[1].trim() }, action: 'settings' };

  // Do not guess around negation, quoted copy, topics, or unsupported clauses.
  // Passing a partial keyword match would silently drop user instructions.
  if (/\b(?:not|never|without|avoid|don'?t|no|about)\b|["“”]/i.test(text)) return unsupported();
  let normal = text.toLowerCase().replace(/[.!?]$/g, '').trim();
  const rewrite = /^(?:please\s+)?(?:make|rewrite)\s+(?:it|this|the script|the caption|the draft)\b/.test(normal);
  const patch = {};
  const aliases = { funny: 'entertaining', entertaining: 'entertaining', punchy: 'bold', subtle: 'calm', gentle: 'calm', energetic: 'bold' };
  normal = normal.replace(/\b(funny|punchy|subtle|gentle|energetic)\b/g, word => aliases[word]);
  if (/^(?:(?:please\s+)?(?:make|keep)\s+(?:it|this)\s+)?(?:a (?:little|bit) )?(?:less intense|calmer|dial it down(?: a bit)?)$/.test(normal)) {
    return { patch: { intensity: INTENSITIES[Math.max(0, INTENSITIES.indexOf(values.intensity) - 1)] }, action: rewrite ? 'rewrite' : 'settings' };
  }
  if (/^(?:(?:please\s+)?(?:make|keep)\s+(?:it|this)\s+)?(?:a (?:little|bit) )?(?:more intense|more energy|dial it up(?: a bit)?)$/.test(normal)) {
    return { patch: { intensity: INTENSITIES[Math.min(2, INTENSITIES.indexOf(values.intensity) + 1)] }, action: rewrite ? 'rewrite' : 'settings' };
  }
  const groups = normal.split(/\s*(?:[,;]|\.\s+|\band\b|\bbut\b|\bwith\b)\s*/).filter(Boolean);
  for (const raw of groups) {
    const phrase = raw
      .replace(/^please\s+/, '')
      .replace(/^(?:set|change)\s+(?:the\s+)?/, '')
      .replace(/^(?:make|keep|rewrite)\s+(?:it|this|the script|the caption|the draft)\s+/, '')
      .replace(/^(?:tone|style|intensity|energy|wording)\s*(?::|to|as|is)?\s*/, '')
      .replace(/^(?:more|a little more)\s+/, '')
      .replace(/\s+(?:tone|style|intensity|energy|wording)$/, '').trim();
    const field = TONES.includes(phrase) ? 'tone' : INTENSITIES.includes(phrase) ? 'intensity' : WORDINGS.includes(phrase) ? 'wording' : null;
    if (!field || (field in patch && patch[field] !== phrase) || phrase === 'custom') return unsupported();
    patch[field] = phrase;
  }
  return Object.keys(patch).length ? { patch, action: rewrite ? 'rewrite' : 'settings' } : unsupported();
}

function unsupported() {
  return { patch: {}, action: 'clarify', message: 'I could not map that whole instruction to the controls. Try “Emotional and calm”, or put your exact wording under Custom voice.' };
}

export function buildPreferenceContext(state) {
  const labels = { tone: 'Writing style', intensity: 'Energy', wording: 'Wording', secondaryTone: 'Secondary style', customVoice: 'Additional voice direction' };
  return Object.entries(labels).filter(([key]) => state.values[key] !== null && state.values[key] !== '')
    .map(([key, label]) => `${label}: ${state.values[key]}${state.fieldRevisions[key] === 0 ? ' (fallback preference; explicit brief instructions take priority)' : ''}`).join('\n');
}
