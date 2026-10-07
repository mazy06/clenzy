import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  paymentConnectApi,
  type PaymentConnectionStatus,
  type PaymentScope,
} from "../../services/api/paymentConnectApi";
import { paymentConnectionKey } from "../../services/api/paymentConnectionKeys";

/** Stripe can activate capabilities after redirecting back to Baitly. */
export function usePaymentActivationPolling(
  identity: string,
  scope: PaymentScope,
  status: PaymentConnectionStatus | null | undefined,
  onStatus: (status: PaymentConnectionStatus) => void | Promise<void>,
) {
  const cache = useQueryClient();
  const callback = useRef(onStatus);
  useEffect(() => { callback.current = onStatus; }, [onStatus]);
  const pending = !!status?.accountCreated && !status.ready && !status.reconnectRequired;

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      attempts += 1;
      let finished = false;
      try {
        if (!document.hidden) {
          const result = await paymentConnectApi.refresh(scope);
          if (cancelled) return;
          finished = result.ready || result.reconnectRequired || !result.accountCreated;
          cache.setQueryData(paymentConnectionKey(identity, scope), result);
          await callback.current(result);
        }
      } catch {
        // Keep the last verified state; a temporary network error is not an activation.
      }
      if (!cancelled && !finished && attempts < 12) timer = setTimeout(poll, 5_000);
    };
    timer = setTimeout(poll, 5_000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cache, identity, pending, scope]);
}
