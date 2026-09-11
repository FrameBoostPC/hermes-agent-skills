# Hermes Agent Skills

Shared skill packages for the Hermes-based agent and dashboard we are building and demonstrating. The paid offer is a course teaching buyers how to recreate the setup and its add-ons. See [project context](docs/project-context.md) for the current business model and division of work.

Each skill is a portable folder with instructions, a dashboard output schema, and an example. Package versions are declared in each `SKILL.md`; these are development candidates to test in the target Hermes environment before including them in course materials.

| Skill | Result | Example request |
| --- | --- | --- |
| [Idea to Content](skills/idea-to-content/SKILL.md) | Hooks, scripts, and social drafts adapted to the user's brief | `/idea-to-content Turn my desk-organisation idea into a short video script and two posts.` |
| [Research Brief](skills/research-brief/SKILL.md) | A scoped answer with evidence, uncertainty, and next actions | `/research-brief Compare these two tools for my needs using the attached notes.` |
| [Project Planner](skills/project-planner/SKILL.md) | Milestones, dependencies, effort estimates, and a first action | `/project-planner Plan a one-page portfolio launch with three hours available each week.` |

The skills return readable answers by default. Add `Return dashboard JSON` to request the structured result defined in that skill's `templates/output.schema.json`. See [dashboard integration](docs/integration.md) for status meanings and application responsibilities.

## Structure

```text
skills/
  idea-to-content/
    SKILL.md
    templates/output.schema.json
    examples/example-output.json
    references/readable-output.md
  research-brief/
    SKILL.md
    templates/output.schema.json
    references/example-input.md
    examples/example-output.json
  project-planner/
    SKILL.md
    templates/output.schema.json
    examples/example-output.json
test-cases/<skill-name>/cases.json
scripts/validate.py
```

Each package is independent. Keep links to its resources in `SKILL.md`; Hermes's installer only includes referenced support files. Test cases and developer tooling stay outside installable skill folders. Example outputs are illustrative, not completed work for a customer.

## Install into a development Hermes agent

Authenticate access to this private GitHub repository using your development environment's supported GitHub authentication. Do not put tokens in commands, this repository, or customer packages. Then register and install the skills:

```sh
hermes skills tap add FrameBoostPC/hermes-agent-skills
hermes skills install FrameBoostPC/hermes-agent-skills/idea-to-content
hermes skills install FrameBoostPC/hermes-agent-skills/research-brief
hermes skills install FrameBoostPC/hermes-agent-skills/project-planner
hermes skills list
```

Start a new Hermes session and invoke a skill using a request from the table. For a manual transfer, copy the complete skill folders into the active Hermes profile's skills directory (the default is `~/.hermes/skills/`), then start a new session. Use a development profile so testing does not change a customer installation.

Content drafting and planning need no connected external services. Current web research needs working search/page-reading tools; without them the research skill reports its limits and can use supplied text. Skills do not install dependencies or connect accounts. These packages do not include a publisher, calendar scheduler, video renderer, or dashboard application.

## Validate and test

Developer tooling requires Python 3.10+ and the packages in `requirements-dev.txt`; they are not required merely to load a skill in Hermes. In an activated virtual environment:

```sh
python -m pip install -r requirements-dev.txt
python scripts/validate.py
python -m unittest discover -s tests -v
```

Validate a response saved from an agent run:

```sh
python scripts/validate.py --output idea-to-content test-results/my-content-result.json
```

The checks cover package structure, referenced resources, schemas, example outputs, and selected data invariants. They do not prove writing quality, citation truth, or successful execution inside Hermes. `test-cases/` contains realistic prompts and criteria for behavioural review; the validator does not run those prompts through a model automatically.

For each skill, run its cases in Hermes with the intended model and tools. Check discovery, source access, requested formats/counts, useful output, JSON validity, and missing-input behaviour. Record the Hermes version, model, tools, input, output, and result outside the distributable packages. Generated local outputs go under ignored `test-results/`.

## Working together

1. Make a focused change to one skill on a `codex/` branch.
2. Add or update cases for the behaviour being changed; avoid rules that overfit one example.
3. Run local validation and relevant Hermes cases.
4. Review the change together before including it in a course release.
5. Update the skill version and tag a tested release when its target-environment checks pass.

Keep credentials, personal configuration, customer data, and private outputs outside this repository. Document required capabilities without secret values. See [validation notes](docs/validation.md) for what has actually been checked so far.

## References

- [Hermes skills system and repository installation](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)
- [Working with Hermes skills](https://hermes-agent.nousresearch.com/docs/guides/work-with-skills)
- [Agent Skills format](https://agentskills.io/specification)
