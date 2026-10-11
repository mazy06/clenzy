import type * as maplibregl from 'maplibre-gl';
import i18n from '../../i18n/config';
import { prefersReducedMotion } from './motion';

/** Caméra « 3D » : inclinaison et légère rotation qui révèlent le volume des bâtiments. */
export const PERSPECTIVE_CAMERA = { pitch: 45, bearing: -15 } as const;

/**
 * Bouton 2D / 3D de la barre de navigation : bascule la caméra entre la vue
 * inclinée et la vue à plat (lecture d'un plan, placement précis).
 */
export class BaitlyPerspectiveControl implements maplibregl.IControl {
  private map?: maplibregl.Map;
  private container?: HTMLDivElement;
  private button?: HTMLButtonElement;
  private readonly sync = () => this.render();

  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'baitly-map-perspective';
    this.button.addEventListener('click', () => this.toggle());
    this.container.append(this.button);
    map.on('pitchend', this.sync);
    this.render();
    return this.container;
  }

  onRemove(): void {
    this.map?.off('pitchend', this.sync);
    this.container?.remove();
    this.map = undefined;
  }

  private isTilted(): boolean {
    return (this.map?.getPitch() ?? 0) > 5;
  }

  private toggle(): void {
    if (!this.map) return;
    const camera = this.isTilted() ? { pitch: 0, bearing: 0 } : PERSPECTIVE_CAMERA;
    this.map.easeTo({ ...camera, duration: prefersReducedMotion() ? 0 : 700 });
  }

  private render(): void {
    if (!this.button) return;
    const tilted = this.isTilted();
    // Le bouton affiche la vue vers laquelle il bascule.
    this.button.textContent = tilted ? '2D' : '3D';
    const label = tilted ? i18n.t('baitlyMap.view2d', 'Passer en vue à plat') : i18n.t('baitlyMap.view3d', 'Passer en vue 3D');
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
  }
}
