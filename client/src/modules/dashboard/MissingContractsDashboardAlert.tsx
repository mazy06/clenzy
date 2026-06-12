import React, { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useMissingContractCount } from '../../hooks/useMissingContractCount';
import ManagementContractFormModal from '../contracts/ManagementContractFormModal';

/**
 * Alerte urgente sur le dashboard : N propriété(s) sans contrat de gestion.
 * Affichée uniquement aux gestionnaires (admin / manager / host) et seulement si au
 * moins une propriété n'a pas de contrat vivant. Le CTA ouvre directement la modal
 * de création de contrat, préselectionnée sur le premier logement à régulariser.
 */
const MissingContractsDashboardAlert: React.FC = () => {
  const { t } = useTranslation();
  const { isAdmin, isManager, isHost } = useAuth();
  const canManage = isAdmin() || isManager() || isHost();
  const { count, missingPropertyIds } = useMissingContractCount(canManage);
  const [contractModalOpen, setContractModalOpen] = useState(false);

  if (!canManage || count === 0) return null;

  return (
    <>
      <Alert
        severity="warning"
        sx={{
          mb: 2,
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          bgcolor: 'var(--warn-soft)',
          color: 'var(--body)',
          border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
          '& .MuiAlert-icon': { color: 'var(--warn)' },
          '& .MuiAlert-message': { fontSize: '0.8125rem' },
        }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => setContractModalOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {t('contracts.gate.cta', 'Établir les contrats')}
          </Button>
        }
      >
        {`${count} ${t('contracts.gate.banner', "logement(s) sans contrat de gestion actif. La répartition par défaut de l'organisation s'applique en attendant.")}`}
      </Alert>

      <ManagementContractFormModal
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        initialPropertyId={missingPropertyIds[0] ?? null}
      />
    </>
  );
};

export default MissingContractsDashboardAlert;
