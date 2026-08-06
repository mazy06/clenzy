import React from 'react';
import { Alert, AlertDescription, AlertTitle, Button } from '../../../components/ui';
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
      // L'action passe SOUS le texte (col-start-2) : le slot AlertAction du kit
      // est ancre en haut a droite sur 72 px, trop etroit pour ces libelles.
      <Alert variant="warning" className="mb-3">
        <Warning size={18} strokeWidth={1.75} />
        <AlertTitle className="text-[0.85rem] font-semibold">
          Configuration Open Banking incomplète
        </AlertTitle>
        <AlertDescription className="text-[0.78rem]">
          La méthode Open Banking est sélectionnée, mais l'authentification bancaire (SCA)
          n'a pas encore été validée. Aucun virement ne peut être effectué tant que ce n'est pas fait.
        </AlertDescription>
        {onReconnect && (
          <div className="col-start-2 mt-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onReconnect}
              className="text-warning-ink border-warning hover:bg-warning-soft"
            >
              Compléter le SCA
            </Button>
          </div>
        )}
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
      <Alert variant="destructive" className="mb-3">
        <ErrorOutline size={18} strokeWidth={1.75} />
        <AlertTitle className="text-[0.85rem] font-semibold">
          Consent bancaire expiré
        </AlertTitle>
        <AlertDescription className="text-[0.78rem]">
          Votre consent Open Banking a expiré le{' '}
          <strong>{new Date(expiresAt).toLocaleDateString('fr-FR')}</strong>. Les virements automatiques
          sont suspendus jusqu'à reconnexion. Refaites le SCA bancaire pour réactiver les payouts.
        </AlertDescription>
        {onReconnect && (
          <div className="col-start-2 mt-1.5">
            <Button size="sm" variant="destructive" onClick={onReconnect}>
              Reconnecter ma banque
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  // Cas 2 : expire dans < 7 jours
  if (daysUntilExpiry <= WARNING_THRESHOLD_DAYS) {
    return (
      <Alert variant="warning" className="mb-3">
        <Warning size={18} strokeWidth={1.75} />
        <AlertTitle className="text-[0.85rem] font-semibold">
          Consent bancaire à renouveler bientôt
        </AlertTitle>
        <AlertDescription className="text-[0.78rem]">
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
        </AlertDescription>
        {onReconnect && (
          <div className="col-start-2 mt-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onReconnect}
              className="text-warning-ink border-warning hover:bg-warning-soft"
            >
              Renouveler maintenant
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  // Cas 3 : consent actif, pas de bannière
  return null;
}
