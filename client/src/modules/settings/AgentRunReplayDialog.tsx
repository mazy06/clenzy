import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Item,
  ItemContent,
  ItemMedia,
  Skeleton,
} from '../../components/ui';
import { cn } from '../../utils/cn';
import { Field, FieldLabel, Input } from '../../components/ui';
import { Brain, Wrench, GitBranch, PauseCircle, FileText } from 'lucide-react';
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

  // Statut du run -> ton semantique Baitly UI (fond `-soft`, texte `-ink`).
  const statusVariant = (status: string): 'destructive' | 'warning' | 'success' => {
    if (status === 'ERROR') return 'destructive';
    if (status === 'PAUSED') return 'warning';
    return 'success';
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('agentReplay.title', 'Replay du run')}</DialogTitle>
          {replay && (
            <DialogDescription>
              {t(`agentReplay.origin.${replay.origin}`, replay.origin)}
              {' · '}
              {new Date(replay.startedAt).toLocaleString()}
            </DialogDescription>
          )}
        </DialogHeader>
        {loading && (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        )}
        {error && <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>}
        {replay && !loading && (
          <>
            <div className="flex gap-1 mb-2 flex-wrap">
              <Badge variant={statusVariant(replay.status)}>
                {t(`agentReplay.status.${replay.status}`, replay.status)}
              </Badge>
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
                const failed = step.status === 'ERROR';
                return (
                  <Item
                    key={step.seq}
                    variant="outline"
                    size="xs"
                    // Une etape en echec se dit par le fond, pas par un lisere
                    // lateral colore (interdit produit).
                    className={cn('items-start', failed && 'border-destructive/40 bg-destructive-soft/50')}
                  >
                    <ItemMedia variant="icon" className={cn('mt-0.5', failed ? 'text-destructive' : 'text-muted-foreground')}>
                      <Icon size={16} aria-hidden />
                    </ItemMedia>
                    <ItemContent className="min-w-0 gap-0.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-xs font-semibold">
                          {t(`agentReplay.kind.${step.kind}`, step.kind)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {step.toolName ?? step.agent}
                        </span>
                      </div>
                      {step.detail && (
                        <span className="text-xs text-muted-foreground block">
                          {step.detail}
                        </span>
                      )}
                    </ItemContent>
                    {tokens > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {tokens.toLocaleString()} tok
                      </span>
                    )}
                  </Item>
                );
              })}
            </div>
            {replay.userQuery && (
              <div className="mt-3 pt-2 border-t border-border">
                <h6 className="text-xs font-medium mb-0.5">
                  {t('agentReplay.whatIf.title', 'Et si… ? (rejouer avec une hypothèse)')}
                </h6>
                <span className="text-xs text-muted-foreground block mb-1.5">
                  {t('agentReplay.whatIf.subtitle',
                    'Le prompt de re-analyse est copié — collez-le dans le chat de l\u2019assistant pour lancer le what-if.')}
                </span>
                <div className="flex gap-1.5 items-start">
                  <Field className="flex-1">
                    {/* Libelle masque : le titre « Et si… ? » juste au-dessus fait
                        office d'intitule visible, mais le champ doit garder un nom. */}
                    <FieldLabel htmlFor="agent-replay-hypothesis" className="sr-only">
                      {t('agentReplay.whatIf.title', 'Et si… ? (rejouer avec une hypothèse)')}
                    </FieldLabel>
                    <Input
                      id="agent-replay-hypothesis"
                      value={hypothesis}
                      onChange={(e) => setHypothesis(e.target.value)}
                      placeholder={t('agentReplay.whatIf.placeholder', 'Ex. : avec un tarif nuit à 95 € au lieu de 120 €')}
                    />
                  </Field>
                  <Button
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
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
