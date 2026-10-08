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

import { ActionModalContent, ActionModalHeader, ActionModalBody, ActionModalFooter, ActionModalFacts, ActionModalSection } from './ActionModal';
import { useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  Field,
  FieldLabel,
  Input,
  Spinner,
} from '../../../components/ui';
import { TriangleAlert } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { ActionDescription } from './ActionDescription';
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
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <ActionModalContent className="sm:max-w-[520px]">
        <ActionModalHeader action={action} title={t(entry.titleKey, entry.titleFallback)} description={action.title} />
        <ActionModalBody>

        <div className="flex flex-col gap-4">
          <ActionDescription action={action} />
          <ActionModalSection title={t('supervision.modal.consequences', 'Ce qui va se passer')}>
            <ActionModalFacts facts={copy.consequences.map((line) => t(line.key, line.fallback))} />
          </ActionModalSection>

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

        </ActionModalBody>
        <ActionModalFooter>
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
        </ActionModalFooter>
      </ActionModalContent>
    </Dialog>
  );
}

export default ActionConfirmModal;
