"""Recette réseau Stripe Baitly, explicitement activée, sans données métier PMS.

N'utilise que des moyens de paiement officiels de test. Les références sont
conservées dans un rapport privé ; aucun secret ni réponse Stripe brute n'est écrit.
Ce contrôle du contrat API ne valide pas le parcours utilisateur Baitly.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from stripe_sandbox_preflight import NoRedirect, STRIPE_API_VERSION, MAX_RESPONSE_BYTES


class RecipeError(Exception):
    def __init__(self, code, *, payment_status=None, payment_id=None):
        super().__init__(code)
        self.payment_status = payment_status
        self.payment_id = payment_id


def check(condition, reason):
    if not condition:
        raise RecipeError(reason)


class SandboxRecipe:
    def __init__(self, environment, report_path):
        self.key = environment.get("BAITLY_STRIPE_SANDBOX_KEY", "")
        self.platform = environment.get("BAITLY_STRIPE_SANDBOX_PLATFORM", "")
        check(bool(re.fullmatch(r"(?:sk|rk)_test_[A-Za-z0-9]+", self.key)), "TEST_KEY_REQUIRED")
        check(bool(re.fullmatch(r"acct_[A-Za-z0-9]+", self.platform)), "PLATFORM_REQUIRED")
        self.path = Path(report_path)
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        self.authorized = False
        if self.path.exists():
            self.report = json.loads(self.path.read_text())
            check(self.report["platform"] == self.platform, "REPORT_PLATFORM_MISMATCH")
            # Stripe peut oublier une clé après 24 h : ne pas créer un doublon tardif.
            check(0 <= time.time() - self.report["created_at"] < 23 * 3600, "REPORT_EXPIRED_NEW_RUN_REQUIRED")
        else:
            import uuid
            self.report = {"run": "baitly-sandbox-" + uuid.uuid4().hex,
                           "created_at": int(time.time()), "platform": self.platform,
                           "api_version": STRIPE_API_VERSION, "references": {}, "checks": {},
                           "baitly_end_to_end_verified": False}

    def save(self):
        self.report["status"] = "API_CHECKS_PASSED" if self.report["checks"] and all(
            item["status"] == "PASSED" for item in self.report["checks"].values()) else "INCOMPLETE"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # Le fichier ne contient pas de clés, mais ses références restent privées.
        fd = os.open(self.path, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as output:
            json.dump(self.report, output, indent=2)

    def request(self, path, data=None, *, operation=None, account=None, v2=False, include=()):
        check(bool(re.fullmatch(
            r"/(?:account|balance|payment_intents(?:/pi_[A-Za-z0-9]+(?:/(?:capture|cancel))?)?|"
            r"refunds|account_links|core/account_links|core/accounts(?:/acct_[A-Za-z0-9]+)?|"
            r"accounts(?:/acct_[A-Za-z0-9]+(?:/external_accounts)?)?|payouts(?:/po_[A-Za-z0-9]+)?|"
            r"transfers(?:/tr_[A-Za-z0-9]+(?:/reversals)?)?)", path)),
            "ENDPOINT_REFUSED")
        check(v2 == path.startswith("/core/"), "API_NAMESPACE_MISMATCH")
        check(data is None or self.authorized, "SANDBOX_NOT_VERIFIED")
        check(data is None or bool(operation), "IDEMPOTENCY_REQUIRED")
        headers = {"Authorization": "Bearer " + self.key,
                   "Stripe-Version": self.report.get("recipient_creation_api_version", STRIPE_API_VERSION)
                   if v2 else self.report["api_version"]}
        if operation:
            headers["Idempotency-Key"] = self.report["run"] + ":" + operation
        if account:
            check(account in self.report["references"].values(), "UNOWNED_FIXTURE_ACCOUNT")
            headers["Stripe-Account"] = account
        encoded = None
        if data is not None:
            encoded = (json.dumps(data) if v2 else urllib.parse.urlencode(data)).encode()
            headers["Content-Type"] = "application/json" if v2 else "application/x-www-form-urlencoded"
        check(all(field in ("configuration.recipient", "requirements", "identity") for field in include), "INCLUDE_REFUSED")
        query = "?" + urllib.parse.urlencode({f"include[{i}]": value for i, value in enumerate(include)}) if include else ""
        request = urllib.request.Request("https://api.stripe.com/" + ("v2" if v2 else "v1") + path + query,
                                         data=encoded, headers=headers)
        try:
            with self.opener.open(request, timeout=30) as response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
            check(len(raw) <= MAX_RESPONSE_BYTES, "RESPONSE_TOO_LARGE")
            result = json.loads(raw)
            check(isinstance(result, dict), "INVALID_RESPONSE")
            if "livemode" in result:
                check(result["livemode"] is False, "LIVE_OBJECT_REFUSED")
            return result
        except urllib.error.HTTPError as error:
            # Seulement des codes publics ; jamais message, client_secret ou corps.
            try:
                body = json.loads(error.read(MAX_RESPONSE_BYTES)).get("error", {})
                code = str(body.get("code") or body.get("type") or "unknown")
                code = code if re.fullmatch(r"[a-z_]+", code) else "unknown"
                payment = body.get("payment_intent") or {}
                raise RecipeError(f"STRIPE_HTTP_{error.code}_{code}",
                                  payment_status=payment.get("status"), payment_id=payment.get("id")) from None
            finally:
                error.close()

    def remember(self, label, result):
        check(isinstance(result.get("id"), str), "OBJECT_ID_REQUIRED")
        previous = self.report["references"].get(label)
        check(previous is None or previous == result["id"], "IDEMPOTENCY_CHANGED_OBJECT")
        self.report["references"][label] = result["id"]
        self.save()
        return result

    def payment(self, label, method, amount, manual=False):
        params = {"amount": amount, "currency": "eur", "payment_method": method, "confirm": "true",
                  "automatic_payment_methods[enabled]": "true",
                  "automatic_payment_methods[allow_redirects]": "never",
                  "metadata[baitly_sandbox_recipe]": self.report["run"],
                  "description": "Baitly - recette sandbox uniquement - " + label}
        if manual:
            params["capture_method"] = "manual"
        return self.remember(label, self.request("/payment_intents", params, operation=label))

    def record(self, name, action):
        try:
            detail = action()
            self.report["checks"][name] = {"status": "PASSED", **(detail or {})}
        except RecipeError as error:
            self.report["checks"][name] = {"status": "BLOCKED", "reason": str(error)}
        except Exception:
            self.report["checks"][name] = {"status": "BLOCKED", "reason": "UNEXPECTED_ERROR"}
        self.save()
        print(name + ": " + json.dumps(self.report["checks"][name]), flush=True)

    def verify(self):
        account = self.request("/account")
        balance = self.request("/balance")
        check(account.get("id") == self.platform, "PLATFORM_MISMATCH")
        check(account.get("country") == "FR", "FRANCE_REQUIRED")
        check(balance.get("object") == "balance" and balance.get("livemode") is False, "TEST_BALANCE_REQUIRED")
        self.report["platform_readiness"] = {k: account.get(k) for k in
                                             ("charges_enabled", "payouts_enabled", "details_submitted")}
        self.authorized = True
        self.save()

    def paid(self):
        payment = self.payment("paid", "pm_card_bypassPendingInternational", 10000)
        check(payment["status"] == "succeeded" and payment["amount_received"] == 10000, "PAYMENT_NOT_SUCCEEDED")
        duplicate = self.payment("paid", "pm_card_bypassPendingInternational", 10000)
        check(duplicate["id"] == payment["id"], "DUPLICATE_PAYMENT")
        canonical = self.request("/payment_intents/" + payment["id"])
        check(canonical["status"] == "succeeded", "CANONICAL_PAYMENT_NOT_SUCCEEDED")
        return {"idempotency_verified": True, "canonical_read_verified": True}

    def declined(self):
        try:
            self.payment("declined", "pm_card_chargeDeclined", 1000)
        except RecipeError as error:
            check(str(error) == "STRIPE_HTTP_402_card_declined", "EXPECTED_CARD_DECLINE_NOT_OBSERVED")
            check(error.payment_status == "requires_payment_method", "DECLINED_STATUS_INCORRECT")
            self.report["references"]["declined"] = error.payment_id
            return {"no_successful_payment": True}
        raise RecipeError("DECLINED_CARD_WAS_ACCEPTED")

    def authentication(self):
        payment = self.payment("authentication", "pm_card_threeDSecure2Required", 1000)
        check(payment["status"] == "requires_action" and payment["amount_received"] == 0, "SCA_NOT_REQUIRED")
        canceled = self.request("/payment_intents/" + payment["id"] + "/cancel", {}, operation="cancel-authentication")
        check(canceled["status"] == "canceled", "SCA_CLEANUP_FAILED")
        return {"authentication_required_verified": True, "no_successful_payment": True}

    def capture(self):
        payment = self.payment("capture", "pm_card_visa", 2000, manual=True)
        check(payment["status"] == "requires_capture", "HOLD_NOT_CREATED")
        params = {"amount_to_capture": 800}
        first = self.request("/payment_intents/" + payment["id"] + "/capture", params, operation="capture-partial")
        second = self.request("/payment_intents/" + payment["id"] + "/capture", params, operation="capture-partial")
        check(first["id"] == second["id"] and first["amount_received"] == 800
              and second["amount_received"] == 800 and first["status"] == "succeeded", "CAPTURE_INCORRECT")
        return {"partial_capture_verified": True, "idempotency_verified": True}

    def cancel(self):
        payment = self.payment("cancel", "pm_card_visa", 1000, manual=True)
        canceled = self.request("/payment_intents/" + payment["id"] + "/cancel", {}, operation="cancel-hold")
        check(canceled["status"] == "canceled" and canceled["amount_received"] == 0, "CANCEL_INCORRECT")

    def refund(self):
        payment_id = self.report["references"].get("paid")
        check(payment_id is not None, "SUCCESSFUL_PAYMENT_REQUIRED")
        params = {"payment_intent": payment_id, "amount": 1000,
                  "metadata[baitly_sandbox_recipe]": self.report["run"]}
        first = self.remember("refund", self.request("/refunds", params, operation="refund"))
        second = self.request("/refunds", params, operation="refund")
        check(first["status"] == "succeeded" and first["amount"] == 1000
              and first["id"] == second["id"], "REFUND_INCORRECT")
        return {"partial_refund_verified": True, "idempotency_verified": True}

    def recipient(self, role):
        check(role in ("owner", "cleaning", "maintenance", "photography", "organization"), "UNKNOWN_FIXTURE_ROLE")
        label = "recipient-" + role
        if label in self.report["references"]:
            return self.report["references"][label]
        params = {"display_name": "TEST Baitly - " + role,
                  "contact_email": "baitly-sandbox-" + role + "@example.com",
                  "identity": {"country": "fr"}, "dashboard": "express",
                  "defaults": {"responsibilities": {"fees_collector": "application", "losses_collector": "application"}},
                  "configuration": {"recipient": {"capabilities": {"stripe_balance": {"stripe_transfers": {"requested": True}}}}},
                  "metadata": {"baitly_sandbox_recipe": self.report["run"], "fixture_role": role},
                  "include": ["configuration.recipient", "requirements", "identity"]}
        account = self.remember(label, self.request("/core/accounts", params, operation=label, v2=True))
        check(account.get("livemode") is False, "TEST_ACCOUNT_REQUIRED")
        self.report["recipient_creation_api_version"] = STRIPE_API_VERSION
        self.save()
        return account["id"]

    def transfer(self, role, amount):
        check(role in ("owner", "cleaning", "maintenance", "photography", "organization"), "UNKNOWN_FIXTURE_ROLE")
        check(type(amount) is int and 0 < amount <= 3000, "FIXTURE_TRANSFER_LIMIT")
        destination = self.report["references"].get("recipient-" + role)
        check(destination is not None, "RECIPIENT_FIXTURE_REQUIRED")
        recipient = self.request("/core/accounts/" + destination, v2=True,
                                 include=("configuration.recipient", "requirements"))
        check(recipient.get("livemode") is False, "TEST_ACCOUNT_REQUIRED")
        check(recipient.get("metadata", {}).get("baitly_sandbox_recipe") == self.report["run"], "FOREIGN_FIXTURE_ACCOUNT")
        capability = recipient["configuration"]["recipient"]["capabilities"]["stripe_balance"]["stripe_transfers"]
        check(capability["status"] == "active", "RECIPIENT_ONBOARDING_REQUIRED")
        payment = self.request("/payment_intents/" + self.report["references"]["paid"])
        check(payment["status"] == "succeeded" and payment["livemode"] is False, "PAYMENT_REQUIRED")
        params = {"amount": amount, "currency": "eur", "destination": destination,
                  "source_transaction": payment["latest_charge"], "transfer_group": self.report["run"],
                  "metadata[baitly_sandbox_recipe]": self.report["run"], "metadata[fixture_role]": role}
        first = self.remember("transfer-" + role, self.request("/transfers", params, operation="transfer-" + role))
        duplicate = self.request("/transfers", params, operation="transfer-" + role)
        canonical = self.request("/transfers/" + first["id"])
        check(first["id"] == duplicate["id"] == canonical["id"], "DUPLICATE_TRANSFER")
        check(canonical["amount"] == amount and canonical["currency"] == "eur"
              and canonical["destination"] == destination and canonical["source_transaction"] == payment["latest_charge"]
              and canonical.get("destination_payment"), "TRANSFER_EVIDENCE_INCORRECT")
        return {"idempotency_verified": True, "destination_payment_verified": True,
                "canonical_read_verified": True, "bank_receipt_verified": False}

    def reverse(self):
        transfer = self.report["references"].get("transfer-owner")
        check(transfer is not None, "TRANSFER_REQUIRED")
        params = {"amount": 500, "metadata[baitly_sandbox_recipe]": self.report["run"]}
        first = self.remember("reversal-owner", self.request("/transfers/" + transfer + "/reversals", params, operation="reversal-owner"))
        duplicate = self.request("/transfers/" + transfer + "/reversals", params, operation="reversal-owner")
        canonical = self.request("/transfers/" + transfer)
        check(first["id"] == duplicate["id"] and canonical["amount_reversed"] == 500, "REVERSAL_INCORRECT")
        return {"partial_reversal_verified": True, "idempotency_verified": True}

    def payout(self, failure=False):
        destination = self.report["references"].get("recipient-owner")
        check(destination is not None and "transfer-owner" in self.report["references"], "TRANSFER_REQUIRED")
        account = self.request("/accounts/" + destination)
        check(account.get("metadata", {}).get("baitly_sandbox_recipe") == self.report["run"], "FOREIGN_FIXTURE_ACCOUNT")
        check(account.get("payouts_enabled") is True, "PAYOUT_ONBOARDING_REQUIRED")
        label = "payout-failure" if failure else "payout-success"
        params = {"amount": 500, "currency": "eur", "metadata[baitly_sandbox_recipe]": self.report["run"]}
        if failure:
            # IBAN de test Stripe documenté : simule no_account. Jamais une banque réelle.
            bank = self.remember("failure-bank", self.request("/accounts/" + destination + "/external_accounts", {
                "external_account[object]": "bank_account", "external_account[country]": "FR",
                "external_account[currency]": "eur", "external_account[account_number]": "FR8420041010050500013M02607",
                "default_for_currency": "false"}, operation="failure-bank"))
            params["destination"] = bank["id"]
        first = self.remember(label, self.request("/payouts", params, operation=label, account=destination))
        duplicate = self.request("/payouts", params, operation=label, account=destination)
        canonical = self.request("/payouts/" + first["id"], account=destination)
        check(first["id"] == duplicate["id"] and canonical["amount"] == 500, "PAYOUT_IDEMPOTENCY_FAILED")
        check(canonical["automatic"] is False, "EXPECTED_MANUAL_TEST_PAYOUT")
        expected = "failed" if failure else "paid"
        check(canonical["status"] in ("pending", "in_transit", expected), "UNEXPECTED_PAYOUT_STATUS")
        return {"status": "PASSED" if canonical["status"] == expected else "PENDING",
                "idempotency_verified": True, "stripe_status": canonical["status"],
                "terminal_state_verified": canonical["status"] == expected,
                "bank_receipt_verified": False, "automatic_reconciliation_verified": False}

    def run(self, phase="payments"):
        self.verify()
        if phase == "payments":
            for name in ("paid", "declined", "authentication", "capture", "cancel", "refund"):
                self.record(name, getattr(self, name))
        elif phase == "connect":
            self.record("recipient_owner_create", lambda: {"created": bool(self.recipient("owner"))})
            self.record("transfer_owner", lambda: self.transfer("owner", 3000))
            self.record("reversal_owner", self.reverse)
            self.record("payout_success", self.payout)
        elif phase == "bank-failure":
            self.record("payout_failure", lambda: self.payout(True))
        self.save()
        return self.report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Autorise uniquement les opérations fictives sandbox")
    parser.add_argument("--report", required=True, help="Rapport privé à réutiliser pour reprendre le même essai")
    parser.add_argument("--phase", choices=("payments", "connect", "bank-failure"), default="payments")
    args = parser.parse_args()
    if not args.execute:
        parser.error("--execute est requis ; aucune opération effectuée")
    try:
        report = SandboxRecipe(os.environ, args.report).run(args.phase)
        print(json.dumps({k: report[k] for k in ("status", "api_version", "platform_readiness", "checks", "baitly_end_to_end_verified")}, indent=2))
        return 0 if report["status"] == "API_CHECKS_PASSED" else 1
    except Exception as error:
        print(json.dumps({"status": "BLOCKED", "reason": str(error) if isinstance(error, RecipeError) else "UNEXPECTED_ERROR"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
