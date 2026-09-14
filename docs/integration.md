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

The skill accepts voice preferences now; the controls below are a handoff specification for the separately developed dashboard. They are not an implemented UI or a Hermes configuration API. Keep the first screen simple: the user's topic, their requested deliverables, and a **Writing style** selector. Put the additional controls under an optional **Customise voice** disclosure.

The maintained preset definitions and writing behaviours live in [writing styles](../skills/idea-to-content/references/writing-styles.md). The skill loads that file when drafting or rewriting copy.

| Control | Choices and default | Behaviour |
| --- | --- | --- |
| Writing style | Engaging (default), Educational, Entertaining, Emotional, Professional, Custom | One primary style. Custom accepts the user's description. |
| Secondary style (optional) | Another named style, or none (default) | Adds a lighter influence; do not require multiple selections. |
| Energy | Calm, Balanced (default), Bold | Changes pacing and emphasis, not factual certainty. |
| Wording | Plain, Conversational (default), Polished | Changes vocabulary and phrasing; never automatically adds slang or profanity. |
| Writing sample (optional) | Pasted sample or an accessible user-owned profile | A reference for voice; never a source of new product facts or personal history. |

Users can also type a voice request in ordinary language. Treat explicitly changed instructions as overrides of presets and saved preferences. Do not silently let a default control override a specific instruction in the user's brief. If the user has not chosen anything, send defaults as fallback preferences. Content purpose (for example, teaching or promoting a product) and audience remain separate from voice.

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

Changing voice requires a new generation; this differs from the research/planner reading-view toggle. Offer **Rewrite in this style** on a selected asset. Send that asset's original copy, its factual brief, audience, length constraints, and the new voice, and request only that asset. Keep the previous version available for comparison. After validation, replace only the targeted card; unrelated assets retain their copy and voice. The application owns card identity, version history, loading/error states, and any decision to save a default profile. A rewrite does not imply posting or scheduling.

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
