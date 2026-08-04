import React, { useMemo } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Button, Stepper, Step, StepLabel } from '../../../components/ui';
import { AssistantMarkdown } from '../components/AssistantMarkdown';

interface StepDef {
  id: string;
  title?: string;
  prompt?: string;
}

interface ToolReference {
  name?: string;
  args?: Record<string, unknown>;
}

interface CurrentStep {
  id: string;
  title?: string;
  prompt?: string;
  expectsData?: Record<string, unknown>;
  suggestTool?: ToolReference;
}

interface SuggestedAction {
  toolName?: string;
  reason?: string;
  collectedData?: Record<string, unknown>;
}

interface WorkflowSnapshot {
  runId?: number;
  workflowId?: string;
  title?: string;
  description?: string;
  estimatedDuration?: number;
  totalSteps?: number;
  currentStepIdx?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | string;
  currentStep?: CurrentStep | null;
  steps?: StepDef[];
  collectedDataJson?: string | null;
  suggestedAction?: SuggestedAction | null;
}

interface WorkflowWidgetProps {
  data: WorkflowSnapshot;
}

/**
 * Evenement DOM emis par le widget pour demander au parent (AssistantExpandedDialog
 * ou AssistantWidget) de poster un message a l'assistant. Permet d'eviter le
 * prop-drilling tout en gardant le widget pur (pas d'acces direct au hook useAgent).
 */
export const ASSISTANT_QUICK_REPLY_EVENT = 'clenzy:assistant:quick-reply';

function dispatchQuickReply(text: string) {
  if (!text || !text.trim()) return;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ASSISTANT_QUICK_REPLY_EVENT, {
    detail: { text: text.trim() },
  }));
}

/**
 * Widget de rendu pour {@code displayHint="workflow_step"} — affiche l'etat
 * d'un workflow guide multi-etapes :
 * <ul>
 *   <li>Header : titre + duree estimee + statut</li>
 *   <li>Stepper Baitly UI horizontal avec etapes completees / courante / futures</li>
 *   <li>Prompt du step courant rendu en markdown (AssistantMarkdown)</li>
 *   <li>Quick replies (chips Oui/Non) si le step attend un booleen</li>
 *   <li>CTA "Continuer" qui poste le texte de l'input — pour les booleens
 *       on dispatche directement; pour le texte libre on guide l'user a
 *       repondre dans le champ chat.</li>
 * </ul>
 *
 * <p>Pattern « Signature » : tokens var(--…), overlines 10.5px {@code --faint}.
 * Pour les boolean quick replies, on emet un
 * {@link ASSISTANT_QUICK_REPLY_EVENT} sur la window que la page chat ecoute
 * pour rappeler {@code sendMessage}.</p>
 */
export const WorkflowWidget: React.FC<WorkflowWidgetProps> = ({ data }) => {
  const total = data.totalSteps ?? data.steps?.length ?? 0;
  const currentIdx = data.currentStepIdx ?? 0;
  const isCompleted = data.status === 'COMPLETED';
  const stepsForStepper = useMemo(() => (data.steps ?? []).map((s, i) => ({
    label: s.title || s.id || `Etape ${i + 1}`,
  })), [data.steps]);

  const expectsBool = useMemo(() => {
    const expected = data.currentStep?.expectsData;
    if (!expected) return false;
    return Object.values(expected).some((v) =>
      typeof v === 'string' && v.toLowerCase() === 'boolean');
  }, [data.currentStep]);

  return (
    <div className="mt-1.5 mb-2 flex flex-col gap-2">
      {/* Header titre + meta */}
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {data.title || 'Workflow'}
        </p>
        {data.estimatedDuration && (
          <p className="cn-text-body1 text-[11.5px] text-[var(--faint)] tabular-nums">
            ≈ {data.estimatedDuration} min
          </p>
        )}
        {data.status && data.status !== 'ACTIVE' && (
          <StatusChip size="sm" tokens={{ color: data.status === 'COMPLETED'
                ? 'var(--ok)'
                : 'var(--muted)', bg: data.status === 'COMPLETED'
                ? 'var(--ok-soft)'
                : 'var(--hover)' }} label={data.status} className="text-[10.5px] tracking-[.04em] uppercase" />
        )}
      </div>

      {/* Stepper visuel */}
      {stepsForStepper.length > 0 && (
        <div className="px-2 py-2 rounded-[12px] bg-[var(--accent-soft)] overflow-x-auto">
          {/* Le primitif derive « franchie / courante / a venir » de activeStep :
              la prop `completed` par etape n'a plus lieu d'etre. */}
          <Stepper activeStep={isCompleted ? stepsForStepper.length : currentIdx}>
            {stepsForStepper.map((step) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </div>
      )}

      {/* Step courant */}
      {!isCompleted && data.currentStep && data.currentStep.prompt && (
        <div className="px-2 py-2 rounded-[12px] bg-[var(--field)]">
          <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--accent)] mb-1">
            Etape {currentIdx + 1}/{total}
            {data.currentStep.title ? ` · ${data.currentStep.title}` : ''}
          </p>
          <div className="[&>*:first-of-type]:mt-0 [&>*:last-of-type]:mb-0">
            <AssistantMarkdown text={data.currentStep.prompt} />
          </div>

          {/* Quick replies pour les booleens + CTA Continuer texte libre */}
          {expectsBool ? (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                className="min-w-[80px]"
                onClick={() => dispatchQuickReply('Oui')}
              >
                Oui
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-w-[80px]"
                onClick={() => dispatchQuickReply('Non')}
              >
                Non
              </Button>
            </div>
          ) : (
            <p className="cn-text-body1 block mt-2 text-[11.5px] italic text-[var(--faint)]">
              Reponds dans le chat ci-dessous puis j'enchainerai l'etape suivante.
            </p>
          )}

          {data.currentStep.suggestTool?.name && (
            <p className="cn-text-body1 block mt-2 text-[11.5px] text-[var(--muted)]">
              Indice : je peux aussi te diriger vers <code>{data.currentStep.suggestTool.name}</code>.
            </p>
          )}
        </div>
      )}

      {/* Etat completed */}
      {isCompleted && (
        <div className="px-2 py-2 rounded-[12px] bg-[var(--ok-soft)]">
          <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ok)]">
            Workflow termine.
          </p>
          {data.suggestedAction?.toolName && (
            <p className="cn-text-body1 block mt-0.5 text-[11.5px] text-[var(--muted)]">
              Prochaine action suggeree : <code>{data.suggestedAction.toolName}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
