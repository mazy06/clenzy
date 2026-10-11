import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { prefersReducedMotion } from './motion';

/**
 * Regroupement des épingles : au-delà d'une douzaine de lieux, les épingles
 * proches fusionnent en une bulle chiffrée, qui s'ouvre au clic (zoom jusqu'au
 * niveau où elles se séparent). La bulle prend la couleur de l'état le plus
 * urgent qu'elle contient : un retard ne se cache pas dans un groupe.
 *
 * <p>Les épingles restent des éléments DOM (thème, clavier, fiches) ; seul leur
 * affichage est piloté ici, recalculé à chaque fin de mouvement de la carte.</p>
 */
export interface ClusterEntry {
  marker: maplibregl.Marker;
  /** 0 = calme … 3 = urgent (cf. `urgencyOf`). */
  urgency: number;
}

/** En dessous, toutes les épingles restent visibles : regrouper n'aide pas. */
const CLUSTER_THRESHOLD = 12;
/** Au-delà de ce zoom, plus de regroupement : on est à l'échelle de la rue. */
const CLUSTER_MAX_ZOOM = 14;
const CLUSTER_RADIUS = 56;

type PointProps = { index: number; urgency: number };
type ClusterProps = { urgency: number };

export class BaitlyClusterLayer {
  private entries: ClusterEntry[] = [];
  private index: Supercluster<PointProps, ClusterProps> | null = null;
  private readonly onMap = new Set<maplibregl.Marker>();
  private readonly clusterMarkers = new Map<number, maplibregl.Marker>();
  private readonly refresh = () => this.render();

  constructor(
    private readonly map: maplibregl.Map,
    private readonly clusterLabel: (count: number) => string,
  ) {
    map.on('moveend', this.refresh);
  }

  /** Nouvelle liste d'épingles (les précédentes ont déjà été retirées par l'appelant). */
  setEntries(entries: ClusterEntry[]): void {
    this.entries = entries;
    this.onMap.clear();
    this.clusterMarkers.forEach((marker) => marker.remove());
    this.clusterMarkers.clear();
    if (entries.length <= CLUSTER_THRESHOLD) {
      this.index = null;
    } else {
      this.index = new Supercluster<PointProps, ClusterProps>({
        radius: CLUSTER_RADIUS,
        maxZoom: CLUSTER_MAX_ZOOM,
        map: (props) => ({ urgency: props.urgency }),
        reduce: (accumulated, props) => {
          accumulated.urgency = Math.max(accumulated.urgency, props.urgency);
        },
      });
      this.index.load(
        entries.map((entry, index) => {
          const { lng, lat } = entry.marker.getLngLat();
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: { index, urgency: entry.urgency },
          };
        }),
      );
    }
    this.render();
  }

  destroy(): void {
    this.map.off('moveend', this.refresh);
    this.clusterMarkers.forEach((marker) => marker.remove());
    this.clusterMarkers.clear();
    this.onMap.clear();
  }

  private render(): void {
    if (!this.index) {
      this.entries.forEach((entry) => this.show(entry.marker));
      this.clusterMarkers.forEach((marker) => marker.remove());
      this.clusterMarkers.clear();
      return;
    }
    const bounds = this.map.getBounds();
    const features = this.index.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      Math.floor(this.map.getZoom()),
    );
    const visibleMarkers = new Set<maplibregl.Marker>();
    const visibleClusters = new Set<number>();
    for (const feature of features) {
      const props = feature.properties as PointProps & Partial<Supercluster.ClusterProperties> & ClusterProps;
      if (props.cluster) {
        visibleClusters.add(props.cluster_id as number);
        this.showCluster(props.cluster_id as number, feature.geometry.coordinates as [number, number], props.point_count as number, props.urgency);
      } else {
        visibleMarkers.add(this.entries[props.index].marker);
      }
    }
    for (const entry of this.entries) {
      // Une fiche ouverte garde son épingle, même si le zoom la regrouperait.
      if (visibleMarkers.has(entry.marker) || entry.marker.getPopup()?.isOpen()) this.show(entry.marker);
      else this.hide(entry.marker);
    }
    this.clusterMarkers.forEach((marker, id) => {
      if (!visibleClusters.has(id)) {
        marker.remove();
        this.clusterMarkers.delete(id);
      }
    });
  }

  private show(marker: maplibregl.Marker): void {
    if (this.onMap.has(marker)) return;
    marker.addTo(this.map);
    this.onMap.add(marker);
  }

  private hide(marker: maplibregl.Marker): void {
    if (!this.onMap.has(marker)) return;
    marker.remove();
    this.onMap.delete(marker);
  }

  private showCluster(id: number, coordinates: [number, number], count: number, urgency: number): void {
    if (this.clusterMarkers.has(id)) return;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'baitly-map-cluster';
    element.dataset.urgency = String(urgency);
    element.dataset.size = count >= 100 ? 'l' : count >= 10 ? 'm' : 's';
    element.textContent = String(count);
    element.setAttribute('aria-label', this.clusterLabel(count));
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!this.index) return;
      const zoom = Math.min(this.index.getClusterExpansionZoom(id), CLUSTER_MAX_ZOOM + 1);
      this.map.easeTo({ center: coordinates, zoom, duration: prefersReducedMotion() ? 0 : 600 });
    });
    this.clusterMarkers.set(id, new maplibregl.Marker({ element }).setLngLat(coordinates).addTo(this.map));
  }
}
