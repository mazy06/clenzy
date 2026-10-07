#!/usr/bin/env python3
"""Précontrôle Baitly en lecture seule. Ne constitue pas une recette de paiement réussie."""

import json
import os
import re
import sys
import urllib.error
import urllib.request

# Contrat du SDK stripe-java 33.4.0 et du relais Stripe CLI --latest validé localement.
STRIPE_API_VERSION = "2026-08-26.dahlia"
MAX_RESPONSE_BYTES = 1_048_576


class PreflightError(Exception):
    """Code public uniquement ; jamais le corps privé d'une réponse PSP."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise PreflightError("REDIRECT_REFUSED")


def configuration(environment):
    key = environment.get("BAITLY_STRIPE_SANDBOX_KEY", "").strip()
    platform = environment.get("BAITLY_STRIPE_SANDBOX_PLATFORM", "").strip()
    accounts = [value.strip() for value in environment.get("BAITLY_STRIPE_SANDBOX_BENEFICIARIES", "").split(",") if value.strip()]
    if not key or not platform or not accounts:
        raise PreflightError("CONFIGURATION_REQUIRED")
    if not re.fullmatch(r"(?:rk|sk)_test_[A-Za-z0-9]+", key):
        raise PreflightError("TEST_KEY_REQUIRED")
    if any(not re.fullmatch(r"acct_[A-Za-z0-9]+", value) for value in [platform, *accounts]):
        raise PreflightError("INVALID_ACCOUNT_ID")
    if len(accounts) > 10 or len(set(accounts)) != len(accounts) or platform in accounts:
        raise PreflightError("DISTINCT_BENEFICIARIES_REQUIRED")
    return key, platform, accounts


class StripeReadOnly:
    def __init__(self, key):
        self.key = key
        # Aucun proxy issu de l'environnement, aucune redirection vers un autre domaine.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def get(self, path, account=None):
        if path != "/account" and path != "/balance" and not re.fullmatch(r"/accounts/acct_[A-Za-z0-9]+", path):
            raise PreflightError("ENDPOINT_REFUSED")
        if account is not None and not re.fullmatch(r"acct_[A-Za-z0-9]+", account):
            raise PreflightError("INVALID_ACCOUNT_ID")
        headers = {"Authorization": "Bearer " + self.key, "Stripe-Version": STRIPE_API_VERSION}
        if account:
            headers["Stripe-Account"] = account
        request = urllib.request.Request("https://api.stripe.com/v1" + path, headers=headers, method="GET")
        try:
            with self.opener.open(request, timeout=20) as response:
                content = response.read(MAX_RESPONSE_BYTES + 1)
            if len(content) > MAX_RESPONSE_BYTES:
                raise PreflightError("RESPONSE_TOO_LARGE")
            result = json.loads(content)
            if not isinstance(result, dict):
                raise PreflightError("INVALID_RESPONSE")
            return result
        except urllib.error.HTTPError as error:
            # Ni URL, ni identifiant, ni message du PSP dans les sorties ou artefacts CI.
            status = error.code
            error.close()
            raise PreflightError("STRIPE_HTTP_" + str(status)) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise PreflightError("STRIPE_UNREACHABLE") from None
        except (ValueError, UnicodeError):
            raise PreflightError("INVALID_RESPONSE") from None


def test_balance(balance):
    if balance.get("object") != "balance" or balance.get("livemode") is not False:
        raise PreflightError("TEST_BALANCE_REQUIRED")
    available = balance.get("available")
    if not isinstance(available, list) or any(not isinstance(row, dict) for row in available):
        raise PreflightError("INVALID_RESPONSE")
    return any(row.get("currency") == "eur" and type(row.get("amount")) is int and row["amount"] > 0 for row in available)


def run(environment, client_factory=StripeReadOnly):
    # Toute la configuration est validée avant le premier appel HTTP.
    key, expected_platform, accounts = configuration(environment)
    client = client_factory(key)
    platform = client.get("/account")
    if platform.get("object") != "account" or platform.get("id") != expected_platform:
        raise PreflightError("PLATFORM_MISMATCH")
    if platform.get("country") != "FR":
        raise PreflightError("FRANCE_RECIPE_REQUIRED")
    funded = test_balance(client.get("/balance"))
    blockers = [] if funded else ["PLATFORM_TEST_EUR_FUNDING_REQUIRED"]
    if platform.get("charges_enabled") is not True:
        blockers.append("PLATFORM_TEST_CHARGES_REQUIRED")
    for index, account in enumerate(accounts, 1):
        beneficiary = client.get("/accounts/" + account)
        if beneficiary.get("object") != "account" or beneficiary.get("id") != account:
            raise PreflightError("BENEFICIARY_MISMATCH")
        if beneficiary.get("country") != "FR":
            blockers.append(f"BENEFICIARY_{index}_OUTSIDE_FRANCE_RECIPE")
        capabilities = beneficiary.get("capabilities")
        if not isinstance(capabilities, dict):
            raise PreflightError("INVALID_RESPONSE")
        if (beneficiary.get("details_submitted") is not True or beneficiary.get("payouts_enabled") is not True
                or capabilities.get("transfers") != "active"):
            blockers.append(f"BENEFICIARY_{index}_ONBOARDING_REQUIRED")
        # Preuve indépendante du mode : Account v1 ne porte pas de champ livemode.
        test_balance(client.get("/balance", account=account))
    return {
        "status": "PRECHECK_PASSED" if not blockers else "NOT_READY",
        "api_version": STRIPE_API_VERSION,
        "beneficiaries_checked": len(accounts),
        "blockers": blockers,
        "baitly_end_to_end_verified": False,
        "financial_operations_created": 0,
    }


def main():
    try:
        report = run(os.environ)
        code = 0 if report["status"] == "PRECHECK_PASSED" else 1
    except PreflightError as error:
        report = {"status": "BLOCKED", "reason": str(error), "baitly_end_to_end_verified": False}
        code = 2 if str(error) == "CONFIGURATION_REQUIRED" else 1
    except Exception:
        report = {"status": "BLOCKED", "reason": "UNEXPECTED_ERROR", "baitly_end_to_end_verified": False}
        code = 1
    print(json.dumps(report, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
