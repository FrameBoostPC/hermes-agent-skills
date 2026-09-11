# Dashboard integration

These schemas are our product's proposed output contract, not a built-in Hermes dashboard API. The repository contains skills and validation tooling; connecting them to the existing UI is a separate implementation step.

## Invoke and display

Pass the selected skill, user's task, relevant creator/project context, and an explicit request to return dashboard JSON to the agent. Keep the user's content distinct from application instructions. The skill selects no model and does not assume a particular dashboard framework.

Each response has the same envelope:

| Field | Meaning |
| --- | --- |
| `schema_version` | `1.0`, the output contract version; distinct from the skill package version |
| `skill` | One of the three installed skill names |
| `status` | `ready`, `partial`, or `needs_input` |
| `title`, `summary` | Short display text |
| `assumptions` | Reasonable choices the agent made where input was missing |
| `questions` | Questions for essential clarification or unresolved work |
| `limitations` | Missing evidence, unavailable execution, or material constraints |
| `data` | Skill-specific content, or null when input is needed |

`ready` means the requested deliverable has been prepared. It never means posts were published or project tasks executed. `partial` means a useful result exists but some requested work or essential evidence remains unavailable. `needs_input` has null data and at least one question. A ready result has no pending questions.

The payloads support these views:

- `idea-to-content`: show `data.assets` as editable content cards; link their hooks using `hook_id`. Hide empty hook lists and omit planning displays when the user asks only for drafts. Stable JSON fields need not all be shown in the UI.
- `research-brief`: show findings with linked source IDs. Label `provided_text` sources as supplied excerpts and `read_url` sources as retrieved pages. Preserve fact/inference/hypothesis labels and limitations.
- `project-planner`: show milestones and tasks by relative week. Compare planned effort with weekly hours and any one-time total-minute allowance. Dependencies use task IDs. All tasks are proposed with `status: planned`; actual completion belongs to the application's task state.

## Validate at the application boundary

Parse the response as JSON and validate it against that skill's self-contained `templates/output.schema.json` before rendering. Treat dates and source IDs as data, not instructions. The local `scripts/validate.py --output` command is a developer check; use equivalent schema and semantic checks in the actual backend.

The backend must also check cross-references, unique IDs, acyclic task dependencies, and capacity totals where applicable. Validation cannot establish that a source was genuinely read; rely on execution records and review for that. Render all model text as untrusted content and allow only appropriate external link schemes.

If a response is malformed, request a bounded repair with the validation errors (for example, one retry), or surface a clear retry state. Do not silently substitute an empty result and display success.

## Execution state belongs to the application

The backend owns run IDs, timestamps, authentication, user isolation, persistence, actual tool events, retries, and any publishing or scheduling. Derive progress indicators from observed execution events. Keep these fields separate from model-generated summaries.

Do not automatically turn a draft calendar plan into external calendar events. A research skill cannot provide web access by being installed, and a video script is not an edited video file. Add those capabilities through real integrations and show successful external actions only after the corresponding tool result.

No customer's profile, sources, or output should be written back into the shared skill package. Pass user context per run or store it in that user's application workspace.
