import io
import json
import unittest
import urllib.error
from unittest.mock import MagicMock, Mock, patch

from stripe_sandbox_preflight import PreflightError, StripeReadOnly, configuration, main, run


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.environment = {
            "BAITLY_STRIPE_SANDBOX_KEY": "rk_test_fixture",
            "BAITLY_STRIPE_SANDBOX_PLATFORM": "acct_platform",
            "BAITLY_STRIPE_SANDBOX_BENEFICIARIES": "acct_personal,acct_company",
        }
        self.client = Mock()
        self.client.get.side_effect = self.response

    @staticmethod
    def response(path, account=None):
        if path == "/balance":
            return {"object": "balance", "livemode": False, "available": [{"currency": "eur", "amount": 8000}]}
        return {"object": "account", "id": "acct_platform" if path == "/account" else path.split("/")[-1],
                "country": "FR", "charges_enabled": True, "details_submitted": True,
                "payouts_enabled": True, "capabilities": {"transfers": "active"}}

    def check(self):
        return run(self.environment, lambda key: self.client)

    def test_live_key_is_rejected_before_network(self):
        self.environment["BAITLY_STRIPE_SANDBOX_KEY"] = "sk_live_fixture"
        with self.assertRaisesRegex(PreflightError, "TEST_KEY_REQUIRED"):
            self.check()
        self.client.get.assert_not_called()

    def test_missing_configuration_is_not_success(self):
        with self.assertRaisesRegex(PreflightError, "CONFIGURATION_REQUIRED"):
            configuration({})

    def test_account_identifiers_cannot_inject_a_path_or_header(self):
        for account in ("acct_x/../../balance", "acct_x\nStripe-Account: acct_other"):
            with self.subTest(account=account):
                self.environment["BAITLY_STRIPE_SANDBOX_BENEFICIARIES"] = account
                with self.assertRaisesRegex(PreflightError, "INVALID_ACCOUNT_ID"):
                    self.check()
        self.client.get.assert_not_called()

    def test_platform_cannot_be_its_own_beneficiary(self):
        self.environment["BAITLY_STRIPE_SANDBOX_BENEFICIARIES"] = "acct_platform"
        with self.assertRaisesRegex(PreflightError, "DISTINCT_BENEFICIARIES_REQUIRED"):
            self.check()

    def test_wrong_platform_stops_before_reading_beneficiaries(self):
        self.environment["BAITLY_STRIPE_SANDBOX_PLATFORM"] = "acct_other"
        with self.assertRaisesRegex(PreflightError, "PLATFORM_MISMATCH"):
            self.check()
        self.assertEqual(self.client.get.call_count, 1)

    def test_connected_live_balance_is_refused(self):
        def response(path, account=None):
            data = self.response(path, account)
            if account:
                data["livemode"] = True
            return data
        self.client.get.side_effect = response
        with self.assertRaisesRegex(PreflightError, "TEST_BALANCE_REQUIRED"):
            self.check()

    def test_platform_must_be_able_to_collect_test_payments(self):
        def response(path, account=None):
            data = self.response(path, account)
            if path == "/account":
                data["charges_enabled"] = False
            return data
        self.client.get.side_effect = response
        result = self.check()
        self.assertEqual(result["status"], "NOT_READY")
        self.assertIn("PLATFORM_TEST_CHARGES_REQUIRED", result["blockers"])

    def test_empty_funding_and_missing_capability_stay_not_ready(self):
        def response(path, account=None):
            data = self.response(path, account)
            if path == "/balance":
                data["available"] = []
            elif path != "/account":
                data["capabilities"] = {"transfers": "pending"}
            return data
        self.client.get.side_effect = response
        result = self.check()
        self.assertEqual(result["status"], "NOT_READY")
        self.assertEqual(len(result["blockers"]), 3)

    def test_success_never_claims_baitly_recipe_passed_or_exposes_ids(self):
        result = self.check()
        self.assertEqual(result["status"], "PRECHECK_PASSED")
        self.assertEqual(result["beneficiaries_checked"], 2)
        self.assertFalse(result["baitly_end_to_end_verified"])
        self.assertNotIn("acct_", json.dumps(result))
        self.client.get.assert_any_call("/balance", account="acct_personal")
        self.client.get.assert_any_call("/balance", account="acct_company")

    def test_http_transport_only_uses_get_and_fixed_stripe_origin(self):
        client = StripeReadOnly("rk_test_fixture")
        response = Mock()
        response.read.return_value = b'{"object":"balance"}'
        client.opener = MagicMock()
        client.opener.open.return_value.__enter__.return_value = response
        client.get("/balance", "acct_personal")
        request = client.opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(request.full_url, "https://api.stripe.com/v1/balance")
        self.assertEqual(request.get_header("Stripe-account"), "acct_personal")
        with self.assertRaisesRegex(PreflightError, "ENDPOINT_REFUSED"):
            client.get("/transfers")

    def test_psp_error_body_and_exceptions_are_not_printed(self):
        client = StripeReadOnly("rk_test_fixture")
        client.opener = Mock()
        client.opener.open.side_effect = urllib.error.HTTPError(
            "https://api.stripe.com/v1/account", 403, "private PSP message", {}, io.BytesIO(b"private customer"))
        with self.assertRaisesRegex(PreflightError, "^STRIPE_HTTP_403$"):
            client.get("/account")
        with patch("stripe_sandbox_preflight.run", side_effect=RuntimeError("private token")), patch("sys.stdout", new_callable=io.StringIO) as output:
            self.assertEqual(main(), 1)
            self.assertNotIn("private", output.getvalue())

    def test_http_redirect_cannot_forward_credentials(self):
        from stripe_sandbox_preflight import NoRedirect
        with self.assertRaisesRegex(PreflightError, "REDIRECT_REFUSED"):
            NoRedirect().redirect_request(None, None, 302, "", {}, "https://untrusted.example")


if __name__ == "__main__":
    unittest.main()
