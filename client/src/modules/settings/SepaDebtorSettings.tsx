import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription, AlertAction, Button } from '../../components/ui';
import { CircleCheck, X, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Field, FieldLabel, FieldDescription, Input } from '../../components/ui';
import { AccountBalance, VerifiedUser } from '../../icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../services/api/accountingApi';
import { useTranslation } from '../../hooks/useTranslation';
import SettingsSection from './components/SettingsSection';

export interface SepaDebtorHandle {
  save: () => Promise<void>;
  hasChanges: () => boolean;
  isSaving: boolean;
  isValid: () => boolean;
}

interface SepaDebtorSettingsProps {
  onChangeState?: () => void;
}

const SepaDebtorSettings = forwardRef<SepaDebtorHandle, SepaDebtorSettingsProps>(function SepaDebtorSettings(
  { onChangeState },
  ref,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['sepa-debtor-config'],
    queryFn: () => accountingApi.getSepaDebtorConfig(),
  });

  const [name, setName] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');

  useEffect(() => {
    if (config) {
      setName(config.name ?? '');
      // Pré-remplit avec le mask (FR76 **** **** **** **** *** 0189) au lieu
      // d'un champ vide. Le mask contient des '*' — au save, on détecte si
      // l'utilisateur a modifié le champ via ibanUnchanged.
      setIban(config.iban ?? '');
      setBic(config.bic ?? '');
    }
  }, [config]);

  const baseline = useMemo(() => ({
    name: config?.name ?? '',
    iban: config?.iban ?? '',
    bic: config?.bic ?? '',
  }), [config]);

  /** True si le champ IBAN contient encore le mask (= non modifié, à préserver). */
  const ibanUnchanged = useMemo(() => {
    const trimmed = iban.trim();
    if (!trimmed) return false;
    if (!config?.iban) return false;
    if (trimmed === config.iban) return true;
    return trimmed.includes('*');
  }, [iban, config?.iban]);

  const mutation = useMutation({
    mutationFn: () => accountingApi.updateSepaDebtorConfig({
      name: name.trim(),
      // N'envoie l'IBAN au backend QUE s'il a été effectivement modifié.
      // Si c'est encore le mask, on omet → le backend préserve l'existant.
      iban: ibanUnchanged ? undefined : (iban.trim() || undefined),
      bic: bic.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sepa-debtor-config'] });
      // Pas de reset à '' — useEffect va re-charger le nouveau mask depuis config
    },
  });

  const hasChanges = () => {
    return (
      name.trim() !== baseline.name ||
      bic.trim() !== baseline.bic ||
      // Modif IBAN = pas en mode mask
      (iban.trim().length > 0 && !ibanUnchanged)
    );
  };

  const isValid = () => name.trim().length > 0 && bic.trim().length > 0;

  useEffect(() => {
    onChangeState?.();
  }, [name, iban, bic, mutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    save: async () => {
      await mutation.mutateAsync();
    },
    hasChanges,
    isSaving: mutation.isPending,
    isValid,
  }));

  if (isLoading) {
    return (
      <SettingsSection
        title={t('settings.sepaDebtor.title', 'Compte bancaire débiteur (SEPA)')}
        icon={AccountBalance}
        accent="primary"
      >
        <div className="flex justify-center py-3">
          <Spinner className="size-6" />
        </div>
      </SettingsSection>
    );
  }

  // `tone="ok"` plutot qu'un couple de tokens ecrit a la main : la primitive
  // porte deja le couple conforme AA (fond `-soft`, encre `-ink`).
  const configuredChip = config?.configured ? (
    <StatusChip tone="ok" label={t('settings.sepaDebtor.configured', 'Configuré')} icon={<VerifiedUser size={11} strokeWidth={2} />} className="tracking-[0.01em] px-0.5" />
  ) : undefined;

  return (
    <SettingsSection
      title={t('settings.sepaDebtor.title', 'Compte bancaire débiteur (SEPA)')}
      icon={AccountBalance}
      accent="primary"
      description={t(
        'settings.sepaDebtor.description',
        'Renseignez les coordonnées bancaires de votre organisation. Elles seront utilisées comme débiteur dans les fichiers SEPA XML (pain.001).',
      )}
      action={configuredChip}
    >
      {mutation.isSuccess && (
        <Alert variant="success" className="mb-3">
          <CircleCheck />
          <AlertDescription>{t('settings.sepaDebtor.saveSuccess', 'Configuration sauvegardée')}</AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => mutation.reset()}>
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}
      {mutation.isError && (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{(mutation.error as Error)?.message ?? t('settings.sepaDebtor.saveError', 'Erreur lors de la sauvegarde')}</AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => mutation.reset()}>
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="flex flex-col gap-2.5">
        <Field>
          <FieldLabel htmlFor="sepa-debtor-name">{t('settings.sepaDebtor.nameLabel', 'Nom du titulaire')}</FieldLabel>
          <Input
            id="sepa-debtor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Baitly SAS"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sepa-debtor-iban">{t('settings.sepaDebtor.ibanLabel', 'IBAN')}</FieldLabel>
          <Input
            id="sepa-debtor-iban"
            className="font-mono text-[0.875rem] tabular-nums"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            onFocus={(e) => {
              // Auto-sélection du contenu si c'est encore le mask : permet à
              // l'admin de taper un nouvel IBAN directement, ou de continuer à
              // utiliser l'existant en cliquant ailleurs sans avoir modifié.
              if (ibanUnchanged) {
                e.target.select();
              }
            }}
            placeholder={!config?.configured ? 'FR76 3000 1007 9412 3456 7890 185' : undefined}
          />
          <FieldDescription>
            {config?.configured
              ? ibanUnchanged
                ? t('settings.sepaDebtor.ibanPreserved', 'IBAN actuel conservé. Tapez un nouvel IBAN pour le remplacer.')
                : t('settings.sepaDebtor.ibanNewFormat', 'Nouvel IBAN. Format : FR76 1234 5678 9012 3456 7890 123')
              : t('settings.sepaDebtor.ibanRequired', 'Renseignez l\'IBAN du compte débiteur Baitly.')}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="sepa-debtor-bic">{t('settings.sepaDebtor.bicLabel', 'BIC / SWIFT')}</FieldLabel>
          <Input
            id="sepa-debtor-bic"
            className="tabular-nums tracking-[0.04em] uppercase"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            placeholder="BNPAFRPPXXX"
          />
        </Field>
      </div>
    </SettingsSection>
  );
});

export default SepaDebtorSettings;
