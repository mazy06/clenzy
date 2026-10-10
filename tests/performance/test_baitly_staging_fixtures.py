"""Gardes des fixtures de charge : aucun accès réseau/BDD dans ces tests."""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("fixture", Path(__file__).with_name("baitly-staging-fixtures.py"))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class StagingFixturesTest(unittest.TestCase):
    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_marked_client_gets_the_required_api_audience(self):
        ops = Mock()
        client_id = "00000000-0000-0000-0000-000000000001"
        subject = "00000000-0000-0000-0000-000000000002"
        ops.keycloak.side_effect = [
            [{"id": client_id, "clientId": "baitly-perf-10-01", "attributes": {"baitly_fixture": fixture.MARKER}}],
            None, [], None, {"id": subject}, None, [{"id": "role-id", "name": "SUPER_ADMIN"}], None,
            {"value": "test-only-secret"}]
        fixture.ensure_client(ops, "baitly-perf-10-01")
        args, kwargs = ops.keycloak.call_args_list[3]
        self.assertIn("protocol-mappers/models", args[0][1])
        self.assertEqual(args[1]["config"]["included.client.audience"], "clenzy-api")
        self.assertEqual(args[1]["config"]["access.token.claim"], "true")

    def test_production_is_refused_before_any_operation(self):
        ops = Mock()
        with patch.dict(os.environ, {"APP_DOMAIN": "app.baitly.fr"}):
            for operation in [lambda: fixture.provision(ops, 4, "2026-10-01", "2026-10-31"),
                    lambda: fixture.disable(ops, 4), lambda: fixture.schema(ops),
                    lambda: fixture.explain(ops, [], "2026-10-01", "2026-10-31")]:
                with self.assertRaises(fixture.FixtureError):
                    operation()
        self.assertEqual(ops.mock_calls, [])

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_unknown_existing_clients_are_not_adopted(self):
        ops = Mock()
        ops.keycloak.return_value = [{"id": "unknown", "clientId": "baitly-perf-10-01", "attributes": {}}]
        with self.assertRaises(fixture.FixtureError):
            fixture.ensure_client(ops, "baitly-perf-10-01")
        self.assertEqual(ops.keycloak.call_count, 1)

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_cleanup_never_disables_an_unmarked_client(self):
        ops = Mock()
        ops.keycloak.return_value = [{"id": "unknown", "clientId": "baitly-perf-10-01", "attributes": {}}]
        with self.assertRaises(fixture.FixtureError):
            fixture.disable(ops, 1)
        self.assertEqual(ops.keycloak.call_count, 1)

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_schema_is_read_only_and_contains_no_business_rows(self):
        ops = Mock()
        fixture.schema(ops)
        sql = ops.sql.call_args.args[0]
        self.assertIn("BEGIN READ ONLY", sql)
        self.assertIn("information_schema.columns", sql)
        self.assertIn("pg_indexes", sql)
        self.assertNotIn("FROM users", sql)

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_explain_is_read_only_scoped_and_bounded_to_500_properties(self):
        ops = Mock()
        ops.sql.return_value = [{"Plan": {"Node Type": "Index Scan"}}]
        actors = [{"clientId": f"baitly-perf-{n}-01", "propertyIds": list(range(1, n + 1))} for n in (10, 100, 1000)]
        plans = fixture.explain(ops, actors, "2026-10-01", "2026-10-31")
        self.assertEqual(len(plans), 8)
        for args, kwargs in ops.sql.call_args_list:
            self.assertIn("BEGIN READ ONLY", args[0])
            self.assertIn("statement_timeout='15s'", args[0])
            self.assertIn("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)", args[0])
            self.assertIn("o.slug=:'slug'", args[0])
            self.assertLessEqual(len(kwargs["ids"].split(",")), 500)

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_too_short_window_is_rejected_before_provisioning(self):
        ops = Mock()
        with self.assertRaises(fixture.FixtureError):
            fixture.provision(ops, 4, "2026-10-01", "2026-10-05")
        self.assertEqual(ops.mock_calls, [])

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_existing_user_binding_is_compare_and_set_on_test_identity(self):
        ops = Mock()
        fixture.ensure_organization(ops, "baitly-perf-10-01", 123, "test-subject")
        sql = ops.sql.call_args.args[0]
        self.assertIn("users.keycloak_id=:'subject'", sql)
        self.assertIn("users.organization_id IS NULL OR users.organization_id=o.id", sql)
        self.assertIn("o.slug=:'slug' AND o.name=:'slug'", sql)
        self.assertIn("users.role='SUPER_ADMIN'", sql)


if __name__ == "__main__":
    unittest.main()
