import { useState } from 'react';
import {
  BotIcon,
  CalendarSyncIcon,
  CheckIcon,
  ClockIcon,
  MessageSquareIcon,
  PencilIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  WrenchIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Label,
  Progress,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import StatusChip from '../../../components/baitly/StatusChip';
import { Money } from '../../../components/baitly/Money';
import { cn } from '../../../utils/cn';

/**
 * Projection — Constellation des agents IA : les agents (nœuds), le feed
 * d'activité et la file de cartes HITL (validation humaine). Galerie only.
 */

// ─── Constellation ───────────────────────────────────────────────────────────

interface AgentNode {
  name: string;
  role: string;
  icon: React.ReactNode;
  status: 'active' | 'idle' | 'waiting';
  tasksToday: number;
  lastRun: string;
  auto: boolean;
}

const AGENTS: AgentNode[] = [
  { name: 'Revenue', role: 'Yield & tarifs', icon: <TrendingUpIcon />, status: 'waiting', tasksToday: 6, lastRun: 'il y a 4 min', auto: false },
  { name: 'Messaging', role: 'Relances & réponses guests', icon: <MessageSquareIcon />, status: 'active', tasksToday: 14, lastRun: 'à l\'instant', auto: true },
  { name: 'Ops', role: 'Interventions & équipes', icon: <WrenchIcon />, status: 'active', tasksToday: 9, lastRun: 'il y a 12 min', auto: true },
  { name: 'Sync', role: 'Canaux & calendriers', icon: <CalendarSyncIcon />, status: 'idle', tasksToday: 31, lastRun: 'il y a 25 min', auto: true },
];

const AGENT_STATUS = {
  active: { tone: 'ok' as const, label: 'Actif' },
  idle: { tone: 'neutral' as const, label: 'En veille' },
  waiting: { tone: 'warn' as const, label: 'Attend validation' },
};

function AgentCard({ agent }: { agent: AgentNode }) {
  const [auto, setAuto] = useState(agent.auto);
  const status = AGENT_STATUS[agent.status];
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border bg-card p-3.5',
        agent.status === 'waiting' ? 'border-warning/40' : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'relative inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary [&>svg]:size-4',
              agent.status === 'active' && 'after:absolute after:-end-0.5 after:-top-0.5 after:size-2 after:rounded-full after:bg-success after:ring-2 after:ring-card'
            )}
          >
            {agent.icon}
          </span>
          <div>
            <h3 className="m-0 text-sm font-semibold text-foreground">Agent {agent.name}</h3>
            <p className="m-0 text-xs text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <StatusChip tone={status.tone} label={status.label} dot size="sm" />
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-foreground">
        <span className="tabular-nums">{agent.tasksToday} tâches aujourd'hui</span>
        <span className="flex items-center gap-1">
          <ClockIcon className="size-3" /> {agent.lastRun}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`agent-auto-${agent.name}`} className="text-xs text-muted-foreground">
          {auto ? (
            <span className="flex items-center gap-1 text-success">
              <ZapIcon className="size-3.5" /> Auto-application
            </span>
          ) : (
            'Validation humaine (HITL)'
          )}
        </Label>
        <Switch
          id={`agent-auto-${agent.name}`}
          checked={auto}
          onCheckedChange={setAuto}
          aria-label={`Mode auto — Agent ${agent.name}`}
        />
      </div>
    </div>
  );
}

// ─── Cartes HITL ─────────────────────────────────────────────────────────────

function HitlYieldCard({ onDecide }: { onDecide: (decision: string) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusChip tone="accent" label="Agent Revenue" size="sm" />
          <StatusChip tone="warn" label="Expire dans 22 h" size="sm" />
        </div>
        <Badge variant="outline">HITL</Badge>
      </div>
      <div>
        <h3 className="m-0 text-sm font-semibold text-foreground">
          Baisse tarifaire proposée — Riad Yasmine
        </h3>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          9 nuits invendues du 18 au 27 août (block-aware). Proposition : <b className="text-foreground">−12 %</b> sur
          ces dates uniquement, prix plancher respecté (68 €).
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-2.5 text-center">
        <div>
          <div className="text-2xs text-muted-foreground">Prix actuel</div>
          <div className="text-sm font-semibold text-foreground tabular-nums"><Money value={80} decimals={0} /></div>
        </div>
        <div>
          <div className="text-2xs text-muted-foreground">Prix proposé</div>
          <div className="text-sm font-semibold text-primary tabular-nums"><Money value={70} decimals={0} /></div>
        </div>
        <div>
          <div className="text-2xs text-muted-foreground">Revenu estimé</div>
          <div className="text-sm font-semibold text-success tabular-nums">
            +<Money value={680} decimals={0} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-2xs text-muted-foreground">
          <span>Probabilité de remplissage (simulation d'élasticité)</span>
          <span className="tabular-nums">74 %</span>
        </div>
        <Progress value={74} />
      </div>
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={() => onDecide('appliquée')}>
          <CheckIcon /> Appliquer
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDecide('ouverte pour ajustement')}>
          <SlidersHorizontalIcon /> Ajuster
        </Button>
        <Button size="sm" variant="ghost" className="ms-auto text-muted-foreground" onClick={() => onDecide('refusée')}>
          <XIcon /> Refuser
        </Button>
      </div>
    </div>
  );
}

function HitlMessageCard({ onDecide }: { onDecide: (decision: string) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusChip tone="accent" label="Agent Messaging" size="sm" />
          <StatusChip tone="info" label="Relance S1" size="sm" />
        </div>
        <Badge variant="outline">HITL</Badge>
      </div>
      <div>
        <h3 className="m-0 text-sm font-semibold text-foreground">
          Relance panier abandonné — Karim El Fassi
        </h3>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          Panier de 2 nuits (Duplex Guéliz, 940 €) abandonné il y a 26 h. Message proposé :
        </p>
      </div>
      <blockquote className="m-0 rounded-lg border-s-2 border-primary/40 bg-muted p-2.5 text-xs text-foreground italic">
        « Bonjour Karim, votre séjour du 14 au 16 août au Duplex Guéliz est toujours disponible.
        Réservez avant ce soir et profitez du petit-déjeuner offert 🥐 »
      </blockquote>
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={() => onDecide('envoyée')}>
          <CheckIcon /> Envoyer
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDecide('ouverte en édition')}>
          <PencilIcon /> Modifier
        </Button>
        <Button size="sm" variant="ghost" className="ms-auto text-muted-foreground" onClick={() => onDecide('ignorée')}>
          <XIcon /> Ignorer
        </Button>
      </div>
    </div>
  );
}

// ─── Feed d'activité ─────────────────────────────────────────────────────────

const FEED = [
  { agent: 'Messaging', icon: <MessageSquareIcon />, accent: 'text-info bg-info-soft', text: 'Réponse envoyée à Amina Benali (heure d\'arrivée + lit bébé).', mode: 'auto', time: 'il y a 2 min' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, accent: 'text-warning bg-warning-soft', text: 'Proposition de baisse −12 % sur 9 nuits (Riad Yasmine) — en attente de validation.', mode: 'hitl', time: 'il y a 4 min' },
  { agent: 'Ops', icon: <WrenchIcon />, accent: 'text-primary bg-primary-soft', text: 'Intervention ménage créée après l\'annulation de RES-1039 (Villa Palmeraie).', mode: 'auto', time: 'il y a 18 min' },
  { agent: 'Sync', icon: <CalendarSyncIcon />, accent: 'text-success bg-success-soft', text: '3 calendriers réconciliés (Airbnb, Booking) — aucun écart détecté.', mode: 'auto', time: 'il y a 25 min' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, accent: 'text-warning bg-warning-soft', text: '+8 % appliqué sur les week-ends de septembre (règle occupation > 85 %).', mode: 'auto', time: 'il y a 1 h' },
];

function ActivityFeed() {
  return (
    <div className="relative flex flex-col gap-4 ps-4">
      <span className="absolute inset-y-1 start-[27px] w-px bg-border" aria-hidden />
      {FEED.map((event, index) => (
        <div key={index} className="relative flex items-start gap-3">
          <span
            className={cn(
              'relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-4 ring-background [&>svg]:size-3',
              event.accent
            )}
          >
            {event.icon}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="m-0 text-xs text-foreground">{event.text}</p>
            <div className="mt-1 flex items-center gap-2 text-2xs text-muted-foreground">
              <span className="font-medium">Agent {event.agent}</span>
              {event.mode === 'auto' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-0.5 text-success">
                      <ZapIcon className="size-2.5" /> auto
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Appliqué sans validation (règle d'autonomie active)</TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-warning">validation requise</span>
              )}
              <span className="ms-auto">{event.time}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section complète ────────────────────────────────────────────────────────

export function BAgentsConstellationSectionDemo() {
  const [decisions, setDecisions] = useState<string[]>([]);
  const pending = 2 - decisions.length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Constellation d'agents"
        subtitle="4 agents · 60 tâches aujourd'hui · 2 en attente de validation"
        iconBadge={<BotIcon />}
        titleAdornment={pending > 0 ? <Badge variant="warning">{pending} HITL</Badge> : <Badge variant="success">À jour</Badge>}
        showBackButton={false}
        className="mb-0"
        actions={
          <Button size="sm" variant="outline">
            <SlidersHorizontalIcon /> Règles d'autonomie
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            À valider ({pending})
          </h3>
          {decisions.length < 1 && (
            <HitlYieldCard onDecide={(d) => setDecisions((prev) => [...prev, `Proposition tarifaire ${d}`])} />
          )}
          {decisions.length < 2 && (
            <HitlMessageCard onDecide={(d) => setDecisions((prev) => [...prev, `Relance ${d}`])} />
          )}
          {decisions.map((decision) => (
            <div
              key={decision}
              className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs text-success"
            >
              <CheckIcon className="size-3.5" /> {decision} (démo — réinitialisée au rechargement)
            </div>
          ))}
          {pending === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              File vide — les agents continuent en autonomie.
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Feed d'activité
          </h3>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
