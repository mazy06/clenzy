import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../../public/locales/fr.json";
import SetupPayout from "./SetupPayout";
import PaymentConnectReturn from "./PaymentConnectReturn";
import {
  paymentConnectApi,
  redirectToPaymentProvider,
  type PaymentConnectionStatus,
} from "../../services/api/paymentConnectApi";
import { getOnboardingSteps } from "../../config/onboardingConfig";
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, organizationId: 7 } }) }));

vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => ({
    currentLanguage: "fr",
    t: (key: string) => key.split(".").reduce((v: any, k) => v?.[k], fr) ?? key,
  }),
}));
vi.mock("../../services/api/paymentConnectApi", () => ({
  paymentConnectApi: {
    status: vi.fn(),
    start: vi.fn(),
    refresh: vi.fn(),
    complete: vi.fn(),
  },
  redirectToPaymentProvider: vi.fn(),
}));
const initial: PaymentConnectionStatus = {
  scope: "PERSONAL",
  country: null,
  accountCreated: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  transfersEnabled: false,
  ready: false,
  canManageOrganization: false,
  creationAvailable: true,
  connectionAvailable: true,
  reconnectRequired: false,
};
const done = vi.fn(),
  check = vi.fn();
function mount(returnUrl?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[returnUrl ?? "/dashboard"]}>
          {returnUrl ? (
            <PaymentConnectReturn />
          ) : (
            <SetupPayout
              stepKey="setup_payouts"
              onSaved={done}
              onCheck={check}
            />
          )}
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(paymentConnectApi.status).mockResolvedValue(initial);
  vi.mocked(paymentConnectApi.start).mockResolvedValue({
    url: "https://connect.stripe.com/setup",
  });
  vi.mocked(paymentConnectApi.refresh).mockResolvedValue({
    ...initial,
    country: "FR",
    accountCreated: true,
  });
  vi.mocked(paymentConnectApi.complete).mockResolvedValue({
    ...initial,
    country: "FR",
    accountCreated: true,
    ready: true,
  });
});
afterEach(() => { vi.useRealTimers(); });
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
async function country(code: string) {
  fireEvent.change(
    await screen.findByLabelText(fr.onboarding.payment.country),
    { target: { value: code } },
  );
}
describe("payment setup", () => {
  it("offers payout setup to every business role", () => {
    for (const role of [
      "HOST",
      "PROPERTY_OWNER",
      "HOUSEKEEPER",
      "TECHNICIAN",
      "SUPERVISOR",
      "LAUNDRY",
      "EXTERIOR_TECH",
    ]) {
      expect(
        getOnboardingSteps(role).some((step) =>
          ["setup_payment", "setup_payouts", "setup_payout_account"].includes(
            step.key,
          ),
        ),
      ).toBe(true);
    }
  });
  it.each(["CREATE", "CONNECT"] as const)(
    "starts %s only after explicit selection and action",
    async (intent) => {
      mount();
      await country("FR");
      expect(screen.getByRole("img", { name: "Stripe" })).toBeVisible();
      expect(
        screen.getByRole("button", { name: fr.onboarding.payment.connect }),
      ).toHaveClass("setup-primary");
      expect(
        screen.getByRole("button", { name: fr.onboarding.payment.create }),
      ).toHaveClass("setup-payment-text-link");
      expect(paymentConnectApi.start).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", {
          name:
            intent === "CREATE"
              ? fr.onboarding.payment.create
              : fr.onboarding.payment.connect,
        }),
      );
      await waitFor(() =>
        expect(redirectToPaymentProvider).toHaveBeenCalledWith(
          "https://connect.stripe.com/setup",
        ),
      );
      expect(paymentConnectApi.start).toHaveBeenCalledWith(
        "PERSONAL",
        "FR",
        intent,
      );
      expect(done).not.toHaveBeenCalled();
    },
  );
  it.each(["MA", "SA"])(
    "shows honest regional availability for %s",
    async (code) => {
      mount();
      await country(code);
      for (const name of code === "MA"
        ? ["Aslan", "Chari Money"]
        : ["Tap Payments"]) {
        expect(screen.getByRole("img", { name })).toBeVisible();
      }
      expect(
        screen.getByText(fr.onboarding.payment.regionalPending),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: fr.onboarding.payment.create }),
      ).not.toBeInTheDocument();
      expect(paymentConnectApi.start).not.toHaveBeenCalled();
    },
  );
  it("only exposes organization selection when authorized by the server", async () => {
    vi.mocked(paymentConnectApi.status).mockImplementation(async (scope) => ({
      ...initial,
      scope,
      canManageOrganization: true,
    }));
    mount();
    fireEvent.click(
      await screen.findByRole("radio", {
        name: fr.onboarding.payment.ORGANIZATION,
      }),
    );
    await waitFor(() =>
      expect(paymentConnectApi.status).toHaveBeenCalledWith("ORGANIZATION"),
    );
    await country("FR");
    fireEvent.click(
      screen.getByRole("button", { name: fr.onboarding.payment.create }),
    );
    await waitFor(() =>
      expect(paymentConnectApi.start).toHaveBeenCalledWith(
        "ORGANIZATION",
        "FR",
        "CREATE",
      ),
    );
  });
  it("keeps a pending account incomplete after verification", async () => {
    vi.mocked(paymentConnectApi.status).mockResolvedValue({
      ...initial,
      country: "FR",
      accountCreated: true,
    });
    mount();
    fireEvent.click(
      await screen.findByRole("button", {
        name: fr.onboarding.form.verifyAccount,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      fr.onboarding.payment.pending,
    );
    expect(check).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
  });
  it("offers reconnection after access is revoked", async () => {
    vi.mocked(paymentConnectApi.status).mockResolvedValue({
      ...initial,
      country: "FR",
      accountCreated: true,
      reconnectRequired: true,
    });
    mount();
    expect(
      await screen.findByRole("button", {
        name: fr.onboarding.payment.connect,
      }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: fr.onboarding.payment.resume }),
    ).not.toBeInTheDocument();
  });
  it("does not exchange the OAuth code twice under StrictMode", async () => {
    mount(
      "/payment-connect/return?scope=PERSONAL&flow=oauth&state=one-use&code=code",
    );
    expect(
      await screen.findByRole("heading", {
        name: fr.onboarding.payment.returnReady,
      }),
    ).toBeVisible();
    expect(paymentConnectApi.complete).toHaveBeenCalledExactlyOnceWith(
      "PERSONAL",
      "one-use",
      "code",
    );
    expect(done).not.toHaveBeenCalled();
  });
  it("a hosted return still requires server verification", async () => {
    mount("/payment-connect/return?scope=PERSONAL&flow=return");
    expect(
      await screen.findByRole("heading", {
        name: fr.onboarding.payment.returnPending,
      }),
    ).toBeVisible();
    expect(paymentConnectApi.refresh).toHaveBeenCalledExactlyOnceWith(
      "PERSONAL",
    );
  });
  it("keeps a reloadable return URL after OAuth without retaining or replaying its code", async () => {
    const view = mount("/payment-connect/return?scope=ORGANIZATION&flow=oauth&state=one-use&code=code");
    await screen.findByRole("heading", { name: fr.onboarding.payment.returnReady });
    expect(window.location.search).toBe("?scope=ORGANIZATION&flow=return");
    view.unmount();
    mount(`/payment-connect/return${window.location.search}`);
    await screen.findByRole("heading", { name: fr.onboarding.payment.returnPending });
    expect(paymentConnectApi.complete).toHaveBeenCalledOnce();
    expect(paymentConnectApi.refresh).toHaveBeenCalledExactlyOnceWith("ORGANIZATION");
  });
  it("OAuth cancellation cannot validate the step", async () => {
    mount(
      "/payment-connect/return?scope=PERSONAL&flow=oauth&error=access_denied",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      fr.onboarding.payment.returnErrorHint,
    );
    expect(paymentConnectApi.complete).not.toHaveBeenCalled();
    expect(paymentConnectApi.refresh).not.toHaveBeenCalled();
  });
  it("renews an expired hosted link without completing a step", async () => {
    mount("/payment-connect/return?scope=ORGANIZATION&flow=refresh");
    await waitFor(() =>
      expect(paymentConnectApi.start).toHaveBeenCalledExactlyOnceWith(
        "ORGANIZATION",
        "FR",
        "CREATE",
      ),
    );
    expect(done).not.toHaveBeenCalled();
  });
  it("ignores a hosted refresh redirect after leaving the return screen", async () => {
    let resolve!: (value: { url: string }) => void;
    vi.mocked(paymentConnectApi.start).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = mount("/payment-connect/return?scope=PERSONAL&flow=refresh");
    await waitFor(() => expect(paymentConnectApi.start).toHaveBeenCalledOnce());
    view.unmount();
    resolve({ url: "https://connect.stripe.com/setup" });
    await new Promise((done) => setTimeout(done, 0));
    expect(redirectToPaymentProvider).not.toHaveBeenCalled();
  });
  it("updates the return screen when Stripe activates after the first verification", async () => {
    vi.useFakeTimers();
    const pending = { ...initial, country: "FR", accountCreated: true };
    vi.mocked(paymentConnectApi.refresh)
      .mockResolvedValueOnce(pending)
      .mockResolvedValue({ ...pending, ready: true });
    mount("/payment-connect/return?scope=PERSONAL&flow=return");
    await advance(0);
    expect(screen.getByRole("heading", { name: fr.onboarding.payment.returnPending })).toBeVisible();
    await advance(5_000);
    expect(screen.getByRole("heading", { name: fr.onboarding.payment.returnReady })).toBeVisible();
    await advance(60_000);
    expect(paymentConnectApi.refresh).toHaveBeenCalledTimes(2);
    expect(paymentConnectApi.start).not.toHaveBeenCalled();
  });
  it("automatically updates the guide and rechecks its completion after activation", async () => {
    vi.useFakeTimers();
    const pending = { ...initial, country: "FR", accountCreated: true };
    vi.mocked(paymentConnectApi.status).mockResolvedValue(pending);
    vi.mocked(paymentConnectApi.refresh).mockResolvedValue({ ...pending, ready: true, chargesEnabled: true, transfersEnabled: true, payoutsEnabled: true });
    mount();
    await advance(0);
    await advance(5_000);
    expect(check).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: fr.onboarding.payment.resume })).not.toBeInTheDocument();
    await advance(60_000);
    expect(paymentConnectApi.refresh).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
  });
  it("bounds automatic verification to one minute without treating a pending account as ready", async () => {
    vi.useFakeTimers();
    mount("/payment-connect/return?scope=PERSONAL&flow=return");
    await advance(0);
    await advance(120_000);
    expect(paymentConnectApi.refresh).toHaveBeenCalledTimes(13);
    expect(screen.getByRole("heading", { name: fr.onboarding.payment.returnPending })).toBeVisible();
    expect(done).not.toHaveBeenCalled();
  });
  it("does not automatically query a revoked connection", async () => {
    vi.useFakeTimers();
    vi.mocked(paymentConnectApi.status).mockResolvedValue({ ...initial, country: "FR", accountCreated: true, reconnectRequired: true });
    mount();
    await advance(0);
    await advance(60_000);
    expect(paymentConnectApi.refresh).not.toHaveBeenCalled();
  });
  it("ignores an automatic verification that finishes after leaving the guide", async () => {
    vi.useFakeTimers();
    const pending = { ...initial, country: "FR", accountCreated: true };
    vi.mocked(paymentConnectApi.status).mockResolvedValue(pending);
    let resolve!: (status: PaymentConnectionStatus) => void;
    vi.mocked(paymentConnectApi.refresh).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = mount();
    await advance(0);
    await advance(5_000);
    view.unmount();
    await act(async () => { resolve({ ...pending, ready: true }); });
    await advance(60_000);
    expect(check).not.toHaveBeenCalled();
    expect(paymentConnectApi.refresh).toHaveBeenCalledOnce();
  });
  it("keeps the last verified state on a network error and retries without restarting onboarding", async () => {
    vi.useFakeTimers();
    const pending = { ...initial, country: "FR", accountCreated: true };
    vi.mocked(paymentConnectApi.status).mockResolvedValue(pending);
    vi.mocked(paymentConnectApi.refresh).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ...pending, ready: true });
    mount();
    await advance(0);
    await advance(5_000);
    expect(check).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: fr.onboarding.payment.resume })).toBeVisible();
    await advance(5_000);
    expect(check).toHaveBeenCalledOnce();
    expect(paymentConnectApi.start).not.toHaveBeenCalled();
  });
});
