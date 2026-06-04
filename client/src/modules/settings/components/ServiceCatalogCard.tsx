import { Box, Chip } from '@mui/material';
import type { CatalogService } from '../../../services/integrations/servicesCatalog';
import ServiceGridCard, { buildStatusChipSx } from './ServiceGridCard';

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
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '8px',
            backgroundColor: service.brandColor,
            color: service.brandTextColor,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
          aria-hidden="true"
        >
          {getInitials(service.name)}
        </Box>
      }
      badge={<Chip label={chip.label} size="small" sx={buildStatusChipSx(chip.color)} />}
    />
  );
}

/** Resout le chip a afficher : prioritise le tag commercial sur le status. */
function getChipMeta(service: { tag?: 'proprietary' | 'free' | 'partner' | 'external'; available: boolean }): { label: string; color: string } {
  const ACCENT_LOCAL = '#4A9B8E';
  const NEUTRAL_LOCAL = '#8A8378';
  const WARM_LOCAL = '#D4A574';
  const INFO_LOCAL = '#7BA3C2';
  const PRIMARY_LOCAL = '#6B8A9A';

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
