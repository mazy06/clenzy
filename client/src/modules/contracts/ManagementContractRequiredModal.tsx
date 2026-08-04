import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { Handshake, Check } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ManagementContractFormFields,
  EMPTY_FORM,
  type PropertyOption,
} from './ManagementContractForm';
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
    // Modale non fermable : `open` est controle sans onOpenChange, donc Radix
    // ne peut pas la refermer (Echap et clic exterieur sont neutralises aussi).
    <Dialog open={open}>
      <DialogContent
        className="max-w-[900px] max-h-[88vh] overflow-y-auto"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
              <Handshake size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[16px] font-semibold leading-[1.2] text-[var(--ink)]">
                {t('contracts.required.title', 'Contrat de gestion requis')}
              </DialogTitle>
              {property && (
                <DialogDescription className="text-[0.75rem] text-[var(--muted)]">
                  {property.name}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="border-y border-solid border-[var(--line)] py-4">
        <p className="cn-text-body1 text-[0.8125rem] text-[var(--muted)] mb-4">
          {t(
            'contracts.required.intro',
            "Avant d'exploiter ce logement, définissez le contrat de gestion : il fixe le modèle d'encaissement (taxonomie OTA) et la commission qui pilotent la répartition des paiements. Choisissez un modèle pour préremplir, puis ajustez les détails.",
          )}
        </p>

        <ManagementContractFormFields
          form={form}
          setForm={setForm}
          properties={properties}
          splitRatios={splitRatios}
          lockProperty
        />

        {error && (
          <Alert variant="destructive" className="mt-2 text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!formValid || saving}
          >
            {saving ? <Spinner className="size-3.5" /> : <Check size={16} strokeWidth={2} />}
            {saving
              ? t('contracts.required.saving', 'Enregistrement…')
              : t('contracts.required.submit', 'Valider le contrat')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManagementContractRequiredModal;
