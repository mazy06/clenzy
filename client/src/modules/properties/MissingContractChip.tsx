import React from 'react';
import { Chip } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';

interface MissingContractChipProps {
  /** Clic sur le badge ; l'appelant gère le stopPropagation + la navigation. */
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Badge « Contrat manquant » du gate de rattrapage, partagé par les vues liste / carte / grille
 * (PropertiesTableView, PropertiesMapView, PropertyCard). Pattern chip -soft (tokens --warn*).
 */
const MissingContractChip: React.FC<MissingContractChipProps> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <Chip
      label={t('contracts.gate.badge', 'Contrat manquant')}
      size="small"
      onClick={onClick}
      sx={{
        height: 18,
        fontSize: '10.5px',
        fontWeight: 700,
        bgcolor: 'var(--warn-soft)',
        color: 'var(--warn)',
        border: 'none',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'var(--warn-soft)', opacity: 0.85 },
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
};

export default MissingContractChip;
