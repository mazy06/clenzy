import React from 'react';
import { Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useMissingContractCount } from '../../hooks/useMissingContractCount';

/**
 * Alerte urgente sur le dashboard : N propriété(s) sans contrat de gestion.
 * Affichée uniquement aux gestionnaires (admin / manager / host) et seulement si au
 * moins une propriété n'a pas de contrat vivant. Renvoie vers la liste des propriétés
 * (gate + badges par propriété + bouton « Établir les contrats »).
 */
const MissingContractsDashboardAlert: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAdmin, isManager, isHost } = useAuth();
  const canManage = isAdmin() || isManager() || isHost();
  const count = useMissingContractCount(canManage);

  if (!canManage || count === 0) return null;

  return (
    <Alert
      severity="warning"
      sx={{
        mb: 2,
        borderRadius: '10px',
        fontSize: '0.8125rem',
        '& .MuiAlert-message': { fontSize: '0.8125rem' },
      }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => navigate('/properties')}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {t('contracts.gate.cta', 'Établir les contrats')}
        </Button>
      }
    >
      {`${count} ${t('contracts.gate.banner', "logement(s) sans contrat de gestion actif. La répartition par défaut de l'organisation s'applique en attendant.")}`}
    </Alert>
  );
};

export default MissingContractsDashboardAlert;
