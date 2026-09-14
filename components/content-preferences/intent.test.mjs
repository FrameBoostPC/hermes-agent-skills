import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretPreferenceText, buildPreferenceContext } from './intent.mjs';
const values = { tone: 'educational', intensity: 'bold', wording: 'plain', customVoice: 'no slang', secondaryTone: null };

test('spoken and typed instructions resolve into the same two choices', () => {
  const result = interpretPreferenceText('Make this emotional, but keep it subtle.', values);
  assert.deepEqual(result.patch, { tone: 'emotional', intensity: 'calm' });
  assert.equal(result.action, 'rewrite');
  assert.deepEqual(interpretPreferenceText('Tone: emotional and intensity: calm', values).patch, result.patch);
});
test('setting selection does not request generation', () => {
  assert.equal(interpretPreferenceText('Set the tone to professional', values).action, 'settings');
  assert.equal(interpretPreferenceText('Generate', values).action, 'generate');
});
test('relative intensity changes one step without touching tone', () => {
  assert.deepEqual(interpretPreferenceText('Make it a little less intense', values).patch, { intensity: 'balanced' });
  assert.deepEqual(interpretPreferenceText('dial it down', { ...values, intensity: 'calm' }).patch, { intensity: 'calm' });
});
test('custom voice is kept verbatim and may contain negation', () => {
  assert.deepEqual(interpretPreferenceText('Custom: warm, dry humour, no jargon', values).patch, { tone: 'custom', customVoice: 'warm, dry humour, no jargon' });
});
test('unsupported or conflicting instructions never partially change controls', () => {
  for (const text of ['Not emotional', 'Emotional but no slang', 'Emotional and professional', 'Write about emotional resilience', 'Make it emotional and shorten to 30 seconds', 'More professional, without jargon']) {
    const result = interpretPreferenceText(text, values);
    assert.equal(result.action, 'clarify', text);
    assert.deepEqual(result.patch, {}, text);
  }
});
test('fallback settings are labelled separately from deliberate instructions', () => {
  const context = buildPreferenceContext({ values, fieldRevisions: { tone: 1, intensity: 0, wording: 0, customVoice: 1, secondaryTone: 0 } });
  assert.match(context, /Writing style: educational\n/);
  assert.match(context, /Energy: bold \(fallback preference/);
  assert.match(context, /Additional voice direction: no slang/);
});
