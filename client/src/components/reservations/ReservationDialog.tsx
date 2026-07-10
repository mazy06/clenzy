import React, { useState, useEffect } from 'react';
import { Dialog, Box, Typography, useMediaQuery } from '@mui/material';
import { Check, Warning as WarningIcon, ArrowBack, ArrowForward } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useReservationForm } from './useReservationForm';
import type { ReservationDialogProps, UseReservationFormResult } from './useReservationForm';
import { BTN_GHOST_SX, BTN_PRIMARY_SX } from './reservationDialogStyles';
import ReservationDialogHeader from './ReservationDialogHeader';
import ReservationWizardSteps from './ReservationWizardSteps';
import PropertySelectField from './PropertySelectField';
import StaySection from './StaySection';
import GuestSection from './GuestSection';
import PricingSection from './PricingSection';
import ExtrasSection from './ExtrasSection';
import FinalizeStep from './FinalizeStep';

export type { ReservationDialogProps, LockedProperty } from './useReservationForm';

// ─── Dialogue de réservation « Signature » ────────────────────────────────────
//
// Orchestrateur MINCE. Logique → useReservationForm ; styles → reservationDialogStyles ;
// rendu → sous-composants. CRÉATION = assistant 4 étapes (wizard) ; ÉDITION = écran
// unique 2 colonnes. Soumission INTERNE : invalide planningKeys.all ET reservationsKeys.all.

// ─── Alerte conflit (partagée) ────────────────────────────────────────────────
const ConflictAlert: React.FC<{ form: UseReservationFormResult; fullWidth?: boolean }> = ({ form, fullWidth }) => {
  const { t } = useTranslation();
  if (!form.hasConflict) return null;
  return (
    <Box
      sx={{
        ...(fullWidth ? { gridColumn: '1 / -1', margin: '0 22px 20px' } : {}),
        backgroundColor: 'var(--warn-soft)',
        border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
        borderRadius: '12px',
        padding: '13px 16px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}>
          <WarningIcon size={17} strokeWidth={1.75} />
        </Box>
        {t('reservations.dialog.conflictTitle')}
      </Box>
      {form.conflictWarnings.map((w, i) => (
        <Typography key={i} sx={{ fontSize: '12.5px', color: 'var(--body)', marginTop: '4px', paddingInlineStart: '26px' }}>
          {w}
        </Typography>
      ))}
    </Box>
  );
};

const FOOT_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 22px',
  borderTop: '1px solid var(--line)',
  backgroundColor: 'var(--surface-2)',
  flexShrink: 0,
} as const;

// ─── Corps édition (écran unique, 2 colonnes) ─────────────────────────────────
const EditBody: React.FC<{ form: UseReservationFormResult; onClose: () => void }> = ({ form, onClose }) => {
  const { t } = useTranslation();
  const stackColumns = useMediaQuery('(max-width: 900px)');

  return (
    <>
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: stackColumns ? '1fr' : '1fr 1fr', gap: 0 }}>
        <Box
          sx={{
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            borderRight: stackColumns ? 'none' : '1px solid var(--line)',
            borderBottom: stackColumns ? '1px solid var(--line)' : 'none',
          }}
        >
          <StaySection form={form} />
          <GuestSection form={form} />
        </Box>
        <Box sx={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <PricingSection form={form} />
          <ExtrasSection form={form} />
        </Box>

        <ConflictAlert form={form} fullWidth />
        {form.error && (
          <Typography sx={{ gridColumn: '1 / -1', margin: '0 22px 20px', fontSize: '12.5px', fontWeight: 600, color: 'var(--err)' }}>
            {form.error}
          </Typography>
        )}
      </Box>

      <Box sx={{ ...FOOT_SX, justifyContent: 'flex-end' }}>
        <Box component="button" type="button" onClick={onClose} sx={BTN_GHOST_SX}>
          {t('common.cancel')}
        </Box>
        <Box component="button" type="button" onClick={form.handleSubmit} disabled={form.submitDisabled} sx={BTN_PRIMARY_SX}>
          <Check size={15} strokeWidth={2} />
          {form.saving ? t('reservations.dialog.submitSaving') : t('common.save')}
        </Box>
      </Box>
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

      <Box sx={{ flex: 1, overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
          <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--err)' }}>{form.error}</Typography>
        )}
      </Box>

      <Box sx={FOOT_SX}>
        <Box component="button" type="button" onClick={onClose} sx={BTN_GHOST_SX}>
          {t('common.cancel')}
        </Box>
        <Box sx={{ marginInlineStart: 'auto', display: 'flex', gap: '10px' }}>
          {step > 1 && (
            <Box component="button" type="button" onClick={() => setStep((s) => s - 1)} sx={BTN_GHOST_SX}>
              <ArrowBack size={15} strokeWidth={2} />
              {t('reservations.dialog.previous')}
            </Box>
          )}
          {step < 4 ? (
            <Box component="button" type="button" onClick={() => canGoNext && setStep((s) => s + 1)} disabled={!canGoNext} sx={BTN_PRIMARY_SX}>
              {t('reservations.dialog.next')}
              <ArrowForward size={15} strokeWidth={2} />
            </Box>
          ) : (
            <Box component="button" type="button" onClick={form.handleSubmit} disabled={finalizeDisabled} sx={BTN_PRIMARY_SX}>
              <Check size={15} strokeWidth={2} />
              {form.saving
                ? t('reservations.dialog.submitCreating')
                : form.requestPayment
                  ? t('reservations.dialog.submitCreatePayment')
                  : t('reservations.dialog.submitCreate')}
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
};

// ─── Shell ────────────────────────────────────────────────────────────────────
const ReservationDialog: React.FC<ReservationDialogProps> = (props) => {
  const { open, onClose } = props;
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isCreate = props.mode === 'create';

  const form = useReservationForm(props);

  // Étape du wizard (création) — remise à 1 à chaque ouverture.
  const [step, setStep] = useState(1);
  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  if (props.mode === 'edit' && !props.reservation) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          // Wizard = colonne unique (assez large pour le calendrier 2 mois) ; édition = 2 colonnes.
          width: isCreate ? 740 : 980,
          maxWidth: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--card)',
          backgroundImage: 'none',
          color: 'var(--body)',
          border: '1px solid var(--line)',
          borderRadius: '18px',
          boxShadow: 'var(--shadow-pop)',
          '@keyframes rmodalIn': {
            from: { transform: 'translateY(12px) scale(.985)' },
            to: { transform: 'none' },
          },
          animation: reduceMotion ? 'none' : 'rmodalIn .22s cubic-bezier(.16,1,.3,1)',
        },
      }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(10,18,24,.5)', backdropFilter: 'blur(3px)' } } }}
    >
      <ReservationDialogHeader form={form} onClose={onClose} />
      {isCreate ? (
        <CreateWizard form={form} onClose={onClose} step={step} setStep={setStep} />
      ) : (
        <EditBody form={form} onClose={onClose} />
      )}
    </Dialog>
  );
};

export default ReservationDialog;
