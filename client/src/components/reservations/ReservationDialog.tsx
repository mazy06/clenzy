import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Button, Dialog, DialogContent, DialogTitle } from '../ui';
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

// Pied de modale : `ghost` pour se retirer, `default` pour l'action qui engage
// — les boutons du kit, comme dans le reste de l'application.
const FOOT_CLS =
  'flex items-center gap-2.5 px-[22px] py-[14px] border-t border-solid border-border bg-card shrink-0';

// Une section de la modale : en-tête illustré + champs, séparée de la suivante
// par un filet (pas de carte dans la carte).
const SECTION_CLS = 'flex flex-col gap-3.5 border-t border-solid border-border pt-5 first:border-t-0 first:pt-0';

// ─── Corps édition (écran unique, 2 colonnes) ─────────────────────────────────
const EditBody: React.FC<{ form: UseReservationFormResult; onClose: () => void }> = ({ form, onClose }) => {
  const { t } = useTranslation();

  return (
    <>
      {/* La 2e colonne apparait a partir de 901 px. */}
      <div className="flex-1 overflow-y-auto grid gap-0 grid-cols-[1fr] min-[901px]:grid-cols-[1fr_1fr]">
        <div
          className={cn(
            'flex flex-col gap-5 p-[22px] border-solid border-border',
            'border-b min-[901px]:border-b-0 min-[901px]:border-e',
          )}
        >
          <section className={SECTION_CLS}><StaySection form={form} /></section>
          <section className={SECTION_CLS}><GuestSection form={form} /></section>
        </div>
        <div className="flex flex-col gap-5 p-[22px]">
          <section className={SECTION_CLS}><PricingSection form={form} /></section>
          <section className={SECTION_CLS}><ExtrasSection form={form} /></section>
        </div>

        <ConflictAlert form={form} fullWidth />
      </div>

      {/* Hors de la zone defilante, cf. la meme correction dans le wizard. */}
      {form.error && (
        <p
          role="alert"
          className="shrink-0 px-[22px] pb-2 text-[12.5px] font-semibold text-destructive-ink"
        >
          {form.error}
        </p>
      )}

      <div className={FOOT_CLS}>
        {/* Le séjour tel qu'il sera enregistré, en euros comme les champs du tarif. */}
        {form.numberOfNights > 0 && (
          <p className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
            {form.nightsText} · {t('reservations.dialog.total')}{' '}
            <span className="font-semibold text-foreground">{form.totalPrice.toFixed(2)} €</span>
          </p>
        )}
        <div className="ms-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={form.handleSubmit} disabled={form.submitDisabled}>
            <Check size={15} strokeWidth={2} />
            {form.saving ? t('reservations.dialog.submitSaving') : t('common.save')}
          </Button>
        </div>
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
      </div>

      {/* Hors de la zone defilante, juste au-dessus des boutons : a l'interieur,
          le message se retrouvait sous le pli des que l'etape etait haute. Le
          bouton restait actif, le clic ne produisait rien de visible, et rien
          ne disait ce qui bloquait. */}
      {form.error && (
        <p
          role="alert"
          className="shrink-0 px-[22px] pb-2 text-[12.5px] font-semibold text-destructive-ink"
        >
          {form.error}
        </p>
      )}
      {form.nightsCapOverrun && (
        <div role="alert" className="mx-[22px] mb-2 flex shrink-0 flex-col gap-2 rounded-md border border-destructive/40 px-3 py-2.5">
          <p className="m-0 text-[12.5px] font-semibold text-destructive-ink">
            {t('reservations.dialog.nightsCap.title', 'Plafond annuel de nuitées dépassé')}
          </p>
          <p className="m-0 text-[12.5px] text-muted-foreground">{form.nightsCapOverrun}</p>
          <p className="m-0 text-[12px] text-muted-foreground">
            {t('reservations.dialog.nightsCap.hint',
              'Résidence principale : 120 nuits par an au plus. Vous pouvez déroger ; les gestionnaires de l’organisation en seront prévenus.')}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={form.dismissNightsCapOverrun}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={form.confirmNightsCapDerogation} disabled={form.saving}>
              {t('reservations.dialog.nightsCap.override', 'Déroger et créer')}
            </Button>
          </div>
        </div>
      )}

      <div className={FOOT_CLS}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <div className="ms-auto flex gap-2">
          {step > 1 && (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ArrowBack className="cn-rtl-flip" size={15} strokeWidth={2} />
              {t('reservations.dialog.previous')}
            </Button>
          )}
          {step < 4 ? (
            <Button size="sm" onClick={() => canGoNext && setStep((s) => s + 1)} disabled={!canGoNext}>
              {t('reservations.dialog.next')}
              <ArrowForward className="cn-rtl-flip" size={15} strokeWidth={2} />
            </Button>
          ) : (
            <Button size="sm" onClick={form.handleSubmit} disabled={finalizeDisabled}>
              <Check size={15} strokeWidth={2} />
              {form.saving
                ? t('reservations.dialog.submitCreating')
                : form.requestPayment
                  ? t('reservations.dialog.submitCreatePayment')
                  : t('reservations.dialog.submitCreate')}
            </Button>
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
