import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Chip,
} from '@mui/material';
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
 *   <li>Stepper MUI horizontal avec etapes completees / courante / futures</li>
 *   <li>Prompt du step courant rendu en markdown (AssistantMarkdown)</li>
 *   <li>Quick replies (chips Oui/Non) si le step attend un booleen</li>
 *   <li>CTA "Continuer" qui poste le texte de l'input — pour les booleens
 *       on dispatche directement; pour le texte libre on guide l'user a
 *       repondre dans le champ chat.</li>
 * </ul>
 *
 * <p>Pattern « Signature » : tokens var(--…), overlines 10.5px {@code --faint}.
 * Stepper MUI conservé tel quel (pattern Wizard/Stepper absent du baseline §7 —
 * tokenisé sans nouveau dessin). Pour les boolean quick replies, on emet un
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
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {/* Header titre + meta */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{
          fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
        }}>
          {data.title || 'Workflow'}
        </Typography>
        {data.estimatedDuration && (
          <Typography sx={{
            fontSize: '11.5px', color: 'var(--faint)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            ≈ {data.estimatedDuration} min
          </Typography>
        )}
        {data.status && data.status !== 'ACTIVE' && (
          <Chip
            label={data.status}
            size="small"
            sx={{
              height: 18, fontSize: '10.5px', fontWeight: 700,
              letterSpacing: '.04em', textTransform: 'uppercase',
              bgcolor: data.status === 'COMPLETED'
                ? 'var(--ok-soft)'
                : 'var(--hover)',
              color: data.status === 'COMPLETED'
                ? 'var(--ok)'
                : 'var(--muted)',
              border: 'none',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>

      {/* Stepper visuel */}
      {stepsForStepper.length > 0 && (
        <Box sx={{
          px: 1.5, py: 1.25,
          borderRadius: '12px',
          bgcolor: 'var(--accent-soft)',
        }}>
          <Stepper
            activeStep={isCompleted ? stepsForStepper.length : currentIdx}
            alternativeLabel
            sx={{
              '& .MuiStepLabel-label': {
                fontSize: '11.5px',
                fontWeight: 500,
                color: 'var(--muted)',
                mt: 0.5,
                '&.Mui-active': { color: 'var(--ink)', fontWeight: 600 },
                '&.Mui-completed': { color: 'var(--muted)' },
              },
              '& .MuiStepIcon-root': {
                fontSize: '1.1rem',
                color: 'var(--line-2)',
                '&.Mui-active': { color: 'var(--accent)' },
                '&.Mui-completed': { color: 'var(--accent)' },
              },
            }}
          >
            {stepsForStepper.map((step, idx) => (
              <Step key={`${step.label}-${idx}`} completed={idx < currentIdx || isCompleted}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* Step courant */}
      {!isCompleted && data.currentStep && data.currentStep.prompt && (
        <Box sx={{
          px: 1.5, py: 1.25,
          borderRadius: '12px',
          bgcolor: 'var(--field)',
        }}>
          <Typography sx={{
            display: 'block', fontSize: '10.5px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.05em',
            color: 'var(--accent)', mb: 0.75,
          }}>
            Etape {currentIdx + 1}/{total}
            {data.currentStep.title ? ` · ${data.currentStep.title}` : ''}
          </Typography>
          <Box sx={{
            '& > *:first-of-type': { mt: 0 },
            '& > *:last-of-type': { mb: 0 },
          }}>
            <AssistantMarkdown text={data.currentStep.prompt} />
          </Box>

          {/* Quick replies pour les booleens + CTA Continuer texte libre */}
          {expectsBool ? (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => dispatchQuickReply('Oui')}
                sx={{ textTransform: 'none', minWidth: 80, cursor: 'pointer' }}
              >
                Oui
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => dispatchQuickReply('Non')}
                sx={{ textTransform: 'none', minWidth: 80, cursor: 'pointer' }}
              >
                Non
              </Button>
            </Box>
          ) : (
            <Typography sx={{
              display: 'block', mt: 1.5, fontSize: '11.5px', fontStyle: 'italic',
              color: 'var(--faint)',
            }}>
              Reponds dans le chat ci-dessous puis j'enchainerai l'etape suivante.
            </Typography>
          )}

          {data.currentStep.suggestTool?.name && (
            <Typography sx={{
              display: 'block', mt: 1.25, fontSize: '11.5px',
              color: 'var(--muted)',
            }}>
              Indice : je peux aussi te diriger vers <code>{data.currentStep.suggestTool.name}</code>.
            </Typography>
          )}
        </Box>
      )}

      {/* Etat completed */}
      {isCompleted && (
        <Box sx={{
          px: 1.5, py: 1.5,
          borderRadius: '12px',
          bgcolor: 'var(--ok-soft)',
        }}>
          <Typography sx={{
            fontSize: '12.5px', fontWeight: 600, color: 'var(--ok)',
          }}>
            Workflow termine.
          </Typography>
          {data.suggestedAction?.toolName && (
            <Typography sx={{
              display: 'block', mt: 0.5, fontSize: '11.5px',
              color: 'var(--muted)',
            }}>
              Prochaine action suggeree : <code>{data.suggestedAction.toolName}</code>
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
