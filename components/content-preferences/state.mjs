/** Application preference state only; no generation, persistence or output schema. */
export const PRESETS = Object.freeze({
  tones: Object.freeze(['engaging', 'educational', 'entertaining', 'emotional', 'professional', 'custom']),
  intensities: Object.freeze(['calm', 'balanced', 'bold']),
  wordings: Object.freeze(['plain', 'conversational', 'polished']),
});

export const DEFAULTS = Object.freeze({
  tone: 'engaging', intensity: 'balanced', wording: 'conversational',
  customVoice: '', secondaryTone: null,
});

const FIELDS = Object.keys(DEFAULTS);
const EVENT_LIMIT = 256;

function validatePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError('Preferences must be an object.');
  }
  for (const [field, value] of Object.entries(patch)) {
    if (!FIELDS.includes(field)) throw new TypeError(`Unknown preference: ${field}`);
    const valid = field === 'tone' ? PRESETS.tones.includes(value)
      : field === 'intensity' ? PRESETS.intensities.includes(value)
      : field === 'wording' ? PRESETS.wordings.includes(value)
      : field === 'secondaryTone' ? value === null || (value !== 'custom' && PRESETS.tones.includes(value))
      : typeof value === 'string';
    if (!valid) throw new TypeError(`Invalid value for ${field}.`);
  }
}

export function createPreferenceStore(initial = {}) {
  validatePatch(initial);
  let revision = Object.keys(initial).length ? 1 : 0;
  const values = { ...DEFAULTS, ...initial };
  const fieldRevisions = Object.fromEntries(FIELDS.map(field => [field, Object.hasOwn(initial, field) ? revision : 0]));
  const seenEvents = new Set();
  const snapshot = () => ({ revision, values: { ...values }, fieldRevisions: { ...fieldRevisions } });

  function apply(patch, { source = 'button', baseRevision = revision, eventId } = {}) {
    validatePatch(patch);
    if (!['button', 'text', 'voice'].includes(source)) throw new TypeError('Invalid input source.');
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0 || baseRevision > revision) {
      throw new TypeError('baseRevision must identify a current or earlier state revision.');
    }
    if (eventId !== undefined && (typeof eventId !== 'string' || !eventId.trim())) {
      throw new TypeError('eventId must be a nonempty string.');
    }
    if (eventId !== undefined && seenEvents.has(eventId)) return { status: 'duplicate', state: snapshot() };

    const fields = Object.keys(patch);
    const conflicts = fields.filter(field => fieldRevisions[field] > baseRevision && patch[field] !== values[field]);
    if (conflicts.length) return { status: 'conflict', state: snapshot(), conflicts };

    const changed = fields.some(field => patch[field] !== values[field]);
    // A deliberate same-value selection reaffirms that field and invalidates older
    // conflicting input. "unchanged" describes values; revision tracks accepted intent.
    // Zero field revision means an untouched fallback, including at initialisation.
    if (fields.length) {
      revision += 1;
      for (const field of fields) {
        values[field] = patch[field];
        fieldRevisions[field] = revision;
      }
    }
    // Retain the most recent 256 accepted event IDs for this store's lifetime.
    // Conflicts stay retryable after the host resolves them with a fresh revision.
    if (eventId !== undefined) {
      seenEvents.add(eventId);
      if (seenEvents.size > EVENT_LIMIT) seenEvents.delete(seenEvents.values().next().value);
    }
    return { status: changed ? 'applied' : 'unchanged', state: snapshot() };
  }

  return { snapshot, apply };
}
