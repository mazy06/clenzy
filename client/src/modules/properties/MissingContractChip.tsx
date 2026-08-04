import React from 'react';
import StatusChip from '../../components/StatusChip';
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
    <StatusChip
      label={t('contracts.gate.badge', 'Contrat manquant')}
      tone="warn"
      size="sm"
      onClick={onClick}
      className="text-[10.5px] font-bold"
    />
  );
};

export default MissingContractChip;
