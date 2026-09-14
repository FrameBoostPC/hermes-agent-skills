# Dashboard integration

These schemas are the proposed output contract for the Hermes setup demonstrated and taught in our course, not a built-in Hermes dashboard API. The repository contains skills and validation tooling; connecting them to the dashboard being developed separately is a separate implementation step.

## Invoke and display

Pass the selected skill, user's task, relevant creator/project context, and an explicit request to return dashboard JSON to the agent. Keep the user's content distinct from application instructions. The skill selects no model and does not assume a particular dashboard framework.

Each response has the same envelope:

| Field | Meaning |
| --- | --- |
| `schema_version` | `1.0`, the output contract version; distinct from the skill package version |
| `skill` | One of the three installed skill names |
| `status` | `ready`, `partial`, or `needs_input` |
| `title`, `summary` | Title and overview; for research/planning, `summary` is the condensed reader view |
| `assumptions` | Reasonable choices the agent made where input was missing |
| `questions` | Questions for essential clarification or unresolved work |
| `limitations` | Missing evidence, unavailable execution, or material constraints |
| `data` | Skill-specific content, or null when input is needed |

`ready` means the requested deliverable has been prepared. It never means posts were published or project tasks executed. `partial` means a useful result exists but some requested work or essential evidence remains unavailable. `needs_input` has null data and at least one question. A ready result has no pending questions.

The payloads support these views:

- `idea-to-content`: show `data.assets` as editable content cards; link their hooks using `hook_id`. Make `content` the copyable caption or spoken script. Keep creator guidance, `production_notes`, and internal titles outside the copy area. `call_to_action` identifies text already in the draft; do not append it again. A separate video `caption` is its own copy area. Hide empty hook lists and omit planning displays when the user asks only for drafts. Stable JSON fields need not all be shown in the UI.
- `research-brief`: show findings with linked source IDs. Label `provided_text` sources as supplied excerpts and `read_url` sources as retrieved pages. Preserve fact/inference/hypothesis labels and limitations.
- `project-planner`: show milestones and tasks by relative week. Compare planned effort with weekly hours and any one-time total-minute allowance. Dependencies use task IDs. All tasks are proposed with `status: planned`; actual completion belongs to the application's task state.

## Idea to Content writing-style controls

The skill accepts voice preferences now. The [portable content-preferences component](../components/content-preferences/README.md) implements selectors and a local generation preview for the separately developed dashboard. It emits preferences and request events. The preview's Python server loads the skill and calls a configurable model directly, initially local gpt-oss:20b through Ollama. The partner can replace that connection with their Hermes backend without changing the skill output schema or shared selector state. The choices below remain the integration contract, not a Hermes configuration API. Keep the first screen simple: the user's topic, their requested deliverables, and a **Writing style** selector. Put the additional controls under an optional **Customise voice** disclosure.

The maintained preset definitions and writing behaviours live in [writing styles](../skills/idea-to-content/references/writing-styles.md). The skill loads that file when drafting or rewriting copy.

| Control | Choices and default | Behaviour |
| --- | --- | --- |
| Writing style | Engaging (default), Educational, Entertaining, Emotional, Professional, Custom | One primary style. Custom accepts the user's description. |
| Secondary style (optional) | Another named style, or none (default) | Adds a lighter influence; do not require multiple selections. |
| Intensity (mapped to Energy in the skill) | Calm, Balanced (default), Bold | Changes pacing and emphasis, not factual certainty. |
| Wording | Plain, Conversational (default), Polished | Changes vocabulary and phrasing; never automatically adds slang or profanity. |
| Writing sample (optional) | Pasted sample or an accessible user-owned profile | A reference for voice; never a source of new product facts or personal history. |

Users can also type or speak a writing-style request in ordinary language. Treat deliberate changes to a setting as overrides of its older value, regardless of input channel. Specific requirements such as no humour remain constraints until the user changes them; a preset must not silently erase those requirements. Do not let an untouched default control override a specific instruction in the user's brief. If the user has not chosen anything, send defaults as fallback preferences. Content purpose (for example, teaching or promoting a product) and audience remain separate from voice.

Pass selected values as request context alongside the topic, audience, factual material, requested assets, and any original copy being rewritten. For example:

```text
Skill: idea-to-content
Topic: how to get good at public speaking
Audience: beginners who hesitate to speak in front of other people
Deliverables: one 45-second vertical video and one companion caption
Writing style: Engaging
Secondary style: Educational
Energy: Bold
Wording: Conversational
Specific instructions: no slang; show one concrete practice exercise
Return dashboard JSON.
```

This is a prompt example, not a new structured request schema. Keep sample/source text labelled as reference content, separate from application instructions. Save the user's actual control selections in application state; the model's existing `data.brief.tone` describes the resolved voice for review. Do not parse that prose field as the source of truth for UI settings. The output schema remains `1.0`, so existing consumers need no new fields.

Applying a new voice to existing copy requires a new generation; this differs from the research/planner reading-view toggle. Offer **Rewrite in this style** on a selected asset. Send that asset's original copy, its factual brief, audience, length constraints, and the new voice, and request only that asset. Keep the previous version available for comparison. After validation, replace only the targeted card; unrelated assets retain their copy and voice. The application owns card identity, version history, loading/error states, and any decision to save a default profile. A rewrite does not imply posting or scheduling.

## Text, buttons and voice share one request

Users must be able to move between typing, clicking and speaking within the same task. Keep one application-owned brief and preference state for that task. All three inputs update it, and the dashboard displays the accepted values. Hermes receives the resolved brief rather than three competing sets of instructions. The portable component implements shared writing-preference state, simple command interpretation and optional speech capture. The broader routing design below still requires the partner's application, speech service and Hermes backend; it is not a new skill output schema.

### Route all inputs to the same actions

- **Text:** interpret the user's request into a topic, deliverables, preferences, target and action.
- **Buttons:** submit explicit settings or actions directly; no model is needed to interpret a dropdown selection.
- **Voice:** reuse the partner's speech layer. With a transcription pipeline, interpret the completed transcript through the same path as text. If a conversational audio model is used, have it send the equivalent intent to the same application actions. It must not keep an independent copy of the current settings or produce a second competing content pack.

The application validates and applies the intended change, updates the visible controls, and invokes the existing skill when generation or rewriting is requested. Preserve natural-language constraints that do not fit a preset, such as “warm, lightly sarcastic, no jargon.” Keep the original request available as context, clearly distinguishing superseded settings from current ones. Do not infer the desired writing style from how emotional, loud or fast the user's microphone audio sounds.

Examples below show mappings in a content-writing context, not universal keyword substitutions:

| User action | Accepted change and behaviour |
| --- | --- |
| Types or says “Write a 45-second public-speaking script. Make it engaging and punchy.” | Set the topic, video length, Engaging style and Bold energy; generate one script and show the resolved choices. |
| Clicks Emotional, then Calm | Set those two preferences for the selected scope. Generate/Rewrite remains a separate action. |
| Says “Make this more emotional, but keep it subtle” with one script selected | Set Emotional and Calm for that script and rewrite it, preserving its facts and requested length. |
| Says “Keep it educational, just dial it down a bit” | Keep the style; reduce energy one step if possible. In a current-draft revision context, rewrite that draft. |
| Says “Use a warmer voice, without sounding sentimental” | Preserve that custom wording instruction; do not discard it merely because there is no exact preset. |
| Says “Use this tone for everything from now on” | Save the resolved preferences to that user's defaults and acknowledge the save after it succeeds. |

Treat Tone/Writing style and Intensity/Energy as label aliases. The UI may show **Tone** and **Intensity** while the skill continues to receive its existing style and energy vocabulary. Content voice and the assistant's speaking voice are separate settings: “make the script calmer” changes copy; “speak more slowly” changes audio delivery where supported. If the intended target is unclear, ask a short question.

### Resolve scope, changes and intent

Use explicit user scope first. “Only the caption” targets that asset; “all three” targets the named set. Otherwise use the clearly selected or currently discussed asset. If several drafts could be “this,” ask which one before rewriting. A fresh content request inherits current task preferences, then saved user defaults, then skill defaults. Editing one asset's tone does not silently alter its siblings or permanent defaults. Keep the UI's scope visible, for example “This script” versus “New drafts.” Save lasting preferences only when the user asks or enables that setting.

Within the same scope and setting, the latest deliberate choice wins across all channels. Changing energy preserves tone and unrelated constraints. A later button selection can supersede an earlier spoken tone choice, and a later spoken choice can supersede an earlier button selection. Distinguish untouched defaults from deliberate selections. Where equally current specific instructions cannot be reconciled, clarify only the disputed part.

All selectors for that scope must remain in agreement with that accepted choice until the user updates it. The portable component supports this by sharing one observable store between views, synchronously refreshing every connected selector after button/text/voice or host updates, and building outgoing requests from the same current snapshot. Bind all views for one draft to that store using the component's `store` property. Do not create a separate voice preference cache, reapply defaults after generation, or let `data.brief.tone` from an agent result reset the user's controls. The partner's full conversation layer must apply newly recognised preferences to this store before requesting content, and continue checking result revisions before showing or speaking completion.

Keep setting changes and execution distinct. “Set the tone to Emotional” changes preferences and receives a short acknowledgement. “Write…”, “Generate”, or “Rewrite this…” executes without a redundant confirmation once topic and target are clear. In an active draft discussion, “Make it funnier” is a rewrite request. Display or speak the resolved change briefly so the user can correct it; do not recite a form or require confirmation of every ordinary choice. Missing optional tone/intensity does not block drafting.

If the user asks what choices are available, offer the same styles and intensity levels through speech and on-screen choices. They can answer by voice, typing or clicking. A follow-up question keeps the original task pending and accepts its answer through any channel; selecting an option must not start a separate conversation or lose the topic.

### Keep voice and the screen in sync

Show Listening, Processing and Generating states only from actual application events. Interim transcription is a draft and must not start multiple generations. Accept one completed utterance as one request, with an event identity that prevents duplicate delivery from causing duplicate work. Keep recognised text visible/editable where a screen is available; direct voice commands should not require an extra click. Clarify a consequential ambiguity such as an uncertain target or a poorly recognised style rather than silently rewriting the wrong asset.

Associate work with the target asset, original copy version and the revision of its input/settings. Pause spoken playback while a new utterance is being resolved. If an accepted newer request changes the target's inputs, cancel obsolete work where supported or keep its eventual result as an older version; never replace the current draft with a stale result or speak it as current. Check delayed transcripts against the state revision they started from: a late transcription must not blindly overwrite a newer conflicting click. Reconcile clear changes and clarify conflicting ones. Provide separate handling for stopping spoken playback, cancelling generation, and ending the voice session; reuse the partner's supported interruption controls.

For voice-originating drafting requests, give a brief spoken acknowledgement and a short completion message while showing the full validated drafts on screen. “Read the script” reads the selected asset's finished copy, excluding internal labels and production notes. Do not speak raw JSON or automatically read an entire content pack. Spoken status must reflect the actual run outcome. A voice-only session can request the same readback and revisions without using the screen.

Hermes documents transcription and spoken-reply flows in [Voice Mode](https://hermes-agent.nousresearch.com/docs/user-guide/features/voice-mode) and editable/direct voice submission in its [practical voice guide](https://hermes-agent.nousresearch.com/docs/guides/use-voice-mode-with-hermes). These capabilities do not establish that the partner's custom dashboard has this shared state or routing implemented. Check the installed Hermes version and the existing audio stack during integration; this design does not require choosing a new speech provider.

### Integration acceptance examples

Verify that equivalent typed, clicked and spoken requests reach the same resolved brief and action, allowing normal model variation in generated wording. Then exercise a mixed sequence: choose Engaging/Bold with buttons, dictate a topic and generate, say “Make only the script emotional but subtle,” and type “keep it under 45 seconds.” Check that controls, current copy and spoken acknowledgement agree, and that sibling captions and saved defaults stay unchanged. Also test an ambiguous target, a corrected transcript, duplicate utterance delivery, a preference update without generation, and a slow older run completing after a newer rewrite. These are handoff scenarios; none has been executed against the custom dashboard here.

## Summary / In depth toggle

Research Brief and Project Planner provide two reading views from one response. Use the existing `summary` and `data` fields; the output contract remains `1.0`. Default the interface to **Summary**, with **In depth** as the other choice. Persist one response and switch which fields are displayed. Changing views does not rerun the model, gather different evidence, change the plan, or execute tasks.

| Display | Research Brief | Project Planner |
| --- | --- | --- |
| Both views | Title, status, material limitations and recommendation-changing conflicts | Title, status and material limitations; show any infeasible original goal and essential deferred scope |
| Summary | `summary`, followed by the first `data.next_actions` item | `summary`, `data.first_action`, and planned effort versus supplied capacity |
| In depth | `summary`, question, scope, assumptions, answer, labelled findings and their sources, conflicts, all next actions and limitations | `summary`, goal, success criteria, assumptions, milestones, tasks by relative week, deliverables, dependencies, estimates, capacity, first action, deferred scope and limitations |

For research JSON, `summary` and `data.answer` use individual inline citation tokens such as `[source-1]` or adjacent `[source-1][source-2]`. Resolve each token through `data.sources`, including tokens in conflict and next-action text. A retrieved page becomes a descriptive link to its recorded URL. Supplied text receives its source title and a supplied/unverified label, even if a URL was included with the excerpt; never present it as a retrieved page. Do not show unresolved IDs as if they were citations. Detailed findings retain their structured `source_ids`. The validator checks inline IDs in the summary, answer, conflicts and next actions; factual support and whether citations are missing still require review.

Compute planner capacity totals from `data.tasks` and its budget fields. Unknown dates and available hours remain unknown in both views. Estimates remain estimates, and `ready` means the plan or brief is prepared. If users edit tasks or findings, refresh the summary from the revised result before showing it again; do not pair a stale summary with changed detail.

For `needs_input`, show the questions with `data: null` and hide the detail toggle. For `partial`, keep limitations visible even in Summary; never make missing evidence or an infeasible deadline disappear through condensation. Empty evidence still permits a short research plan but does not justify a made-up detailed answer.

In ordinary chat, these two skills default to the condensed view. Requests can explicitly ask for `Summary only`, `In depth only`, or `both views`. JSON mode always supplies the full payload so the application can switch views without a second generation. This repository supplies the skill instructions and output contract; the toggle itself is implemented in the separately developed dashboard.

## Validate at the application boundary

Parse the response as JSON and validate it against that skill's self-contained `templates/output.schema.json` before rendering. Treat dates and source IDs as data, not instructions. The local `scripts/validate.py --output` command is a developer check; use equivalent schema and semantic checks in the actual backend.

The backend must also check cross-references, unique IDs, acyclic task dependencies, and capacity totals where applicable. Validation cannot establish that a source was genuinely read; rely on execution records and review for that. Render all model text as untrusted content and allow only appropriate external link schemes.

If a response is malformed, request a bounded repair with the validation errors (for example, one retry), or surface a clear retry state. Do not silently substitute an empty result and display success.

## Execution state belongs to the application

The backend owns run IDs, timestamps, authentication, user isolation, persistence, actual tool events, retries, and any publishing or scheduling. Derive progress indicators from observed execution events. Keep these fields separate from model-generated summaries.

Do not automatically turn a draft calendar plan into external calendar events. A research skill cannot provide web access by being installed, and a video script is not an edited video file. Add those capabilities through real integrations and show successful external actions only after the corresponding tool result.

No customer's profile, sources, or output should be written back into the shared skill package. Pass user context per run or store it in that user's application workspace.
