/* ============================================================
   <SupervisionPendingAction> — carte d'approbation inline (HITL)

   Quand le moteur multi-agent met un run en PAUSE sur une action sensible
   (interrupt AG-UI), le panneau affiche cette carte : nom de l'outil +
   message + Valider / Refuser. La décision reprend le run (resume) via
   `onResolve(true|false)`.

   Registre visuel : deep-space, cohérent avec SupervisionChatBar (surface
   sombre translucide). Accent ambre #F0B24B = « attend ta validation »
   (cf. STATUS.wait), pour signaler une action en suspens. lucide via
   src/icons, pas d'emoji, prefers-reduced-motion respecté.
   ============================================================ */

import { useState } from 'react';
import { Box } from '@mui/material';
import { Gavel, Check, Close } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PendingAgentAction } from '../types';

export interface SupervisionPendingActionProps {
  action: PendingAgentAction;
  /** Décision opérateur : true = valider (l'outil s'exécute), false = refuser. */
  onResolve: (confirmed: boolean) => void;
}

const ACCENT = '#F0B24B'; // ambre = action en attente de validation (STATUS.wait)
const SURFACE = 'rgba(20,24,58,.94)';
const BORDER = '1px solid rgba(240,178,75,.35)';

export function SupervisionPendingAction({ action, onResolve }: SupervisionPendingActionProps) {
  const { t } = useTranslation();
  // Verrou local : évite un double-clic / double-resume pendant que le run reprend.
  const [submitting, setSubmitting] = useState(false);

  const resolve = (confirmed: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    onResolve(confirmed);
  };

  return (
    <Box
      role="alertdialog"
      aria-label={t('supervision.approval.title', 'Validation requise')}
      sx={{
        width: 300,
        borderRadius: '14px',
        bgcolor: SURFACE,
        border: BORDER,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 16px 40px -22px rgba(0,0,0,.7)',
        overflow: 'hidden',
        color: '#E7E9FB',
        // Entrée discrète, désactivée si l'utilisateur préfère moins d'animation.
        '@keyframes supervisionApprovalIn': {
          from: { opacity: 0, transform: 'translateY(-4px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: 'supervisionApprovalIn 200ms ease-out',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      {/* En-tête : intention (validation requise) + outil concerné */}
      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
        <div className="flex items-center justify-center w-[26px] h-[26px] rounded-[8px] bg-[rgba(240,178,75,.16)] shrink-0" style={{ color: ACCENT }}>
          <Gavel size={15} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-[0.3px] uppercase" style={{ color: ACCENT }}>
            {t('supervision.approval.title', 'Validation requise')}
          </div>
          <div className="text-[13.5px] font-bold leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap">
            {action.toolName}
          </div>
        </div>
      </div>

      {/* Message d'explication remonté par l'agent */}
      <div className="px-2 pb-2 text-[12.5px] leading-[1.5] text-[rgba(231,233,251,.82)] whitespace-pre-wrap break-words">
        {action.message}
      </div>

      {/* Décision : Refuser (secondaire) / Valider (primaire ambre) */}
      <div className="flex gap-1.5 px-2 py-2 border-t border-[rgba(255,255,255,.1)]">
        <DecisionButton
          variant="reject"
          disabled={submitting}
          onClick={() => resolve(false)}
          icon={<Close size={15} strokeWidth={2.25} />}
          label={t('supervision.approval.reject', 'Refuser')}
        />
        <DecisionButton
          variant="validate"
          disabled={submitting}
          onClick={() => resolve(true)}
          icon={<Check size={15} strokeWidth={2.25} />}
          label={
            submitting
              ? t('supervision.approval.submitting', 'Transmission…')
              : t('supervision.approval.validate', 'Valider')
          }
        />
      </div>
    </Box>
  );
}

interface DecisionButtonProps {
  variant: 'validate' | 'reject';
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function DecisionButton({ variant, disabled, onClick, icon, label }: DecisionButtonProps) {
  const isValidate = variant === 'validate';
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.625,
        px: 1,
        py: 0.75,
        borderRadius: '10px',
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease, opacity 180ms ease',
        border: isValidate ? '1px solid transparent' : '1px solid rgba(255,255,255,.18)',
        bgcolor: isValidate ? ACCENT : 'transparent',
        color: isValidate ? '#0c0e2a' : '#E7E9FB',
        '&:hover': disabled
          ? {}
          : isValidate
            ? { bgcolor: '#F6C36B' }
            : { bgcolor: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.3)' },
        '&:disabled': { opacity: 0.55 },
      }}
    >
      {icon}
      <span>{label}</span>
    </Box>
  );
}
