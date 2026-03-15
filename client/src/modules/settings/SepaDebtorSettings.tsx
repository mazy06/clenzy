import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Alert, CircularProgress, Chip,
} from '@mui/material';
import { AccountBalance, Save } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../services/api/accountingApi';
import { useTranslation } from '../../hooks/useTranslation';

const SepaDebtorSettings: React.FC = () => {
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

  if (isLoading) {
    return <CircularProgress size={24} />;
  }

  return (
    <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccountBalance sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {t('settings.sepaDebtor.title', 'Compte bancaire debiteur (SEPA)')}
        </Typography>
        {config?.configured && (
          <Chip label={t('settings.sepaDebtor.configured', 'Configure')} size="small" color="success" sx={{ fontSize: '0.625rem', height: 20 }} />
        )}
      </Box>

      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 2 }}>
        {t('settings.sepaDebtor.description', 'Renseignez les coordonnees bancaires de votre organisation. Elles seront utilisees comme debiteur dans les fichiers SEPA XML (pain.001).')}
      </Typography>

      {mutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2, fontSize: '0.8125rem' }} onClose={() => mutation.reset()}>
          {t('settings.sepaDebtor.saveSuccess', 'Configuration sauvegardee')}
        </Alert>
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '0.8125rem' }} onClose={() => mutation.reset()}>
          {(mutation.error as Error)?.message ?? t('settings.sepaDebtor.saveError', 'Erreur lors de la sauvegarde')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 500 }}>
        <TextField
          label={t('settings.sepaDebtor.nameLabel', 'Nom du titulaire')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
          placeholder="Clenzy SAS"
          InputProps={{ sx: { fontSize: '0.8125rem' } }}
          InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
        />
        <TextField
          label={t('settings.sepaDebtor.ibanLabel', 'IBAN')}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          size="small"
          fullWidth
          placeholder={config?.iban ?? 'FR76 3000 1007 9412 3456 7890 185'}
          helperText={config?.configured ? t('settings.sepaDebtor.ibanMasked', 'IBAN actuel : ') + (config.iban ?? '') + t('settings.sepaDebtor.ibanChangeHint', ' — laissez vide pour conserver') : undefined}
          InputProps={{ sx: { fontSize: '0.8125rem' } }}
          InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          FormHelperTextProps={{ sx: { fontSize: '0.75rem' } }}
        />
        <TextField
          label={t('settings.sepaDebtor.bicLabel', 'BIC / SWIFT')}
          value={bic}
          onChange={(e) => setBic(e.target.value)}
          size="small"
          fullWidth
          placeholder="BNPAFRPPXXX"
          InputProps={{ sx: { fontSize: '0.8125rem' } }}
          InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={mutation.isPending ? <CircularProgress size={14} /> : <Save />}
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim() || !bic.trim()}
          sx={{ textTransform: 'none', fontSize: '0.8125rem', alignSelf: 'flex-start' }}
        >
          {t('common.save', 'Enregistrer')}
        </Button>
      </Box>
    </Paper>
  );
};

export default SepaDebtorSettings;
