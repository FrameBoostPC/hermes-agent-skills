# Hermes Skills

A shared repository for the skills used by our Hermes agent product. This is the starter structure; no completed skills have been added yet.

Each skill has its own folder under `skills/`. Its entry point is `skills/<skill-name>/SKILL.md`, containing the skill's name, description, and workflow instructions. Add `templates/`, `references/`, `scripts/`, or `assets/` inside that folder only when needed, and reference them from `SKILL.md`.

Store development examples and evaluation cases under `test-cases/<skill-name>/`, outside the installable skill folder.

## Creating a skill

1. Create a folder with a short, descriptive, lowercase name under `skills/`.
2. Write its `SKILL.md`: when to use it, expected inputs, steps, output format, and quality checks.
3. Add realistic test cases, including incomplete briefs and common edge cases.
4. Test the complete skill in a development Hermes agent using the intended model and tools. Refine the instructions and record the result.
5. Review changes together, commit them, and tag a tested release before including it in the product.

Keep credentials, local configuration, customer data, and private outputs out of this repository. Document required tools and configuration without including secret values.

## References

- [Working with Hermes skills](https://hermes-agent.nousresearch.com/docs/guides/work-with-skills)
- [Agent Skills format](https://agentskills.io/specification)
