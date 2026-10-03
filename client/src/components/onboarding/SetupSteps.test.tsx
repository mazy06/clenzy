import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../../public/locales/fr.json";
import SetupBasics from "./SetupBasics";
import SetupProperty from "./SetupProperty";
import { usersApi } from "../../services/api/usersApi";
import { calendarPricingApi } from "../../services/api/calendarPricingApi";

vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => ({
    currentLanguage: "fr",
    t: (key: string) => key.split(".").reduce((v: any, k) => v?.[k], fr) ?? key,
  }),
}));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      firstName: "Salma",
      lastName: "Alaoui",
      email: "salma@example.test",
      organizationId: 1,
    },
  }),
}));
vi.mock("../../hooks/useCurrency", () => ({
  useCurrency: () => ({ currency: "EUR" }),
}));
vi.mock("../../services/api/usersApi", () => ({
  usersApi: { updateMyProfile: vi.fn() },
}));
vi.mock("../../services/api/propertiesApi", () => ({
  propertiesApi: {
    getAll: vi.fn().mockResolvedValue([{ id: 42, name: "Riad" }]),
  },
}));
vi.mock("../../services/api/calendarPricingApi", () => ({
  calendarPricingApi: {
    getRatePlans: vi.fn(),
    updateRatePlan: vi.fn(),
    createRatePlan: vi.fn(),
  },
}));
vi.mock("../../modules/properties/PropertyForm", () => ({
  default: ({ onSuccess }: any) => (
    <button onClick={() => onSuccess({ id: 42, name: "Riad", ownerId: 1 })}>
      Créer le logement
    </button>
  ),
}));
vi.mock("../../modules/contracts/ManagementContractRequiredModal", () => ({
  default: ({ onCompleted, embedded }: any) => (
    <button onClick={onCompleted}>
      {embedded ? "Valider le contrat dans le guide" : "Modal externe"}
    </button>
  ),
}));
vi.mock("../../modules/dashboard/ICalImportModal", () => ({
  default: () => null,
}));

function mount(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  );
}
beforeEach(() => vi.clearAllMocks());

describe("inline onboarding tasks", () => {
  it("persists the phone number before checking the real profile status", async () => {
    const check = vi.fn().mockResolvedValue(undefined),
      done = vi.fn();
    vi.mocked(usersApi.updateMyProfile).mockResolvedValue({ success: true });
    mount(
      <SetupBasics stepKey="complete_profile" onSaved={done} onCheck={check} />,
    );
    fireEvent.change(screen.getByLabelText(fr.onboarding.form.phone), {
      target: { value: "+33 6 12 34 56 78" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: fr.onboarding.guide.save }),
    );
    await waitFor(() => expect(check).toHaveBeenCalledOnce());
    expect(usersApi.updateMyProfile).toHaveBeenCalledWith({
      phoneNumber: "+33 6 12 34 56 78",
    });
    expect(done).not.toHaveBeenCalled();
  });
  it("keeps the profile form open and does not validate after a failed save", async () => {
    const check = vi.fn(),
      done = vi.fn();
    vi.mocked(usersApi.updateMyProfile).mockRejectedValue(new Error("offline"));
    mount(
      <SetupBasics stepKey="complete_profile" onSaved={done} onCheck={check} />,
    );
    fireEvent.change(screen.getByLabelText(fr.onboarding.form.phone), {
      target: { value: "+33612345678" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: fr.onboarding.guide.save }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      fr.onboarding.guide.saveError,
    );
    expect(check).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByLabelText(fr.onboarding.form.phone)).toHaveValue(
      "+33612345678",
    );
  });
  it("requires the management contract inside the guide after property creation", async () => {
    const check = vi.fn(),
      done = vi.fn();
    mount(
      <SetupProperty
        stepKey="create_property"
        onSaved={done}
        onCheck={check}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Créer le logement" }));
    expect(check).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Valider le contrat dans le guide" }),
    );
    expect(check).toHaveBeenCalledOnce();
  });
  it("updates the existing base rate instead of creating a duplicate", async () => {
    vi.mocked(calendarPricingApi.getRatePlans).mockResolvedValue([
      {
        id: 7,
        propertyId: 42,
        name: "Base",
        type: "BASE",
        priority: 1,
        nightlyPrice: 100,
        currency: "MAD",
        isActive: true,
      },
    ]);
    vi.mocked(calendarPricingApi.updateRatePlan).mockResolvedValue({
      id: 7,
    } as any);
    const done = vi.fn();
    mount(
      <SetupProperty
        stepKey="define_pricing"
        onSaved={done}
        onCheck={vi.fn()}
      />,
    );
    fireEvent.change(
      await screen.findByLabelText(fr.onboarding.form.nightlyPrice),
      { target: { value: "125" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: fr.onboarding.guide.save }),
    );
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(calendarPricingApi.updateRatePlan).toHaveBeenCalledWith(7, {
      nightlyPrice: 125,
      currency: "MAD",
      isActive: true,
    });
    expect(calendarPricingApi.createRatePlan).not.toHaveBeenCalled();
  });
});
