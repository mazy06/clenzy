import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Chip,
  useTheme,
  alpha,
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
 * Evenement DOM emis par le widget pour demander au parent (AssistantPage) de
 * poster un message a l'assistant. Permet d'eviter le prop-drilling tout en
 * gardant le widget pur (pas d'acces direct au hook useAgent).
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
 * <p>Borderless, bg tonal, conforme aux autres widgets. Pour les boolean
 * quick replies, on emet un {@link ASSISTANT_QUICK_REPLY_EVENT} sur la window
 * que la page chat ecoute pour rappeler {@code sendMessage}.</p>
 */
export const WorkflowWidget: React.FC<WorkflowWidgetProps> = ({ data }) => {
  const theme = useTheme();
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
        <Typography variant="caption" sx={{
          fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
        }}>
          {data.title || 'Workflow'}
        </Typography>
        {data.estimatedDuration && (
          <Typography variant="caption" sx={{
            fontSize: '0.7rem', color: theme.palette.text.disabled,
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
              height: 18, fontSize: '0.65rem', fontWeight: 600,
              bgcolor: data.status === 'COMPLETED'
                ? alpha(theme.palette.success.main, 0.14)
                : alpha(theme.palette.text.primary, 0.08),
              color: data.status === 'COMPLETED'
                ? theme.palette.success.dark
                : theme.palette.text.secondary,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>

      {/* Stepper visuel */}
      {stepsForStepper.length > 0 && (
        <Box sx={{
          px: 1.5, py: 1.25,
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}>
          <Stepper
            activeStep={isCompleted ? stepsForStepper.length : currentIdx}
            alternativeLabel
            sx={{
              '& .MuiStepLabel-label': {
                fontSize: '0.7rem',
                fontWeight: 500,
                mt: 0.5,
              },
              '& .MuiStepIcon-root': {
                fontSize: '1.1rem',
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
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.text.primary, 0.035),
        }}>
          <Typography variant="caption" sx={{
            display: 'block', fontSize: '0.65rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: theme.palette.primary.dark, mb: 0.75,
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
            <Typography variant="caption" sx={{
              display: 'block', mt: 1.5, fontSize: '0.72rem', fontStyle: 'italic',
              color: theme.palette.text.disabled,
            }}>
              Reponds dans le chat ci-dessous puis j'enchainerai l'etape suivante.
            </Typography>
          )}

          {data.currentStep.suggestTool?.name && (
            <Typography variant="caption" sx={{
              display: 'block', mt: 1.25, fontSize: '0.7rem',
              color: theme.palette.text.secondary,
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
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.success.main, 0.1),
        }}>
          <Typography variant="body2" sx={{
            fontWeight: 600, color: theme.palette.success.dark,
          }}>
            Workflow termine.
          </Typography>
          {data.suggestedAction?.toolName && (
            <Typography variant="caption" sx={{
              display: 'block', mt: 0.5, fontSize: '0.75rem',
              color: theme.palette.text.secondary,
            }}>
              Prochaine action suggeree : <code>{data.suggestedAction.toolName}</code>
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
