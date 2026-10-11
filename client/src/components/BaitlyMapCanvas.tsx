import React, { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import { createSettledScheduler } from "../utils/layoutShift";
import { createBaitlyMap, prefersReducedMotion, setBaitlyMapMode } from "./map/createBaitlyMap";
import { createBaitlyPin, pinPopupContent, PIN_POPUP_OFFSET, type BaitlyPinIcon } from "./map/baitlyMapPin";
import { keepPopupInView } from "./map/keepPopupInView";
import { BaitlyClusterLayer } from "./map/markerClusters";
import { MARKER_STATE_DEFAULT_LABELS, MARKER_STATE_ORDER, urgencyOf, type MarkerState } from "./map/markerStates";
import { useTranslation } from "../hooks/useTranslation";
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
}

/**
 * Dernier recours seulement. Le centre normal est la ville du compte
 * (`useHomeMapCenter`) ; Paris ne sert plus qu'aux comptes sans ville
 * exploitable — creation par un administrateur, invitation d'un prestataire,
 * ville que le geocodeur ne reconnait pas.
 */
const DEFAULT_CENTER: [number, number] = [2.3522, 48.8566]; // Paris
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
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  height = 400,
  onMarkerClick,
  onBoundsChange,
  selectedPropertyId,
  renderPopup,
  colorMode = "light",
}: BaitlyPropertyMapProps & { colorMode?: "light" | "dark" }) {
  // Lu à la création des marqueurs : changer de fonction ne les reconstruit pas.
  const renderPopupRef = useRef(renderPopup);
  renderPopupRef.current = renderPopup;
  const { t } = useTranslation();
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  const clustersRef = useRef<BaitlyClusterLayer | null>(null);
  const clusterLabelRef = useRef((count: number) => t("baitlyMap.cluster", { count, defaultValue: "{{count}} lieux, zoomer pour les voir" }));
  clusterLabelRef.current = (count: number) => t("baitlyMap.cluster", { count, defaultValue: "{{count}} lieux, zoomer pour les voir" });
  /** Marqueurs affichés (type, id, position) : une liste identique ne reconstruit rien. */
  const markersSignatureRef = useRef<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const selectedPropertyIdRef = useRef(selectedPropertyId);
  const syncSelection = useCallback(() => {
    if (selectedPropertyIdRef.current == null) return;
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
  const zoomRef = useRef(zoom);
  /** Thème d'AMORCAGE : le changer ensuite remplace le style, pas la carte (cf. plus bas). */
  const initialModeRef = useRef(colorMode);
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

    const map = createBaitlyMap({
      container: mapContainerRef.current,
      mode: initialModeRef.current,
      center: centerRef.current,
      zoom: zoomRef.current,
      perspective: true,
    });
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
    // Nouvelle carte (thème, remontage) : ses marqueurs sont à reposer.
    markersSignatureRef.current = null;
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
      map.off("moveend", handleMoveEnd);
      map.off("movestart", handleMoveStart);
      clustersRef.current?.destroy();
      clustersRef.current = null;
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [clearMarkers, emitBounds]);

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
   * d'autre : des marqueurs la cadrent deja (`fitBounds` plus bas), et un
   * deplacement manuel est une intention qu'on ne recouvre pas.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || userMovedRef.current || properties.length > 0) return;
    map.jumpTo({ center, zoom });
  }, [center, zoom, properties.length]);

  // Sync markers with properties
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Un rafraîchissement de requête renvoie un NOUVEAU tableau aux mêmes
    // marqueurs : tout reconstruire refermait la fiche ouverte et recadrait
    // la carte sur l'ensemble (dézoom intempestif). Même signature = rien à faire.
    const signature = properties.map((p) => `${markerKey(p)}@${p.lat},${p.lng}#${p.state ?? ""}`).join("|");
    if (signature === markersSignatureRef.current) return;

    const addMarkers = () => {
      markersSignatureRef.current = signature;
      clearMarkers();

      properties.forEach((property) => {
        const markerType = property.type ?? "property";
        const { color, icon } = MARKER_STYLES[markerType] ?? MARKER_STYLES.property;

        const popup = renderPopupRef.current
          ? cardPopup(map, property, setOpenCard)
          : new maplibregl.Popup({ offset: PIN_POPUP_OFFSET, closeButton: false })
              .setDOMContent(pinPopupContent(property.name));

        const element = createBaitlyPin({ color, icon, label: property.name, interactive: true });
        element.dataset.mapPropertyId = String(property.id ?? "");
        if (property.state) element.dataset.state = property.state;
        // Pas d'`addTo` ici : c'est le regroupement qui décide de l'affichage.
        const marker = new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([property.lng, property.lat])
          .setPopup(popup);

        // Ouverture pilotée ici, au premier clic : laisser le clic remonter à la
        // carte faisait basculer la bulle une seconde fois (MapLibre referme ce
        // que la sélection venait d'ouvrir) — il fallait cliquer deux fois.
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          togglePopupExclusively(map, marker, markersRef.current);
          onMarkerClickRef.current?.(property);
        });

        markersRef.current.push(marker);
      });
      clustersRef.current?.setEntries(
        markersRef.current.map((marker, index) => ({ marker, urgency: urgencyOf(properties[index].state) })),
      );
      syncSelection();

      // Centre aussi un logement unique, au lieu de conserver la vue du globe.
      if (properties.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        properties.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, {
          padding: 60,
          // z16 : un logement seul se voit à l'îlot, bâtiments en volume.
          maxZoom: 16,
          ...(prefersReducedMotion() ? { duration: 0 } : {}),
        });
      }

      // Emit initial bounds after markers settle
      requestAnimationFrame(() => emitBounds());
    };

    if (map.loaded()) {
      addMarkers();
    } else {
      map.on("load", addMarkers);
    }

    return () => {
      map.off("load", addMarkers);
    };
  }, [properties, clearMarkers, emitBounds, syncSelection]);

  const states = MARKER_STATE_ORDER.filter((state) => properties.some((p) => p.state === state));

  return (
    <>
      <div className="relative w-full" style={{ height }}>
        <div ref={mapContainerRef} className="size-full rounded-lg overflow-hidden" />
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
    return;
  }
  markers.forEach((other) => {
    if (other !== marker && other.getPopup()?.isOpen()) other.togglePopup();
  });
  const anchor = placeBeside(map, marker);
  marker.togglePopup();
  if (anchor) focusMarker(map, marker, anchor);
}

/**
 * Zoom d'arrivée sur une fiche : celui où les bâtiments 3D sont entièrement
 * dressés (ils poussent de z14 à z15, cf. baitlyMapStyle). Plus loin, le relief
 * se devine à peine ; plus près, on perd le quartier.
 */
const FOCUS_ZOOM = 15;

/**
 * Centre la carte sur le marqueur cliqué et zoome jusqu'au relief 3D — sans
 * jamais dézoomer — en décalant le centre pour que la fiche ouverte à côté
 * tienne entièrement dans la carte. L'inclinaison courante est conservée.
 */
function focusMarker(map: maplibregl.Map, marker: maplibregl.Marker, anchor: "left" | "right"): void {
  const width = map.getContainer().clientWidth;
  const cardWidth = width >= 560 ? 400 : 280;
  // Le marqueur part du côté opposé à la fiche, d'une demi-fiche (+ l'écart de la bulle).
  const shift = Math.min(cardWidth / 2 + 16, width / 2 - 24);
  map.flyTo({
    center: marker.getLngLat(),
    zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
    offset: [anchor === "left" ? -shift : shift, 0],
    duration: prefersReducedMotion() ? 0 : 900,
    essential: true,
  });
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
  marker: PropertyMarker,
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
    setOpenCard({ marker, container });
    release = keepPopupInView(map, popup);
  });
  popup.on("close", () => {
    release();
    setOpenCard((current) => (current?.container === container ? null : current));
  });
  return popup;
}
