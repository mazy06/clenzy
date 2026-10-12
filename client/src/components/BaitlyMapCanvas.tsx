import React, { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize } from "../icons/glyphs";
import * as maplibregl from "maplibre-gl";
import { createSettledScheduler } from "../utils/layoutShift";
import { createBaitlyMap, prefersReducedMotion, setBaitlyMapMode } from "./map/createBaitlyMap";
import { createBaitlyPin, pinPopupContent, PIN_POPUP_OFFSET, type BaitlyPinIcon } from "./map/baitlyMapPin";
import { keepPopupInView } from "./map/keepPopupInView";
import { BaitlyClusterLayer } from "./map/markerClusters";
import { BaitlySectorLayer, sectorBounds, type SectorOverlay } from "./map/sectorLayer";
import { MARKER_STATE_DEFAULT_LABELS, MARKER_STATE_ORDER, urgencyOf, type MarkerState } from "./map/markerStates";
import { useTranslation } from "../hooks/useTranslation";
import { useMapSheet } from "./map/MapSheetContext";
export interface PropertyMarker {
  lat: number;
  lng: number;
  name: string;
  id?: number;
  type?: PropertyMarkerType;
  /** Anneau d'état de l'épingle (planning du jour, retard…) ; absent = lieu calme. */
  state?: MarkerState;
}

export type PropertyMarkerType = "property" | "key_exchange" | "intervention" | "service_request";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface BaitlyPropertyMapProps {
  properties: PropertyMarker[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  height?: string | number;
  onMarkerClick?: (property: PropertyMarker) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  selectedPropertyId?: number;
  /**
   * Fiche riche affichée dans la bulle du marqueur ouvert (photos, adresse,
   * intervenant…). Montée par portail : elle garde le contexte React de l'écran
   * (requêtes, traductions, navigation). Absente : la bulle montre le nom seul.
   */
  renderPopup?: (marker: PropertyMarker) => ReactNode;
  /** Secteurs d'intervention dessinés sous les épingles (bordure + fond translucide). */
  sectors?: SectorOverlay | null;
  /** Commandes propres à l'écran, posées en haut de la carte (ex. bascule des secteurs). */
  overlayControls?: ReactNode;
}

/** Sans localisation exploitable, une vue mondiale plutôt qu'une ville arbitraire. */
const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 12;

// L'epingle Baitly est un element DOM : les tokens s'y resolvent et suivent le theme.
const MARKER_STYLES: Record<PropertyMarkerType, { color: string; icon: BaitlyPinIcon }> = {
  property: { color: "var(--bui-navy)", icon: "home" },
  key_exchange: { color: "var(--bui-warning-ink)", icon: "key" },
  intervention: { color: "var(--bui-success-ink)", icon: "wrench" },
  service_request: { color: "var(--bui-info-ink)", icon: "clipboard" },
};

const markerKey = (marker: PropertyMarker) => `${marker.type ?? "property"}:${marker.id ?? `${marker.lat},${marker.lng}`}`;

interface OpenCard {
  marker: PropertyMarker;
  container: HTMLElement;
}

/**
 * Carte Baitly (MapLibre + tuiles OSM maison) affichant des marqueurs de proprietes.
 * Supporte deux types de marqueurs (property / key_exchange) avec des couleurs distinctes.
 * Affiche un popup au clic sur un marqueur.
 */
export function BaitlyMapCanvas({
  properties,
  center,
  zoom = DEFAULT_ZOOM,
  height = 400,
  onMarkerClick,
  onBoundsChange,
  selectedPropertyId,
  renderPopup,
  sectors,
  overlayControls,
  colorMode = "light",
}: BaitlyPropertyMapProps & { colorMode?: "light" | "dark" }) {
  // Lu à la création des marqueurs : changer de fonction ne les reconstruit pas.
  const renderPopupRef = useRef(renderPopup);
  renderPopupRef.current = renderPopup;
  const { t } = useTranslation();
  const sheet = useMapSheet();
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "partial" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const entriesRef = useRef(new Map<string, { marker: maplibregl.Marker; property: PropertyMarker; rich: boolean }>());
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  const openCardRef = useRef(openCard);
  openCardRef.current = openCard;
  const clustersRef = useRef<BaitlyClusterLayer | null>(null);
  const sectorLayerRef = useRef<BaitlySectorLayer | null>(null);
  const sectorsRef = useRef(sectors);
  sectorsRef.current = sectors;
  const clusterLabelRef = useRef((count: number) => t("baitlyMap.cluster", { count, defaultValue: "{{count}} lieux, zoomer pour les voir" }));
  clusterLabelRef.current = (count: number) => t("baitlyMap.cluster", { count, defaultValue: "{{count}} lieux, zoomer pour les voir" });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const selectedPropertyIdRef = useRef(selectedPropertyId);
  const syncSelection = useCallback(() => {
    markersRef.current.forEach((marker) => {
      const selected =
        marker.getElement().dataset.mapPropertyId ===
        String(selectedPropertyIdRef.current);
      marker.getElement().setAttribute("aria-pressed", String(selected));
      if (marker.getPopup()?.isOpen() === selected) return;
      if (selected && mapRef.current) placeBeside(mapRef.current, marker);
      marker.togglePopup();
    });
  }, []);
  useEffect(() => {
    selectedPropertyIdRef.current = selectedPropertyId;
    syncSelection();
  }, [selectedPropertyId, syncSelection]);
  // `center`/`zoom` sont des valeurs d'AMORCAGE, pas un etat pilote : les
  // garder en dependances de la creation detruisait et reconstruisait la carte
  // des que le centre changeait — ce qui arrive desormais, la ville du compte
  // arrivant apres coup. Un ref les transmet sans reconstruire.
  const centerRef = useRef(center);
  const framedRef = useRef(false);
  const zoomRef = useRef(zoom);
  /** Thème d'AMORCAGE : le changer ensuite remplace le style, pas la carte (cf. plus bas). */
  const initialModeRef = useRef(colorMode);
  initialModeRef.current = colorMode;
  const appliedModeRef = useRef(colorMode);
  /** L'utilisateur a-t-il deja deplace la carte lui-meme ? */
  const userMovedRef = useRef(false);
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onBoundsChangeRef.current = onBoundsChange;
    centerRef.current = center;
    zoomRef.current = zoom;
  }, [onMarkerClick, onBoundsChange, center, zoom]);


  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    entriesRef.current.clear();
  }, []);

  const emitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !onBoundsChangeRef.current) return;
    const b = map.getBounds();
    if (!b) return;
    onBoundsChangeRef.current({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map: maplibregl.Map;
    try {
      map = createBaitlyMap({
        container: mapContainerRef.current,
        mode: initialModeRef.current,
        center: centerRef.current ?? DEFAULT_CENTER,
        zoom: centerRef.current ? zoomRef.current : 2,
        perspective: true,
      });
    } catch {
      setMapStatus("error");
      return;
    }
    appliedModeRef.current = initialModeRef.current;
    setMapStatus("loading");
    const handleLoad = () => setMapStatus((status) => status === "error" || status === "partial" ? status : "ready");
    const handleError = (event: maplibregl.ErrorEvent) => {
      const source = (event as maplibregl.ErrorEvent & { sourceId?: string }).sourceId;
      if (source === "baitly-world") {
        setMapStatus((status) => status === "error" ? status : "partial");
        return;
      }
      if (source === "baitly-terrain") {
        map.setTerrain(null);
        map.jumpTo({ pitch: 0, bearing: 0 });
        if (map.getLayer("terrain_hillshade")) map.removeLayer("terrain_hillshade");
        return;
      }
      setMapStatus("error");
    };
    map.on("load", handleLoad);
    map.on("error", handleError);
    const handleMoveEnd = () => emitBounds();
    // `originalEvent` n'est present que sur un geste : un `fitBounds` ou un
    // `jumpTo` programmatique ne compte pas comme un deplacement utilisateur.
    const handleMoveStart = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) userMovedRef.current = true;
    };
    map.on("moveend", handleMoveEnd);
    map.on("movestart", handleMoveStart);
    mapRef.current = map;
    clustersRef.current = new BaitlyClusterLayer(map, (count) => clusterLabelRef.current(count));
    sectorLayerRef.current = new BaitlySectorLayer(map);
    sectorLayerRef.current.set(sectorsRef.current ?? null, initialModeRef.current);
    framedRef.current = false;
    userMovedRef.current = false;
    // Le panneau change de taille sans toujours redimensionner la fenêtre
    // (sidebar, répartition carte/liste). MapLibre doit recalculer son canvas.
    // ...mais une seule fois arrive : `resize` reconstruit le canvas GL, le
    // faire a chaque frame du repli de la navigation coute bien plus cher que
    // le deplacement lui-meme.
    const settledResize = createSettledScheduler(() => map.resize());
    const resizeObserver = new ResizeObserver(settledResize.schedule);
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      settledResize.cancel();
      resizeObserver.disconnect();
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.off("moveend", handleMoveEnd);
      map.off("movestart", handleMoveStart);
      clustersRef.current?.destroy();
      clustersRef.current = null;
      sectorLayerRef.current?.destroy();
      sectorLayerRef.current = null;
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [clearMarkers, emitBounds, retryKey]);

  // Secteurs : redessinés à chaque changement ; sans épingle à cadrer, la carte se
  // cadre une fois sur leur emprise (zone d'un prestataire qui n'a encore aucun logement).
  useEffect(() => {
    const map = mapRef.current;
    sectorLayerRef.current?.set(sectors ?? null, colorMode);
    const outline = sectors?.merged;
    if (!map || !outline || properties.length > 0 || framedRef.current || userMovedRef.current || centerRef.current) return;
    framedRef.current = true;
    const [west, south, east, north] = sectorBounds(outline);
    map.fitBounds([[west, south], [east, north]], { padding: 48, maxZoom: 12, duration: 0 });
  }, [sectors, properties.length, colorMode]);

  /**
   * Papier ↔ Nuit : on remplace le STYLE de la carte existante (MapLibre applique
   * la différence). La caméra, les épingles et la fiche ouverte ne bougent pas —
   * recréer la carte renvoyait l'utilisateur à son point de départ.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedModeRef.current === colorMode) return;
    appliedModeRef.current = colorMode;
    setBaitlyMapMode(map, colorMode);
  }, [colorMode]);

  /**
   * Centre arrive APRES la creation — typiquement la ville du compte, resolue
   * par une requete. On ne le pose que si la camera n'appartient a personne
   * d'autre : un déplacement manuel est une intention qu'on ne recouvre pas.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center || userMovedRef.current) return;
    map.jumpTo({ center, zoom });
    framedRef.current = true;
  }, [center?.[0], center?.[1], zoom]);

  // Les marqueurs DOM sont indépendants du chargement des tuiles : attendre
  // `load` après une mise à jour pouvait les laisser en attente indéfiniment.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const valid = properties.filter(validMarker);
    const keys = new Set(valid.map(markerKey));
    for (const [key, entry] of entriesRef.current) {
      if (keys.has(key)) continue;
      entry.marker.remove();
      entriesRef.current.delete(key);
    }
    valid.forEach((property) => {
      const key = markerKey(property);
      let entry = entriesRef.current.get(key);
      const rich = !!renderPopupRef.current;
      if (entry && entry.rich !== rich) {
        entry.marker.remove();
        entriesRef.current.delete(key);
        entry = undefined;
      }
      if (!entry) {
        const markerType = property.type ?? "property";
        const { color, icon } = MARKER_STYLES[markerType] ?? MARKER_STYLES.property;
        const element = createBaitlyPin({ color, icon, label: property.name, interactive: true });
        const marker = new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([property.lng, property.lat]);
        const created = { marker, property, rich };
        marker.setPopup(rich
          ? cardPopup(map, () => created.property, setOpenCard)
          : new maplibregl.Popup({ offset: PIN_POPUP_OFFSET, closeButton: false }).setDOMContent(pinPopupContent(property.name)));
        marker.getPopup()?.on("close", () => element.setAttribute("aria-pressed", "false"));
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          const mobile = sheetRef.current;
          if (created.rich && mobile?.detailHost) {
            markersRef.current.forEach((other) => other.getElement().setAttribute("aria-pressed", String(other === marker)));
            setOpenCard({ marker: created.property, container: mobile.detailHost });
            mobile.openDetail();
          } else {
            togglePopupExclusively(map, marker, markersRef.current);
          }
          onMarkerClickRef.current?.(created.property);
        });
        entry = created;
        entriesRef.current.set(key, entry);
      }
      entry.property = property;
      const position = entry.marker.getLngLat();
      if (position.lng !== property.lng || position.lat !== property.lat) entry.marker.setLngLat([property.lng, property.lat]);
      const element = entry.marker.getElement();
      element.dataset.mapPropertyId = String(property.id ?? "");
      element.setAttribute("aria-label", property.name);
      if (property.state) element.dataset.state = property.state;
      else delete element.dataset.state;
      if (!entry.rich) entry.marker.getPopup()?.setDOMContent(pinPopupContent(property.name));
    });
    markersRef.current = [...entriesRef.current.values()].map((entry) => entry.marker);
    clustersRef.current?.setEntries([...entriesRef.current.values()].map((entry) => ({ marker: entry.marker, urgency: urgencyOf(entry.property.state) })));
    if (selectedPropertyIdRef.current != null) syncSelection();
    if (openCardRef.current && !keys.has(markerKey(openCardRef.current.marker))) sheetRef.current?.closeDetail();
    setOpenCard((current) => {
      if (!current) return null;
      const fresh = entriesRef.current.get(markerKey(current.marker));
      if (!fresh) return null;
      return current.marker === fresh.property ? current : { ...current, marker: fresh.property };
    });
    if (!framedRef.current && !centerRef.current && !userMovedRef.current && valid.length) {
      framedRef.current = true;
      fitMarkers(map, valid);
    }
    emitBounds();
  }, [properties, emitBounds, syncSelection, retryKey, !!renderPopup]);

  useEffect(() => {
    if (sheet && !sheet.detailOpen) {
      setOpenCard((current) => current?.container === sheet.detailHost ? null : current);
      if (selectedPropertyIdRef.current == null) markersRef.current.forEach((marker) => marker.getElement().setAttribute("aria-pressed", "false"));
    }
  }, [sheet?.detailOpen, sheet?.detailHost]);

  const states = MARKER_STATE_ORDER.filter((state) => properties.some((p) => p.state === state));

  return (
    <>
      <div className="relative w-full" style={{ height }}>
        <div ref={mapContainerRef} className="size-full rounded-lg overflow-hidden" />
        <div className="absolute start-3 top-3 z-10 flex max-w-[calc(100%-88px)] flex-col items-start gap-2">
          {overlayControls}
          {properties.length > 0 && <button type="button" onClick={() => {
            userMovedRef.current = true;
            if (mapRef.current) fitMarkers(mapRef.current, properties);
          }} className="baitly-map-fit-button">
            <Maximize size={16} aria-hidden="true" />
            <span>
            {t("baitlyMap.showAll", "Voir tous les lieux")}
            </span>
          </button>}
          {mapStatus === "loading" && <span role="status" className="rounded-lg bg-card px-3 py-2 text-xs text-muted-foreground">{t("baitlyMap.loading", "Chargement de la carte…")}</span>}
          {mapStatus === "partial" && <span role="status" className="max-w-64 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">{t("baitlyMap.worldUnavailable", "Fond mondial indisponible. Carte régionale affichée.")}</span>}
          {mapStatus === "error" && <div role="alert" className="max-w-64 rounded-lg border border-border bg-card p-3 text-xs text-foreground">
            <p>{t("baitlyMap.loadError", "Le fond de carte n’a pas pu être chargé.")}</p>
            <button type="button" onClick={() => {
              const map = mapRef.current;
              if (map) {
                const location = map.getCenter();
                centerRef.current = [location.lng, location.lat];
                zoomRef.current = map.getZoom();
              }
              setRetryKey((key) => key + 1);
            }} className="mt-2 min-h-11 cursor-pointer rounded-md border border-border px-3 font-medium focus-visible:ring-2 focus-visible:ring-ring">{t("common.retry", "Réessayer")}</button>
          </div>}
        </div>
        {states.length > 0 ? (
          <ul className="baitly-map-legend" aria-label={t("baitlyMap.legend", "Légende")}>
            {states.map((state) => (
              <li key={state} data-state={state}>
                {t(`baitlyMap.states.${state}`, MARKER_STATE_DEFAULT_LABELS[state])}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {openCard && renderPopup
        ? createPortal(renderPopup(openCard.marker), openCard.container, markerKey(openCard.marker))
        : null}
    </>
  );
}

/** Ouvre la bulle du marqueur (en refermant les autres), ou la referme si elle l'était. */
function togglePopupExclusively(map: maplibregl.Map, marker: maplibregl.Marker, markers: maplibregl.Marker[]): void {
  if (marker.getPopup()?.isOpen()) {
    marker.togglePopup();
    marker.getElement().setAttribute("aria-pressed", "false");
    return;
  }
  markers.forEach((other) => {
    if (other !== marker && other.getPopup()?.isOpen()) other.togglePopup();
  });
  placeBeside(map, marker);
  marker.togglePopup();
  markers.forEach((other) => other.getElement().setAttribute("aria-pressed", String(other === marker)));
}

function validMarker(marker: PropertyMarker): boolean {
  return Number.isFinite(marker.lng) && Number.isFinite(marker.lat) && Math.abs(marker.lng) <= 180 && Math.abs(marker.lat) <= 90;
}

function fitMarkers(map: maplibregl.Map, properties: PropertyMarker[]): void {
  const valid = properties.filter(validMarker);
  if (!valid.length) return;
  const bounds = new maplibregl.LngLatBounds();
  valid.forEach((p) => bounds.extend([p.lng, p.lat]));
  const padding = Math.max(0, Math.min(60, (Math.min(map.getContainer().clientWidth, map.getContainer().clientHeight) - 1) / 4));
  map.fitBounds(bounds, { padding, maxZoom: 15, duration: prefersReducedMotion() ? 0 : 200 });
}

/**
 * Une fiche s'ouvre À CÔTÉ du marqueur, jamais dessus ni dessous : à droite s'il
 * est dans la moitié gauche de la carte, à gauche sinon — là où il y a le plus
 * de largeur. `keepPopupInView` recadre ensuite si la hauteur manque.
 */
function placeBeside(map: maplibregl.Map, marker: maplibregl.Marker): "left" | "right" | null {
  const popup = marker.getPopup();
  if (!popup?.options.className?.includes("baitly-map-popup--card")) return null;
  const { x } = map.project(marker.getLngLat());
  const anchor = x < map.getContainer().clientWidth / 2 ? "left" : "right";
  popup.options.anchor = anchor;
  return anchor;
}

/**
 * Bulle « fiche » : un conteneur vide que React remplit par portail tant que la
 * bulle est ouverte — le détail n'est donc chargé qu'au clic, pour un seul
 * marqueur à la fois.
 */
function cardPopup(
  map: maplibregl.Map,
  getMarker: () => PropertyMarker,
  setOpenCard: React.Dispatch<React.SetStateAction<OpenCard | null>>,
): maplibregl.Popup {
  const container = document.createElement("div");
  container.className = "baitly-map-card-slot";
  const popup = new maplibregl.Popup({
    offset: PIN_POPUP_OFFSET,
    closeButton: true,
    maxWidth: "none",
    className: "baitly-map-popup--card",
    focusAfterOpen: false,
  }).setDOMContent(container);
  let release: () => void = () => undefined;
  popup.on("open", () => {
    setOpenCard({ marker: getMarker(), container });
    release = keepPopupInView(map, popup);
  });
  popup.on("close", () => {
    release();
    setOpenCard((current) => (current?.container === container ? null : current));
  });
  return popup;
}
