/**
 * Vue du menu Carte — un onglet de l'écran (`?tab=`, registre
 * `config/screenTabs.tsx`) : ce que montrent la liste, les épingles et le bas de la fiche.
 */
export type PropertyMapView = 'properties' | 'prestations' | 'reservations' | 'issues';

const VIEWS: readonly PropertyMapView[] = ['properties', 'prestations', 'reservations', 'issues'];

export function parsePropertyMapView(value: string | null | undefined): PropertyMapView {
  return VIEWS.includes(value as PropertyMapView) ? (value as PropertyMapView) : 'properties';
}
