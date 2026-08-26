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
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Spinner,
} from '../../../components/ui';
import { Check, TriangleAlert } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
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
            <ItemGroup className="gap-1.5">
              {options.map((option) => {
                const selected = chosen === option.value;
                return (
                  <Item
                    key={String(option.value)}
                    asChild
                    variant={selected ? 'outline' : 'default'}
                    className={cn(
                      'cursor-pointer transition-colors duration-200',
                      selected && 'bg-[var(--bui-accent)]',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setChosen(option.value)}
                      aria-pressed={selected}
                    >
                      <ItemContent>
                        <ItemTitle className="flex items-center gap-2">
                          {option.label}
                          {option.recommended && (
                            <Badge variant="secondary">
                              {t('supervision.choice.suggested', 'Proposé par l’agent')}
                            </Badge>
                          )}
                        </ItemTitle>
                        {option.detail && <ItemDescription>{option.detail}</ItemDescription>}
                      </ItemContent>
                      {selected && <Check size={15} className="text-[var(--bui-primary)]" />}
                    </button>
                  </Item>
                );
              })}
            </ItemGroup>

            {preview!.facts.length > 0 && (
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
            )}

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
            disabled={chosen === null || submitting || Boolean(preview?.blocked)}
          >
            {submitting && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {entry ? t(entry.ctaKey, entry.ctaFallback) : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActionChoiceModal;
