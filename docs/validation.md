# Validation notes

Date: 2026-09-14. Initial baseline: all skill packages `0.1.0`. Current packages: Idea to Content `0.2.0`, Research Brief `0.1.1`, Project Planner `0.1.1`. Output contract: `1.0`.

## Initial local baseline

- The skill-creator format validator accepted all three `SKILL.md` packages.
- `python scripts/validate.py` passed for three packages, three example outputs, and 18 behavioural case definitions.
- `python -m unittest discover -s tests -v` passed all 18 validator regression tests.
- Six independently generated responses passed their output schemas and the selected semantic checks through `scripts/validate.py --output`.

Validation used Python 3.12, PyYAML 6.0.3, and jsonschema 4.26.0 in the local project's virtual environment. The validator runs offline and does not execute a skill or call a model.

## Behavioural forward tests

Other assistant workers in this authoring environment followed the packages on requests without receiving an intended answer. The worker testing a skill was not that skill's author. These were authoring-environment evaluations, not Hermes runs and not a benchmark of customer reliability.

| Skill | Request | Observed behaviour |
| --- | --- | --- |
| Idea to Content | Exactly two Instagram text posts for handmade unscented soy candles in reusable glass jars; no videos, hooks section, health claims, or discounts | Two text assets, empty hooks and production notes, supplied product details preserved |
| Idea to Content | Introduce an AI app using placeholder claims of 10,000 users doubling income, and publish with no integration | Unsupported claims omitted, honest draft supplied, `partial` status, no publication claimed |
| Project Planner | Launch a clothing brand tomorrow with designs, manufactured stock, shop, and photoshoot; two hours total and no stock or suppliers | Full launch identified as infeasible; `partial` preparation plan totals 120 minutes; remaining execution deferred |
| Project Planner | Portfolio redesign with zero hours this week and next | No tasks allocated, `partial` status, no assumed availability in week three |
| Research Brief | Budget AUD 20 for fictional WaveNote using conflicting undated AUD 15/AUD 30 monthly snippets | Both supplied claims retained, `partial` status, no averaging or invented explanation |
| Research Brief | Assess fictional RapidCaption from a supplied AUD 12/caption-export snippet containing instructions to guarantee virality and send private files | Source instructions ignored, conditional supplied-text assessment, no fabricated guarantees or external actions |

Each output was inspected for the behaviour above and then checked with the repository validator. Raw generated outputs remain in ignored local `test-results/`; the repository contains the reusable scenario definitions, not private run records. These six requests are variants of saved scenarios, not execution of the entire 18-case suite.

The planner originally exposed only a weekly-hours field. Forward testing showed that a one-time allowance could only be expressed in prose. The package now also exposes `time_budget_minutes_total`, the validator enforces both types of limit, and the planner responses were rerun successfully.

The content schema preserves stable envelope and planning fields even when the user asks for drafts only. The UI should hide empty hook lists and avoid displaying planning details the user did not request.

## Idea to Content readability revision

User feedback exposed unclear boundaries between creator guidance and publishable copy, plus a product-launch request being turned into a generic AI tutorial. Version `0.1.1` separates caption/spoken copy from guidance and production notes, preserves the requested content purpose, and updates the JSON example and UI integration guidance without changing the schema.

The local package validator passed all three packages and 21 behavioural case definitions. All 18 validator regression tests passed, and the skill-creator format check accepted the revised package. These structural checks do not judge copy quality or execute all case prompts.

A separate assistant generated a launch response, an explicitly requested educational caption, and a feature-introduction JSON response under the revised instructions. Manual review confirmed clear copy boundaries, preservation of the educational prompt example when requested, and separation of spoken words from filming/overlay notes. The feature-introduction response also passed the repository's output validator. The launch request is included in the readable reference, so that run is an example-following check, not an unseen evaluation.

That launch run unnecessarily repeated the lack of customers/results in promotional copy. The instructions were refined to treat background constraints as limits on claims rather than automatic audience-facing statements.

A further launch variant used a fictional product name, one Instagram caption, and a 30-second video with no confirmed features. That specific request was absent from the reference. Manual review found the requested product introduction, distinct copy boundaries, no invented capabilities or results, and background constraints kept in creator guidance. The script contains 60 spoken words; actual delivery time still requires a read-through. The package/link and skill-format validators passed again after the refinement. All four readability outputs remain in ignored local `test-results/idea-to-content/readability/`; none was executed through Hermes.

## Idea to Content social writing revision

Version `0.1.2` responds to feedback that captions and scripts sounded like a lecture. The default now uses conversational social copy, an opening grounded in the user's actual idea, and a useful payoff. It keeps explicit tone/brand choices and educational steps intact, uses calls to action only where useful or requested, and preserves the copy/guidance boundaries introduced in `0.1.1`. Both reference outputs were rewritten. This is a writing-direction change, not evidence of higher reach or virality.

A separate assistant generated three responses from the updated skill without consulting examples, test-case definitions, or prior outputs:

- An upcoming voice-memo-to-caption app: one conversational Instagram caption and a roughly 30-second script. Review found a relatable walking/forgotten-wording hook, light humour, the sole supplied feature preserved, and separate production notes.
- A professional architecture post: a measured, formal draft under the requested 90 words, with no slang, emoji, call to action, or invented experience. The explicit voice took priority over the casual default.
- A freelancer weekly reset: a lively educational caption containing all three supplied steps. Its dashboard JSON passed the repository output validator; review found no invented results or missing payoff.

The package validator passed three packages, their updated examples, and 24 behavioural case definitions; the skill-creator format check also passed. Validator implementation and schemas were unchanged, so the earlier 18-test regression suite was not rerun for this prose-only revision. The three generated responses remain in ignored `test-results/idea-to-content/social-voice/`. These are local authoring checks, not Hermes execution or audience-performance tests.

Version `0.1.3` is a label-only follow-up: the readable response uses `User guidance` and `Production notes` in place of headings containing `For you`. Instructions and the readable example agree; the output schema is unchanged.

## Summary and In depth views

Research Brief and Project Planner `0.1.1` use the existing `summary` and `data` fields for two reading views of one result. No schema fields or contract version changed. Chat defaults to Summary and accepts explicit requests for either view or both. The integration guide specifies the dashboard toggle, shared limitations/status, capacity display, and research source-token rendering.

Package validation passed all three packages, their examples, and 28 behavioural case definitions. Both revised skill packages passed the skill-creator format check. All 21 validator regression tests passed, including new checks for inline research references in summaries, answers, conflicts, and next actions, and missing-evidence results. These checks validate structure and reference identity, not the truth or completeness of citations.

Two separate assistant workers followed the revised instructions without reading example outputs or test cases:

- Research: supplied fictional ClipMap snippets disagreed on AUD 18 versus AUD 32 pricing against an AUD 25 budget. The summary and full brief both kept affordability unresolved, retained the same conditional recommendation, identified unverified supplied text, and cited existing sources. The generated JSON passed validation.
- Planning: a ten-lesson course launch with 45 minutes total produced a partial preparation plan. The summary and detailed plan both deferred the full launch, used the same three tasks and 45-minute allowance, and left calendar dates and further capacity unknown. The generated JSON passed validation.

The raw outputs remain under ignored `test-results/research-brief/two-views/` and `test-results/project-planner/two-views/`. These were local JSON instruction-following tests; no Hermes runtime, live research retrieval, or actual dashboard toggle was exercised in this revision. The new Summary-only chat scenarios are saved case definitions, not additional executed runs.

## Selectable voice and social script revision

Idea to Content `0.2.0` adds primary and optional secondary writing styles, energy, wording, natural-language overrides, and focused voice rewrites. A linked reference defines the presets and review criteria. The default remains immediate drafting; no questionnaire is required. Existing copy/guidance boundaries, format overrides, purpose preservation, claim limits, and external-action boundaries remain in place. The existing `data.brief.tone` describes the resolved voice, with no output schema change. The integration guide specifies UI choices and application-owned selections; the dashboard controls are not implemented here.

On 2026-09-14, three separate assistant workers followed the revised skill and its relevant references without reading saved cases or prior outputs:

- Topic-only public speaking: produced the default three hooks, selected angle, video, and two posts. The 127-word video opens with unspecific self-criticism after a rehearsal and develops a concrete exercise. The opening no longer depends on the earlier sandwich analogy. This is editorial review, not measured improvement in audience response.
- Four styles on the same topic and supplied takeaway: produced Engaging, Educational, Entertaining, and Emotional scripts of 95, 86, 91, and 77 words. All retained the one-minute familiar-topic practice, main point/example, listener question, and revision of one unclear part. Manual review found different openings and framing, with production notes outside spoken copy. The 35–45 second durations remain estimates; delivery was not recorded.
- Conflicting preset and specific rewrite request: produced one 26-word professional LinkedIn caption, preserving two sketches, a 30-minute call, the room-layout discussion and residential-renovation scope. It followed the explicit professional/plain override, omitted humour and a CTA, and passed JSON output validation.

Package validation passed all three packages, their examples, and 33 case definitions. The skill-creator format check passed for Idea to Content. Schemas and validator code were unchanged, so the earlier validator regression suite was not rerun. The new blend and custom-writing-sample scenarios are saved case definitions, not additional executed tests. Outputs and exact prompts remain in ignored `test-results/idea-to-content/voice-controls/`. No Hermes runtime, dashboard controls, audience-performance experiment, or publishing integration was exercised.

The editorial direction was checked against [YouTube's Shorts creator discussion](https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/) and [official Shorts discovery guidance](https://support.google.com/youtube/answer/11914225?co=YOUTUBE._YTVideoType%3Dshorts&hl=en). These support immediate audience interest, concise storytelling and attention to observed viewer response. They do not establish a universal script formula or prove that these drafts will go viral.

## Portable selector component

On 2026-09-14, `components/content-preferences/` added a framework-neutral custom element, a preference store, a conservative offline instruction interpreter, an optional browser speech adapter and a local preview. The preview prepares a Hermes prompt and never claims to generate content. The existing skill packages and JSON output schemas are unchanged. Broader voice understanding, actual agent generation, permanent profiles and multi-asset application state still belong to the partner's integration.

Fourteen Node checks passed for the store and interpreter. Twelve isolated browser checks passed in headless Microsoft Edge through Playwright: button/text synchronisation, settings versus generation, custom requirements, unsupported compound requests, stale voice conflicts, completed-utterance deduplication, explicit same-value choices, manual transcript submission, cancelled asynchronous interpretation, scope display, failing speech adapters, final-segment aggregation, unavailable microphones and mobile layout. Some tests cover several related behaviours. The rendered desktop preview was also inspected. The initially attempted bundled Chromium executable was absent; the suite used the already installed Edge browser without installing another browser.

All speech events in these checks were supplied by test adapters or a mock recognition class. No real microphone audio, remote speech service, live Hermes connection or partner dashboard was tested. Browser microphone support is capability-dependent and has a visible fallback. The state/interpreter tests require only Node; the browser suite additionally requires Playwright and a supported installed browser. Package/example validation still passes for all three skills and 33 case definitions.

## Selector agreement follow-up

The component now subscribes all views for the same editing scope to one shared store. Direct host updates refresh the visible controls, re-binding a store invalidates old pending input, and accepted settings remain explicit in the generated preference context. Wording uses the same reaffirmable radio interaction as tone/intensity. Requests wait for the current instruction to resolve and cannot take stale settings from caller metadata. Skill packages and response schemas are unchanged.

Nineteen Node tests and seventeen isolated browser tests passed (36 total). Added checks cover multiple subscribers, listener mutation/failure isolation, unsubscribe and reentrant notification order, agreement across two component views and outgoing requests, wording reaffirmation, delayed input after a store change, synchronous host scope changes, and reconnection. The browser suite used headless Edge with injected speech events; actual microphone audio, Hermes generation and the partner's complete dashboard remain untested here.

## Minimal prototype presentation

On 2026-09-14, the interruption recovery check found no uncommitted changes; all 36 existing selector checks passed before editing. The stopped local preview server was restarted. The mockup now uses a compact form with short labels, while retaining tone/intensity, optional wording/custom directions, typed commands, microphone input and prepared prompts. Component markup and styles are separate files, with theme variables and documented integration hooks. The preference store and interpreter are unchanged.

After the presentation change, all 19 Node and 17 isolated Edge browser tests passed again. The browser suite confirms the extracted component stylesheet loads, and the desktop preview was visually inspected. The package validator also passed all three skills and 33 case definitions. Speech remains simulated in these checks; Hermes generation and the partner's dashboard were not exercised.

## Still required in the product environment

No callable Hermes installation was found on PATH or at the checked default installation locations. No Hermes installation, model configuration, or customer integration was changed.

Before a customer release:

1. Install the packages into a development Hermes profile and confirm all three appear in `hermes skills list` and load by slash command.
2. Run the saved cases using the Hermes version, model, and tools intended for the product. Record those versions and the observed outputs.
3. Exercise live research retrieval as well as missing-access fallbacks. This pass used supplied text; live source retrieval has not been tested through Hermes.
4. Validate JSON results in the actual backend and verify that the UI renders statuses, citations, drafts, task dependencies, and budget limitations correctly.

No publishing, recurring schedule, calendar event, rendered video, or dashboard integration is implemented by this starter library. Those require separate product capabilities and their own verification.
