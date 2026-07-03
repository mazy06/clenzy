import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { Brain, Wrench, GitBranch, PauseCircle, FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { agentRunApi, type AgentRunReplay, type AgentRunStep } from '../../services/api/agentRunApi';

/**
 * Grand Livre d'Autonomie (campagne X3, signature feature n°1) : le replay d'un
 * run d'agent — « chaque action IA a un reçu, rejouable ». Ouvert depuis une
 * ligne du ledger de crédits qui porte un runId.
 */
interface Props {
  runId: string | null;
  open: boolean;
  onClose: () => void;
}

const KIND_ICON: Record<AgentRunStep['kind'], typeof Brain> = {
  LLM_CALL: Brain,
  TOOL_CALL: Wrench,
  DELEGATION: GitBranch,
  PAUSE: PauseCircle,
  SUMMARY: FileText,
};

export default function AgentRunReplayDialog({ runId, open, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [replay, setReplay] = useState<AgentRunReplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What-if (campagne L3) : hypothèse → prompt composé serveur → presse-papier.
  const [hypothesis, setHypothesis] = useState('');
  const [whatIfStatus, setWhatIfStatus] = useState<'idle' | 'busy' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (!open || !runId) return;
    setLoading(true);
    setReplay(null);
    setError(null);
    agentRunApi
      .getReplay(runId)
      .then(setReplay)
      .catch(() => setError(t('agentReplay.loadError', 'Impossible de charger le replay de ce run.')))
      .finally(() => setLoading(false));
  }, [open, runId, t]);

  const statusColor = (status: string): string => {
    if (status === 'ERROR') return theme.palette.error.main;
    if (status === 'PAUSED') return '#D4A574';
    return '#4A9B8E';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {t('agentReplay.title', 'Replay du run')}
          </Typography>
          {replay && (
            <Typography variant="caption" color="text.secondary">
              {t(`agentReplay.origin.${replay.origin}`, replay.origin)}
              {' · '}
              {new Date(replay.startedAt).toLocaleString()}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close', 'Fermer')}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={48} />
          </Box>
        )}
        {error && <Alert severity="warning">{error}</Alert>}
        {replay && !loading && (
          <>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={t(`agentReplay.status.${replay.status}`, replay.status)}
                sx={{ bgcolor: statusColor(replay.status), color: '#fff' }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`${replay.steps.length} ${t('agentReplay.steps', 'étapes')}`}
              />
            </Box>
            {replay.error && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {replay.error}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {replay.steps.map((step) => {
                const Icon = KIND_ICON[step.kind] ?? Brain;
                const tokens = step.promptTokens + step.completionTokens;
                return (
                  <Box
                    key={step.seq}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderLeft: '2px solid',
                      borderLeftColor: step.status === 'ERROR' ? theme.palette.error.main : 'divider',
                    }}
                  >
                    <Icon
                      size={16}
                      style={{ marginTop: 2, flexShrink: 0 }}
                      color={theme.palette.text.secondary}
                      aria-hidden
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t(`agentReplay.kind.${step.kind}`, step.kind)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {step.toolName ?? step.agent}
                        </Typography>
                      </Box>
                      {step.detail && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {step.detail}
                        </Typography>
                      )}
                    </Box>
                    {tokens > 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                      >
                        {tokens.toLocaleString()} tok
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
            {replay.userQuery && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {t('agentReplay.whatIf.title', 'Et si… ? (rejouer avec une hypothèse)')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t('agentReplay.whatIf.subtitle',
                    'Le prompt de re-analyse est copié — collez-le dans le chat de l\u2019assistant pour lancer le what-if.')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                    placeholder={t('agentReplay.whatIf.placeholder', 'Ex. : avec un tarif nuit à 95 € au lieu de 120 €')}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={whatIfStatus === 'busy' || !hypothesis.trim()}
                    onClick={async () => {
                      setWhatIfStatus('busy');
                      try {
                        const { prompt } = await agentRunApi.whatIf(replay.runId, hypothesis.trim());
                        await navigator.clipboard.writeText(prompt);
                        setWhatIfStatus('copied');
                        setTimeout(() => setWhatIfStatus('idle'), 4000);
                      } catch {
                        setWhatIfStatus('error');
                        setTimeout(() => setWhatIfStatus('idle'), 4000);
                      }
                    }}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                  >
                    {whatIfStatus === 'copied'
                      ? t('agentReplay.whatIf.copied', 'Copié !')
                      : whatIfStatus === 'error'
                        ? t('agentReplay.whatIf.error', 'Échec')
                        : t('agentReplay.whatIf.copy', 'Copier le prompt')}
                  </Button>
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
