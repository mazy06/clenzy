import React from 'react';
import { Box, Switch, Typography } from '@mui/material';

/**
 * Primitives de formulaire partagées par les onglets « Réservation & accueil »
 * (Livret d'accueil + Services payants) — identité PMS épurée : icône inline
 * discrète, en-têtes cohérents, états vides compacts.
 */

/** En-tête de section : overline « Signature » (10.5px fw700 uppercase --faint) + actions à droite. */
export const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; actions?: React.ReactNode }> = ({
  icon,
  title,
  actions,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box sx={{ flexShrink: 0, display: 'flex', color: 'var(--faint)' }}>{icon}</Box>
      <Typography
        sx={{
          fontSize: '10.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          color: 'var(--faint)',
        }}
      >
        {title}
      </Typography>
    </Box>
    {actions ? <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>{actions}</Box> : null}
  </Box>
);

/** État vide compact d'une section : encart pointillé discret + icône + texte court. */
export const EmptyHint: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      px: 1.75,
      py: 1.5,
      borderRadius: '10px',
      border: '1px dashed var(--line-2)',
      bgcolor: 'var(--hover)',
    }}
  >
    <Box sx={{ flexShrink: 0, display: 'flex', color: 'var(--faint)' }}>{icon}</Box>
    <Typography sx={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--muted)' }}>
      {text}
    </Typography>
  </Box>
);

/** Ligne de réglage (toggle) : icône + libellé + description + Switch à droite. */
export const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, label, description, checked, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25 }}>
    <Box sx={{ flexShrink: 0, display: 'flex', color: 'text.secondary' }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
        {description}
      </Typography>
    </Box>
    <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
  </Box>
);
