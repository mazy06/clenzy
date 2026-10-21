import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaitlyMapCanvas, type PropertyMarker } from '../BaitlyMapCanvas';
import { MapSheetProvider } from '../map/MapSheetContext';
import { MapCardCoordinator } from '../map/MapCardCoordinator';
import {baitlyDirectoryGlyphs} from '../../config/baitlyDirectoryGlyphs';
import { useState } from 'react';

const state = vi.hoisted(() => ({ markers: [] as Array<{ element: HTMLElement; removed: number }>, attribution: false }));
const tileState=vi.hoisted(()=>({created:vi.fn(),disposed:vi.fn()}));
vi.mock('../map/BaitlyDirectoryTiles',()=>({BaitlyDirectoryTiles:class{constructor(){tileState.created();}dispose(){tileState.disposed();}}}));
const container = document.createElement('div');
const map = {
  on: vi.fn(), off: vi.fn(), remove: vi.fn(),
  addControl: vi.fn((control: { onAdd: () => HTMLElement }) => document.body.append(control.onAdd())),
  removeControl: vi.fn((control: { onRemove: () => void }) => control.onRemove()), resize: vi.fn(), jumpTo: vi.fn(), fitBounds: vi.fn(),
  getContainer: () => container, getZoom: () => 20,
  getCenter: () => ({ lng: 51.5, lat: 25.3 }), getBearing: () => 0, getPitch: () => 0, easeTo: vi.fn(),
  getBounds: () => ({ getNorth: () => 90, getSouth: () => -90, getEast: () => 180, getWest: () => -180 }),
  project: () => ({ x: 120, y: 100 }),
  getLayer: vi.fn(),
};

vi.mock('../map/createBaitlyMap', () => ({ createBaitlyMap: ({container:host}:{container:HTMLElement}) => {
  if(state.attribution)host.innerHTML='<details class="maplibregl-ctrl-attrib maplibregl-compact"><summary>Informations carte</summary><div class="maplibregl-ctrl-attrib-inner">BaitlyMap · OpenStreetMap</div></details>';
  return map;
}, setBaitlyMapMode: vi.fn(), prefersReducedMotion: () => true }));
vi.mock('../map/keepPopupInView', () => ({ keepPopupInView: () => () => undefined }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: unknown) => typeof fallback === 'string' ? fallback : 'Lieux' }) }));
vi.mock('maplibre-gl', () => {
  class Popup {
    options: Record<string, unknown>;
    private opened = false;
    private listeners = new Map<string, Array<() => void>>();
    private content?: HTMLElement;
    constructor(options: Record<string, unknown>) { this.options = options; }
    setDOMContent(content: HTMLElement) { this.content = content; return this; }
    setLngLat() { return this; }
    addTo() { if (this.content) container.append(this.content); return this; }
    remove() { this.content?.remove(); return this; }
    on(event: string, callback: () => void) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]); return this; }
    once(event: string, callback: () => void) { return this.on(event, callback); }
    isOpen() { return this.opened; }
    toggle() { this.opened = !this.opened; this.listeners.get(this.opened ? 'open' : 'close')?.forEach((listener) => listener()); }
  }
  class Marker {
    element: HTMLElement;
    removed = 0;
    private attached = false;
    private popup?: Popup;
    private position = { lng: 0, lat: 0 };
    constructor({ element }: { element: HTMLElement }) { this.element = element; state.markers.push(this); }
    setLngLat([lng, lat]: [number, number]) { this.position = { lng, lat }; return this; }
    getLngLat() { return this.position; }
    setPopup(popup: Popup) { this.popup = popup; return this; }
    getPopup() { return this.popup; }
    getElement() { return this.element; }
    addTo() { this.attached = true; container.append(this.element); return this; }
    remove() { this.attached = false; this.removed++; this.element.remove(); return this; }
    togglePopup() {
      if (this.popup && !this.popup.isOpen() && !this.attached) throw new TypeError('Popup opened on a detached marker');
      this.popup?.toggle(); return this;
    }
  }
  return { Marker, Popup, LngLatBounds: class { extend() { return this; } } };
});

const place: PropertyMarker = { id: 1, name: 'Doha', lat: 25.2854, lng: 51.531 };

beforeEach(() => {
  vi.clearAllMocks();
  state.markers.length = 0;
  state.attribution = false;
  container.replaceChildren();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Carte Baitly : rafraîchissements et caméra', () => {
  it('keeps the vector source through load completion and selection rerenders',()=>{
    const options={url:'https://api.baitly.test/tiles/{z}/{x}/{y}',onReference:vi.fn(),onError:vi.fn()};
    const view=render(<BaitlyMapCanvas properties={[]} directoryTiles={options}/>);
    expect(tileState.created).toHaveBeenCalledTimes(1);
    const load=map.on.mock.calls.find(([event])=>event==='load')![1];act(()=>load());
    view.rerender(<BaitlyMapCanvas properties={[]} directoryTiles={{...options,onReference:vi.fn()}} highlightedPropertyId={1}/>);
    expect(tileState.created).toHaveBeenCalledTimes(1);expect(tileState.disposed).not.toHaveBeenCalled();
    view.unmount();expect(tileState.disposed).toHaveBeenCalledTimes(1);
  });
  it('renders full database counts without regrouping them as individual businesses and zooms into their true bounds',()=>{
    const clicked=vi.fn();
    const group:PropertyMarker={id:-1_000_000_000_001,name:'50000 professionnels',type:'directory_cluster',clusterCount:50000,clusterBounds:[4,44,6,46],lat:45,lng:5};
    render(<BaitlyMapCanvas properties={[group]} center={[2,46]} onMarkerClick={clicked}/>);
    const circle=container.querySelector<HTMLElement>('.baitly-map-cluster')!;
    expect(circle.dataset.count).toBe('50000');expect(circle).toHaveTextContent('50k+');
    fireEvent.click(circle);
    expect(map.fitBounds).toHaveBeenCalledWith([[4,44],[6,46]],expect.objectContaining({maxZoom:16}));
    expect(clicked).not.toHaveBeenCalled();
  });
  it('affiche un palier compact tout en conservant le véritable effectif du groupe',()=>{
    const companies=Array.from({length:125},(_,index)=>({...place,id:index+1,name:`Entreprise ${index+1}`}));
    render(<BaitlyMapCanvas properties={companies} center={[51.5,25.3]}/>);
    const group=container.querySelector<HTMLElement>('.baitly-map-cluster')!;
    expect(group).toHaveTextContent('100+');expect(group.dataset.count).toBe('125');
    const diameter=Number.parseInt(group.style.getPropertyValue('--cluster-size'));
    expect(diameter).toBeGreaterThan(32);expect(diameter).toBeLessThanOrEqual(64);
    const hiddenPins=state.markers.filter(marker=>marker.element.dataset.mapPropertyId);
    expect(hiddenPins.every(marker=>marker.element.childElementCount===0)).toBe(true);
    fireEvent.click(group);fireEvent.click(container.querySelector('.baitly-map-cluster-list button')!);
    expect(hiddenPins.some(marker=>marker.element.querySelector('svg'))).toBe(true);
  });
  it('réutilise les cercles conservés lors d’une mise à jour des entreprises',()=>{
    const places=[place,{...place,id:2,name:'Entreprise voisine'}];
    const view=render(<BaitlyMapCanvas properties={places} center={[51.5,25.3]}/>);
    const circle=container.querySelector('.baitly-map-cluster');expect(circle).not.toBeNull();
    view.rerender(<BaitlyMapCanvas properties={places.map(row=>({...row,name:`${row.name} actualisée`}))} center={[51.5,25.3]}/>);
    expect(container.querySelector('.baitly-map-cluster')).toBe(circle);
    expect(container.contains(circle)).toBe(true);
  });
  it('limite les repères visibles en conservant toujours l’entreprise sélectionnée',()=>{
    const companies=Array.from({length:350},(_,index)=>({...place,id:index+1,lat:place.lat+index/100,name:`Entreprise ${index+1}`}));
    render(<BaitlyMapCanvas properties={companies} center={[51.5,25.3]} selectedPropertyId={350}/>);
    expect(container.querySelectorAll('.baitly-map-pin')).toHaveLength(300);
    expect(container.querySelector('[data-map-property-id="350"]')).toHaveAttribute('aria-pressed','true');
  });
  it('réutilise les données lors d’une sélection puis recherche à nouveau sur un déplacement manuel', () => {
    const changed=vi.fn(),coverage=vi.fn(),properties=[place];
    const view=render(<BaitlyMapCanvas properties={properties} center={[51.5,25.3]} onBoundsChange={changed} onCoverageBoundsChange={coverage}/>);
    changed.mockClear();coverage.mockClear();
    const moveEnd=map.on.mock.calls.find(([event])=>event==='moveend')![1];
    const moveStart=map.on.mock.calls.find(([event])=>event==='movestart')![1];
    view.rerender(<BaitlyMapCanvas properties={properties} center={[51.5,25.3]} onBoundsChange={changed} onCoverageBoundsChange={coverage} selectedPropertyId={1} locateProperty={{id:1,request:1}}/>);
    act(()=>moveEnd());
    expect(changed).not.toHaveBeenCalled();
    expect(coverage).toHaveBeenCalledTimes(1);
    expect(state.markers[0].element).toHaveAttribute('aria-pressed','true');
    act(()=>{moveStart({originalEvent:new Event('wheel')});moveEnd();});
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it('ne relance pas de recherche pour le recadrage d’une fiche ouverte depuis une épingle',()=>{
    const changed=vi.fn();
    render(<BaitlyMapCanvas properties={[place]} center={[51.5,25.3]} onBoundsChange={changed}/>);
    changed.mockClear();fireEvent.click(state.markers[0].element);
    const moveEnd=map.on.mock.calls.find(([event])=>event==='moveend')![1];
    act(()=>moveEnd());expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Voir tous les lieux'}));
    act(()=>moveEnd());expect(changed).toHaveBeenCalledTimes(1);
  });
  it('rattache une entreprise regroupée avant d’ouvrir sa fiche depuis la liste', () => {
    const second = { ...place, id: 2, name: 'Entreprise voisine' };
    const properties = [place, second];
    const view = render(<BaitlyMapCanvas properties={properties} center={[51.5, 25.3]} />);
    const pin = state.markers.find(marker => marker.element.dataset.mapPropertyId === '2')!;
    expect(container.contains(pin.element)).toBe(false);
    view.rerender(<BaitlyMapCanvas properties={properties} center={[51.5, 25.3]} selectedPropertyId={2} locateProperty={{id:2,request:1}} />);
    expect(container.contains(pin.element)).toBe(true);
    expect(pin.element).toHaveAttribute('aria-pressed', 'true');
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({center:[second.lng,second.lat]}));
  });
  it('partage la bulle des crédits avec la légende métier et préserve son portail lors du rafraîchissement des crédits', () => {
    state.attribution=true;
    const view=render(<BaitlyMapCanvas properties={[]} mapInfo={<p>Propriétaires, conciergeries, prestataires</p>} />);
    const legend=screen.getByText('Propriétaires, conciergeries, prestataires');
    const bubble=legend.closest('details')!;
    expect(bubble).toHaveTextContent('BaitlyMap · OpenStreetMap');
    expect(bubble.querySelector('.maplibregl-ctrl-attrib-inner')).not.toContainElement(legend);
    bubble.querySelector('.maplibregl-ctrl-attrib-inner')!.textContent='BaitlyMap · © OpenStreetMap · © Mapterhorn';
    view.rerender(<BaitlyMapCanvas properties={[]} mapInfo={<p>Nouvelle légende</p>} />);
    expect(bubble).toHaveTextContent('Nouvelle légende');
    expect(bubble).toHaveTextContent('© Mapterhorn');
    const slot=bubble.querySelector('.baitly-map-info-content')!;
    view.unmount();expect(slot.isConnected).toBe(false);
  });
  it('met en évidence un marqueur depuis la liste et localise un lieu regroupé sans quitter la carte', () => {
    const second = { ...place, id: 2, name: 'Deuxième logement' };
    const { rerender } = render(<BaitlyMapCanvas properties={[place, second]} center={[51.5, 25.3]} />);
    rerender(<BaitlyMapCanvas properties={[place, second]} center={[51.5, 25.3]} highlightedPropertyId={2} />);
    const pin = state.markers.find(marker => marker.element.dataset.mapPropertyId === '2')!;
    expect(pin.element.hasAttribute('data-highlighted')).toBe(true);
    expect(container.contains(pin.element)).toBe(true);
    rerender(<BaitlyMapCanvas properties={[place, second]} center={[51.5, 25.3]} locateProperty={{ id: 2, request: 1 }} />);
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [second.lng, second.lat] }));
    expect(pin.element.getAttribute('aria-pressed')).toBe('true');
  });
  it('restaure et émet le cadrage sans recréer la carte', () => {
    const changed = vi.fn();
    const camera = { center: [2.3, 48.8] as [number, number], zoom: 13, bearing: 20, pitch: 30 };
    render(<BaitlyMapCanvas properties={[place]} camera={camera} onCameraChange={changed} />);
    expect(map.jumpTo).toHaveBeenCalledWith(camera);
    act(() => map.on.mock.calls.find(([event]) => event === 'moveend')?.[1]());
    expect(changed).toHaveBeenCalledWith({ center: [51.5, 25.3], zoom: 20, bearing: 0, pitch: 0 });
    expect(map.remove).not.toHaveBeenCalled();
  });
  it('réutilise les anneaux de sélection pour plusieurs marqueurs',()=>{
    const second={...place,id:-2,name:'Prestataire national'};
    const view=render(<BaitlyMapCanvas properties={[place,second]} highlightedPropertyIds={[place.id!,-2]}/>);
    expect(state.markers.filter(marker=>marker.element.hasAttribute('data-highlighted'))).toHaveLength(2);
    view.rerender(<BaitlyMapCanvas properties={[place,second]} highlightedPropertyIds={[-2]}/>);
    expect(state.markers.filter(marker=>marker.element.hasAttribute('data-highlighted'))).toHaveLength(1);
  });
  it('conserve la carte régionale quand seul le fond mondial est indisponible', () => {
    render(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    const errorHandler = map.on.mock.calls.find(([event]) => event === 'error')?.[1];
    const loadHandler = map.on.mock.calls.find(([event]) => event === 'load')?.[1];
    act(() => { errorHandler({ sourceId: 'baitly-world', error: new Error('HTTP 403') }); loadHandler(); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Carte régionale affichée');
    expect(state.markers[0].removed).toBe(0);
    expect(map.remove).not.toHaveBeenCalled();
  });

  it('signale toujours un échec du fond régional même si le fond mondial échoue aussi', () => {
    render(<BaitlyMapCanvas properties={[place]} />);
    const errorHandler = map.on.mock.calls.find(([event]) => event === 'error')?.[1];
    act(() => { errorHandler({ sourceId: 'protomaps', error: new Error('HTTP 403') }); errorHandler({ sourceId: 'baitly-world', error: new Error('HTTP 403') }); });
    expect(screen.getByRole('alert').textContent).toContain('Le fond de carte');
  });

  it('met à jour les états et les callbacks sans recréer le marqueur ni recadrer', () => {
    const clicked = vi.fn();
    const { rerender } = render(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} onMarkerClick={clicked} />);
    const marker = state.markers[0];
    map.fitBounds.mockClear();
    map.jumpTo.mockClear();
    const refreshed = { ...place, state: 'late' as const, name: 'Doha, maintenance' };
    rerender(<BaitlyMapCanvas properties={[refreshed]} center={[51.5, 25.3]} onMarkerClick={clicked} />);
    expect(state.markers).toHaveLength(1);
    expect(marker.removed).toBe(0);
    expect(marker.element.dataset.state).toBe('late');
    fireEvent.click(marker.element);
    expect(clicked).toHaveBeenCalledWith(refreshed);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it('ne dépend pas de load pour afficher les marqueurs arrivés après le montage', () => {
    const { rerender } = render(<BaitlyMapCanvas properties={[]} center={[51.5, 25.3]} />);
    rerender(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    expect(state.markers).toHaveLength(1);
    expect(container.querySelector('[aria-label="Doha"]')).not.toBeNull();
  });

  it('cadre tous les lieux uniquement sur une demande explicite quand le centre utilisateur est connu', () => {
    render(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    expect(map.fitBounds).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Voir tous les lieux' }));
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('rend le détail mobile dans la feuille plutôt que dans une bulle sur la carte', () => {
    const detailHost = document.createElement('div');
    document.body.append(detailHost);
    const openDetail = vi.fn();
    render(<MapSheetProvider value={{ detailHost, detailOpen: true, openDetail, closeDetail: vi.fn() }}>
      <BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} renderPopup={(marker) => <p>{marker.name} détail</p>} />
    </MapSheetProvider>);
    fireEvent.click(state.markers[0].element);
    expect(openDetail).toHaveBeenCalledTimes(1);
    expect(detailHost.textContent).toBe('Doha détail');
    detailHost.remove();
  });

  it('garde la fiche mobile ouverte lorsque le parent synchronise le contact sélectionné', () => {
    const detailHost = document.createElement('div');
    document.body.append(detailHost);
    const closeDetail = vi.fn();
    function ControlledMap() {
      const [selected, setSelected] = useState<number>();
      return <MapCardCoordinator><MapSheetProvider value={{ detailHost, detailOpen: true, openDetail: vi.fn(), closeDetail }}>
        <BaitlyMapCanvas properties={[place]} selectedPropertyId={selected} onMarkerClick={marker => setSelected(marker.id)}
          renderPopup={marker => <p>{marker.name} détail</p>} />
      </MapSheetProvider></MapCardCoordinator>;
    }
    render(<ControlledMap />);
    fireEvent.click(state.markers[0].element);
    expect(detailHost.textContent).toBe('Doha détail');
    expect(closeDetail).not.toHaveBeenCalled();
    expect(state.markers[0].element).toHaveAttribute('aria-pressed', 'true');
    detailHost.remove();
  });

  it('conserve le cadrage demandé même si la localisation arrive ensuite', () => {
    const { rerender } = render(<BaitlyMapCanvas properties={[place]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir tous les lieux' }));
    map.jumpTo.mockClear();
    rerender(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it('rend sélectionnables deux missions exactement au même point, même à fort zoom', () => {
    const clicked = vi.fn();
    const second = { ...place, id: 2, name: 'Doha, seconde mission' };
    render(<BaitlyMapCanvas properties={[place, second]} center={[51.5, 25.3]} onMarkerClick={clicked} />);
    const cluster = container.querySelector('.baitly-map-cluster');
    expect(cluster).not.toBeNull();
    fireEvent.click(cluster as HTMLElement);
    const choices = container.querySelectorAll('.baitly-map-cluster-list button');
    expect(choices).toHaveLength(2);
    fireEvent.click(choices[1]);
    expect(clicked).toHaveBeenCalledWith(second);
  });
});

it('updates a professional pin from maintenance to laundry without keeping the old glyph or recreating its marker',()=>{
 const professional={...place,type:'crm_provider' as const,glyph:baitlyDirectoryGlyphs.MAINTENANCE};
 const view=render(<BaitlyMapCanvas properties={[professional]} center={[51.5,25.3]}/>);const marker=state.markers[0];
 const maintenance=marker.element.querySelector('svg g')?.innerHTML;map.fitBounds.mockClear();
 view.rerender(<BaitlyMapCanvas properties={[{...professional,glyph:baitlyDirectoryGlyphs.LAUNDRY}]} center={[51.5,25.3]}/>);
 expect(state.markers).toHaveLength(1);expect(marker.removed).toBe(0);expect(marker.element.querySelector('svg g')?.innerHTML).not.toBe(maintenance);
 const expected=document.createElementNS('http://www.w3.org/2000/svg','g');expected.innerHTML=baitlyDirectoryGlyphs.LAUNDRY.body;
 expect(marker.element.querySelector('svg g')?.innerHTML).toBe(expected.innerHTML);expect(map.fitBounds).not.toHaveBeenCalled();
});
