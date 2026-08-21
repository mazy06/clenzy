import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, Button, Card, CardContent, Spinner } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import StatusChip from '../../components/StatusChip';
import { Gavel } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateTime } from '../../utils/formatUtils';
import { providerTermsApi, type ProviderTermsStatus } from '../../services/api/usersApi';

interface Props {
  /** Averti le parcours d'onboarding qu'une acceptation vient d'avoir lieu. */
  onAccepted?: () => void;
}

/**
 * CGU prestataire — acceptation HORODATEE (V1).
 *
 * Ce n'est pas une signature electronique : des conditions generales se
 * satisfont juridiquement d'une trace (version, date, IP resolue cote serveur).
 * Le moteur de signature reste reserve aux mandats de gestion proprietaire, qui
 * engagent la gestion d'un bien.
 *
 * La VERSION acceptee est comparee a la version courante : republier des CGU
 * redemande l'accord sans effacer la trace precedente.
 */
export default function ProviderTermsCard({ onAccepted }: Props) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [status, setStatus] = useState<ProviderTermsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    providerTermsApi.getMine()
      .then(setStatus)
      .catch(() => setError(t('account.terms.loadError', 'Impossible de charger vos conditions.')))
      .finally(() => setLoading(false));
  }, [t]);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      setStatus(await providerTermsApi.accept());
      notify.success(t('account.terms.accepted', 'Conditions acceptées'));
      onAccepted?.();
    } catch {
      setError(t('account.terms.acceptError', "L'enregistrement a échoué, réessayez."));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Card size="sm" className="shadow-none">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gavel size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <p className="m-0 text-2xs font-bold uppercase tracking-wider text-faint">
              {t('account.terms.title', 'Conditions de prestation')}
            </p>
          </div>
          {status && (
            <StatusChip
              tone={status.upToDate ? 'ok' : 'warn'}
              label={status.upToDate
                ? t('account.terms.upToDate', 'Acceptées')
                : t('account.terms.pending', 'À accepter')}
              size="sm"
              dot
            />
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Spinner className="size-6" /></div>
        ) : (
          <>
            <p className="m-0 text-xs text-muted-foreground">
              {t('account.terms.body',
                "Elles fixent les règles de vos missions : tarifs appliqués, preuve photo, commission retenue par la conciergerie et versement de votre rémunération. Votre accord est nécessaire pour être payé.")}
            </p>

            {/* La trace vaut preuve : on la montre a l'interesse plutot que de la
                garder pour le seul back-office. */}
            {status?.acceptedAt && (
              <p className="m-0 text-xs text-muted-foreground tabular-nums">
                {t('account.terms.acceptedOn', 'Acceptées le')} {formatDateTime(status.acceptedAt)}
                {status.acceptedVersion && ` · ${t('account.terms.version', 'version')} ${status.acceptedVersion}`}
              </p>
            )}

            {/* Version republiee : l'ancienne acceptation reste tracee, mais elle
                ne vaut plus pour le texte en vigueur. */}
            {status && !status.upToDate && status.acceptedVersion && (
              <Alert variant="warning" className="py-1.5">
                <TriangleAlert />
                <AlertDescription>
                  {t('account.terms.newVersion',
                    'Les conditions ont été mises à jour depuis votre dernière acceptation.')}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="py-1.5">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {status && !status.upToDate && (
              <div>
                <Button variant="secondary" size="sm" onClick={accept} disabled={accepting}>
                  {accepting && <Spinner className="size-4" />}
                  {t('account.terms.accept', "J'accepte les conditions de prestation")}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
