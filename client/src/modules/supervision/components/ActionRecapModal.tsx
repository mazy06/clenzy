/* ============================================================
   <ActionRecapModal> — rendre compte, pas proposer

   Famille « informative ». L'assignation automatique réussissait en silence :
   seul le destinataire de la mission l'apprenait, et côté gestion rien ne
   distinguait une mission confiée d'une mission oubliée.

   Cette modale n'exécute RIEN. Son bouton retire la carte de la file, une fois
   l'information lue — c'est la seule modale dont le CTA ne déclenche aucun
   effet métier, et son libellé le dit.
   ============================================================ */

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import { entryOf } from './actionRegistry';
import type { SuggestionPreview } from './ActionReviewModal';
import type { PendingAction, PortfolioPendingAction } from '../types';

export interface ActionRecapModalProps {
  action: PendingAction | PortfolioPendingAction;
  onClose: () => void;
  /** Retire la carte de la file : rien d'autre ne se produit. */
  onAcknowledge: () => void;
}

export function ActionRecapModal({ action, onClose, onAcknowledge }: ActionRecapModalProps) {
  const { t } = useTranslation();
  const entry = entryOf(action.applyActionType);
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [failed, setFailed] = useState(false);

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
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [action.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-balance">
            {entry ? t(entry.titleKey, entry.titleFallback) : ''}
          </DialogTitle>
          <DialogDescription className="text-balance">{action.title}</DialogDescription>
        </DialogHeader>

        {!preview && !failed ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="size-4" />
          </div>
        ) : failed ? (
          <p className="py-2 text-sm text-[var(--bui-muted-foreground)] text-pretty">
            {t(
              'supervision.recap.unavailable',
              'Le détail n’a pas pu être chargé. La mission a bien été confiée : la fiche de la demande en garde la trace.',
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
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

            {/* La situation a pu changer depuis le récapitulatif. */}
            {preview!.blocked && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{preview!.blocked}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onAcknowledge}>
            {entry ? t(entry.ctaKey, entry.ctaFallback) : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActionRecapModal;
