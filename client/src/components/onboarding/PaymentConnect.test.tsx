import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../../public/locales/fr.json";
import SetupPayout from "./SetupPayout";
import PaymentConnectReturn from "./PaymentConnectReturn";
import {
  paymentConnectApi,
  redirectToPaymentProvider,
  type PaymentConnectionStatus,
} from "../../services/api/paymentConnectApi";
import { getOnboardingSteps } from "../../config/onboardingConfig";

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
async function country(code: string) {
  fireEvent.change(
    await screen.findByLabelText(fr.onboarding.payment.country),
    { target: { value: code } },
  );
}
describe("payment setup", () => {
  it("offers payout setup to every business role", () => {
    for (const role of [
      "SUPER_ADMIN",
      "SUPER_MANAGER",
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
});
