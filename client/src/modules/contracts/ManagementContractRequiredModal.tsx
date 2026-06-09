import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography, Alert, CircularProgress,
} from '@mui/material';
import { Handshake, Check } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ManagementContractFormFields,
  EMPTY_FORM,
  type PropertyOption,
} from './ManagementContractsPage';
import {
  managementContractsApi,
  type CreateManagementContractRequest,
} from '../../services/api/managementContractsApi';
import { splitConfigApi } from '../../services/api/splitConfigApi';
import type { SplitRatios } from '../../types/payment';

export interface ContractRequiredProperty {
  id: number;
  name: string;
  ownerId: number;
  ownerName?: string;
}

interface ManagementContractRequiredModalProps {
  open: boolean;
  property: ContractRequiredProperty | null;
  /** Appelé une fois le contrat de gestion créé. */
  onCompleted: () => void;
}

/**
 * Modal de contrat de gestion **obligatoire**, ouverte juste après la création d'une propriété.
 * Non fermable (ni croix, ni Échap, ni clic extérieur, ni « passer ») : le seul moyen de sortir
 * est de valider le contrat. Un rechargement de page est rattrapé par le gate « contrat manquant »
 * sur la liste des propriétés.
 */
const ManagementContractRequiredModal: React.FC<ManagementContractRequiredModalProps> = ({
  open, property, onCompleted,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateManagementContractRequest>(EMPTY_FORM);
  const [splitRatios, setSplitRatios] = useState<SplitRatios | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Préremplit le formulaire avec la propriété fraîchement créée.
  useEffect(() => {
    if (property) {
      setForm({ ...EMPTY_FORM, propertyId: property.id, ownerId: property.ownerId });
      setError(null);
    }
  }, [property]);

  // Charge la répartition courante (pour l'aperçu) à l'ouverture.
  useEffect(() => {
    if (!open) return;
    splitConfigApi.getCurrentRatios().then(setSplitRatios).catch(() => setSplitRatios(null));
  }, [open]);

  const properties: PropertyOption[] = useMemo(
    () => (property ? [{ id: property.id, name: property.name, ownerId: property.ownerId, ownerName: property.ownerName }] : []),
    [property],
  );

  const formValid = Boolean(form.propertyId) && Boolean(form.startDate) && form.commissionRate > 0;

  const handleSubmit = async () => {
    if (!formValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await managementContractsApi.create(form);
      // Rafraîchit le gate « contrat manquant » sur la liste des propriétés.
      queryClient.invalidateQueries({ queryKey: ['management-contracts'] });
      onCompleted();
    } catch {
      setError(t('contracts.required.error', "L'enregistrement du contrat a échoué. Vérifiez les champs et réessayez."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="lg"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Box
          component="span"
          sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '8px',
            bgcolor: 'primary.main', color: '#fff',
          }}
        >
          <Handshake size={16} strokeWidth={2} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2 }}>
            {t('contracts.required.title', 'Contrat de gestion requis')}
          </Typography>
          {property && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {property.name}
            </Typography>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
          {t(
            'contracts.required.intro',
            "Avant d'exploiter ce logement, définissez le contrat de gestion : il fixe le modèle d'encaissement (taxonomie OTA) et la commission qui pilotent la répartition des paiements. Choisissez un modèle pour préremplir, puis ajustez les détails.",
          )}
        </Typography>

        <ManagementContractFormFields
          form={form}
          setForm={setForm}
          properties={properties}
          splitRatios={splitRatios}
          lockProperty
        />

        {error && (
          <Alert severity="error" sx={{ mt: 1.5, fontSize: '0.8125rem' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formValid || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Check size={16} strokeWidth={2} />}
          sx={{ textTransform: 'none' }}
        >
          {saving
            ? t('contracts.required.saving', 'Enregistrement…')
            : t('contracts.required.submit', 'Valider le contrat')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManagementContractRequiredModal;
