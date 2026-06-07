import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
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

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';
const WARM = '#D4A574';

export const buildStatusChipSx = (color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '6px',
  px: 0.25,
  backgroundColor: `${color}14`,
  color,
  border: `1px solid ${color}33`,
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
      <Chip icon={<CheckCircleIcon size={11} strokeWidth={2} />} label="Connecté" size="small" sx={buildStatusChipSx(ACCENT)} />
    ) : status === 'comingSoon' ? (
      <Chip label="Bientôt disponible" size="small" sx={buildStatusChipSx(NEUTRAL)} />
    ) : (
      <Chip icon={<ErrorOutline size={11} strokeWidth={2} />} label="Non connecté" size="small" sx={buildStatusChipSx(NEUTRAL)} />
    );

  const infoZone = (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 0 }}>
      {logo ?? (providerId ? <ProviderLogo provider={providerId} size={40} muted={disabled} /> : null)}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</Typography>
          {titleAdornment}
          {badge ?? statusChip}
        </Box>
        <Typography noWrap sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
    </Box>
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
    <Paper
      elevation={0}
      role={role}
      aria-checked={role === 'radio' ? selected : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      sx={{
        borderRadius: '12px',
        border: '1px solid',
        borderColor: selected ? ACCENT : 'divider',
        backgroundColor: selected ? `${ACCENT}0A` : 'background.paper',
        boxShadow: 'none',
        overflow: 'hidden',
        outline: 'none',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        ...(disabled
          ? {}
          : {
              '&:hover': {
                borderColor: `${ACCENT}40`,
                boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 12px rgba(45, 55, 72, 0.06)',
              },
              '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
            }),
      }}
    >
      <Box sx={{ px: 2, py: 1.75, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {tooltipId || tooltipData ? (
          <ServiceTooltip providerId={tooltipId ?? label} data={tooltipData} name={label}>
            {infoZone}
          </ServiceTooltip>
        ) : (
          infoZone
        )}
        {actions ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </Box>
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
      </Box>
    </Paper>
  );
}
