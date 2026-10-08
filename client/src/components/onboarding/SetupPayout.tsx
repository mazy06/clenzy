import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  Check,
  CreditCard,
  Landmark,
  UserRound,
} from "../../icons/glyphs";
import { Button, Skeleton } from "../ui";
import { useTranslation } from "../../hooks/useTranslation";
import {
  paymentConnectApi,
  redirectToPaymentProvider,
  type PaymentScope,
} from "../../services/api/paymentConnectApi";
import type { SetupStepProps } from "./OnboardingStepContent";
import RegionalPaymentProviders from "./RegionalPaymentProviders";
import IntegrationLogo from "../integrations/IntegrationLogo";
import { useAuth } from "../../hooks/useAuth";
import { paymentConnectionKey } from "../../services/api/paymentConnectionKeys";
import { usePaymentActivationPolling } from "./usePaymentActivationPolling";

/** One onboarding surface for every beneficiary; account ownership is checked by the backend. */
export default function SetupPayout(props: SetupStepProps & { beneficiaryScope?: PaymentScope }) {
  const { user } = useAuth();
  if (!user) return null;
  const identity = `${user.id}:${user.organizationId}`;
  return <PaymentSetup key={`${identity}:${props.beneficiaryScope ?? 'choice'}`} {...props} identity={identity} />;
}

function PaymentSetup({ onCheck, beneficiaryScope, identity }: SetupStepProps & { beneficiaryScope?: PaymentScope; identity: string }) {
  const { t } = useTranslation();
  const id = useId();
  const cache = useQueryClient();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [selectedScope, setScope] = useState<PaymentScope>(() =>
    new URLSearchParams(window.location.search).get("paymentScope") ===
    "ORGANIZATION"
      ? "ORGANIZATION"
      : "PERSONAL",
  );
  const scope = beneficiaryScope ?? selectedScope;
  const [countryChoice, setCountryChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const query = useQuery({
    queryKey: paymentConnectionKey(identity, scope),
    queryFn: () => paymentConnectApi.status(scope),
    refetchOnMount: "always",
  });
  const status = query.data;
  usePaymentActivationPolling(identity, scope, status, async (result) => {
    if (result.ready) {
      setNotice("");
      setError(false);
      await onCheck();
    }
  });
  const country = status?.country ?? countryChoice;
  const needsConnection = !status?.accountCreated || status.reconnectRequired;
  const canStart = needsConnection
    ? status?.connectionAvailable
    : status?.creationAvailable;
  const start = async (intent: "CREATE" | "CONNECT") => {
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      const result = await paymentConnectApi.start(scope, country, intent);
      if (mounted.current) redirectToPaymentProvider(result.url);
    } catch {
      setError(true);
      setNotice(t("onboarding.payment.error"));
      setBusy(false);
    }
  };
  const refresh = async () => {
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      const result = await paymentConnectApi.refresh(scope);
      if (!mounted.current) return;
      cache.setQueryData(paymentConnectionKey(identity, scope), result);
      await onCheck();
      if (!result.ready) setNotice(t("onboarding.payment.pending"));
    } catch {
      setError(true);
      setNotice(t("onboarding.payment.error"));
    } finally {
      setBusy(false);
    }
  };
  if (query.isPending) return <Skeleton className="h-48" />;
  if (query.isError)
    return (
      <div role="alert">
        <p>{t("onboarding.guide.loadError")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("onboarding.payment.retry")}
        </Button>
      </div>
    );
  return (
    <section className="setup-payment" aria-busy={busy}>
      {!beneficiaryScope && status?.canManageOrganization && (
        <fieldset className="setup-payment-beneficiary" disabled={busy}>
          <legend>{t("onboarding.payment.beneficiary")}</legend>
          {(["PERSONAL", "ORGANIZATION"] as const).map((value) => (
            <label key={value} data-selected={scope === value}>
              <input
                type="radio"
                name={`${id}-beneficiary`}
                checked={scope === value}
                onChange={() => {
                  setScope(value);
                  setCountryChoice("");
                  setNotice("");
                }}
              />
              {value === "PERSONAL" ? (
                <UserRound size={18} />
              ) : (
                <Building2 size={18} />
              )}
              <span>{t(`onboarding.payment.${value}`)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="setup-payment-hint">
        {t(
          `onboarding.payment.${scope === "ORGANIZATION" ? "organizationHint" : "personalHint"}`,
        )}
      </p>
      <label className="setup-payment-country" htmlFor={`${id}-country`}>
        {t("onboarding.payment.country")}
        <select
          id={`${id}-country`}
          value={country}
          disabled={busy || !!status?.country}
          onChange={(e) => {
            setCountryChoice(e.target.value);
            setNotice("");
          }}
        >
          <option value="">{t("onboarding.payment.chooseCountry")}</option>
          {["FR", "MA", "SA"].map((code) => (
            <option key={code} value={code}>
              {t(`onboarding.payment.countries.${code}`)}
            </option>
          ))}
        </select>
      </label>
      {country && country !== "FR" && (
        <RegionalPaymentProviders country={country} />
      )}
      {country === "FR" && (
        <div className="setup-payment-provider">
          <div className="setup-payment-brand">
            <IntegrationLogo provider="stripe" />
            <div>
              <h3>Stripe Connect</h3>
              <p>{t("onboarding.payment.stripeHint")}</p>
            </div>
          </div>
          {status?.accountCreated && (
            <ul className="setup-payment-status">
              {(
                [
                  [status.accountCreated, "created", UserRound],
                  [status.chargesEnabled, "charges", CreditCard],
                  [
                    status.payoutsEnabled && status.transfersEnabled,
                    "payouts",
                    Landmark,
                  ],
                ] as const
              ).map(([enabled, key, Icon]) => (
                <li key={key} data-ready={enabled}>
                  {enabled ? <Check size={17} /> : <Icon size={17} />}
                  <span>{t(`onboarding.payment.${key}`)}</span>
                  <small>
                    {t(`onboarding.payment.${enabled ? "active" : "waiting"}`)}
                  </small>
                </li>
              ))}
            </ul>
          )}
          <div className="setup-payment-actions">
            <Button
              className="setup-primary"
              disabled={busy || (!status?.ready && !canStart)}
              onClick={() =>
                void (status?.ready
                  ? refresh()
                  : start(needsConnection ? "CONNECT" : "CREATE"))
              }
            >
              {t(
                status?.ready
                  ? "onboarding.form.verifyAccount"
                  : `onboarding.payment.${needsConnection ? "connect" : "resume"}`,
              )}
              {!status?.ready && <ArrowUpRight size={16} />}
            </Button>
            {!status?.accountCreated && (
              <p className="setup-payment-create">
                <span>{t("onboarding.payment.noAccount")}</span>{" "}
                <button
                  type="button"
                  className="setup-payment-text-link"
                  disabled={busy || !status?.creationAvailable}
                  onClick={() => void start("CREATE")}
                >
                  {t("onboarding.payment.create")}
                </button>
              </p>
            )}
            {status?.accountCreated && !status?.ready && (
              <button
                type="button"
                className="setup-payment-text-link"
                disabled={busy}
                onClick={() => void refresh()}
              >
                {t("onboarding.form.verifyAccount")}
              </button>
            )}
          </div>
          {!status?.creationAvailable && (
            <p>{t("onboarding.payment.notConfigured")}</p>
          )}
          {status?.creationAvailable &&
            !status?.connectionAvailable &&
            !status?.accountCreated && (
              <p>{t("onboarding.payment.oauthPending")}</p>
            )}
          <p className="setup-payment-hint">
            {t("onboarding.payment.officialFlow")}
          </p>
        </div>
      )}
      {notice && (
        <p
          role={error ? "alert" : "status"}
          className={error ? "setup-guide-error" : "setup-guide-note"}
        >
          {notice}
        </p>
      )}
    </section>
  );
}
