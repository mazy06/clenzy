import React from 'react';
import { Chip } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';

interface MissingContractChipProps {
  /** Clic sur le badge ; l'appelant gère le stopPropagation + la navigation. */
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Badge « Contrat manquant » du gate de rattrapage, partagé par les vues liste / carte / grille
 * (PropertiesTableView, PropertiesMapView, PropertyCard). Accent rosé validé Clenzy (#C97A7A).
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
        fontSize: '0.625rem',
        fontWeight: 700,
        bgcolor: 'rgba(212,165,116,0.16)',
        color: '#8a5a1f',
        border: '1px solid rgba(212,165,116,0.45)',
        borderRadius: '4px',
        cursor: 'pointer',
        '& .MuiChip-label': { px: 0.5 },
      }}
    />
  );
};

export default MissingContractChip;
