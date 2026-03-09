import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import { paymentConfigApi } from '../../services/api/paymentConfigApi';
import type { PaymentMethodConfig, PaymentProviderType } from '../../types/payment';
import { PAYMENT_PROVIDER_LABELS } from '../../types/payment';

export default function PaymentSettings() {
  const [configs, setConfigs] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await paymentConfigApi.getConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to load payment configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (providerType: PaymentProviderType, currentEnabled: boolean) => {
    try {
      await paymentConfigApi.updateConfig(providerType, { enabled: !currentEnabled });
      setConfigs(prev =>
        prev.map(c =>
          c.providerType === providerType ? { ...c, enabled: !currentEnabled } : c
        )
      );
      setSnackbar({
        open: true,
        message: `${PAYMENT_PROVIDER_LABELS[providerType]} ${!currentEnabled ? 'activé' : 'désactivé'}`,
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({ open: true, message: 'Erreur lors de la mise à jour', severity: 'error' });
    }
  };

  // Show all providers, including those not yet configured
  const allProviders: PaymentProviderType[] = ['STRIPE', 'PAYTABS', 'CMI', 'PAYZONE', 'PAYPAL'];

  const getConfig = (type: PaymentProviderType): PaymentMethodConfig | undefined =>
    configs.find(c => c.providerType === type);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Fournisseurs de paiement
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Activez ou désactivez les fournisseurs de paiement pour votre organisation.
        Seul Stripe est actuellement opérationnel. Les autres fournisseurs seront disponibles prochainement.
      </Typography>

      <Paper variant="outlined" sx={{ mt: 2 }}>
        <List disablePadding>
          {allProviders.map((type, index) => {
            const config = getConfig(type);
            const enabled = config?.enabled ?? false;
            const isStub = type !== 'STRIPE';

            return (
              <ListItem
                key={type}
                divider={index < allProviders.length - 1}
                sx={{ py: 2 }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography fontWeight={600}>
                        {PAYMENT_PROVIDER_LABELS[type]}
                      </Typography>
                      {isStub && (
                        <Chip label="Bientôt" size="small" color="default" variant="outlined" />
                      )}
                      {enabled && !isStub && (
                        <Chip label="Actif" size="small" color="success" />
                      )}
                      {config?.sandboxMode && (
                        <Chip label="Sandbox" size="small" color="warning" variant="outlined" />
                      )}
                    </Box>
                  }
                  secondary={
                    config?.countryCodes?.length
                      ? `Pays: ${config.countryCodes.join(', ')}`
                      : 'Tous les pays supportés'
                  }
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={enabled}
                    onChange={() => handleToggle(type, enabled)}
                    disabled={isStub}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
