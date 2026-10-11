import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaitlyPropertyMapProps } from "../../src/components/BaitlyMapCanvas";
import BInterventionsMapDemo from "../../src/modules/admin/design-system/BInterventionsMapDemo";
import { DemoLanguageProvider } from "../../src/modules/admin/design-system/demoLanguage";
import { interventionsDemoText } from "../../src/modules/admin/design-system/interventionsDemoMessages";
import { SiteLanguageProvider } from "../lib/siteLanguage";
import AnimatedOpsMockup from "./AnimatedOpsMockup";

// Exercise the real mission rows/layout without requiring WebGL or paid map requests.
vi.mock("../../src/components/BaitlyMapCanvas", () => ({
  BaitlyMapCanvas: ({ properties, onMarkerClick }: BaitlyPropertyMapProps) => (
    <div role="group" aria-label="Carte Baitly">
      {properties.map((property) => (
        <button
          key={property.id}
          data-map-property-id={property.id}
          onClick={() => onMarkerClick?.(property)}
        >
          {property.name}
        </button>
      ))}
    </div>
  ),
}));

let observers: IntersectionObserverCallback[];
beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function reveal() {
  await act(async () => {
    observers.forEach((callback) =>
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  });
}
function demo(language = "fr") {
  return (
    <DemoLanguageProvider value={language}>
      <BInterventionsMapDemo />
    </DemoLanguageProvider>
  );
}

describe("PMS interventions projection", () => {
  it("publishes full mission content without a server Suspense bailout or map SDK", () => {
    const html = renderToString(demo());
    expect(html).toContain("Riad Bab Doukkala");
    expect(html).toContain("Chargement de la carte");
    expect(html).not.toContain("<!--$!-->");
    expect(html).not.toContain("data-map-property-id");
  });

  it.each(["fr", "en", "ar"])(
    "selects the real mission row from its map marker in %s",
    async (language) => {
      const { container } = render(demo(language));
      expect(screen.queryByRole("group", { name: "Carte Baitly" })).toBeNull();
      await reveal();
      const map = await screen.findByRole("group", { name: "Carte Baitly" });
      const m = interventionsDemoText(language);
      fireEvent.click(
        within(map).getByRole("button", { name: m.missions[1].propertyName }),
      );
      const row = container.querySelector('[data-demo-mission="1"]')!;
      expect(row).toHaveAttribute("aria-pressed", "true");
      expect(row).toHaveTextContent(m.missions[1].team);
      expect(row).toHaveTextContent(m.statusLabels.late);
      fireEvent.click(container.querySelector('[data-demo-mission="2"]')!);
      expect(row).toHaveAttribute("aria-pressed", "false");
      if (language === "ar") {
        expect(container.querySelector(".bim-demo")).toHaveAttribute(
          "dir",
          "rtl",
        );
        expect(row).toHaveTextContent("١٠:٠٠");
        const expected = new Intl.DateTimeFormat(
          "ar-SA-u-ca-islamic-umalqura-nu-arab",
          { day: "numeric", month: "short", timeZone: "UTC" },
        ).format(new Date("2026-04-08T12:00:00Z"));
        expect(row.querySelector("time")).toHaveTextContent(expected);
      }
    },
  );

  it("filters map markers and mission rows together, including an empty result", async () => {
    const { container } = render(demo());
    await reveal();
    const map = await screen.findByRole("group", { name: "Carte Baitly" });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Atlas" },
    });
    expect(screen.getByText("1 intervention dans cette zone")).toBeVisible();
    expect(within(map).getAllByRole("button")).toHaveLength(1);
    expect(container.querySelectorAll("[data-demo-mission]")).toHaveLength(1);
    expect(container.querySelector('[data-demo-mission="1"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "not-a-job" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Aucune mission");
    expect(within(map).queryAllByRole("button")).toHaveLength(0);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(within(map).getAllByRole("button")).toHaveLength(3);
  });

  it("autoplays only onscreen and yields to manual selection", async () => {
    vi.useFakeTimers();
    const { container } = render(
      <SiteLanguageProvider initialLanguage="fr">
        <AnimatedOpsMockup />
      </SiteLanguageProvider>,
    );
    const row = (index: number) =>
      container.querySelector('[data-demo-mission="' + index + '"]')!;
    act(() => vi.advanceTimersByTime(6000));
    expect(row(0)).toHaveAttribute("aria-pressed", "true");
    await reveal();
    expect(screen.queryByRole('group', { name: 'Carte Baitly' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Carte illustrative · données de démonstration' })).toBeVisible();
    act(() => vi.advanceTimersByTime(6100));
    expect(row(1)).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerDown(row(0));
    fireEvent.click(row(0));
    act(() => vi.advanceTimersByTime(15000));
    expect(row(0)).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Reprendre la démonstration" }),
    ).toBeVisible();
  });

  it("keeps reduced motion static while allowing map selection", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(
      <SiteLanguageProvider initialLanguage="fr">
        <AnimatedOpsMockup />
      </SiteLanguageProvider>,
    );
    await reveal();
    act(() => vi.advanceTimersByTime(30000));
    expect(container.querySelector('[data-demo-mission="0"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: /démonstration/ })).toBeNull();
    fireEvent.click(container.querySelector('[data-map-property-id="3"]')!);
    expect(container.querySelector('[data-demo-mission="2"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
