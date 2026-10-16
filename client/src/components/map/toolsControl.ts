import type * as maplibregl from 'maplibre-gl';

/**
 * Groupe d'outils propres à l'écran (cadrer les lieux, calques…), empilé dans la colonne
 * des contrôles MapLibre sous le bouton 2D / 3D. Le conteneur est vide : React y rend
 * ses boutons par portail, et le groupe reste invisible tant qu'il n'en a aucun.
 */
export class BaitlyToolsControl implements maplibregl.IControl {
  readonly container = document.createElement('div');

  onAdd(): HTMLElement {
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    return this.container;
  }

  onRemove(): void {
    this.container.remove();
  }
}
