"""Garde-fous de la recette mutante ; aucun accès Stripe dans ces tests."""

import contextlib
import io
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError

from stripe_sandbox_recipe import SandboxRecipe, RecipeError


class SandboxRecipeTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "recipe.json"
        self.environment = {"BAITLY_STRIPE_SANDBOX_KEY": "sk_test_fixture",
                            "BAITLY_STRIPE_SANDBOX_PLATFORM": "acct_fixture"}

    def recipe(self):
        recipe = SandboxRecipe(self.environment, self.path)
        recipe.opener = Mock()
        return recipe

    def test_live_key_is_rejected_before_network_access(self):
        self.environment["BAITLY_STRIPE_SANDBOX_KEY"] = "sk_live_fixture"
        with self.assertRaisesRegex(RecipeError, "TEST_KEY_REQUIRED"):
            self.recipe()

    def test_no_mutation_before_platform_and_test_mode_proof(self):
        recipe = self.recipe()
        with self.assertRaisesRegex(RecipeError, "SANDBOX_NOT_VERIFIED"):
            recipe.request("/payment_intents", {"amount": 100}, operation="test")
        recipe.opener.open.assert_not_called()

    def test_wrong_platform_never_authorizes_mutations(self):
        recipe = self.recipe()
        recipe.request = Mock(side_effect=[{"id": "acct_another", "country": "FR"},
                                           {"object": "balance", "livemode": False}])
        with self.assertRaisesRegex(RecipeError, "PLATFORM_MISMATCH"):
            recipe.verify()
        self.assertFalse(recipe.authorized)

    def test_missing_test_balance_proof_never_authorizes_mutations(self):
        recipe = self.recipe()
        recipe.request = Mock(side_effect=[{"id": "acct_fixture", "country": "FR"}, {"object": "balance"}])
        with self.assertRaisesRegex(RecipeError, "TEST_BALANCE_REQUIRED"):
            recipe.verify()
        self.assertFalse(recipe.authorized)

    def test_expired_idempotency_run_cannot_be_replayed(self):
        recipe = self.recipe()
        recipe.report["created_at"] = int(time.time()) - 24 * 3600
        recipe.save()
        with self.assertRaisesRegex(RecipeError, "REPORT_EXPIRED"):
            self.recipe()

    def test_external_host_and_unknown_account_cannot_receive_credentials(self):
        recipe = self.recipe()
        with self.assertRaisesRegex(RecipeError, "ENDPOINT_REFUSED"):
            recipe.request("https://example.com/balance")
        with self.assertRaisesRegex(RecipeError, "UNOWNED_FIXTURE_ACCOUNT"):
            recipe.request("/balance", account="acct_foreign")
        recipe.opener.open.assert_not_called()

    def test_error_response_secrets_are_not_in_output_or_report(self):
        recipe = self.recipe()
        payload = json.dumps({"error": {"code": "card_declined", "message": "secret-message",
                              "payment_intent": {"id": "pi_test", "client_secret": "secret-token",
                                                 "status": "requires_payment_method"}}}).encode()
        recipe.opener.open.side_effect = HTTPError("https://api.stripe.com", 402, "error", {}, io.BytesIO(payload))
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            recipe.record("failed", lambda: recipe.request("/balance"))
        serialized = self.path.read_text() + output.getvalue()
        self.assertNotIn("secret-message", serialized)
        self.assertNotIn("secret-token", serialized)
        self.assertIn("STRIPE_HTTP_402_card_declined", serialized)
        self.assertEqual(recipe.report["status"], "INCOMPLETE")

    def test_pending_payout_is_not_reported_as_completed(self):
        recipe = self.recipe()
        with contextlib.redirect_stdout(io.StringIO()):
            recipe.record("payout", lambda: {"status": "PENDING", "terminal_state_verified": False})
        self.assertEqual(recipe.report["status"], "INCOMPLETE")

    def test_foreign_fixture_cannot_receive_transfer(self):
        recipe = self.recipe()
        recipe.report["references"]["recipient-owner"] = "acct_foreign"
        recipe.request = Mock(return_value={"livemode": False, "metadata": {"baitly_sandbox_recipe": "another-run"}})
        with self.assertRaisesRegex(RecipeError, "FOREIGN_FIXTURE_ACCOUNT"):
            recipe.transfer("owner", 3000)
        self.assertEqual(recipe.request.call_count, 1)

    def test_transfer_amount_is_capped(self):
        recipe = self.recipe()
        with self.assertRaisesRegex(RecipeError, "FIXTURE_TRANSFER_LIMIT"):
            recipe.transfer("owner", 100000)
        recipe.opener.open.assert_not_called()


if __name__ == "__main__":
    unittest.main()
