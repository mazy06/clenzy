import * as maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { prefersReducedMotion } from './motion';
import {clusterCountLabel,clusterDiameter,selectVisibleMapFeatures,MAP_VISIBLE_SYMBOL_LIMIT} from './clusterPresentation';

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
  aggregate?:boolean;
  prepare?:()=>void;
  /** 0 = calme … 3 = urgent (cf. `urgencyOf`). */
  urgency: number;
  /** Vignette et ligne secondaire du lieu, dans la liste d'un regroupement. */
  thumbnailUrl?: string | null;
  subtitle?: string | null;
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
  private readonly prepare = new WeakMap<maplibregl.Marker,()=>void>();
  private readonly clusterMarkers = new Map<number, maplibregl.Marker>();
  private signature = '';
  private choice?: maplibregl.Popup;
  private readonly refresh = () => this.render();

  constructor(
    private readonly map: maplibregl.Map,
    private readonly clusterLabel: (count: number) => string,
    private readonly claimCard?: (close: () => void) => () => void,
  ) {
    map.on('moveend', this.refresh);
  }

  /** Met à jour le regroupement sans détacher les épingles conservées. */
  setEntries(entries: ClusterEntry[]): void {
    entries.forEach(entry=>{if(entry.prepare)this.prepare.set(entry.marker,entry.prepare);});
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
    const regular=entries.map((entry,index)=>({entry,index})).filter(({entry})=>!entry.aggregate);
    if (regular.length < 2) {
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
        regular.map(({entry,index}) => {
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

  refreshSelection(): void { this.render(); }

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
    // Lieux dont la fiche est ouverte : relevés une fois, pas groupe par groupe (le
    // parcours des feuilles de chaque groupe coûtait à chaque fin de déplacement).
    const open = new Set(this.entries.filter((entry) => this.isOpen(entry.marker)).map((entry) => entry.marker));
    const candidates=features.filter(feature=>{
      const props=feature.properties as PointProps & Partial<Supercluster.ClusterProperties>;
      if(!props.cluster&&open.has(this.entries[props.index]?.marker))return false;
      return !(props.cluster&&open.size>0&&this.hasOpenLeaf(props.cluster_id as number,open));
    });
    const displayed=selectVisibleMapFeatures(candidates,{west:bounds.getWest(),south:bounds.getSouth(),east:bounds.getEast(),north:bounds.getNorth()},Math.max(0,MAP_VISIBLE_SYMBOL_LIMIT-open.size-this.entries.filter(entry=>entry.aggregate).length));
    for (const feature of displayed) {
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
      if (entry.aggregate || visibleMarkers.has(entry.marker) || open.has(entry.marker)) this.show(entry.marker);
      else this.hide(entry.marker);
    }
    this.clusterMarkers.forEach((marker, id) => {
      if (!visibleClusters.has(id)) {
        marker.remove();
        this.clusterMarkers.delete(id);
      }
    });
  }

  private isOpen(marker: maplibregl.Marker): boolean {
    return !!marker.getPopup()?.isOpen() || marker.getElement().getAttribute('aria-pressed') === 'true'
      || marker.getElement().hasAttribute('data-highlighted');
  }

  private hasOpenLeaf(clusterId: number, open: Set<maplibregl.Marker>): boolean {
    if (!this.index) return false;
    return this.index.getLeaves(clusterId, Infinity).some((leaf) => open.has(this.entries[leaf.properties.index].marker));
  }

  private show(marker: maplibregl.Marker): void {
    if (this.onMap.has(marker)) return;
    this.prepare.get(marker)?.();
    marker.addTo(this.map);
    this.onMap.add(marker);
  }

  private hide(marker: maplibregl.Marker): void {
    if (!this.onMap.has(marker)) return;
    marker.remove();
    this.onMap.delete(marker);
  }

  private showCluster(id: number, coordinates: [number, number], count: number, urgency: number): void {
    const existing=this.clusterMarkers.get(id);
    if(existing){
      const element=existing.getElement();
      if(element.dataset.count!==String(count)){
        element.textContent=clusterCountLabel(count);element.dataset.count=String(count);
        element.dataset.size=count>=100?'l':count>=10?'m':'s';
        element.style.setProperty('--cluster-size',`${clusterDiameter(count)}px`);
        element.setAttribute('aria-label',this.clusterLabel(count));
      }
      if(element.dataset.urgency!==String(urgency))element.dataset.urgency=String(urgency);
      const point=existing.getLngLat();
      if(point.lng!==coordinates[0]||point.lat!==coordinates[1])existing.setLngLat(coordinates);
      return;
    }
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'baitly-map-cluster';
    element.dataset.urgency = String(urgency);
    element.dataset.size = count >= 100 ? 'l' : count >= 10 ? 'm' : 's';
    element.textContent = clusterCountLabel(count);
    element.style.setProperty('--cluster-size',`${clusterDiameter(count)}px`);
    element.dataset.count=String(count);
    element.setAttribute('aria-label', this.clusterLabel(count));
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!this.index) return;
      const leaves = this.index.getLeaves(id, Infinity);
      const first = leaves[0]?.geometry.coordinates;
      const coincident = first && leaves.every((leaf) => leaf.geometry.coordinates[0] === first[0] && leaf.geometry.coordinates[1] === first[1]);
      const point=marker.getLngLat(),current:[number,number]=[point.lng,point.lat];
      if (coincident || this.map.getZoom() >= CLUSTER_MAX_ZOOM) {
        this.showChoices(current, leaves.map((leaf) => this.entries[leaf.properties.index]));
        return;
      }
      const zoom = Math.min(this.index.getClusterExpansionZoom(id), CLUSTER_MAX_ZOOM);
      this.map.easeTo({ center: current, zoom, duration: prefersReducedMotion() ? 0 : 200 });
    });
    const marker=new maplibregl.Marker({element}).setLngLat(coordinates).addTo(this.map);
    this.clusterMarkers.set(id,marker);
  }

  /**
   * Lieux à une même adresse : une liste avec vignette, nom et adresse. Choisir un lieu
   * affiche son épingle et ouvre sa fiche ; la pastille du groupe s'efface tant que la fiche
   * est ouverte, et revient quand on la ferme (clic ailleurs).
   */
  private showChoices(coordinates: [number, number], entries: ClusterEntry[]): void {
    const list = document.createElement('div');
    list.className = 'baitly-map-cluster-list';
    for (const entry of entries) {
      const { marker } = entry;
      const button = document.createElement('button');
      button.type = 'button';
      button.append(clusterThumb(entry), clusterText(marker.getElement().getAttribute('aria-label') ?? '', entry.subtitle));
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.choice?.remove();
        this.show(marker);
        marker.getElement().click();
        marker.getPopup()?.once('close', this.refresh);
        this.render();
      });
      list.append(button);
    }
    this.choice?.remove();
    this.choice = new maplibregl.Popup({ maxWidth: '300px', offset: 24, className: 'baitly-map-popup--choices' })
      .setLngLat(coordinates).setDOMContent(list).addTo(this.map);
    const choice = this.choice;
    const release = this.claimCard?.(() => choice.remove());
    if (release) choice.on('close', release);
  }
}

/** Vignette du lieu (photo, sinon initiale) — DOM construit, aucun HTML injecté. */
function clusterThumb(entry: ClusterEntry): HTMLElement {
  const thumb = document.createElement('span');
  thumb.className = 'baitly-map-cluster-list__thumb';
  if (entry.thumbnailUrl) {
    const image = document.createElement('img');
    image.src = entry.thumbnailUrl;
    image.alt = '';
    image.loading = 'lazy';
    thumb.append(image);
  } else {
    thumb.textContent = (entry.marker.getElement().getAttribute('aria-label') ?? '?').trim().charAt(0).toUpperCase();
  }
  return thumb;
}

function clusterText(name: string, subtitle?: string | null): HTMLElement {
  const text = document.createElement('span');
  text.className = 'baitly-map-cluster-list__text';
  const title = document.createElement('span');
  title.className = 'baitly-map-cluster-list__name';
  title.textContent = name;
  text.append(title);
  if (subtitle) {
    const line = document.createElement('span');
    line.className = 'baitly-map-cluster-list__meta';
    line.textContent = subtitle;
    text.append(line);
  }
  return text;
}
