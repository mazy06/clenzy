import React, { useState, useCallback } from 'react';
import { Box, Tooltip, Typography, ClickAwayListener } from '@mui/material';
import { Lock as LockIcon } from '../../icons';

interface PlanningBlockedBandProps {
  /** Position et taille (px) calculées par le layout du planning. */
  left: number;
  width: number;
  height: number;
  /** Notes éventuelles du blocage (saisie manuelle). */
  notes?: string;
  /** Source du blocage (ex: "ICAL:42", "MANUAL", "AIRBNB"). */
  source?: string;
}

/**
 * Plage bloquée du calendrier rendue comme une bande de cellules **grisées**
 * (hachurées) — et non comme une brique d'événement : un blocage n'est pas un
 * séjour. Au clic, un tooltip explique que la période est indisponible.
 *
 * Le blocage reste présent dans les données (`allEvents`) : le drag-to-select
 * de création de réservation continue de l'éviter.
 */
const PlanningBlockedBand: React.FC<PlanningBlockedBandProps> = ({ left, width, height, notes, source }) => {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
    setOpen((o) => !o);
  }, []);

  const isExternal = !!source && source.toUpperCase().startsWith('ICAL');
  const tooltip = (
    <Box sx={{ py: 0.25 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 0.25 }}>
        Période bloquée
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.35 }}>
        Ces dates sont indisponibles à la réservation.
        {isExternal && ' Synchronisée depuis un calendrier externe (OTA).'}
      </Typography>
      {notes && (
        <Typography sx={{ fontSize: '0.6875rem', mt: 0.5, opacity: 0.85, fontStyle: 'italic' }}>
          {notes}
        </Typography>
      )}
    </Box>
  );

  // Largeur minimale pour afficher l'icône / le label sans tronquer.
  const showIcon = width >= 22;
  const showLabel = width >= 68;

  return (
    <ClickAwayListener onClickAway={close}>
      <Tooltip
        open={open}
        onClose={close}
        title={tooltip}
        arrow
        placement="top"
        // Déclenchement au clic uniquement (pas au survol) — cf. demande produit.
        disableHoverListener
        disableFocusListener
        disableTouchListener
        slotProps={{ tooltip: { sx: { maxWidth: 240 } } }}
      >
        <Box
          data-blocked-range
          role="button"
          tabIndex={0}
          aria-label="Période bloquée — voir le détail"
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle(e);
            }
          }}
          sx={{
            position: 'absolute',
            left,
            top: 0,
            width,
            height,
            zIndex: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            color: 'var(--muted)',
            // Cellules grisées + hachures diagonales = convention « indisponible ».
            backgroundColor: 'color-mix(in srgb, var(--muted) 8%, var(--card))',
            backgroundImage:
              'repeating-linear-gradient(45deg, color-mix(in srgb, var(--muted) 16%, transparent) 0 1px, transparent 1px 7px)',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--muted) 14%, transparent)',
            transition: 'background-color 150ms ease-out',
            '&:hover': {
              backgroundColor: 'color-mix(in srgb, var(--muted) 14%, var(--card))',
            },
          }}
        >
          {showIcon && <LockIcon size={12} strokeWidth={1.75} />}
          {showLabel && (
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Bloqué
            </Typography>
          )}
        </Box>
      </Tooltip>
    </ClickAwayListener>
  );
};

PlanningBlockedBand.displayName = 'PlanningBlockedBand';
export default PlanningBlockedBand;
