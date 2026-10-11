import * as maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { prefersReducedMotion } from './motion';

/**
 * Regroupement des épingles : même pour deux lieux, les épingles
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

/** Les lieux à une même adresse restent sélectionnables au zoom de la rue. */
const CLUSTER_MAX_ZOOM = 22;
const CLUSTER_RADIUS = 56;

type PointProps = { index: number; urgency: number };
type ClusterProps = { urgency: number };

export class BaitlyClusterLayer {
  private entries: ClusterEntry[] = [];
  private index: Supercluster<PointProps, ClusterProps> | null = null;
  private readonly onMap = new Set<maplibregl.Marker>();
  private readonly clusterMarkers = new Map<number, maplibregl.Marker>();
  private signature = '';
  private choice?: maplibregl.Popup;
  private readonly refresh = () => this.render();

  constructor(
    private readonly map: maplibregl.Map,
    private readonly clusterLabel: (count: number) => string,
  ) {
    map.on('moveend', this.refresh);
  }

  /** Met à jour le regroupement sans détacher les épingles conservées. */
  setEntries(entries: ClusterEntry[]): void {
    const signature = entries.map(({ marker, urgency }) => {
      const { lng, lat } = marker.getLngLat();
      return `${lng},${lat}:${urgency}:${marker.getElement().getAttribute('aria-label')}`;
    }).join('|');
    const unchanged = signature === this.signature && entries.length === this.entries.length && entries.every((entry, index) => entry.marker === this.entries[index].marker);
    this.entries = entries;
    if (unchanged) return;
    this.signature = signature;
    const retained = new Set(entries.map((entry) => entry.marker));
    for (const marker of this.onMap) {
      if (retained.has(marker)) continue;
      marker.remove();
      this.onMap.delete(marker);
    }
    this.choice?.remove();
    this.clusterMarkers.forEach((marker) => marker.remove());
    this.clusterMarkers.clear();
    if (entries.length < 2) {
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
    this.choice?.remove();
    this.map.off('moveend', this.refresh);
    this.clusterMarkers.forEach((marker) => marker.remove());
    this.clusterMarkers.clear();
    this.onMap.clear();
  }

  private render(): void {
    this.choice?.remove();
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
      if (visibleMarkers.has(entry.marker) || entry.marker.getPopup()?.isOpen() || entry.marker.getElement().getAttribute('aria-pressed') === 'true') this.show(entry.marker);
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
      const leaves = this.index.getLeaves(id, Infinity);
      const first = leaves[0]?.geometry.coordinates;
      const coincident = first && leaves.every((leaf) => leaf.geometry.coordinates[0] === first[0] && leaf.geometry.coordinates[1] === first[1]);
      if (coincident || this.map.getZoom() >= CLUSTER_MAX_ZOOM) {
        this.showChoices(coordinates, leaves.map((leaf) => this.entries[leaf.properties.index].marker));
        return;
      }
      const zoom = Math.min(this.index.getClusterExpansionZoom(id), CLUSTER_MAX_ZOOM);
      this.map.easeTo({ center: coordinates, zoom, duration: prefersReducedMotion() ? 0 : 200 });
    });
    this.clusterMarkers.set(id, new maplibregl.Marker({ element }).setLngLat(coordinates).addTo(this.map));
  }

  /** Une sélection explicite rend accessibles les missions à la même adresse. */
  private showChoices(coordinates: [number, number], markers: maplibregl.Marker[]): void {
    const list = document.createElement('div');
    list.className = 'baitly-map-cluster-list';
    for (const marker of markers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = marker.getElement().getAttribute('aria-label');
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.choice?.remove();
        this.show(marker);
        marker.getElement().click();
      });
      list.append(button);
    }
    this.choice?.remove();
    this.choice = new maplibregl.Popup({ maxWidth: '280px', offset: 24 }).setLngLat(coordinates).setDOMContent(list).addTo(this.map);
  }
}
