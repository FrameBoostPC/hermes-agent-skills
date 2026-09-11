"""Regression checks for the validation tool; these do not run agent prompts."""

import copy
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("validate", Path(__file__).resolve().parents[1] / "scripts" / "validate.py")
validate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validate)


@unittest.skipIf(validate.yaml is None or validate.Draft202012Validator is None, "Install requirements-dev.txt to run validation tests")
class ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.skill = self.root / "skills" / "sample-skill"
        (self.skill / "templates").mkdir(parents=True)
        (self.skill / "examples").mkdir()
        self.cases_path = self.root / "test-cases" / "sample-skill" / "cases.json"
        self.cases_path.parent.mkdir(parents=True)
        (self.skill / "SKILL.md").write_text(
            "---\nname: sample-skill\ndescription: Create a sample result.\nmetadata:\n  version: '0.1.0'\n---\n"
            "Use the [schema](templates/output.schema.json) and [example](examples/example-output.json).\n",
            encoding="utf-8",
        )
        self.schema = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "required": sorted(validate.ENVELOPE_FIELDS),
            "additionalProperties": False,
            "properties": {
                "schema_version": {"const": "1.0"},
                "skill": {"const": "sample-skill"},
                "status": {"enum": ["ready", "partial", "needs_input"]},
                "title": {"type": "string"},
                "summary": {"type": "string"},
                "assumptions": {"type": "array", "items": {"type": "string"}},
                "questions": {"type": "array", "items": {"type": "string"}},
                "limitations": {"type": "array", "items": {"type": "string"}},
                "data": {
                    "type": ["object", "null"],
                    "properties": {"date": {"type": "string", "format": "date"}},
                },
            },
            "allOf": [{
                "if": {"properties": {"status": {"const": "needs_input"}}},
                "then": {"properties": {"data": {"type": "null"}, "questions": {"minItems": 1}}},
                "else": {"properties": {"data": {"type": "object"}}},
            }],
        }
        self.output = {
            "schema_version": "1.0", "skill": "sample-skill", "status": "ready",
            "title": "Sample", "summary": "Example", "assumptions": [],
            "questions": [], "limitations": [], "data": {"date": "2026-09-11"},
        }
        self.write_json(self.skill / "templates" / "output.schema.json", self.schema)
        self.write_json(self.skill / "examples" / "example-output.json", self.output)
        self.write_json(self.cases_path, [{"id": "basic", "prompt": "Create a sample.", "expected_behavior": ["Return a sample."]}])

    def write_json(self, path, value):
        path.write_text(json.dumps(value), encoding="utf-8")

    def test_complete_package_passes(self):
        errors, passes = validate.validate_repo(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(len(passes), 1)

    def test_traversal_and_missing_links_fail_but_external_and_code_links_do_not(self):
        with (self.skill / "SKILL.md").open("a", encoding="utf-8") as handle:
            handle.write(
                "\n[escape](../../outside.txt)\n[missing](references/missing.md)\n"
                "[external](https://example.com/unknown)\n"
                "```markdown\n[sample](not-a-real-resource.md)\n```\n"
            )
        errors, _ = validate.validate_repo(self.root)
        self.assertEqual(len(errors), 2, errors)
        self.assertTrue(any("escapes skill folder" in error for error in errors))
        self.assertTrue(any("missing linked resource" in error for error in errors))

    def test_external_schema_ref_is_rejected_before_validation(self):
        self.schema["properties"]["data"] = {"$ref": "https://example.com/schema.json"}
        self.write_json(self.skill / "templates" / "output.schema.json", self.schema)
        errors, _ = validate.validate_repo(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("must be internal fragments", errors[0])

    def test_wrong_identity_and_invalid_date_are_rejected(self):
        output = copy.deepcopy(self.output)
        output["skill"] = "another-skill"
        output["data"]["date"] = "2026-02-30"
        errors = []
        validate.check_instance(self.schema, output, Path("response.json"), errors)
        self.assertEqual(len(errors), 2, errors)

    def test_needs_input_requires_questions_and_null_data(self):
        output = copy.deepcopy(self.output)
        output["status"] = "needs_input"
        errors = []
        validate.check_instance(self.schema, output, Path("response.json"), errors)
        self.assertEqual(len(errors), 2, errors)
        output.update(data=None, questions=["Which subject?"])
        errors = []
        validate.check_instance(self.schema, output, Path("response.json"), errors)
        self.assertEqual(errors, [])

    def test_duplicate_case_ids_are_rejected(self):
        case = {"id": "repeated", "prompt": "Create a sample.", "expected_behavior": ["Return a sample."]}
        self.write_json(self.cases_path, [case, case])
        errors, _ = validate.validate_repo(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("repeats id", errors[0])

    def test_invalid_schema_property_reports_error_without_crashing(self):
        self.schema["properties"]["skill"] = True
        self.write_json(self.skill / "templates" / "output.schema.json", self.schema)
        errors, _ = validate.validate_repo(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("properties.skill.const", errors[0])

    def test_nonstandard_json_and_duplicate_keys_are_rejected(self):
        for text in ['{"data": NaN}', '{"data": 1, "data": 2}']:
            with self.subTest(text=text):
                response = self.root / "response.json"
                response.write_text(text, encoding="utf-8")
                errors = []
                self.assertIs(validate.read_json(response, errors), validate.MISSING)
                self.assertEqual(len(errors), 1)


@unittest.skipIf(validate.yaml is None or validate.Draft202012Validator is None, "Install requirements-dev.txt to run validation tests")
class SkillRelationshipTests(unittest.TestCase):
    """Mutate published examples to distinguish relationship checks from schema checks."""

    def fixture(self, skill):
        skill_dir = validate.ROOT / "skills" / skill
        errors = []
        schema = validate.load_schema(skill_dir, errors)
        output = validate.read_json(skill_dir / "examples" / "example-output.json", errors)
        self.assertEqual(errors, [])
        return schema, output

    def rejected(self, skill, mutate, expected):
        schema, output = self.fixture(skill)
        mutate(output["data"])
        shape_errors = list(validate.Draft202012Validator(schema, format_checker=validate.FormatChecker()).iter_errors(output))
        self.assertEqual(shape_errors, [], "Mutation must pass JSON Schema to exercise semantic validation")
        errors = []
        validate.check_instance(schema, output, Path("response.json"), errors)
        self.assertTrue(any(expected in error for error in errors), errors)

    def test_published_examples_and_needs_input_outputs_pass(self):
        for skill in ("idea-to-content", "research-brief", "project-planner"):
            with self.subTest(skill=skill):
                schema, output = self.fixture(skill)
                errors = []
                validate.check_instance(schema, output, Path("response.json"), errors)
                self.assertEqual(errors, [])
                output.update(status="needs_input", data=None, questions=["What is your goal?"])
                errors = []
                validate.check_instance(schema, output, Path("response.json"), errors)
                self.assertEqual(errors, [])

    def test_content_ids_and_hook_references(self):
        for field in ("hooks", "assets"):
            with self.subTest(field=field):
                self.rejected("idea-to-content", lambda data: data[field][1].update(id=data[field][0]["id"]), "duplicate ID")
        self.rejected("idea-to-content", lambda data: data["assets"][0].update(hook_id="missing-hook"), "unknown hook")

    def test_research_ids_and_source_references(self):
        for field in ("findings", "sources"):
            with self.subTest(field=field):
                self.rejected("research-brief", lambda data: data[field][1].update(id=data[field][0]["id"]), "duplicate ID")
        self.rejected("research-brief", lambda data: data["findings"][0].update(source_ids=["source-999"]), "unknown source")

    def test_planner_ids_and_references(self):
        for field in ("tasks", "milestones"):
            with self.subTest(field=field):
                self.rejected("project-planner", lambda data: data[field][1].update(id=data[field][0]["id"]), "duplicate ID")
        self.rejected("project-planner", lambda data: data["tasks"][0].update(milestone_id="missing"), "unknown milestone")
        self.rejected("project-planner", lambda data: data["tasks"][0].update(depends_on=["missing"]), "unknown task")

    def test_planner_dependency_self_cycle_and_order(self):
        self.rejected("project-planner", lambda data: data["tasks"][0].update(depends_on=["t1"]), "cannot depend on itself")
        self.rejected("project-planner", lambda data: data["tasks"][0].update(depends_on=["t2"]), "dependency cycle")

        def reorder(data):
            data["tasks"][0], data["tasks"][1] = data["tasks"][1], data["tasks"][0]

        self.rejected("project-planner", reorder, "must appear before")

    def test_planner_predecessor_cannot_be_in_later_week(self):
        self.rejected("project-planner", lambda data: data["tasks"][0].update(week=2), "scheduled in a later week")

    def test_planner_weekly_and_total_budgets(self):
        self.rejected("project-planner", lambda data: data.update(time_budget_hours_per_week=2), "exceeding weekly budget")
        self.rejected("project-planner", lambda data: data.update(time_budget_minutes_total=359), "exceeding total budget")
        schema, output = self.fixture("project-planner")
        output["data"].update(time_budget_hours_per_week=None, time_budget_minutes_total=360)
        errors = []
        validate.check_instance(schema, output, Path("response.json"), errors)
        self.assertEqual(errors, [], "An exact total budget with no weekly limit should pass")

    def test_planner_supplied_date_bounds(self):
        self.rejected("project-planner", lambda data: data.update(start_date="2026-09-12", deadline="2026-09-11"), "deadline is before")

        def before_start(data):
            data.update(start_date="2026-09-12")
            data["milestones"][0]["target_date"] = "2026-09-11"

        def after_deadline(data):
            data.update(deadline="2026-09-12")
            data["milestones"][0]["target_date"] = "2026-09-13"

        self.rejected("project-planner", before_start, "target date is before")
        self.rejected("project-planner", after_deadline, "target date is after")

    def test_shape_failure_skips_semantic_checks(self):
        schema, output = self.fixture("project-planner")
        output["data"]["tasks"] = None
        errors = []
        validate.check_instance(schema, output, Path("response.json"), errors)
        self.assertTrue(errors)

    def test_output_cli_rejects_semantically_invalid_response(self):
        _, output = self.fixture("idea-to-content")
        output["data"]["assets"][0]["hook_id"] = "missing-hook"
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "response.json"
            path.write_text(json.dumps(output), encoding="utf-8")
            stdout, stderr = io.StringIO(), io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                result = validate.main(["--output", "idea-to-content", str(path)])
            self.assertEqual(result, 1)
            self.assertIn("unknown hook", stderr.getvalue())
            self.assertNotIn("PASS", stdout.getvalue())


if __name__ == "__main__":
    unittest.main()
