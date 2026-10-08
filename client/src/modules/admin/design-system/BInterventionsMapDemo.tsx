import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { MapboxPropertyMapProps } from "../../../components/MapboxMapCanvas";
import {
  CalendarDays,
  CalendarIcon,
  ChevronDownIcon,
  Clock3,
  DownloadIcon,
  FilterIcon,
  HomeIcon,
  LayoutGridIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  WrenchIcon,
} from "../../../icons/glyphs";
import { useDemoLanguage } from "./demoLanguage";
import { interventionsDemoText } from "./interventionsDemoMessages";
import { interventionsMapCopy } from "./interventionsMapCopy";
import MissionMapSplitView from "../../../components/MissionMapSplitView";
import ServiceMapRowView from "../../../components/ServiceMapRowView";
import StatusChip from "../../../components/StatusChip";
import BaitlyMarkLogo from "../../../components/BaitlyMarkLogo";
import { Avatar, AvatarFallback } from "../../../components/ui";
import thumbApartment from "../../../assets/demo/stay-apartment.jpg";
import thumbVilla from "../../../assets/demo/stay-villa.jpg";
import thumbTerrace from "../../../assets/demo/stay-terrace.jpg";
import "./interventions-map-demo.css";

const MapboxMapCanvas = lazy(() =>
  import("../../../components/MapboxMapCanvas").then((module) => ({
    default: module.MapboxMapCanvas,
  })),
);
const IMAGES = {
  cleaning: thumbApartment,
  maintenance: thumbTerrace,
  checkin: thumbVilla,
};
const COORDINATES = {
  fr: [
    [-7.9811, 31.6295],
    [-7.5898, 33.5731],
    [-9.5981, 30.4278],
  ],
  sa: [
    [46.6753, 24.7136],
    [39.1728, 21.5433],
    [50.2083, 26.2172],
  ],
};
const DATES = ["2026-03-28", "2026-04-08", "2026-04-11"];
const TONES = { pending: "warn", late: "err", done: "ok" } as const;

/** Keep SSR and hydration identical; download the map SDK only near the scene. */
function DeferredMap({
  loadingLabel,
  ...props
}: MapboxPropertyMapProps & { loadingLabel: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "200px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const placeholder = (
    <div className="bim-map-loading" role="status" aria-label={loadingLabel} />
  );
  return (
    <div ref={host} className="h-full">
      {ready ? (
        <Suspense fallback={placeholder}>
          <MapboxMapCanvas {...props} colorMode="light" />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}

/** Same Mapbox renderer, map/list layout and mission row as the authenticated
 * PMS. Only fixture data and local selection replace the private data layer. */
export default function BInterventionsMapDemo({ MapComponent = DeferredMap }: {
  MapComponent?: ComponentType<MapboxPropertyMapProps & { loadingLabel: string }>;
} = {}) {
  const language = useDemoLanguage();
  const m = interventionsDemoText(language);
  const copy = interventionsMapCopy[language] ?? interventionsMapCopy.fr;
  const locale =
    language === "ar" ? "ar-SA-u-ca-islamic-umalqura-nu-arab" : language;
  const numbers = new Intl.NumberFormat(locale);
  const dates = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState("");
  const sceneRef = useRef<HTMLElement>(null);
  const localizeDigits = (value: string) =>
    language === "ar"
      ? value.replace(/\d+/g, (digits) =>
          numbers.format(Number(digits)).padStart(digits.length, "٠"),
        )
      : value;
  const query = search.trim().toLocaleLowerCase(language);
  const visible = useMemo(
    () =>
      m.missions
        .map((mission, index) => ({ ...mission, index }))
        .filter((mission) =>
          `${mission.title} ${mission.propertyName} ${mission.address} ${mission.team}`
            .toLocaleLowerCase(language)
            .includes(query),
        ),
    [m, query, language],
  );
  const markers = useMemo(
    () =>
      visible.map((mission) => {
        const [lng, lat] = (
          language === "fr" ? COORDINATES.fr : COORDINATES.sa
        )[mission.index];
        return { id: mission.index + 1, name: mission.propertyName, lng, lat };
      }),
    [visible, language],
  );
  const selectedIndex = visible.some((mission) => mission.index === active)
    ? active
    : visible[0]?.index;
  const selectMission = (index: number) => {
    setActive(index);
  };
  useEffect(() => {
    const list = sceneRef.current?.querySelector<HTMLElement>(
      "[data-map-list-scroll]",
    );
    const row = list?.querySelector<HTMLElement>(
      `[data-demo-mission="${selectedIndex}"]`,
    );
    if (!list || !row) return;
    const viewport = list.getBoundingClientRect();
    const item = row.getBoundingClientRect();
    if (item.top < viewport.top) list.scrollTop -= viewport.top - item.top;
    else if (item.bottom > viewport.bottom)
      list.scrollTop += item.bottom - viewport.bottom;
  }, [selectedIndex]);
  const listTitle =
    visible.length === 1
      ? copy.oneInThisZone
      : m.inThisZone.replace("{count}", numbers.format(visible.length));

  return (
    <section
      ref={sceneRef}
      className="bim-demo"
      dir={language === "ar" ? "rtl" : "ltr"}
      lang={language}
      aria-label={copy.map}
    >
      <aside className="bim-sidebar" aria-hidden>
        <BaitlyMarkLogo variant="mark" size={29} tone="dark" disableAnimation />
        {[LayoutGridIcon, HomeIcon, CalendarIcon, WrenchIcon].map(
          (Icon, index) => (
            <span key={index} data-current={index === 3}>
              <Icon size={17} />
            </span>
          ),
        )}
        <span className="bim-sidebar-settings">
          <SettingsIcon size={17} />
        </span>
      </aside>
      <div className="bim-screen">
        <header className="bim-header">
          <span className="bim-screen-icon">
            <WrenchIcon size={18} />
          </span>
          <h2>{m.title}</h2>
          <span className="bim-screen-switcher">
            {m.title}
            <ChevronDownIcon size={14} />
          </span>
          <label className="bim-search">
            <SearchIcon size={16} aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={m.searchOrCommand}
              aria-label={m.search}
            />
            <kbd aria-hidden>⌘K</kbd>
          </label>
          <span className="bim-toolbar" aria-hidden>
            {[FilterIcon, DownloadIcon, RefreshCwIcon, PlusIcon].map(
              (Icon, index) => (
                <Icon key={index} size={17} />
              ),
            )}
          </span>
        </header>
        <div className="bim-workspace">
          <MissionMapSplitView
            className="bim-shared-map"
            listTitle={listTitle}
            listResetKey={query}
            map={
              <MapComponent
                properties={markers}
                selectedPropertyId={
                  selectedIndex == null ? undefined : selectedIndex + 1
                }
                height="100%"
                loadingLabel={copy.loading}
                onMarkerClick={(marker) =>
                  marker.id != null && selectMission(marker.id - 1)
                }
              />
            }
          >
            {visible.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground" role="status">
                {copy.empty}
              </p>
            )}
            {visible.map((mission) => (
              <ServiceMapRowView
                key={mission.kind}
                title={mission.title}
                serviceLabel={mission.subtitle}
                propertyName={mission.propertyName}
                propertyAddress={localizeDigits(mission.address)}
                propertyThumb={
                  <span className="relative block h-12 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                    <img
                      src={IMAGES[mission.kind]}
                      alt=""
                      className="size-full object-cover"
                      width={56}
                      height={48}
                    />
                  </span>
                }
                assigneeLabel={m.team}
                assigneeName={mission.team}
                assigneeAvatars={
                  <Avatar size="sm">
                    <AvatarFallback>
                      {mission.team
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                }
                schedule={
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="size-3.5" aria-hidden />
                      <time dateTime={DATES[mission.index]}>
                        {dates.format(
                          new Date(`${DATES[mission.index]}T12:00:00Z`),
                        )}
                      </time>
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Clock3
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      <bdi dir="ltr">{localizeDigits(mission.slot)}</bdi>
                    </span>
                  </div>
                }
                badges={
                  <>
                    <StatusChip
                      pill
                      tone={TONES[mission.status]}
                      label={m.statusLabels[mission.status]}
                    />
                    {mission.priority === "high" && (
                      <StatusChip
                        pill
                        tone="warn"
                        label={m.priorityLabels.high}
                      />
                    )}
                  </>
                }
                selected={mission.index === selectedIndex}
                demoIndex={mission.index}
                onSelect={() => selectMission(mission.index)}
              />
            ))}
          </MissionMapSplitView>
        </div>
      </div>
    </section>
  );
}
