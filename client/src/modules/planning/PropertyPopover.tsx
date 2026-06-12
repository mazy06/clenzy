import React from 'react';
import { Box, Button, Popover, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Business, LocationOn, Close, Visibility } from '../../icons';
import type { PlanningProperty } from './types';

// ─── Popover logement (maquette Signature) ───────────────────────────────────
//
// Carte ~270px ouverte au clic sur le nom du logement (colonne) : héro
// radius 10 fond var(--accent-soft) avec icône bâtiment var(--accent) et nom
// en overlay ; lignes uniquement pour les données déjà présentes sur l'objet
// PlanningProperty (Occupation / ADR / Revenu n'y existent pas → omises) ;
// pied : « Fermer » + « Voir la fiche » (route fiche propriété existante).

const ICON_SIZE = 13;

interface PropertyPopoverProps {
  anchorEl: HTMLElement;
  property: PlanningProperty;
  onClose: () => void;
}

const PropertyPopover: React.FC<PropertyPopoverProps> = ({ anchorEl, property, onClose }) => {
  const navigate = useNavigate();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const address = [property.address, property.city].filter(Boolean).join(', ');

  return (
    <Popover
      open
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      transitionDuration={reduceMotion ? 0 : undefined}
      slotProps={{
        paper: {
          sx: {
            width: 270,
            borderRadius: '14px',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-pop)',
            backgroundColor: 'var(--card)',
            backgroundImage: 'none',
            overflow: 'hidden',
            ml: 1,
          },
        },
      }}
    >
      {/* Héro : fond accent-soft, icône bâtiment, nom en overlay */}
      <Box
        sx={{
          position: 'relative',
          m: '10px',
          height: 72,
          borderRadius: '10px',
          backgroundColor: 'var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'inline-flex', color: 'var(--accent)', opacity: 0.55, mb: '14px' }}>
          <Business size={26} strokeWidth={1.5} />
        </Box>
        <Box
          component="span"
          sx={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 7,
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {property.name}
        </Box>
      </Box>

      {/* Lignes — uniquement les données existantes */}
      {address && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            px: '14px',
            py: '8px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <Box sx={{ display: 'inline-flex', color: 'var(--muted)', flexShrink: 0, mt: '1px' }}>
            <LocationOn size={ICON_SIZE} strokeWidth={1.75} />
          </Box>
          <Box component="span" sx={{ fontSize: '0.6875rem', color: 'var(--muted)', flexShrink: 0 }}>
            Adresse
          </Box>
          <Box
            component="span"
            sx={{
              ml: 'auto',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--ink)',
              textAlign: 'right',
              minWidth: 0,
              lineHeight: 1.35,
            }}
          >
            {address}
          </Box>
        </Box>
      )}

      {/* Pied : Fermer (outlined neutre) + Voir la fiche (outlined accent) */}
      <Box sx={{ display: 'flex', gap: 1, p: '10px 14px', borderTop: '1px solid var(--line)' }}>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<Close size={ICON_SIZE} strokeWidth={1.75} />}
          onClick={onClose}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9px',
            color: 'var(--ink)',
            borderColor: 'var(--line-2)',
            '&:hover': { borderColor: 'var(--ink)', backgroundColor: 'var(--hover)' },
          }}
        >
          Fermer
        </Button>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<Visibility size={ICON_SIZE} strokeWidth={1.75} />}
          onClick={() => {
            onClose();
            navigate(`/properties/${property.id}`);
          }}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9px',
            color: 'var(--accent)',
            borderColor: 'var(--accent)',
            '&:hover': { borderColor: 'var(--accent-deep)', backgroundColor: 'var(--accent-soft)' },
          }}
        >
          Voir la fiche
        </Button>
      </Box>
    </Popover>
  );
};

export default PropertyPopover;
