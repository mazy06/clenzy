import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { Warning, ErrorOutline } from '../../../icons';
import type { OwnerPayoutConfig } from '../../../services/api/accountingApi';

/**
 * Bannière proactive qui alerte sur l'état du consent Open Banking PIS.
 *
 * <h2>Trois états visibles</h2>
 * <ul>
 *   <li><strong>Expiré</strong> (rouge) : virements bloqués, l'admin doit
 *       refaire le SCA pour réactiver Open Banking.</li>
 *   <li><strong>Bientôt expiré</strong> (< 7 jours, jaune) : tout fonctionne
 *       encore mais on prévient à l'avance pour éviter une coupure.</li>
 *   <li><strong>Aucune bannière</strong> : consent actif > 7 jours OU la
 *       méthode payout n'est pas Open Banking.</li>
 * </ul>
 *
 * <h2>Affichage conditionnel</h2>
 * <p>La bannière ne s'affiche que si la méthode courante est OPEN_BANKING
 * (peu importe que la config soit "verified" ou pas — on alerte uniquement
 * sur l'expiration).</p>
 */

interface OpenBankingConsentBannerProps {
  config: OwnerPayoutConfig | null | undefined;
  /** Callback appelé quand l'admin clique sur "Reconnecter ma banque". */
  onReconnect?: () => void;
}

const WARNING_THRESHOLD_DAYS = 7;

export default function OpenBankingConsentBanner({
  config,
  onReconnect,
}: OpenBankingConsentBannerProps) {
  if (!config || config.payoutMethod !== 'OPEN_BANKING') {
    return null;
  }

  const expiresAt = config.openBankingConsentExpiresAt;
  if (!expiresAt) {
    // Open Banking sélectionné mais SCA jamais validé → bannière "à compléter"
    return (
      <Alert
        severity="warning"
        icon={<Warning size={18} strokeWidth={1.75} />}
        sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem', alignItems: 'center' }}
        action={
          onReconnect && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={onReconnect}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: '8px' }}
            >
              Compléter le SCA
            </Button>
          )
        }
      >
        <Box>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0.25 }}>
            Configuration Open Banking incomplète
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            La méthode Open Banking est sélectionnée, mais l'authentification bancaire (SCA)
            n'a pas encore été validée. Aucun virement ne peut être effectué tant que ce n'est pas fait.
          </Typography>
        </Box>
      </Alert>
    );
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const isExpired = expiresAtMs < nowMs;
  const daysUntilExpiry = Math.max(0, Math.floor((expiresAtMs - nowMs) / (1000 * 60 * 60 * 24)));

  // Cas 1 : déjà expiré
  if (isExpired) {
    return (
      <Alert
        severity="error"
        icon={<ErrorOutline size={18} strokeWidth={1.75} />}
        sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem', alignItems: 'center' }}
        action={
          onReconnect && (
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={onReconnect}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                borderRadius: '8px',
                boxShadow: 'none',
              }}
            >
              Reconnecter ma banque
            </Button>
          )
        }
      >
        <Box>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0.25 }}>
            Consent bancaire expiré
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            Votre consent Open Banking a expiré le{' '}
            <strong>{new Date(expiresAt).toLocaleDateString('fr-FR')}</strong>. Les virements automatiques
            sont suspendus jusqu'à reconnexion. Refaites le SCA bancaire pour réactiver les payouts.
          </Typography>
        </Box>
      </Alert>
    );
  }

  // Cas 2 : expire dans < 7 jours
  if (daysUntilExpiry <= WARNING_THRESHOLD_DAYS) {
    return (
      <Alert
        severity="warning"
        icon={<Warning size={18} strokeWidth={1.75} />}
        sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem', alignItems: 'center' }}
        action={
          onReconnect && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={onReconnect}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: '8px' }}
            >
              Renouveler maintenant
            </Button>
          )
        }
      >
        <Box>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0.25 }}>
            Consent bancaire à renouveler bientôt
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            Votre consent Open Banking expire dans{' '}
            <strong>
              {daysUntilExpiry === 0
                ? "moins d'un jour"
                : daysUntilExpiry === 1
                  ? '1 jour'
                  : `${daysUntilExpiry} jours`}
            </strong>
            {' '}({new Date(expiresAt).toLocaleDateString('fr-FR')}). Renouvelez dès maintenant pour éviter
            toute interruption des virements automatiques.
          </Typography>
        </Box>
      </Alert>
    );
  }

  // Cas 3 : consent actif, pas de bannière
  return null;
}
