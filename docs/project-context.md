# Project context

Updated: 2026-09-14.

## Current business model

Build a working Hermes-based agent, its dashboard/UI, and useful add-ons, skills, and workflows. Demonstrate the setup and its results on social media. Sell a course that teaches buyers how to create the same setup and add-ons themselves.

The primary paid offer is the course. This replaces the earlier plan to sell the agent itself as a plug-and-play product.

The intended audience is people discovering AI through social media who want to take part and build a setup like the one demonstrated. The advanced visual presentation is intended to attract interest; working demonstrations show what the setup actually does.

## What we are building

- A Hermes agent with a visually distinctive dashboard and UI.
- Useful skills and workflows, including content creation, research, and planning, with further add-ons to develop.
- Text, button and voice interaction with the same tasks and preferences. Users should be able to dictate a request, select or change writing tone/intensity through any of these inputs, and move between them during revisions.
- All selectors for the same draft must reflect one accepted selection. A user's choice through any input remains authoritative until deliberately updated; older transcripts, defaults or model output must not silently replace it.
- A reproducible setup that can become the basis for course lessons and demonstrations.

The partner is building the Hermes agent and dashboard on their computer. This laptop holds the shared skills repository and local prototypes. The partner pulls the repository to integrate and test the skills with Hermes.

Keep local mockups minimal in text and easy to redesign. Presentation files should stay separate from the working controls and shared state so the partner can adapt the appearance to their dashboard while retaining the features.

Shared input routing, synchronised preferences and concise spoken responses are specified in the [integration guide](integration.md#text-buttons-and-voice-share-one-request). A [portable content-preferences component](../components/content-preferences/README.md) provides local tone/intensity selectors, a shared preference store, simple typed commands and optional browser speech capture. Its generation prototype calls a configurable model using the Idea to Content instructions and shows actual drafts. The initial local model is OpenAI's open-weight gpt-oss:20b through Ollama; the partner chooses their eventual model/provider independently. The partner still connects the skills and controls to the actual dashboard, full conversational router, speech service and Hermes runtime. The laptop prototype calls a model directly and does not run Hermes itself.

## Direction for future work

Keep skills portable and useful across different user ideas. Build examples that are clear to demonstrate and document the setup steps, dependencies, inputs, and outputs needed to recreate them. When drafting marketing for this project, centre the offer on learning to build the demonstrated setup.

The course price, curriculum, delivery platform, included source files, and support arrangements have not been specified. Current implementation and testing status is recorded in [validation notes](validation.md).
