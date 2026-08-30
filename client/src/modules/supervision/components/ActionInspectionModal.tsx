/* ============================================================
   <ActionInspectionModal> — examiner, puis trancher

   Famille « inspection ». L'intervenant a rendu son travail : photos, durée
   réelle, horodatage de fin. Le gestionnaire regarde, puis décide — valider
   rend le solde exigible, refuser renvoie en reprise.

   Ce contrôle n'existait pas. L'intervenant clôturait lui-même, et le solde
   devenait dû sans que personne n'ait rien regardé.

   Deux issues, et c'est ce qui distingue cette modale d'une confirmation : y
   refuser n'est pas « ne rien faire », c'est un acte qui renvoie le travail
   avec un motif.
   ============================================================ */

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AspectRatio,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Spinner,
  Textarea,
} from '../../../components/ui';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import { entryOf } from './actionRegistry';
import type { SuggestionPreview } from './ActionReviewModal';
import type { PendingAction, PortfolioPendingAction } from '../types';

export interface ActionInspectionModalProps {
  action: PendingAction | PortfolioPendingAction;
  onClose: () => void;
  /** Valide : le parent applique la carte, le solde devient exigible. */
  onApprove: () => void;
  /** Refuse : renvoie le travail en reprise avec ce motif. */
  onReject: (reason: string) => void;
}

/** `{"interventionId":97}` → 97. Null si illisible. */
function interventionIdOf(actionParams: string | undefined): number | null {
  if (!actionParams) return null;
  try {
    const parsed = JSON.parse(actionParams) as { interventionId?: unknown };
    return typeof parsed.interventionId === 'number' ? parsed.interventionId : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   Une vignette de 96 px ne permet pas de juger un travail. Agrandir se
   fait DANS la modale — pas dans une seconde boîte de dialogue empilée,
   ni dans un onglet qui ferait perdre le contexte du contrôle en cours.
   ------------------------------------------------------------------ */
function PhotoViewer({
  photos, index, onIndex, onClose,
}: {
  photos: string[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const go = (step: number) => onIndex((index + step + photos.length) % photos.length);

  // Les flèches sont le geste naturel pour parcourir des pièces.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--bui-muted)]">
        <img
          src={photos[index]}
          alt={t('supervision.inspection.photoAlt', 'Photo {{n}} sur {{total}}', {
            n: index + 1, total: photos.length,
          })}
          className="max-h-[52vh] w-full object-contain"
        />
        {photos.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => go(-1)}
              className="absolute start-2 top-1/2 -translate-y-1/2 cursor-pointer"
              aria-label={t('supervision.inspection.prevPhoto', 'Photo précédente')}
            >
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => go(1)}
              className="absolute end-2 top-1/2 -translate-y-1/2 cursor-pointer"
              aria-label={t('supervision.inspection.nextPhoto', 'Photo suivante')}
            >
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--bui-muted-foreground)] tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
          {t('supervision.inspection.backToGrid', 'Revenir aux pièces')}
        </Button>
      </div>
    </div>
  );
}

/** Les pièces, en grille, cliquables une à une. */
function PhotoGrid({ photos, onOpen }: { photos: string[]; onOpen: (i: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className="cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-[var(--bui-border)] transition-[border-color,opacity] duration-200 ease-out hover:border-[var(--bui-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bui-ring)]"
          aria-label={t('supervision.inspection.enlargePhoto', 'Agrandir la photo {{n}}', { n: i + 1 })}
        >
          <AspectRatio ratio={1}>
            <img src={photo} alt="" className="size-full object-cover" />
          </AspectRatio>
        </button>
      ))}
    </div>
  );
}

export function ActionInspectionModal({
  action, onClose, onApprove, onReject,
}: ActionInspectionModalProps) {
  const { t } = useTranslation();
  const entry = entryOf(action.applyActionType);
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /** Index de la pièce agrandie ; `null` = grille. */
  const [zoomed, setZoomed] = useState<number | null>(null);

  const interventionId = interventionIdOf(action.actionParams);

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

  const photos = preview?.photos ?? [];
  const loading = !preview && !failed;
  const blocked = Boolean(preview?.blocked);

  const approve = () => {
    setSubmitting(true);
    onApprove();
  };
  const reject = () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    onReject(reason.trim());
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
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
              'supervision.inspection.previewFailed',
              'Le détail du travail rendu n’a pas pu être chargé. Ouvrez la fiche de l’intervention pour l’examiner.',
            )}
          </p>
        ) : (
          /* Le primitive Dialog ne borne pas sa hauteur : une douzaine de
             vignettes pousseraient les deux boutons de décision hors de
             l'écran, sans rien pour y revenir. Seule la lecture défile ;
             l'en-tête et le pied restent en place. */
          <div className="flex max-h-[58vh] flex-col gap-4 overflow-y-auto">
            {/* Les pièces à examiner : photos, durée réelle, ponctualité. */}
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

            {/* Les pièces elles-mêmes. Le résumé annonçait « 3 photos jointes »
                et renvoyait vers un autre écran : personne n'y allait, et le
                contrôle se faisait donc sans regarder. */}
            {photos.length > 0 && (
              zoomed !== null ? (
                <PhotoViewer
                  photos={photos}
                  index={zoomed}
                  onIndex={setZoomed}
                  onClose={() => setZoomed(null)}
                />
              ) : (
                <PhotoGrid photos={photos} onOpen={setZoomed} />
              )
            )}

            {/* La fiche reste accessible : elle porte les photos d'avant, les
                commentaires et l'historique, que ce contrôle n'affiche pas. */}
            {interventionId != null && (
              <a
                href={`/interventions/${interventionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-2 text-[var(--bui-primary)]"
              >
                {t('supervision.inspection.openFile', 'Ouvrir la fiche de l’intervention')}
              </a>
            )}

            {blocked && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{preview!.blocked}</AlertDescription>
              </Alert>
            )}

            {/* Le refus exige un motif : sans lui, l'intervenant apprend qu'on
                refuse sans savoir quoi corriger. */}
            {rejecting && (
              <Field>
                <FieldLabel htmlFor="reject-reason">
                  {t('supervision.inspection.reasonLabel', 'Qu’y a-t-il à reprendre ?')}
                </FieldLabel>
                <Textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={t(
                    'supervision.inspection.reasonPlaceholder',
                    'Photos manquantes, pièce non traitée, finition à revoir…',
                  )}
                />
              </Field>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Annuler')}
          </Button>
          {rejecting ? (
            <Button
              variant="destructive"
              onClick={reject}
              disabled={!reason.trim() || submitting}
            >
              {submitting && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
              {t('supervision.inspection.confirmReject', 'Renvoyer en reprise')}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setRejecting(true)}
                disabled={submitting || loading || blocked}
              >
                {t('supervision.inspection.reject', 'Refuser')}
              </Button>
              <Button onClick={approve} disabled={submitting || loading || blocked}>
                {submitting && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
                {entry ? t(entry.ctaKey, entry.ctaFallback) : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActionInspectionModal;
