# Validation notes

Date: 2026-09-11. Initial baseline: all skill packages `0.1.0`. Current Idea to Content package: `0.1.3`; other packages remain `0.1.0`. Output contract: `1.0`.

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

## Still required in the product environment

No callable Hermes installation was found on PATH or at the checked default installation locations. No Hermes installation, model configuration, or customer integration was changed.

Before a customer release:

1. Install the packages into a development Hermes profile and confirm all three appear in `hermes skills list` and load by slash command.
2. Run the saved cases using the Hermes version, model, and tools intended for the product. Record those versions and the observed outputs.
3. Exercise live research retrieval as well as missing-access fallbacks. This pass used supplied text; live source retrieval has not been tested through Hermes.
4. Validate JSON results in the actual backend and verify that the UI renders statuses, citations, drafts, task dependencies, and budget limitations correctly.

No publishing, recurring schedule, calendar event, rendered video, or dashboard integration is implemented by this starter library. Those require separate product capabilities and their own verification.
