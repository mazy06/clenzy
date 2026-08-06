
import { Badge } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import type { CatalogService } from '../../../services/integrations/servicesCatalog';
import ServiceGridCard from './ServiceGridCard';

/**
 * Card du catalogue de services (Insurance, Cleaning, Smart Locks, Activités, Avis…).
 * Délègue au composant partagé {@link ServiceGridCard} — <b>même design que les cartes
 * IoT Tuya/Minut</b> : logo à initiales coloré (40px), pastille (tag commercial Gratuit /
 * Partenaire / Propriétaire… ou statut), description sur une ligne, et tooltip riche
 * construit à partir des données du catalogue (description longue + modalités + lien).
 */

interface ServiceCatalogCardProps {
  service: CatalogService;
  onClick: (service: CatalogService) => void;
}

export default function ServiceCatalogCard({ service, onClick }: ServiceCatalogCardProps) {
  const chip = getChipMeta(service);
  return (
    <ServiceGridCard
      serviceTooltipId={service.id}
      tooltipData={{
        description: service.tooltipDescription,
        accessModality: service.accessModality,
        websiteUrl: service.websiteUrl,
        region: service.region,
        name: service.name,
      }}
      label={service.name}
      description={service.shortDescription}
      role="button"
      onClick={() => onClick(service)}
      logo={
        <div className="size-10 rounded-md inline-flex items-center justify-center shrink-0 text-sm font-bold tracking-tight" style={{ backgroundColor: service.brandColor, color: service.brandTextColor }} aria-hidden="true">
          {getInitials(service.name)}
        </div>
      }
      badge={
        <Badge variant={chip.variant} className={cn('shrink-0', chip.className)}>
          {chip.label}
        </Badge>
      }
    />
  );
}

/** Ton de puce du kit pour chaque tag commercial. */
type ChipMeta = {
  label: string;
  variant: 'secondary' | 'success' | 'warning' | 'info';
  /** La marque n'a pas de variante de puce dédiée : fond doux + encre primaire. */
  className?: string;
};

/** Resout le chip a afficher : prioritise le tag commercial sur le status. */
function getChipMeta(service: { tag?: 'proprietary' | 'free' | 'partner' | 'external'; available: boolean }): ChipMeta {
  if (service.tag === 'proprietary') {
    return { label: 'Propriétaire', variant: 'secondary', className: 'bg-primary-soft text-primary' };
  }
  if (service.tag === 'free') return { label: 'Gratuit', variant: 'success' };
  if (service.tag === 'partner') return { label: 'Partenaire', variant: 'info' };
  if (service.tag === 'external') return { label: 'Externe', variant: 'warning' };
  return service.available
    ? { label: 'Configurable', variant: 'success' }
    : { label: 'Bientôt', variant: 'secondary' };
}

/** Extrait les 2 premieres lettres significatives du nom (skip parentheses). */
function getInitials(name: string): string {
  const clean = name.replace(/\(.*?\)/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
