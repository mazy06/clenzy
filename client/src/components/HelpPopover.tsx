import React, { useCallback, useId, useState } from 'react';
import { Box, Typography, IconButton, Popover, Tooltip } from '@mui/material';
import { Info as InfoIcon } from '../icons';
import { HelpStepsGrid, type HelpStep } from './HelpBanner';

interface HelpPopoverProps {
  title: string;
  description: string;
  steps?: HelpStep[];
  /** Libellé accessible du bouton (tooltip + aria-label). */
  label?: string;
}

/**
 * Déclencheur d'aide contextuelle — icône ⓘ discrète qui, au clic, ouvre un
 * popover portant le même contenu qu'un {@link HelpBanner} (chip AIDE + titre +
 * description + étapes). Remplace le bandeau permanent : l'aide ne mange plus
 * d'espace vertical mais reste accessible à la demande, sans état "dismissed" à
 * persister.
 *
 * Placement type : porté dans le slot actions du PageHeader d'une page
 * multi-onglets (via {@link usePageHeaderActions}) ou dans les actions d'un
 * header custom (ex. SyncAdmin) — un ⓘ par onglet, à côté du titre.
 *
 * <h2>Design rules appliquées</h2>
 * <ul>
 *   <li>Icône Lucide (pas d'emoji), `cursor: pointer`, focus clavier visible.</li>
 *   <li>Popover : filet 1 px en haut (accent), soft brand wash — pas de
 *   glassmorphism ni de side-stripe.</li>
 *   <li>Étapes en colonne unique (lecture verticale) via {@link HelpStepsGrid}.</li>
 *   <li>`prefers-reduced-motion` respecté par la transition MUI par défaut.</li>
 * </ul>
 */
const HelpPopover: React.FC<HelpPopoverProps> = ({
  title,
  description,
  steps = [],
  label = 'Aide',
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const panelId = useId();
  const open = Boolean(anchorEl);

  const handleOpen = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  return (
    <>
      <Tooltip title={label} arrow>
        <IconButton
          size="small"
          onClick={handleOpen}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          sx={{
            cursor: 'pointer',
            color: open ? 'var(--accent)' : 'var(--faint)',
            bgcolor: open ? 'var(--accent-soft)' : 'transparent',
            p: 0.5,
            borderRadius: '9px',
            transition: 'color .18s ease, background-color .18s ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            '&:hover': { color: 'var(--accent)', bgcolor: 'var(--accent-soft)' },
          }}
        >
          <InfoIcon size={18} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>

      <Popover
        id={panelId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': title,
            sx: {
              position: 'relative',
              mt: 0.75,
              width: { xs: 'calc(100vw - 32px)', sm: 420 },
              maxWidth: 460,
              borderRadius: '14px',
              border: '1px solid var(--line)',
              bgcolor: 'var(--card)',
              backgroundImage:
                'radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--accent) 4%, transparent) 0%, transparent 60%)',
              boxShadow: '0 12px 32px -8px color-mix(in srgb, var(--ink) 22%, transparent)',
              overflow: 'hidden',
              p: { xs: 1.75, sm: 2.25 },
              // Single allowed filet — 1 px top accent (pas un side-stripe).
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '1px',
                bgcolor: 'var(--accent)',
                opacity: 0.5,
              },
            },
          },
        }}
      >
        {/* Header — chip AIDE + titre */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
          <Box
            sx={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              bgcolor: 'var(--accent-soft)',
              border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              borderRadius: '8px',
              px: 0.75,
              py: 0.25,
              mt: 0.25,
              flexShrink: 0,
              lineHeight: 1.2,
            }}
            aria-hidden
          >
            AIDE
          </Box>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--ink)',
              lineHeight: 1.3,
              letterSpacing: '-.01em',
              flex: 1,
              textWrap: 'balance',
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* Description */}
        <Typography
          sx={{
            fontSize: '12.5px',
            color: 'var(--muted)',
            lineHeight: 1.55,
            mb: steps.length > 0 ? 2 : 0,
          }}
        >
          {description}
        </Typography>

        {/* Étapes — colonne unique pour une lecture verticale dans le popover */}
        <HelpStepsGrid steps={steps} columns={1} />
      </Popover>
    </>
  );
};

export default HelpPopover;
