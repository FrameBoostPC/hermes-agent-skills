# Content preferences component

A framework-neutral `<content-preferences>` custom element for Idea to Content. Copy this whole folder into the partner's frontend or import its modules. No production npm dependencies, model calls, credentials, account connections, or global profile changes are included. This component is separate from the installable Hermes skill folders.

## Run the preview

From the repository root:

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory components/content-preferences
```

Open `http://127.0.0.1:8765/demo.html`. The preview provides tone cards, Calm/Balanced/Bold intensity, wording/custom directions, typed commands and optional browser microphone transcription. **Prepare request** creates a copyable Hermes prompt. It does not generate content or call Hermes. Rewriting needs an original draft and the host backend.

The offline interpreter recognises complete, simple commands such as `Tone: educational`, `Emotional and calm`, `Make this emotional, but keep it subtle`, `Make it a little less intense`, and `Custom: warm, dry humour, no jargon`. Unrecognised, conflicting or compound instructions are reported without partially applying them. For example, `Make it emotional but no slang` requires the Custom voice field or the host interpreter. It is deliberately not a general language model. Existing custom directions survive preset changes; an explicit `Custom:` instruction replaces the previous custom description.

Microphone input uses `SpeechRecognition` or `webkitSpeechRecognition` when available. Recording begins only on a user click; a completed utterance is passed through the same interpreter as typed text. Unsupported or declined microphone access leaves text/buttons usable. Some browser speech services process audio online and may not work offline; see [MDN's speech recognition reference](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). In-app browser support is not assumed. Inject the partner's existing Hermes speech adapter for its production voice workflow.

## Embed and connect

```html
<script type="module" src="./content-preferences/controls.mjs"></script>
<content-preferences scope-label="This script"></content-preferences>
```

Use one store per editing scope. Every selector view for the same scope must share that store; do not maintain independent button, chat and voice values. `scope-label` is a display label, not an asset identity or a mechanism for loading another asset's saved preferences. The host owns asset IDs, per-user persistence, source facts, run cancellation and results. Changing the label refreshes the display and invalidates pending interpretation; bind the correct store when changing actual scope.

```js
import { createPreferenceStore } from './content-preferences/state.mjs';
const shared = createPreferenceStore();
mainControls.store = shared;
floatingControls.store = shared;
// Direct host updates also refresh every connected view synchronously.
shared.apply({ tone: 'emotional', intensity: 'calm' }, { source: 'voice' });
```

Accepted values stay authoritative until the user deliberately changes those fields. The store never restores fallbacks after generation or takes new preferences from the model's output. Every input updates the same state, the component renders from it, and each request snapshots it. Keep saved defaults as initial/fallback context; do not replay them through `apply` after the user has made a choice. Text in the instruction box is a draft or transcript, not another selected value.

The `store` setter unsubscribes the old store, cancels pending interpretation/capture and immediately displays the new store. A detached view resynchronises on reconnection. `store.subscribe(listener)` returns an unsubscribe function and synchronously delivers detached `{status, state, source}` notifications for accepted nonempty updates, including same-value reaffirmations. Empty, duplicate, invalid or conflicting updates do not notify. Reentrant updates are delivered in acceptance order. One throwing listener does not prevent other views receiving updates; its error is reported in that `apply` result's `notificationErrors` array. Subscribers should render/read state rather than feed it back into the same store.

```js
const controls = document.querySelector('content-preferences');
controls.setPreferences({ tone: 'educational', intensity: 'bold' });

controls.addEventListener('preferences-change', ({ detail }) => {
  // detail.state contains a detached snapshot. Persist only if the user requested it.
});

controls.addEventListener('content-request', ({ detail }) => {
  // Send detail.preferenceContext + the original brief/draft through YOUR Hermes
  // integration. detail.action is generate or rewrite. Use your real asset ID.
  // Capture detail.state.revision and the asset's version before starting work.
  // Validate the result against the skill schema before displaying it. Check the
  // revision/version again so late results cannot replace newer edits.
});
```

`requestContent('generate' | 'rewrite')` emits one request with a detached state snapshot. Changing selectors alone emits no content request. The built-in parser treats `Make this…` as a rewrite request and `Set the tone…` as a settings update. Preparing a request waits for the component's current instruction to resolve; a completed voice instruction can issue its requested action. Caller metadata cannot override the snapshot, action, scope or preference context. The demo surfaces a missing-original-draft message for rewrites. Any shared-store change marks a previously prepared demo prompt out of date.

`preferences` returns `{revision, values, fieldRevisions}`. UI `tone` maps to the skill's Writing style; `intensity` maps to Energy. `values` contains `tone`, `intensity`, `wording`, `customVoice`, and optional `secondaryTone`. The current UI offers the first four; hosts can set `secondaryTone` programmatically. Tone, intensity and wording all support deliberately reaffirming the currently selected radio. Zero field revision means an untouched fallback, which the generated request explicitly labels. The request also states that accepted choices supersede older preferences in the brief for the same fields. `setPreferences()` represents deliberate accepted choices. Use a new store with no initial values for untouched defaults. `preferences-change` is also emitted with `status: 'rebound'` and `source: 'binding'` when the component switches stores.

## Connect the agent's language understanding

Set `controls.interpretText` to your async interpreter with this signature:

```js
// Values are a detached snapshot; metadata has source, baseRevision and eventId.
controls.interpretText = async (text, values, metadata) => {
  // Ask YOUR backend to interpret the complete instruction in the current scope.
  // Return, for example:
  return { patch: { tone: 'emotional', intensity: 'calm' }, action: 'rewrite' };
};
```

The return above is an interface illustration, not a working backend: do not use a constant response in production. Return only the changed fields in `patch`, preserving custom directions unless the user changes them. Supported actions: `settings`, `generate`, `rewrite`, or `clarify` with a short `message`. Conflicting/unclear input should return `clarify` and an empty patch. Topic changes, length edits, multi-asset targets, saved profiles and agent speech controls belong to the host's full conversational router; this selector handles writing preferences only.

`submitInstruction(text, {source, baseRevision, eventId})` is available for host-delivered text or completed transcripts. Sources are `text` or `voice`; button changes use `setPreferences(patch, options)`. Capture `baseRevision` when the input begins and use a stable event ID. Accepted changes update the visible controls. The store rejects stale conflicting fields atomically, permits unrelated stale changes, and retains the last 256 accepted event IDs to avoid duplicate delivery. Durable/network deduplication belongs to the host. Pending interpretations are discarded after a newer instruction, scope-label change or element removal. Locally captured voice interpretations are also invalidated by microphone cancellation/replacement.

## Connect speech

Assign `controls.speechAdapter` with this interface:

```js
controls.speechAdapter = {
  start({ onStart, onInterim, onFinal, onError, onEnd }) {
    // Start YOUR transcription service only after this user-initiated call.
    // onStart(): recording has actually begun.
    // onInterim(text): display only; do not execute.
    // onFinal(text): one completed utterance; do not paraphrase user intent.
    // onError(message): failed/denied service; onEnd(): capture finished.
    return {
      stop() { /* End recording and request its final transcript. */ },
      abort() { /* Cancel recording and release the microphone. */ },
    };
  },
};
```

The sketch above documents callbacks; replace the empty methods with actual service controls. Component removal and adapter replacement cancel capture. Typed submission retires active capture so the same visible transcript cannot execute twice. Calling `cancelVoice()` discards pending locally captured speech interpretation as well as capture callbacks. Host-delivered transcripts should manage their own cancellation lifetime before calling `submitInstruction`.

Spoken assistant replies, playback speed/voice, reading drafts aloud and full-duplex audio are outside this writing-style component. Keep them in the existing voice layer.

## Tests

Node 20+ is sufficient for the dependency-free checks:

```sh
node --test components/content-preferences/state.test.mjs components/content-preferences/intent.test.mjs
```

The browser suite additionally needs Playwright available to Node and a browser installed for it:

```sh
node --test components/content-preferences/browser.test.mjs
```

Optionally set `PLAYWRIGHT_MODULE` to an installed Playwright module entry path, `PLAYWRIGHT_CHANNEL` to a locally installed supported channel such as `msedge`, and `CONTROLS_SCREENSHOT` to an output PNG path. The suite starts its own loopback server, uses an isolated headless browser, and injects speech callbacks; it never records microphone audio. Production custom-dashboard integration and actual speech-service transcription still require testing on the partner's machine.
