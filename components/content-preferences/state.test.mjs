import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferenceStore, DEFAULTS, PRESETS } from './state.mjs';

test('defaults stay fallback while constructor selections are deliberate', () => {
  assert.deepEqual(createPreferenceStore().snapshot(), {
    revision: 0, values: DEFAULTS,
    fieldRevisions: { tone: 0, intensity: 0, wording: 0, customVoice: 0, secondaryTone: 0 },
  });
  const initial = createPreferenceStore({ tone: 'engaging' }).snapshot();
  assert.equal(initial.fieldRevisions.tone, 1);
  assert.equal(initial.fieldRevisions.intensity, 0);
  assert.ok(PRESETS.tones.includes('custom'));
});

test('latest choices across buttons, text and voice update the same state', () => {
  const store = createPreferenceStore();
  for (const [source, tone] of [['button', 'emotional'], ['text', 'educational'], ['voice', 'professional']]) {
    assert.equal(store.apply({ tone }, { source }).status, 'applied');
    assert.equal(store.snapshot().values.tone, tone);
  }
  assert.equal(store.snapshot().revision, 3);
});

test('intensity and preset changes preserve custom requirements and other stores', () => {
  const store = createPreferenceStore({ tone: 'custom', customVoice: 'warm; no humour', secondaryTone: 'educational' });
  const sibling = createPreferenceStore({ tone: 'emotional' });
  const siblingBefore = sibling.snapshot();
  store.apply({ intensity: 'bold' });
  assert.equal(store.snapshot().values.tone, 'custom');
  store.apply({ tone: 'professional' });
  assert.deepEqual(store.snapshot().values, { ...DEFAULTS, tone: 'professional', intensity: 'bold', customVoice: 'warm; no humour', secondaryTone: 'educational' });
  assert.deepEqual(sibling.snapshot(), siblingBefore);
});

test('delayed conflicting input is atomic and retryable; unrelated fields merge', () => {
  const store = createPreferenceStore();
  store.apply({ tone: 'emotional' });
  const options = { source: 'voice', baseRevision: 0, eventId: 'utterance-1' };
  const conflict = store.apply({ tone: 'educational', intensity: 'calm' }, options);
  assert.equal(conflict.status, 'conflict');
  assert.deepEqual(conflict.conflicts, ['tone']);
  assert.equal(store.snapshot().values.intensity, 'balanced');
  assert.equal(store.apply({ intensity: 'bold' }, { source: 'voice', baseRevision: 0 }).status, 'applied');
  assert.equal(store.apply({ tone: 'educational' }, { ...options, baseRevision: store.snapshot().revision }).status, 'applied');
});

test('same-value explicit choice invalidates older differing voice input', () => {
  const store = createPreferenceStore();
  const result = store.apply({ tone: 'engaging' }, { source: 'button' });
  assert.equal(result.status, 'unchanged');
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.fieldRevisions.tone, 1);
  assert.equal(store.apply({ tone: 'emotional' }, { source: 'voice', baseRevision: 0 }).status, 'conflict');
  assert.equal(store.apply({}, { eventId: 'empty' }).state.revision, 1);
});

test('duplicate accepted events, including unchanged events, are bounded', () => {
  const store = createPreferenceStore();
  store.apply({ tone: 'engaging' }, { eventId: 'same' });
  assert.equal(store.apply({ tone: 'emotional' }, { eventId: 'same' }).status, 'duplicate');
  for (let index = 0; index < 256; index += 1) store.apply({}, { eventId: `event-${index}` });
  assert.equal(store.apply({ tone: 'emotional' }, { eventId: 'event-255' }).status, 'duplicate');
  assert.equal(store.apply({ tone: 'emotional' }, { eventId: 'same' }).status, 'applied');
});

test('invalid patches and options cannot partially mutate preferences', () => {
  const store = createPreferenceStore();
  const before = store.snapshot();
  for (const patch of [{ tone: 'invalid' }, { intensity: 'loud' }, { wording: 'slang' }, { customVoice: null }, { secondaryTone: 'custom' }, { tone: 'emotional', extra: true }, [], null]) {
    assert.throws(() => store.apply(patch), TypeError);
    assert.deepEqual(store.snapshot(), before);
  }
  for (const options of [{ source: 'unknown' }, { baseRevision: -1 }, { baseRevision: 1 }, { baseRevision: 0.5 }, { eventId: '' }]) {
    assert.throws(() => store.apply({ tone: 'emotional' }, options), TypeError);
    assert.deepEqual(store.snapshot(), before);
  }
});

test('snapshots and patches cannot mutate the store or previous request snapshots', () => {
  const initial = { customVoice: 'no humour' };
  const store = createPreferenceStore(initial);
  initial.customVoice = 'changed outside';
  const original = store.snapshot();
  const exposed = store.snapshot();
  exposed.values.customVoice = 'changed outside';
  exposed.fieldRevisions.tone = 999;
  const patch = { intensity: 'bold' };
  const result = store.apply(patch);
  patch.intensity = 'calm';
  result.state.values.intensity = 'calm';
  assert.equal(store.snapshot().values.customVoice, 'no humour');
  assert.equal(store.snapshot().values.intensity, 'bold');
  assert.equal(store.snapshot().fieldRevisions.tone, 0);
  assert.equal(original.values.intensity, 'balanced');
});

test('subscribers agree synchronously across accepted button, text and voice choices', () => {
  const store = createPreferenceStore();
  const first = [], second = [];
  store.subscribe(change => first.push(change));
  store.subscribe(change => second.push(change));
  assert.equal(store.snapshot().revision, 0);
  assert.deepEqual(first, []);
  for (const [source, patch] of [
    ['button', { tone: 'emotional' }],
    ['text', { intensity: 'calm' }],
    ['voice', { wording: 'plain' }],
    ['button', { wording: 'plain' }],
  ]) {
    const result = store.apply(patch, { source });
    assert.deepEqual(first.at(-1), { status: result.status, state: result.state, source });
    assert.deepEqual(second.at(-1), first.at(-1));
    assert.deepEqual(second.at(-1).state, store.snapshot());
  }
  assert.equal(first.length, 4);
  assert.equal(first.at(-1).status, 'unchanged');
  assert.equal(first.at(-1).state.fieldRevisions.wording, 4);
});

test('subscriber snapshots are detached and unsubscribe stops further delivery', () => {
  const store = createPreferenceStore();
  const original = store.snapshot();
  const snapshots = [];
  const unsubscribe = store.subscribe(change => {
    change.state.values.tone = 'professional';
    change.state.fieldRevisions.tone = 999;
    change.state.revision = 999;
  });
  store.subscribe(change => snapshots.push(change.state));
  const result = store.apply({ tone: 'emotional' });
  assert.deepEqual(snapshots[0], result.state);
  assert.deepEqual(result.state, store.snapshot());
  assert.equal(original.revision, 0);
  unsubscribe();
  unsubscribe();
  store.apply({ intensity: 'bold' });
  assert.equal(snapshots[1].values.tone, 'emotional');
  assert.equal(snapshots[0].values.intensity, 'balanced');
  let calls = 0;
  const stop = store.subscribe(() => calls++);
  store.apply({ wording: 'plain' });
  stop();
  store.apply({ wording: 'polished' });
  assert.equal(calls, 1);
  assert.throws(() => store.subscribe(null), TypeError);
});

test('a failing subscriber is reported without preventing other views from synchronising', () => {
  const store = createPreferenceStore();
  const failure = new Error('view failed');
  const delivered = [];
  store.subscribe(() => { throw failure; });
  store.subscribe(change => delivered.push(change.state));
  const result = store.apply({ intensity: 'calm' });
  assert.equal(result.status, 'applied');
  assert.deepEqual(result.notificationErrors, [failure]);
  assert.deepEqual(delivered, [store.snapshot()]);
  store.apply({ wording: 'plain' });
  assert.deepEqual(delivered.at(-1), store.snapshot());
});

test('empty, duplicate, conflicting and invalid updates do not notify subscribers', () => {
  const store = createPreferenceStore();
  const changes = [];
  store.subscribe(change => changes.push(change));
  store.apply({ tone: 'emotional' }, { eventId: 'accepted' });
  assert.equal(store.apply({}, { source: 'text' }).status, 'unchanged');
  assert.equal(store.apply({ tone: 'professional' }, { eventId: 'accepted' }).status, 'duplicate');
  assert.equal(store.apply({ tone: 'educational' }, { baseRevision: 0 }).status, 'conflict');
  assert.throws(() => store.apply({ intensity: 'invalid' }), TypeError);
  assert.throws(() => store.apply({ intensity: 'bold' }, { source: 'invalid' }), TypeError);
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].state, store.snapshot());
});

test('reentrant updates reach every subscriber in acceptance order', () => {
  const store = createPreferenceStore();
  const first = [], second = [];
  store.subscribe(change => {
    first.push(change.state);
    if (change.state.revision === 1) {
      const nested = store.apply({ intensity: 'bold' }, { source: 'voice' });
      nested.state.values.tone = 'professional';
      nested.state.revision = 999;
    }
  });
  store.subscribe(change => second.push(change.state));
  store.apply({ tone: 'educational' });
  assert.deepEqual(first.map(state => state.revision), [1, 2]);
  assert.deepEqual(second, first);
  assert.deepEqual(second.at(-1), store.snapshot());
});
