import React from 'react';
import { cn } from '../../../utils/cn';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bolt, CheckCircle, Close, Settings, Warning, AccessTime } from '../../../icons';
import { automationRulesApi, isMessagingAction, type AutomationTrigger } from '../../../services/api/automationRulesApi';
import { anonymizesGuestEmail } from '../../../services/api/reservationsApi';

// Déclencheurs de messagerie « autour de l'arrivée » / « autour du départ » : une
// règle active de messagerie sur l'un d'eux = envoi automatique côté hub.
const CHECK_IN_TRIGGERS: AutomationTrigger[] = ['RESERVATION_CONFIRMED', 'CHECK_IN_APPROACHING', 'CHECK_IN_DAY'];
const CHECK_OUT_TRIGGERS: AutomationTrigger[] = ['CHECK_OUT_DAY', 'CHECK_OUT_PASSED'];

// ─── Messagerie automatique (maquette Signature — onglet Opérations) ─────────
//
// Section « MESSAGERIE AUTOMATIQUE » : overline var(--faint) + lignes
// ✓ var(--ok) (ou ✕ var(--faint)) + libellé + détail à droite. Reprend tel
// quel l'état config (check-in / check-out / destinataire) historiquement
// affiché dans l'onglet Infos — déplacé ici, aucune logique nouvelle.

interface MessagingAutomationStatusProps {
  guestEmail?: string | null;
  source?: string | null;
}

const MessagingAutomationStatus: React.FC<MessagingAutomationStatusProps> = ({ guestEmail, source }) => {
  const navigate = useNavigate();
  const { data: rules, isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => automationRulesApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const hasEmail = Boolean(guestEmail && guestEmail.trim() && guestEmail.includes('@'));
  // Référence unique : la règle était recopiée ici et dans GuestMessagingService,
  // et ne connaissait ni Vrbo ni Expedia — l'écran promettait alors à tort que
  // l'envoi automatique fonctionnerait sur ces séjours.
  const isAnonymizedIcal = anonymizesGuestEmail(source);

  // Source de vérité = le hub d'automatisation : une règle active de messagerie
  // sur un déclencheur d'arrivée / de départ = envoi automatique.
  const checkInOk = Boolean(rules?.some((r) =>
    r.enabled && CHECK_IN_TRIGGERS.includes(r.triggerType) && isMessagingAction(r.actionType)));
  const checkOutOk = Boolean(rules?.some((r) =>
    r.enabled && CHECK_OUT_TRIGGERS.includes(r.triggerType) && isMessagingAction(r.actionType)));

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <div className="flex items-center gap-[4.5px] py-[5px]">
      <span className={cn('inline-flex shrink-0', ok ? 'text-[var(--ok)]' : 'text-[var(--faint)]')}>
        {ok ? <CheckCircle size={13} strokeWidth={2} /> : <Close size={13} strokeWidth={2} />}
      </span>
      <span className="text-[0.75rem] font-semibold text-[var(--ink)] shrink-0">
        {label}
      </span>
      <span className="ms-auto text-[0.6875rem] text-[var(--muted)] text-end min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {detail}
      </span>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="inline-flex text-[var(--faint)]">
          <Bolt size={13} strokeWidth={1.75} />
        </span>
        <span className="flex-1 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">Messagerie automatique</span>
        <Tooltip>
          {/* Le trigger enveloppe un <span> (element hote) : Radix y pose sa ref
              d'ancrage, ce qu'un composant fonction React 18 ne peut pas recevoir. */}
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Configurer dans Automatisations"
                onClick={() => navigate('/automation-rules')}
                className="text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
              >
                <Settings size={13} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Configurer dans Automatisations</TooltipContent>
        </Tooltip>
      </div>

      {isLoading ? (
        <div className="text-[0.6875rem] text-[var(--faint)]">Chargement…</div>
      ) : (
        <div>
          <Row
            ok={checkInOk}
            label="Check-in"
            detail={checkInOk
              ? 'automatique · règle active'
              : 'désactivé (envoi manuel uniquement)'}
          />
          <Row
            ok={checkOutOk}
            label="Check-out"
            detail={checkOutOk
              ? 'automatique · règle active'
              : 'désactivé (envoi manuel uniquement)'}
          />

          {/* Destinataire */}
          <div className="flex items-start gap-[4.5px] mt-[4.5px] pt-[4.5px]" style={{ borderTop: '1px dashed var(--line)' }}>
            <span className={cn('inline-flex mt-px', hasEmail ? 'text-[var(--ok)]' : 'text-[var(--warn)]')}>
              {hasEmail
                ? <CheckCircle size={13} strokeWidth={2} />
                : <Warning size={13} strokeWidth={2} />}
            </span>
            <div className="flex-1 min-w-0">
              <span className={cn('block text-[0.6875rem] font-semibold', hasEmail ? 'text-[var(--ok)]' : 'text-[var(--warn)]')}>
                {hasEmail ? `Email guest disponible (${guestEmail})` : 'Pas d\'email guest'}
              </span>
              {!hasEmail && (
                <span className="block text-[0.625rem] text-[var(--muted)] mt-0.5 leading-[1.35]">
                  {isAnonymizedIcal
                    ? `Réservation importée via iCal (${source}) — l'email du voyageur n'est pas exposé par le canal. Renseigne-le manuellement dans la fiche client pour activer les envois.`
                    : 'Aucun message automatique ne pourra être envoyé tant que l\'email n\'est pas renseigné.'}
                </span>
              )}
              {hasEmail && !checkInOk && !checkOutOk && (
                <span className="block text-[0.625rem] text-[var(--muted)] mt-0.5 leading-[1.35]">
                  Active une règle de messagerie dans Automatisations pour que les emails partent sans intervention.
                </span>
              )}
            </div>
          </div>

          {(checkInOk || checkOutOk) && (
            <div className="flex items-center gap-0.5 mt-1 text-[var(--faint)]">
              <AccessTime size={10} strokeWidth={1.75} />
              <span className="text-[0.625rem] italic">
                Scheduler : déclenchement horaire
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagingAutomationStatus;
