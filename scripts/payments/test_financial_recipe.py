import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("financial_recipe", Path(__file__).with_name("financial_recipe.py"))
recipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipe)


class FinancialRecipeTest(unittest.TestCase):
    def test_only_explicit_local_test_database_is_allowed(self):
        for url in ("jdbc:postgresql://127.0.0.1:5432/baitly_payout_test", "jdbc:postgresql://localhost:55439/postgres"):
            self.assertEqual(recipe.validate_jdbc(url), url)
        for url in (None, "jdbc:postgresql://prod.example:5432/baitly_test", "jdbc:postgresql://localhost:5432/clenzy",
                    "jdbc:postgresql://localhost:5432/postgres", "jdbc:postgresql://localhost:5432/test?password=secret"):
            with self.assertRaises(ValueError): recipe.validate_jdbc(url)

    def test_only_a_local_pdf_engine_is_allowed(self):
        self.assertEqual(recipe.validate_pdf_url("http://127.0.0.1:3000"), "http://127.0.0.1:3000")
        for url in (None, "", "https://127.0.0.1:3000", "http://gotenberg:3000", "http://127.0.0.1:3000/forms", "http://example.com:3000"):
            with self.assertRaises(ValueError): recipe.validate_pdf_url(url)

    def test_no_selector_may_disappear_silently(self):
        files = [Path("OneTest.java"), Path("TwoTest.java")]
        self.assertEqual(recipe.required_backend(["*Test"], files), {"OneTest", "TwoTest"})
        with self.assertRaises(ValueError): recipe.required_backend(["AbsentTest"], files)

    def test_every_selected_frontend_suite_is_typechecked(self):
        required = ["src/payments.test.tsx", "src/shop.integration.test.tsx"]
        recipe.validate_frontend_typecheck(required, {"include": required, "exclude": []})
        for config in ({"include": required[:1], "exclude": []}, {"include": required},
                       {"include": required, "exclude": ["**/*.test.tsx"]}):
            with self.assertRaises(ValueError): recipe.validate_frontend_typecheck(required, config)

    def verify(self, xml, required=("OneTest",), frontend=False):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.xml"; path.write_text(xml)
            return recipe.verify_reports([path], required, frontend)

    def test_backend_and_frontend_reports_use_the_actual_executed_suites(self):
        self.assertEqual(self.verify('<testsuite name="com.baitly.OneTest" tests="2"/>')["tests"], 2)
        self.assertEqual(self.verify('<testsuite name="com.baitly.OneTest$Concurrent" tests="2"/>')["tests"], 2)
        self.assertEqual(self.verify('<testsuites><testsuite name="/repo/src/payment.test.tsx" tests="3"/></testsuites>',
                                    ("src/payment.test.tsx",), True)["tests"], 3)

    def test_missing_empty_skipped_failed_or_errored_suites_never_pass(self):
        for xml in ('<testsuite name="com.baitly.OtherTest" tests="5"/>', '<testsuite name="com.baitly.OneTest" tests="0"/>',
                    '<testsuite name="com.baitly.OneTest" tests="2" skipped="1"/>',
                    '<testsuite name="com.baitly.OneTest" tests="2" failures="1"/>',
                    '<testsuite name="com.baitly.OneTest" tests="2" errors="1"/>'):
            with self.assertRaises(ValueError): self.verify(xml)
        with self.assertRaises(ValueError): recipe.verify_reports([], {"OneTest"})


if __name__ == "__main__": unittest.main()
