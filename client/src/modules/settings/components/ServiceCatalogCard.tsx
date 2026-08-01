
import StatusChip from '../../../components/StatusChip';
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
        <div className="w-[40px] h-[40px] rounded-[8px] inline-flex items-center justify-center shrink-0 text-[0.85rem] font-bold tracking-[-0.02em]" style={{ backgroundColor: service.brandColor, color: service.brandTextColor }} aria-hidden="true">
          {getInitials(service.name)}
        </div>
      }
      badge={
        <StatusChip
          tokens={{ color: chip.color, bg: `color-mix(in srgb, ${chip.color} 8%, transparent)` }}
          label={chip.label}
          className="border border-solid tracking-[0.01em]"
          sx={{ borderColor: `color-mix(in srgb, ${chip.color} 20%, transparent)` }}
        />
      }
    />
  );
}

/** Resout le chip a afficher : prioritise le tag commercial sur le status. */
function getChipMeta(service: { tag?: 'proprietary' | 'free' | 'partner' | 'external'; available: boolean }): { label: string; color: string } {
  const ACCENT_LOCAL = 'var(--ok)';
  const NEUTRAL_LOCAL = 'var(--muted)';
  const WARM_LOCAL = 'var(--warn)';
  const INFO_LOCAL = 'var(--info)';
  const PRIMARY_LOCAL = 'var(--accent)';

  if (service.tag === 'proprietary') return { label: 'Propriétaire', color: PRIMARY_LOCAL };
  if (service.tag === 'free') return { label: 'Gratuit', color: ACCENT_LOCAL };
  if (service.tag === 'partner') return { label: 'Partenaire', color: INFO_LOCAL };
  if (service.tag === 'external') return { label: 'Externe', color: WARM_LOCAL };
  return service.available
    ? { label: 'Configurable', color: ACCENT_LOCAL }
    : { label: 'Bientôt', color: NEUTRAL_LOCAL };
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
