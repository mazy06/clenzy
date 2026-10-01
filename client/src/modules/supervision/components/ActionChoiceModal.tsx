/* ============================================================
   <ActionChoiceModal> — trancher entre des candidats

   Famille « décider », variante où le paramètre n'est pas un nombre mais un
   choix entre des objets réels : quel devis retenir, laquelle des deux
   réservations annuler, vers quel logement reloger.

   Ces cartes choisissaient SEULES. Le motif exposait le raisonnement de l'agent,
   mais le bouton n'offrait que de l'entériner — les candidats écartés
   n'apparaissaient nulle part.

   Les candidats viennent du serveur À L'OUVERTURE, avec de quoi les comparer.
   Celui que l'agent proposait est présélectionné : un point de départ, pas une
   contrainte.
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
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { DescriptionNarrative } from './ActionDescription';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import type { SuggestionPreview } from './ActionReviewModal';
import { entryOf } from './actionRegistry';
import type { PendingAction, PortfolioPendingAction } from '../types';

export interface PreviewOption {
  paramName: string;
  value: number | string;
  label: string;
  detail: string | null;
  recommended: boolean;
}

export interface ActionChoiceModalProps {
  action: PendingAction | PortfolioPendingAction;
  onClose: () => void;
  /** Confirme : le parent applique la carte avec le candidat retenu. */
  onConfirm: (params: Record<string, number | string | boolean>) => void;
}

export function ActionChoiceModal({ action, onClose, onConfirm }: ActionChoiceModalProps) {
  const { t } = useTranslation();
  const entry = entryOf(action.applyActionType);
  const [preview, setPreview] = useState<(SuggestionPreview & { options: PreviewOption[] }) | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<number | string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    fetch(buildApiUrl(`/ai/supervision/suggestions/${action.id}/preview`), {
      credentials: 'include',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: SuggestionPreview & { options: PreviewOption[] }) => {
        if (cancelled) return;
        setPreview(p);
        // Ce que l'agent proposait : présélectionné, jamais imposé.
        setChosen(p.options.find((o) => o.recommended)?.value ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [action.id]);

  const confirm = () => {
    const option = preview?.options.find((o) => o.value === chosen);
    if (!option) return;
    setSubmitting(true);
    onConfirm({ [option.paramName]: option.value });
  };

  const loading = !preview && !failed;
  const options = preview?.options ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <ActionModalContent className="sm:max-w-[560px]">
        <ActionModalHeader action={action} title={entry ? t(entry.titleKey, entry.titleFallback) : ''} description={action.title} />
        <ActionModalBody>

        {loading ? (
          <ActionModalLoading />
        ) : failed || options.length === 0 ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>
              {t(
                'supervision.choice.noOptions',
                'Les candidats n’ont pas pu être chargés. La situation a peut-être changé depuis que la carte a été émise.',
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset className="baitly-action-choice-list">
              <legend className="sr-only">{t('supervision.modal.choose', 'Choisir une option')}</legend>
              {options.map((option) => (
                <label className="baitly-action-choice" key={String(option.value)}>
                  <input type="radio" name="hitl-choice" checked={chosen === option.value}
                    onChange={() => setChosen(option.value)} disabled={submitting} />
                  <div>
                    <span className="baitly-action-choice-heading">
                      <span>{option.label}</span>
                      {option.recommended && <small>{t('supervision.choice.suggested', 'Proposé par l’agent')}</small>}
                    </span>
                    {option.detail && <DescriptionNarrative text={option.detail} />}
                  </div>
                </label>
              ))}
            </fieldset>

            {preview!.facts.length > 0 && (
              <ActionModalSection title={t('supervision.modal.consider', 'À prendre en compte')}>
                <ActionModalFacts facts={preview!.facts} />
              </ActionModalSection>
            )}

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
            disabled={chosen === null || submitting || Boolean(preview?.blocked)}
          >
            {submitting && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {entry ? t(entry.ctaKey, entry.ctaFallback) : ''}
          </Button>
        </ActionModalFooter>
      </ActionModalContent>
    </Dialog>
  );
}

export default ActionChoiceModal;
