import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { Box } from '@mui/material';
import { Card } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { CheckCircle as CheckCircleIcon, ErrorOutline } from '../../../icons';
import { Settings2 } from 'lucide-react';
import ProviderLogo, { type ProviderId } from './ProviderLogos';
import ServiceTooltip from './ServiceTooltip';
import type { ServiceTooltipData } from '../../../services/integrations/serviceTooltips';

/**
 * Carte de service unifiée de l'onglet Intégrations — <b>même design que les cartes IoT</b>
 * (Tuya/Minut) : {@link Paper} compacte, rangée [logo 40px + (titre + pastille de statut +
 * description sur une ligne)] enveloppée dans {@link ServiceTooltip} (détails riches du service),
 * avec une affordance d'action à droite. La carte entière est cliquable (ouvre la config).
 *
 * Présentationnel : aucune logique métier. Le parent fournit l'état (status/selected) et l'action.
 */

const ACCENT = 'var(--ok)';
const NEUTRAL = 'var(--muted)';
const WARM = 'var(--warn)';

export const buildStatusChipSx = (color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '6px',
  px: 0.25,
  backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
  color,
  border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
  '& .MuiChip-icon': { color: `${color} !important`, ml: '6px', mr: '-2px' },
  '& .MuiChip-label': { px: 0.875 },
});

export type ServiceCardStatus = 'connected' | 'idle' | 'comingSoon';

interface ServiceGridCardProps {
  /** Clé logo + tooltip (cf. ProviderLogos / SERVICE_TOOLTIPS). Optionnel si {@link logo} est fourni. */
  providerId?: ProviderId;
  /** Logo custom (sinon ProviderLogo via providerId). */
  logo?: React.ReactNode;
  /** Clé SERVICE_TOOLTIPS pour le tooltip riche (défaut : providerId). */
  serviceTooltipId?: string;
  label: string;
  description: string;
  status?: ServiceCardStatus;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Élément rendu après le titre (ex: drapeau pays, badge QTSP). */
  titleAdornment?: React.ReactNode;
  /** Chip custom dans le titre, à la place de la pastille de statut (ex: tag commercial du catalogue). */
  badge?: React.ReactNode;
  /** Données de tooltip riche (override SERVICE_TOOLTIPS) pour les services du catalogue. */
  tooltipData?: ServiceTooltipData & { name?: string };
  role?: 'radio' | 'button';
  /** Actions custom (icônes) rendues à droite À LA PLACE du chevron (ex: config + connexion, comme les cartes IoT). */
  actions?: React.ReactNode;
}

export default function ServiceGridCard({
  providerId,
  logo,
  serviceTooltipId,
  label,
  description,
  status = 'idle',
  selected = false,
  disabled = false,
  onClick,
  titleAdornment,
  badge,
  tooltipData,
  role = 'button',
  actions,
}: ServiceGridCardProps) {
  const statusChip =
    status === 'connected' ? (
      <StatusChip color={ACCENT} label="Connecté" icon={<CheckCircleIcon size={11} strokeWidth={2} />} />
    ) : status === 'comingSoon' ? (
      <StatusChip color={NEUTRAL} label="Bientôt disponible" />
    ) : (
      <StatusChip color={NEUTRAL} label="Non connecté" icon={<ErrorOutline size={11} strokeWidth={2} />} />
    );

  const infoZone = (
    <div className="flex items-start gap-2 flex-1 min-w-0">
      {logo ?? (providerId ? <ProviderLogo provider={providerId} size={40} muted={disabled} /> : null)}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="cn-text-body1 text-[0.875rem] font-semibold">{label}</p>
          {titleAdornment}
          {badge ?? statusChip}
        </div>
        <p className="cn-text-body1 truncate text-[0.72rem] text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );

  const tooltipId = serviceTooltipId ?? providerId;
  const interactive = !disabled && !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      role={role}
      aria-checked={role === 'radio' ? selected : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      // L'etat selectionne et le survol sont des ETATS : ils passent par des
      // classes conditionnelles, pas par un sx recalcule a chaque rendu.
      className={cn(
        'gap-0 overflow-hidden py-0 outline-none transition-[border-color,box-shadow] duration-200',
        selected ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-border bg-card',
        interactive ? 'cursor-pointer' : 'cursor-default',
        !disabled && [
          'hover:border-[color-mix(in_srgb,var(--accent)_25%,transparent)] hover:shadow-[var(--shadow-card)]',
          'focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]',
        ],
      )}
    >
      <div className="px-3 py-2.5 flex items-start gap-1.5">
        {tooltipId || tooltipData ? (
          <ServiceTooltip providerId={tooltipId ?? label} data={tooltipData} name={label}>
            {infoZone}
          </ServiceTooltip>
        ) : (
          infoZone
        )}
        {actions ? (
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        ) : interactive && status !== 'comingSoon' ? (
          // Affordance par défaut (remplace l'ancien chevron) : engrenage de config,
          // teinté selon l'état — warm tant que non configuré, neutre une fois connecté
          // (même langage visuel que les cartes IoT / WhatsApp). La carte entière reste
          // cliquable ; l'icône est purement visuelle.
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              mt: 0.25,
              color: status === 'connected' ? 'text.secondary' : WARM,
            }}
          >
            <Settings2 size={18} strokeWidth={2} />
          </Box>
        ) : null}
      </div>
    </Card>
  );
}
