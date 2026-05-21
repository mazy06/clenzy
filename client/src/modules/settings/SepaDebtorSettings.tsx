import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import {
  Box, Typography, TextField, Alert, CircularProgress, Chip,
} from '@mui/material';
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
      setIban('');
      setBic(config.bic ?? '');
    }
  }, [config]);

  const baseline = useMemo(() => ({
    name: config?.name ?? '',
    bic: config?.bic ?? '',
  }), [config]);

  const mutation = useMutation({
    mutationFn: () => accountingApi.updateSepaDebtorConfig({
      name: name.trim(),
      iban: iban.trim() || undefined,
      bic: bic.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sepa-debtor-config'] });
      setIban('');
    },
  });

  const hasChanges = () => {
    return (
      name.trim() !== baseline.name ||
      bic.trim() !== baseline.bic ||
      iban.trim().length > 0
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
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </SettingsSection>
    );
  }

  const configuredChip = config?.configured ? (
    <Chip
      icon={<VerifiedUser size={11} strokeWidth={2} />}
      label={t('settings.sepaDebtor.configured', 'Configuré')}
      size="small"
      sx={{
        height: 22,
        fontSize: '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        backgroundColor: '#4A9B8E14',
        color: '#4A9B8E',
        border: '1px solid #4A9B8E33',
        borderRadius: '6px',
        px: 0.25,
        '& .MuiChip-icon': {
          color: '#4A9B8E !important',
          ml: '6px',
          mr: '-2px',
        },
        '& .MuiChip-label': { px: 0.875 },
      }}
    />
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
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: '8px' }}
          onClose={() => mutation.reset()}
        >
          {t('settings.sepaDebtor.saveSuccess', 'Configuration sauvegardée')}
        </Alert>
      )}
      {mutation.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: '8px' }}
          onClose={() => mutation.reset()}
        >
          {(mutation.error as Error)?.message ?? t('settings.sepaDebtor.saveError', 'Erreur lors de la sauvegarde')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        <TextField
          label={t('settings.sepaDebtor.nameLabel', 'Nom du titulaire')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
          placeholder="Clenzy SAS"
        />
        <TextField
          label={t('settings.sepaDebtor.ibanLabel', 'IBAN')}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          size="small"
          fullWidth
          placeholder={config?.iban ?? 'FR76 3000 1007 9412 3456 7890 185'}
          helperText={
            config?.configured
              ? `${t('settings.sepaDebtor.ibanMasked', 'IBAN actuel : ')}${config.iban ?? ''}${t('settings.sepaDebtor.ibanChangeHint', ' — laissez vide pour conserver')}`
              : undefined
          }
          InputProps={{ sx: { fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' } }}
        />
        <TextField
          label={t('settings.sepaDebtor.bicLabel', 'BIC / SWIFT')}
          value={bic}
          onChange={(e) => setBic(e.target.value)}
          size="small"
          fullWidth
          placeholder="BNPAFRPPXXX"
          InputProps={{ sx: { fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', textTransform: 'uppercase' } }}
        />
      </Box>
    </SettingsSection>
  );
});

export default SepaDebtorSettings;
