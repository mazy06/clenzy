import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, IconButton, Alert, CircularProgress, Tooltip } from '@mui/material';
import { Handshake, Check, Close } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ManagementContractFormFields,
  EMPTY_FORM,
  type PropertyOption,
} from './ManagementContractForm';
import {
  managementContractsApi,
  type ManagementContract,
  type CreateManagementContractRequest,
} from '../../services/api/managementContractsApi';
import { splitConfigApi } from '../../services/api/splitConfigApi';
import type { SplitRatios } from '../../types/payment';
import apiClient from '../../services/apiClient';

export interface ManagementContractFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Appelé après création/modification réussie (avant fermeture). */
  onSaved?: (contract: ManagementContract) => void;
  /** Préselectionne ce logement à l'ouverture (badge « Contrat manquant », bandeaux). */
  initialPropertyId?: number | null;
  /** Contrat à modifier ; null/undefined = mode création. */
  contract?: ManagementContract | null;
}

/**
 * Modal de création / édition d'un contrat de gestion. Autonome : charge la
 * liste des logements et la répartition courante à l'ouverture, ce qui permet
 * de l'ouvrir depuis n'importe quel écran (contrats, propriétés, dashboard).
 * Après enregistrement, invalide les queries `management-contracts` pour
 * rafraîchir le gate « contrat manquant » et les listes.
 */
const ManagementContractFormModal: React.FC<ManagementContractFormModalProps> = ({
  open, onClose, onSaved, initialPropertyId = null, contract = null,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = Boolean(contract);

  const [form, setForm] = useState<CreateManagementContractRequest>(EMPTY_FORM);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [splitRatios, setSplitRatios] = useState<SplitRatios | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (Ré)initialise le formulaire à chaque ouverture, selon le mode.
  // Pattern dialog-init délibéré (comme useReservationForm) : rouvrir = état frais.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (contract) {
      setForm({
        propertyId: contract.propertyId,
        ownerId: contract.ownerId,
        contractType: contract.contractType,
        startDate: contract.startDate,
        endDate: contract.endDate,
        commissionRate: contract.commissionRate,
        minimumStayNights: contract.minimumStayNights,
        autoRenew: contract.autoRenew,
        noticePeriodDays: contract.noticePeriodDays,
        cleaningFeeIncluded: contract.cleaningFeeIncluded,
        maintenanceIncluded: contract.maintenanceIncluded,
        upsellCommissionRate: contract.upsellCommissionRate,
          paymentModel: contract.paymentModel,
        commissionBase: contract.commissionBase,
        otaFeeBorneBy: contract.otaFeeBorneBy,
        notes: contract.notes ?? '',
      });
    } else {
      setForm({ ...EMPTY_FORM, propertyId: initialPropertyId ?? 0 });
    }
  }, [open, contract, initialPropertyId]);

  // Charge les logements + la répartition courante à l'ouverture.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProperties(true);
    apiClient.get<{ content?: PropertyOption[]; [key: string]: unknown }>('/properties?size=1000')
      .then(resp => {
        if (cancelled) return;
        const list = (Array.isArray(resp) ? resp : (resp.content ?? [])) as PropertyOption[];
        setProperties(list);
      })
      .catch(() => { /* rôles sans accès propriétés : sélecteur vide, non bloquant */ })
      .finally(() => { if (!cancelled) setLoadingProperties(false); });
    splitConfigApi.getCurrentRatios()
      .then(ratios => { if (!cancelled) setSplitRatios(ratios); })
      .catch(() => { if (!cancelled) setSplitRatios(null); });
    return () => { cancelled = true; };
  }, [open]);

  // Une fois les logements chargés (mode création) : complète propertyId/ownerId.
  // En édition, le logement est verrouillé et l'ownerId vient du contrat.
  useEffect(() => {
    if (!open || isEdit || properties.length === 0) return;
    setForm(prev => {
      const target = properties.find(p => p.id === prev.propertyId) ?? properties[0];
      if (prev.propertyId === target.id && prev.ownerId === target.ownerId) return prev;
      return { ...prev, propertyId: target.id, ownerId: target.ownerId };
    });
  }, [open, isEdit, properties]);

  const formValid = Boolean(form.propertyId) && Boolean(form.startDate) && form.commissionRate > 0;

  const handleSubmit = async () => {
    if (!formValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = contract
        ? await managementContractsApi.update(contract.id, form)
        : await managementContractsApi.create(form);
      // Rafraîchit le gate « contrat manquant » (badges, bandeaux) et les listes.
      queryClient.invalidateQueries({ queryKey: ['management-contracts'] });
      onSaved?.(saved);
      onClose();
    } catch {
      setError(t('contracts.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 2 }}>
        <span className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-[10px] shrink-0 bg-[var(--accent-soft)] text-[var(--accent)]">
          <Handshake size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, lineHeight: 1.25, textWrap: 'balance', color: 'var(--ink)' }}>
            {isEdit
              ? t('contracts.editTitle', 'Modifier le contrat')
              : t('contracts.createTitle', 'Créer un contrat de gestion')}
          </Typography>
          <p className="cn-text-body1 text-[0.78rem] text-[var(--muted)] mt-0.5">
            {isEdit && contract
              ? contract.contractNumber
              : t('contracts.modalSubtitle', "L'encaissement et la commission pilotent la répartition automatique des revenus.")}
          </p>
        </div>
        <Tooltip title={t('contracts.cancel', 'Annuler')}>
          <IconButton
            size="small"
            onClick={onClose}
            disabled={saving}
            sx={{
              width: 34, height: 34, borderRadius: '10px',
              border: '1px solid var(--line)', color: 'var(--muted)',
              '&:hover': { color: 'var(--err)', borderColor: 'var(--err)', bgcolor: 'transparent' },
            }}
          >
            <Close size={18} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 3 }}>
        {loadingProperties && properties.length === 0 ? (
          <div className="flex justify-center py-9">
            <CircularProgress size={28} />
          </div>
        ) : (
          <ManagementContractFormFields
            form={form}
            setForm={setForm}
            properties={properties}
            splitRatios={splitRatios}
            lockProperty={isEdit}
          />
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: '0.8125rem' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          {t('contracts.cancel', 'Annuler')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formValid || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Check size={16} strokeWidth={2} />}
        >
          {saving
            ? t('contracts.required.saving', 'Enregistrement…')
            : isEdit
              ? t('contracts.save', 'Enregistrer')
              : t('contracts.modalSubmit', 'Créer le contrat')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManagementContractFormModal;
