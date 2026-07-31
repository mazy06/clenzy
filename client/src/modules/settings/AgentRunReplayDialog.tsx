import { useEffect, useState } from 'react';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Skeleton, TextField, useTheme } from '@mui/material';
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
        <div>
          <h6 className="cn-text-h6 leading-[1.2]">
            {t('agentReplay.title', 'Replay du run')}
          </h6>
          {replay && (
            <span className="cn-text-caption text-muted-foreground">
              {t(`agentReplay.origin.${replay.origin}`, replay.origin)}
              {' · '}
              {new Date(replay.startedAt).toLocaleString()}
            </span>
          )}
        </div>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close', 'Fermer')}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <div className="flex flex-col gap-1.5">
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={48} />
          </div>
        )}
        {error && <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>}
        {replay && !loading && (
          <>
            <div className="flex gap-1 mb-2 flex-wrap">
              <StatusChip tokens={{ color: '#fff', bg: statusColor(replay.status) }} label={t(`agentReplay.status.${replay.status}`, replay.status)} />
              <Badge variant="outline">{`${replay.steps.length} ${t('agentReplay.steps', 'étapes')}`}</Badge>
            </div>
            {replay.error && (
              <Alert variant="destructive" className="mb-2">
                <TriangleAlert />
                <AlertDescription>{replay.error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="cn-text-body2 font-semibold">
                          {t(`agentReplay.kind.${step.kind}`, step.kind)}
                        </p>
                        <span className="cn-text-caption text-muted-foreground">
                          {step.toolName ?? step.agent}
                        </span>
                      </div>
                      {step.detail && (
                        <span className="cn-text-caption text-muted-foreground block">
                          {step.detail}
                        </span>
                      )}
                    </div>
                    {tokens > 0 && (
                      <span className="cn-text-caption text-muted-foreground tabular-nums whitespace-nowrap">
                        {tokens.toLocaleString()} tok
                      </span>
                    )}
                  </Box>
                );
              })}
            </div>
            {replay.userQuery && (
              <div className="mt-3 pt-2 border-t border-[divider]">
                <h6 className="cn-text-subtitle2 mb-0.5">
                  {t('agentReplay.whatIf.title', 'Et si… ? (rejouer avec une hypothèse)')}
                </h6>
                <span className="cn-text-caption text-muted-foreground block mb-1.5">
                  {t('agentReplay.whatIf.subtitle',
                    'Le prompt de re-analyse est copié — collez-le dans le chat de l\u2019assistant pour lancer le what-if.')}
                </span>
                <div className="flex gap-1.5 items-start">
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
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
