/* ============================================================
   <ActionReviewModal> — lire avant que ça parte

   Famille « relecture ». Ces cartes adressent un texte à un voyageur, un
   propriétaire ou un fournisseur. Le destinataire et le contenu n'étaient
   résolus qu'à l'envoi : l'écran ne montrait qu'un titre, et une fois parti le
   message ne se rattrape pas.

   L'aperçu est demandé au serveur À L'OUVERTURE, jamais repris du scan : une
   carte peut dater de plusieurs jours, et l'adresse du voyageur a pu être
   complétée depuis.

   Quand le texte exact n'est composable qu'à l'envoi, la modale le DIT et
   montre les faits déterminants. Afficher un texte approchant donnerait une
   assurance que personne n'a.
   ============================================================ */

import { ActionModalContent, ActionModalHeader, ActionModalBody, ActionModalFooter, ActionModalLoading, ActionModalFacts, ActionModalSection } from './ActionModal';
import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  Spinner,
} from '../../../components/ui';
import { TriangleAlert } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import { entryOf } from './actionRegistry';
import type { PendingAction, PortfolioPendingAction } from '../types';

/** Réponse de `GET /ai/supervision/suggestions/{id}/preview`. */
export interface SuggestionPreview {
  channel: string | null;
  recipients: string[];
  subject: string | null;
  body: string | null;
  bodyRendered: boolean;
  facts: string[];
  /** Raison pour laquelle l'envoi échouerait maintenant. */
  blocked: string | null;
  /** Candidats à trancher — vide pour la famille « relecture ». */
  options: Array<{
    paramName: string;
    value: number | string;
    label: string;
    detail: string | null;
    recommended: boolean;
  }>;
  /**
   * Pièces à examiner, prêtes à afficher (`data:` URL). Vide pour toutes les
   * familles sauf « inspection ».
   */
  photos: string[];
}

export interface ActionReviewModalProps {
  action: PendingAction | PortfolioPendingAction;
  onClose: () => void;
  onConfirm: () => void;
}

export function ActionReviewModal({ action, onClose, onConfirm }: ActionReviewModalProps) {
  const { t } = useTranslation();
  const entry = entryOf(action.applyActionType);
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    fetch(buildApiUrl(`/ai/supervision/suggestions/${action.id}/preview`), {
      credentials: 'include',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => (r.ok ? (r.json() as Promise<SuggestionPreview>) : Promise.reject()))
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      // L'aperçu manque, mais l'action reste légitime : on dégrade en
      // confirmation plutôt que de bloquer l'opérateur.
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [action.id]);

  const confirm = () => {
    setSubmitting(true);
    onConfirm();
  };

  const loading = !preview && !failed;
  const noRecipient = preview != null && preview.recipients.length === 0;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <ActionModalContent className="sm:max-w-[560px]">
        <ActionModalHeader action={action} title={entry ? t(entry.titleKey, entry.titleFallback) : ''} description={action.title} />
        <ActionModalBody>

        {loading ? (
          <ActionModalLoading />
        ) : failed ? (
          <p className="py-2 text-sm text-[var(--bui-muted-foreground)] text-pretty">
            {t(
              'supervision.review.previewFailed',
              'L’aperçu n’a pas pu être chargé. L’action reste possible : le destinataire et le contenu seront résolus à l’envoi.',
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="baitly-action-envelope">
              <dt>{t('supervision.review.recipients', 'Destinataire')}</dt>
              <dd>{noRecipient
                ? t('supervision.review.noRecipient', 'Aucun destinataire résolu.')
                : <ul>{preview!.recipients.map((r) => <li key={r}>{r}</li>)}</ul>}</dd>
              {preview!.channel && <>
                <dt>{t('supervision.modal.channel', 'Canal')}</dt><dd>{preview!.channel}</dd>
              </>}
              {preview!.subject && <>
                <dt>{t('supervision.review.subject', 'Objet')}</dt><dd className="font-medium">{preview!.subject}</dd>
              </>}
            </dl>

            {preview!.body && <ActionModalSection title={t('supervision.modal.message', 'Message à relire')}>
              <div className="baitly-action-message">{preview!.body}</div>
            </ActionModalSection>}
            {!preview!.bodyRendered && !preview!.body && (
              <p className="baitly-action-modal-note">{t('supervision.review.bodyNotRendered',
                'Le message est composé au moment de l’envoi : son texte exact n’est pas affichable ici.')}</p>
            )}
            {preview!.facts.length > 0 && <ActionModalSection title={t('supervision.modal.consider', 'À prendre en compte')}>
              <ActionModalFacts facts={preview!.facts} />
            </ActionModalSection>}

            {/* La carte peut dater : le refus se voit ici, pas à la validation. */}
            {preview!.blocked && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{preview!.blocked}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        </ActionModalBody>
        <ActionModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            onClick={confirm}
            disabled={submitting || loading || Boolean(preview?.blocked)}
          >
            {submitting && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {entry ? t(entry.ctaKey, entry.ctaFallback) : ''}
          </Button>
        </ActionModalFooter>
      </ActionModalContent>
    </Dialog>
  );
}

export default ActionReviewModal;
