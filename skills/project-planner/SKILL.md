---
name: project-planner
description: Turn goals into practical project plans and next actions.
metadata:
  version: "0.1.0"
---

# Project Planner

## When to use

Use for a launch, personal project, learning goal, or content campaign that needs milestones and an achievable sequence of tasks. Produce a plan the user can begin today. Research questions belong in a research brief; this skill can list unresolved research as a task without pretending it is complete.

## Inputs and defaults

Use the user's goal, desired outcome, deadline, available hours, existing progress, and constraints. Reuse relevant context already provided in the conversation. A title alone is enough to start when the outcome is understandable.

If there is no identifiable goal, ask one concise question and return `needs_input` in JSON mode. Otherwise state reasonable assumptions and produce a useful first draft. Missing dates, timezone, or budget do not block a relative plan. Keep unknown dates and available hours null; never silently invent a calendar date or treat an assumption as a user commitment.

## Procedure

1. Describe the outcome and observable completion criteria. Separate what the user must produce from hoped-for results: publishing a portfolio is a deliverable; getting hired is not a guaranteed result.
2. Identify existing work, dependencies, and constraints. Preserve user-selected tools and scope. Do not expand a simple project into a business strategy, extra platforms, or unrequested purchases.
3. Break the work into a few milestones with a clear `done_when`. Turn the first one or two weeks into specific tasks with tangible deliverables and rough effort estimates. For longer projects, describe later milestones and place unplanned work in `deferred`; do not fabricate a detailed schedule months ahead.
4. Assign tasks to relative weeks, starting at 1. Without a start date, a week means a consecutive seven-day planning block, not a named calendar week. Respect dependencies and sequence tasks in executable order. Estimates are working assumptions, not measured durations. Record a repeating weekly allowance in `time_budget_hours_per_week` and a one-time allowance in `time_budget_minutes_total`; leave whichever was not supplied null. Compare each week's total minutes with weekly hours and the entire plan with any total allowance; shrink scope or defer tasks until both fit. Explain a time-limited or changing weekly allowance in assumptions and do not presume additional future capacity.
5. For an infeasible deadline or conflicting constraints, return a feasible subset with `partial` status. Explain the tradeoff in `limitations` and record remaining scope in `deferred`. Do not label the original deadline achievable merely because some tasks fit. If even the smallest useful task does not fit a zero-hour budget, leave tasks empty and explain the blocker.
6. Finish with one concrete first action. If capacity is zero, make that a decision about time or scope. For a normal plan, tie it to the first unblocked task.

## Output

In ordinary chat, give the goal, assumptions, milestones, a compact task list grouped by week with rough effort, and the first action. Show capacity totals when hours were supplied. Respect a user-requested shorter format.

When the user or calling application explicitly requests dashboard JSON, JSON mode, or structured output, load [the output schema](templates/output.schema.json) and return only one JSON object matching it, without Markdown fences or commentary. The complete [example output](examples/example-output.json) illustrates a two-week tutoring-page project with three hours available each week; its names and estimates are examples to adapt, not reusable defaults.

Envelope rules: `schema_version` is `1.0`; `skill` is `project-planner`. `ready` means the requested plan is prepared, not that project tasks were executed. `partial` means useful planning was possible but a material constraint or missing dependency remains; supply at least one limitation. `needs_input` requires a question and null `data`. For `ready`, keep questions empty. Ordinary unknowns belong in assumptions and limitations, not a needless clarification loop.

Every task has a unique ID, a valid milestone ID, and only existing predecessor IDs. No circular or self dependencies. A predecessor's week must not be later than its dependent task's week. Every task starts with `status: planned`. A ready plan contains at least one actionable task. Use ISO `YYYY-MM-DD` dates only when supported by the user's context. A timezone is only needed when resolving actual calendar times; this skill does not schedule times.

## Tools and limits

No external tools are needed to draft a plan. Read user-supplied files only when available and relevant. If a choice depends on current prices, availability, or platform rules, verify it with an available research tool or mark it as a research dependency. Do not claim current facts from memory. Use only actual tools exposed by the host; no tool is provided by this skill itself.

The output proposes work. Do not create calendar events, buy services, contact people, or mark tasks complete as part of drafting the plan. A later explicit execution request may use connected tools under the host's permissions. Do not claim those actions happened without a successful tool result.

## Verification

Before returning, check that tasks advance the stated goal, preserve explicit constraints, have actionable deliverables, and fit the stated capacity. Check IDs, dependency order, week totals, and any supplied deadline. Confirm that deferred work is visible and the first action can actually be taken. Validate the JSON against the linked schema when a validator is available; otherwise check the fields without claiming an automated validation ran.
