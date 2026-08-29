/* ============================================================
   <ActionConfirmModal> — dire la conséquence avant de la produire

   Ouverte au clic sur le CTA d'une carte HITL dont l'action n'a aucun
   paramètre à choisir, mais dont l'effet engage : de l'argent bouge, une
   réservation est annulée, des données sont effacées, quelque chose sort
   vers un tiers.

   Ces cartes s'exécutaient au clic. Le libellé du bouton (« Verser »,
   « Publier ») ne disait ni le montant, ni l'ampleur, ni ce qui devenait
   irrattrapable — et l'écran ne rendait la main qu'une fois l'acte commis.

   Le texte de chaque type vit dans actionRegistry.ts : ici, il n'y a que la
   mise en scène.
   ============================================================ */

import { useState } from 'react';
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
  Field,
  FieldLabel,
  Input,
  Spinner,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import { entryOf } from './actionRegistry';
import type { PendingAction, PortfolioPendingAction } from '../types';

export interface ActionConfirmModalProps {
  action: PendingAction | PortfolioPendingAction;
  onClose: () => void;
  /** Confirme : le parent applique la carte. */
  onConfirm: () => void;
}

/**
 * Mot à saisir pour les actions irrattrapables.
 *
 * <p>Court, en majuscules, et sans rapport avec le bouton : une saisie qu'on
 * peut faire d'un réflexe ne protège de rien.</p>
 */
const TYPED_GUARD = 'CONFIRMER';

export function ActionConfirmModal({ action, onClose, onConfirm }: ActionConfirmModalProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const entry = entryOf(action.applyActionType);
  // Un type hors registre n'a rien à confirmer d'utile : le parent ne devrait
  // pas nous ouvrir, mais mieux vaut ne rien afficher que d'inventer un texte.
  if (!entry?.confirm) return null;
  const copy = entry.confirm;

  const irreversible = copy.severity === 'irreversible';
  const guardSatisfied = !irreversible || typed.trim().toUpperCase() === TYPED_GUARD;

  const confirm = () => {
    if (!guardSatisfied) return;
    setSubmitting(true);
    onConfirm();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-balance">{t(entry.titleKey, entry.titleFallback)}</DialogTitle>
          <DialogDescription className="text-balance">{action.title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Ce qui va se passer, une conséquence par ligne. */}
          <ul className="flex flex-col gap-2">
            {copy.consequences.map((line) => (
              <li key={line.key} className="flex gap-2.5 text-sm text-[var(--bui-foreground)]">
                <span
                  className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--bui-muted-foreground)]"
                  aria-hidden
                />
                <span className="text-pretty">{t(line.key, line.fallback)}</span>
              </li>
            ))}
          </ul>

          {/* Le montant de la carte est un instantané du scan : le serveur le
              recalcule à l'exécution. Le taire laisserait croire qu'il est ferme. */}
          {action.amountEur != null && (
            <div className="flex items-baseline justify-between gap-3 rounded-md bg-[var(--bui-muted)] px-3.5 py-2.5">
              <span className="text-xs text-[var(--bui-muted-foreground)]">
                {copy.amountIsRecomputed
                  ? t('supervision.confirm.amountEstimate', 'Montant estimé')
                  : t('supervision.confirm.amount', 'Montant')}
              </span>
              <span className="text-base font-semibold tabular-nums">
                <Money value={action.amountEur} from="EUR" />
              </span>
            </div>
          )}
          {action.amountEur != null && copy.amountIsRecomputed && (
            <p className="-mt-2 text-xs text-[var(--bui-muted-foreground)]">
              {t(
                'supervision.confirm.recomputedNote',
                'Le montant exact est recalculé au moment de l’exécution : il peut différer de cette estimation.',
              )}
            </p>
          )}

          {/* Irrattrapable : on demande un geste délibéré, pas un clic. */}
          {irreversible && (
            <>
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>
                  {t('supervision.confirm.irreversible', 'Cette action ne peut pas être annulée.')}
                </AlertDescription>
              </Alert>
              <Field>
                <FieldLabel htmlFor="confirm-guard">
                  {t('supervision.confirm.typeToConfirm', {
                    word: TYPED_GUARD,
                    defaultValue: 'Saisissez {{word}} pour continuer',
                  })}
                </FieldLabel>
                <Input
                  id="confirm-guard"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={TYPED_GUARD}
                />
              </Field>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant={irreversible ? 'destructive' : 'default'}
            onClick={confirm}
            disabled={!guardSatisfied || submitting}
          >
            {submitting && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {t(entry.ctaKey, entry.ctaFallback)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActionConfirmModal;
