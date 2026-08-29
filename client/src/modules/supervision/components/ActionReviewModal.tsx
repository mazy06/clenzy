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

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Spinner,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-balance">
            {entry ? t(entry.titleKey, entry.titleFallback) : ''}
          </DialogTitle>
          <DialogDescription className="text-balance">{action.title}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="size-4" />
          </div>
        ) : failed ? (
          <p className="py-2 text-sm text-[var(--bui-muted-foreground)] text-pretty">
            {t(
              'supervision.review.previewFailed',
              'L’aperçu n’a pas pu être chargé. L’action reste possible : le destinataire et le contenu seront résolus à l’envoi.',
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Destinataire et canal — le cœur de la relecture. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs uppercase tracking-wide text-[var(--bui-muted-foreground)]">
                  {t('supervision.review.recipients', 'Destinataire')}
                </span>
                {preview!.channel && <Badge variant="secondary">{preview!.channel}</Badge>}
              </div>
              {noRecipient ? (
                <span className="text-sm text-[var(--bui-muted-foreground)]">
                  {t('supervision.review.noRecipient', 'Aucun destinataire résolu.')}
                </span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {preview!.recipients.map((r) => (
                    <li key={r} className="text-sm font-medium">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {preview!.subject && (
              <>
                <Separator />
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-[var(--bui-muted-foreground)]">
                    {t('supervision.review.subject', 'Objet')}
                  </span>
                  <span className="text-sm">{preview!.subject}</span>
                </div>
              </>
            )}

            {preview!.facts.length > 0 && (
              <>
                <Separator />
                <ul className="flex flex-col gap-2">
                  {preview!.facts.map((fact) => (
                    <li key={fact} className="flex gap-2.5 text-sm text-pretty">
                      <span
                        className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--bui-muted-foreground)]"
                        aria-hidden
                      />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Le texte exact, quand il existe déjà. */}
            {preview!.body && (
              <>
                <Separator />
                <div className="max-h-[220px] overflow-y-auto rounded-md bg-[var(--bui-muted)] p-3 text-sm whitespace-pre-wrap">
                  {preview!.body}
                </div>
              </>
            )}
            {!preview!.bodyRendered && !preview!.body && (
              <p className="text-xs text-[var(--bui-muted-foreground)] text-pretty">
                {t(
                  'supervision.review.bodyNotRendered',
                  'Le message est composé au moment de l’envoi : son texte exact n’est pas affichable ici.',
                )}
              </p>
            )}

            {/* La carte peut dater : le refus se voit ici, pas à la validation. */}
            {preview!.blocked && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{preview!.blocked}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActionReviewModal;
