// Helpers de présentation purs partagés par ServiceRequestsList et ses vues
// (carte / liste). Aucun effet de bord.

/**
 * Retire le suffixe " — {propertyName}" ou " - {propertyName}" du titre.
 * Evite la redondance quand le nom de propriete est deja affiche dans sa
 * propre colonne.
 */
export function stripPropertySuffix(title: string, propertyName?: string): string {
  if (!propertyName) return title;
  const patterns = [` — ${propertyName}`, ` - ${propertyName}`, ` -- ${propertyName}`];
  for (const p of patterns) {
    if (title.endsWith(p)) return title.slice(0, -p.length).trim();
  }
  return title;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatPrice(price: number | undefined, symbol: string): string {
  if (price === undefined || price === null) return '—';
  return `${price}${symbol}`;
}
