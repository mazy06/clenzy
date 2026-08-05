import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Dialog, DialogContent, DialogTitle } from '../ui';
import { Check, ArrowBack, ArrowForward } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useReservationForm } from './useReservationForm';
import type { ReservationDialogProps, UseReservationFormResult } from './useReservationForm';
import ReservationDialogHeader from './ReservationDialogHeader';
import ReservationWizardSteps from './ReservationWizardSteps';
import PropertySelectField from './PropertySelectField';
import StaySection from './StaySection';
import GuestSection from './GuestSection';
import PricingSection from './PricingSection';
import ExtrasSection from './ExtrasSection';
import FinalizeStep from './FinalizeStep';
import ConflictAlert from './ConflictAlert';
import BlockBody from './BlockBody';

export type { ReservationDialogProps, LockedProperty } from './useReservationForm';

/** Mode d'entrée du dialogue (création) : nouvelle réservation OU blocage de période. */
export type ReservationDialogEntryMode = 'reservation' | 'block';

// ─── Dialogue de réservation ──────────────────────────────────────────────────
//
// Orchestrateur MINCE. Logique → useReservationForm ; styles → reservationDialogStyles ;
// rendu → sous-composants. CRÉATION = assistant 4 étapes (wizard) OU écran blocage ;
// ÉDITION = écran unique 2 colonnes. Soumission INTERNE : invalide planningKeys.all ET
// reservationsKeys.all.

// Equivalents en classes de FOOT_SX / BTN_GHOST_SX / BTN_PRIMARY_SX (reservationDialogStyles).
// Les deux niveaux de bouton portent la hiérarchie du pied : `ghost` pour se retirer,
// contour `primary` pour l'action qui engage.
const FOOT_CLS =
  'flex items-center gap-2.5 px-[22px] py-[14px] border-t border-solid border-border bg-card shrink-0';
const BTN_BASE_CLS =
  'inline-flex items-center gap-2 h-[38px] px-[17px] rounded-[11px] font-[inherit] text-[12.5px] font-semibold cursor-pointer border border-solid border-transparent [transition:transform_.12s,background_.14s,border-color_.14s,color_.14s] active:enabled:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BTN_GHOST_CLS = `${BTN_BASE_CLS} bg-transparent text-muted-foreground hover:text-foreground`;
const BTN_PRIMARY_CLS = `${BTN_BASE_CLS} bg-transparent border-primary text-primary hover:enabled:bg-primary-soft disabled:opacity-[.45] disabled:cursor-not-allowed`;

// ─── Corps édition (écran unique, 2 colonnes) ─────────────────────────────────
const EditBody: React.FC<{ form: UseReservationFormResult; onClose: () => void }> = ({ form, onClose }) => {
  const { t } = useTranslation();

  return (
    <>
      {/* max-width: 900px MUI => la 2e colonne apparait a partir de 901 px. */}
      <div className="flex-1 overflow-y-auto grid gap-0 grid-cols-[1fr] min-[901px]:grid-cols-[1fr_1fr]">
        <div
          className={cn(
            'flex flex-col gap-[18px] p-[22px] border-solid border-border',
            'border-b min-[901px]:border-b-0 min-[901px]:border-r',
          )}
        >
          <StaySection form={form} />
          <GuestSection form={form} />
        </div>
        <div className="flex flex-col gap-[18px] p-[22px]">
          <PricingSection form={form} />
          <ExtrasSection form={form} />
        </div>

        <ConflictAlert form={form} fullWidth />
        {form.error && (
          <p className="col-span-full mt-0 mx-[22px] mb-5 text-[12.5px] font-semibold text-destructive-ink">
            {form.error}
          </p>
        )}
      </div>

      <div className={cn(FOOT_CLS, 'justify-end')}>
        <button type="button" onClick={onClose} className={BTN_GHOST_CLS}>
          {t('common.cancel')}
        </button>
        <button type="button" onClick={form.handleSubmit} disabled={form.submitDisabled} className={BTN_PRIMARY_CLS}>
          <Check size={15} strokeWidth={2} />
          {form.saving ? t('reservations.dialog.submitSaving') : t('common.save')}
        </button>
      </div>
    </>
  );
};

// ─── Corps création (wizard 4 étapes) ─────────────────────────────────────────
const CreateWizard: React.FC<{
  form: UseReservationFormResult;
  onClose: () => void;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
}> = ({ form, onClose, step, setStep }) => {
  const { t } = useTranslation();

  const stepLabels = [
    t('reservations.dialog.stepStay'),
    t('reservations.dialog.stepTraveler'),
    t('reservations.dialog.stepPricing'),
    t('reservations.dialog.stepFinalize'),
  ];

  const step1Valid = !!form.effectivePropertyId && !!form.startDate && !!form.endDate && !form.hasConflict;
  // Voyageur : un prénom + nom suffisent (la fiche est upsertée au submit).
  const step2Valid = !!form.newGuestFirstName.trim() && !!form.newGuestLastName.trim();
  // Étape n atteignable si toutes les précédentes sont valides.
  const reachable = [true, step1Valid, step1Valid && step2Valid, step1Valid && step2Valid];
  const canGoNext = step === 1 ? step1Valid : step === 2 ? step2Valid : true;
  const hasPaymentEmail = !!(form.paymentEmail.trim() || form.newGuestEmail.trim());
  const finalizeDisabled =
    form.submitDisabled || (form.requestPayment && (!(form.totalPrice > 0) || !hasPaymentEmail));

  const goStep = (target: number) => {
    if (target < step || reachable[target - 1]) setStep(target);
  };

  return (
    <>
      <ReservationWizardSteps steps={stepLabels} current={step} reachable={reachable} onStepClick={goStep} />

      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[22px]">
        {step === 1 && (
          <>
            {form.showPropertySelector && <PropertySelectField form={form} />}
            <StaySection form={form} />
            <ConflictAlert form={form} />
          </>
        )}
        {step === 2 && <GuestSection form={form} />}
        {step === 3 && (
          <>
            <PricingSection form={form} />
            <ExtrasSection form={form} />
          </>
        )}
        {step === 4 && <FinalizeStep form={form} />}

        {form.error && (
          <p className="text-[12.5px] font-semibold text-destructive-ink">{form.error}</p>
        )}
      </div>

      <div className={FOOT_CLS}>
        <button type="button" onClick={onClose} className={BTN_GHOST_CLS}>
          {t('common.cancel')}
        </button>
        <div className="ms-auto flex gap-2.5">
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className={BTN_GHOST_CLS}>
              <ArrowBack size={15} strokeWidth={2} />
              {t('reservations.dialog.previous')}
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={() => canGoNext && setStep((s) => s + 1)} disabled={!canGoNext} className={BTN_PRIMARY_CLS}>
              {t('reservations.dialog.next')}
              <ArrowForward size={15} strokeWidth={2} />
            </button>
          ) : (
            <button type="button" onClick={form.handleSubmit} disabled={finalizeDisabled} className={BTN_PRIMARY_CLS}>
              <Check size={15} strokeWidth={2} />
              {form.saving
                ? t('reservations.dialog.submitCreating')
                : form.requestPayment
                  ? t('reservations.dialog.submitCreatePayment')
                  : t('reservations.dialog.submitCreate')}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Shell ────────────────────────────────────────────────────────────────────
const ReservationDialog: React.FC<ReservationDialogProps> = (props) => {
  const { open, onClose } = props;
  const isCreate = props.mode === 'create';

  const form = useReservationForm(props);

  // Étape du wizard (création) — remise à 1 à chaque ouverture.
  const [step, setStep] = useState(1);
  // Mode d'entrée (création) : réservation OU blocage. Réinitialisé sur `initialMode`
  // à chaque ouverture ; le toggle du header permet de basculer.
  const [entryMode, setEntryMode] = useState<ReservationDialogEntryMode>(props.initialMode ?? 'reservation');
  useEffect(() => {
    if (open) {
      setStep(1);
      setEntryMode(props.initialMode ?? 'reservation');
    }
  }, [open, props.initialMode]);

  if (props.mode === 'edit' && !props.reservation) return null;

  const isBlock = isCreate && entryMode === 'block';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Le header du dialogue porte deja sa croix : pas de bouton du gabarit.
          L'animation d'entree et le voile viennent du kit (et respectent deja
          prefers-reduced-motion) — l'ancien keyframes local est redondant. */}
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex flex-col overflow-hidden p-0 max-w-[95vw] max-h-[92vh]',
          'rounded-2xl border border-solid border-border bg-card text-foreground shadow-2xl',
          // Wizard = colonne unique (assez large pour le calendrier 2 mois) ; édition = 2 colonnes.
          isCreate ? 'w-[740px]' : 'w-[980px]',
        )}
      >
        <DialogTitle className="sr-only">
          {isCreate ? 'Nouvelle réservation' : 'Modifier la réservation'}
        </DialogTitle>
        <ReservationDialogHeader
          form={form}
          onClose={onClose}
          entryMode={entryMode}
          onEntryModeChange={setEntryMode}
          showModeToggle={isCreate}
        />
        {isBlock ? (
          <BlockBody form={form} onClose={onClose} />
        ) : isCreate ? (
          <CreateWizard form={form} onClose={onClose} step={step} setStep={setStep} />
        ) : (
          <EditBody form={form} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReservationDialog;
