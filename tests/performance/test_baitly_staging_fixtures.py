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
    def test_keycloak_failure_reports_only_the_fixed_operation(self):
        with patch.object(fixture, "command", side_effect=fixture.FixtureError("private secret")):
            with self.assertRaisesRegex(fixture.FixtureError, "Keycloak : update mapper a échoué") as failure:
                fixture.Staging().keycloak(["update", "clients/private-id/protocol-mappers/models/private-mapper"],
                        {"clientSecret": "private secret"})
        self.assertNotIn("private", str(failure.exception).replace("privées", ""))

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_provision_uses_the_application_profile_route(self):
        ops = Mock()
        ops.api.return_value = {"id": 1, "subject": "test-subject", "role": "SUPER_ADMIN"}
        def portfolio(ops, slug, count, *args):
            return {"propertyIds": list(range(count)), "reservations": count * 4, "interventions": count}
        with patch.object(fixture, "ensure_client", return_value=("test-subject", "test-secret")), \
                patch.object(fixture, "repair_fixture_identity"), \
                patch.object(fixture, "ensure_organization", return_value={"organizationId": 1}), \
                patch.object(fixture, "fill_portfolio", side_effect=portfolio), \
                patch.object(fixture.time, "sleep"), patch("builtins.print"):
            actors = fixture.provision(ops, 1, "2026-10-01", "2026-10-31")
        self.assertEqual(len(actors), 3)
        for call in ops.api.call_args_list:
            self.assertEqual(call.args[0], "/api/me")

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
        self.assertTrue(ops.keycloak.call_args_list[1].args[1]['serviceAccountsEnabled'])
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

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_cleanup_keeps_the_service_account_identity(self):
        ops = Mock()
        def keycloak(args, body=None):
            if args[0] == 'get':
                name = args[-1].split('=')[1]
                return [{'id': 'test-client', 'clientId': name, 'attributes': {'baitly_fixture': fixture.MARKER}}]
        ops.keycloak.side_effect = keycloak
        fixture.disable(ops, 1)
        writes = [call for call in ops.keycloak.call_args_list if call.args[0][0] == 'update']
        self.assertEqual(len(writes), 3)
        for call in writes:
            self.assertEqual(call.args[1], {'enabled': False, 'serviceAccountsEnabled': True})

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_existing_old_identity_is_never_adopted(self):
        ops = Mock()
        ops.sql.return_value = [{'id': 1, 'subject': '00000000-0000-0000-0000-000000000001'}]
        ops.keycloak.return_value = {'id': 'still-exists'}
        with self.assertRaisesRegex(fixture.FixtureError, 'toujours présente'):
            fixture.repair_fixture_identity(ops, 'baitly-perf-10-01', '00000000-0000-0000-0000-000000000002', 10)
        self.assertEqual(ops.sql.call_count, 1)

    @patch.dict(os.environ, {"APP_DOMAIN": "app.clenzy.fr"})
    def test_deleted_fixture_identity_repair_is_scoped_and_compare_and_set(self):
        ops = Mock()
        ops.sql.side_effect = [[{'id': 1, 'subject': '00000000-0000-0000-0000-000000000001'}], {'matched': 1}]
        ops.keycloak.return_value = None
        fixture.repair_fixture_identity(ops, 'baitly-perf-10-01', '00000000-0000-0000-0000-000000000002', 10)
        sql = ops.sql.call_args.args[0]
        for guard in ["u.keycloak_id=:'oldSubject'", "u.email_hash=:'emailHash'", "o.slug=:'name' AND o.name=:'name'",
                      "m.role_in_org='OWNER'", "p.description IS DISTINCT FROM :'marker'", "u.role='SUPER_ADMIN'"]:
            self.assertIn(guard, sql)
        self.assertTrue(ops.keycloak.call_args.kwargs['allow_missing'])

    def test_only_explicit_cli_not_found_can_be_tolerated(self):
        result = Mock(returncode=1, stderr='Resource not found for url: http://localhost/users/test', stdout='')
        with patch.object(fixture.subprocess, 'run', return_value=result):
            self.assertEqual(fixture.command(['test'], allow_not_found=True), '')
            with self.assertRaises(fixture.FixtureError):
                fixture.command(['test'])
            result.stderr = 'Authentication failed'
            with self.assertRaises(fixture.FixtureError):
                fixture.command(['test'], allow_not_found=True)


if __name__ == "__main__":
    unittest.main()
