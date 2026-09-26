import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteLanguageProvider, type SiteLanguage } from "../lib/siteLanguage";
import { SiteLaunchProvider } from "../lib/siteLaunch";
import { BAITLY_READINESS_MESSAGES } from "../lib/messages/baitlyReadiness";
import { PRELAUNCH_MESSAGES } from "../lib/messages/prelaunch";
import StatusPage from "./StatusPage";

const fetchMock = vi.fn();
const response = (paused: boolean) =>
  new Response(
    JSON.stringify({
      registrationsPaused: paused,
      launchAt: null,
      launchTimeZone: "Europe/Paris",
    }),
    { status: 200 },
  );

beforeEach(() => {
  sessionStorage.clear();
  fetchMock
    .mockReset()
    .mockImplementation(() => Promise.resolve(response(true)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

function mount(language: SiteLanguage = "fr") {
  window.history.replaceState({}, "", `/statut?lang=${language}`);
  return render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <SiteLaunchProvider>
          <StatusPage />
        </SiteLaunchProvider>
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}

describe("Public service status", () => {
  it.each(["fr", "en", "ar"] as const)(
    "separates pre-launch from unmeasured uptime in %s",
    async (language) => {
      mount(language);
      const m = BAITLY_READINESS_MESSAGES[language].status;
      expect(await screen.findByText(m.launch)).toBeInTheDocument();
      expect(screen.getAllByText(m.unmeasured)).toHaveLength(
        m.components.length,
      );
      expect(screen.getByText(m.measurementCopy)).toBeInTheDocument();
      expect(document.documentElement.dir).toBe(
        language === "ar" ? "rtl" : "ltr",
      );
    },
  );

  it("does not turn open registrations into operational services", async () => {
    fetchMock.mockResolvedValueOnce(response(false));
    mount();
    const m = BAITLY_READINESS_MESSAGES.fr.status;
    expect(await screen.findByText(m.open)).toBeInTheDocument();
    expect(screen.getAllByText(m.unmeasured)).toHaveLength(m.components.length);
    expect(
      screen.getByRole("link", { name: PRELAUNCH_MESSAGES.fr.register }),
    ).toHaveAttribute("href", "/bientot-disponible?lang=fr");
  });

  it("does not announce opening while the server is still loading", () => {
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    mount();
    const m = BAITLY_READINESS_MESSAGES.fr.status;
    expect(screen.getByRole("status")).toHaveTextContent(m.loading);
    expect(screen.queryByText(m.open)).not.toBeInTheDocument();
    expect(screen.queryByText(m.launch)).not.toBeInTheDocument();
  });

  it("shows an unknown status on failure and can retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    mount();
    const m = BAITLY_READINESS_MESSAGES.fr.status;
    expect(await screen.findByText(m.unknown)).toBeInTheDocument();
    expect(screen.getAllByText(m.unmeasured)).toHaveLength(m.components.length);
    fireEvent.click(
      screen.getByRole("button", { name: PRELAUNCH_MESSAGES.fr.retry }),
    );
    expect(await screen.findByText(m.launch)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
