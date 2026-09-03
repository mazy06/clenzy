import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useMissingContractCount } from '../../hooks/useMissingContractCount';
import ManagementContractFormModal from '../contracts/ManagementContractFormModal';
import MissingContractsBanner from '../contracts/MissingContractsBanner';

/**
 * Alerte urgente sur le dashboard : N propriété(s) sans contrat de gestion.
 * Affichée uniquement aux gestionnaires (admin / manager / host) et seulement si au
 * moins une propriété n'a pas de contrat vivant. Le CTA ouvre directement la modal
 * de création de contrat, préselectionnée sur le premier logement à régulariser.
 */
const MissingContractsDashboardAlert: React.FC = () => {
  const { isAdmin, isManager, isHost } = useAuth();
  const canManage = isAdmin() || isManager() || isHost();
  const { count, missingPropertyIds } = useMissingContractCount(canManage);
  const [contractModalOpen, setContractModalOpen] = useState(false);

  if (!canManage || count === 0) return null;

  return (
    <>
      {/* Aucune marge propre : le tableau de bord empile ses blocs avec un
          `gap`, une marge s'y ajouterait au lieu de s'y substituer. */}
      <MissingContractsBanner count={count} onEstablish={() => setContractModalOpen(true)} />

      <ManagementContractFormModal
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        initialPropertyId={missingPropertyIds[0] ?? null}
      />
    </>
  );
};

export default MissingContractsDashboardAlert;
