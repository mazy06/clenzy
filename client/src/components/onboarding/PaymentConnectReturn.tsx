import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard } from "../../icons/glyphs";
import { Button, Skeleton } from "../ui";
import { useTranslation } from "../../hooks/useTranslation";
import {
  paymentConnectApi,
  redirectToPaymentProvider,
  type PaymentConnectionStatus,
  type PaymentScope,
} from "../../services/api/paymentConnectApi";
import "./setup-surfaces.css";
import { useAuth } from "../../hooks/useAuth";
import { paymentConnectionKey } from "../../services/api/paymentConnectionKeys";
import { usePaymentActivationPolling } from "./usePaymentActivationPolling";

/** A redirect is not evidence of activation: only the authenticated server can verify Stripe. */
export default function PaymentConnectReturn() {
  const { user } = useAuth();
  if (!user) return null;
  const identity = `${user.id}:${user.organizationId}`;
  return <PaymentReturn key={identity} identity={identity} />;
}

function PaymentReturn({ identity }: { identity: string }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { t, currentLanguage } = useTranslation();
  const cache = useQueryClient();
  const [params] = useState(() => new URLSearchParams(search));
  const scope: PaymentScope =
    params.get("scope") === "ORGANIZATION" ? "ORGANIZATION" : "PERSONAL";
  const request = useRef<Promise<PaymentConnectionStatus | null>>();
  const active = useRef(false);
  const [result, setResult] = useState<PaymentConnectionStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(true);
  usePaymentActivationPolling(identity, scope, result, async (status) => {
    setResult(status);
    if (status.ready) await cache.invalidateQueries({ queryKey: ["onboarding", "me"] });
  });

  useEffect(() => {
    active.current = true;
    // Keep the single-use code out of browser history, without persisting it in storage.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    let mounted = true;
    if (!request.current)
      request.current = (async () => {
        if (params.has("error")) throw new Error("Authorization cancelled");
        const flow = params.get("flow");
        if (flow === "oauth" && params.get("state") && params.get("code"))
          return paymentConnectApi.complete(
            scope,
            params.get("state")!,
            params.get("code")!,
          );
        if (flow === "refresh") {
          const link = await paymentConnectApi.start(scope, "FR", "CREATE");
          if (active.current) redirectToPaymentProvider(link.url);
          return null;
        }
        if (flow === "return") return paymentConnectApi.refresh(scope);
        throw new Error("Invalid payment return");
      })();
    // Reuse the same request during React StrictMode effect replay; never redeem OAuth twice.
    request.current
      .then((status) => {
        if (!mounted) return;
        if (status) {
          cache.setQueryData(paymentConnectionKey(identity, scope), status);
          // A reload must recheck the account, never replay a one-use OAuth code.
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}?scope=${scope}&flow=return`,
          );
        }
        void cache.invalidateQueries({ queryKey: ["onboarding", "me"] });
        setResult(status);
        setBusy(false);
      })
      .catch(() => {
        if (mounted) {
          setFailed(true);
          setBusy(false);
        }
      });
    return () => {
      active.current = false;
      mounted = false;
    };
  }, [cache, params, scope, identity]);

  return (
    <main
      className="baitly-setup setup-payment-return"
      dir={currentLanguage === "ar" ? "rtl" : "ltr"}
    >
      {result?.ready ? <Check size={32} /> : <CreditCard size={32} />}
      <h1>
        {t(
          `onboarding.payment.${busy ? "checking" : failed ? "returnError" : result?.ready ? "returnReady" : "returnPending"}`,
        )}
      </h1>
      {busy ? (
        <Skeleton className="h-20" />
      ) : (
        <>
          <p role={failed ? "alert" : "status"}>
            {t(
              `onboarding.payment.${failed ? "returnErrorHint" : result?.ready ? "returnReadyHint" : "pending"}`,
            )}
          </p>
          <Button variant="outline" onClick={() => navigate(`/account?tab=my-transfers&paymentScope=${scope}`, { replace: true })}>
            {t("myTransfers.title")}
          </Button>
          <Button
            className="setup-primary"
            onClick={() =>
              navigate(`/dashboard?setup=payment&paymentScope=${scope}`, {
                replace: true,
              })
            }
          >
            {t("onboarding.payment.backToGuide")}
          </Button>
        </>
      )}
    </main>
  );
}
