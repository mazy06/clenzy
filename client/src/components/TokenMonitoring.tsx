import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '../utils/cn';
import StatusChip from './StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from './ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from './ui';
import { Card } from '../components/ui';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import {
  Refresh,
  Delete,
  CheckCircle,
  Warning,
  ContentCopy,
  Person,
  Email,
  AccessTime,
  Bolt,
  TrendingUp,
  Storage,
  HourglassEmpty,
  Error as ErrorIcon,
} from '../icons';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from 'recharts';
import TokenService, { TokenStats, TokenMetrics } from '../services/TokenService';
import StatTile from './StatTile';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';
import { useAuth } from '../hooks/useAuth';
import { userAvatarSrc } from '../services/api/usersApi';
import { parseApiDate } from '../utils/formatUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Anneau de decompte. Le kit n'a pas de jauge circulaire DETERMINEE (Spinner est
// indetermine), et deux cercles SVG suffisent : le trace est plus court que le
// `CircularProgress` MUI qu'il remplace, sans en dependre.
const RING_SIZE = 96;
const RING_THICKNESS = 3;
const RING_RADIUS = (RING_SIZE - RING_THICKNESS) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Expiré';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelativeTime(iso: string | undefined | null): string {
  if (!iso || iso === 'N/A') return 'Jamais';
  const ts = parseApiDate(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `Il y a ${diff}s`;
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}


// ─── Component ───────────────────────────────────────────────────────────────

const TokenMonitoring: React.FC = () => {
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, setTick] = useState(0);

  const tokenService = TokenService.getInstance();
  const { setHeaderActions } = useMonitoringHeader();
  // Recupere le user complet (avec profilePictureUrl + databaseId) pour afficher
  // l'avatar — le JWT seul ne le contient pas, contrairement a la sidebar.
  const { user } = useAuth();

  const loadTokenStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const stats = await tokenService.getBackendTokenStats();
      const metrics = await tokenService.getBackendTokenMetrics();
      if (stats) setTokenStats(stats);
      if (metrics) setTokenMetrics(metrics);
    } catch {
      setError('Impossible de charger les statistiques des tokens');
    } finally {
      setIsLoading(false);
    }
  }, [tokenService]);

  const cleanupTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await tokenService.cleanupExpiredTokens();
      if (result.success) {
        await loadTokenStats();
      } else {
        setError(`Erreur lors du nettoyage: ${result.error}`);
      }
    } catch {
      setError('Erreur lors du nettoyage des tokens');
    } finally {
      setIsLoading(false);
    }
  }, [tokenService, loadTokenStats]);

  useEffect(() => {
    loadTokenStats();
  }, [loadTokenStats]);

  // Re-render every second to keep the countdown live
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Register page-header actions (refresh + cleanup) for this tab.
  useEffect(() => {
    setHeaderActions(
      <div className="flex flex-row gap-1.5">
        <BuiButton
          variant="outline"
          size="sm"
          onClick={loadTokenStats}
          disabled={isLoading}
        >
          {isLoading ? (
            <Spinner className="size-3.5" />
          ) : (
            <Refresh size={16} strokeWidth={1.75} />
          )}
          Actualiser
        </BuiButton>
        {/* color="warning" n'a pas de variante dediee : outline + teinte --warn. */}
        <BuiButton
          variant="outline"
          size="sm"
          onClick={cleanupTokens}
          disabled={isLoading}
          className="text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
        >
          <Delete size={16} strokeWidth={1.75} />
          Nettoyer expirés
        </BuiButton>
      </div>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, isLoading, loadTokenStats, cleanupTokens]);

  const currentToken = tokenService.getCurrentTokenInfo();
  const timeUntilExpiry = currentToken.timeUntilExpiry ?? 0;
  // Assumption : un token Keycloak dure 15 min par défaut → on prend max(observé, 900)
  const totalLifetime = Math.max(timeUntilExpiry, 900);
  const remainingPct = totalLifetime > 0 ? Math.round((timeUntilExpiry / totalLifetime) * 100) : 0;

  // Token status (active / expiring / expired) — tokens semantiques
  const tokenStatus = useMemo(() => {
    if (!currentToken.isAuthenticated) return { label: 'Non authentifié', fg: 'var(--muted)', soft: 'var(--hover)' };
    if (timeUntilExpiry <= 0) return { label: 'Expiré', fg: 'var(--err)', soft: 'var(--err-soft)' };
    if (timeUntilExpiry < 300) return { label: 'Expiration proche', fg: 'var(--warn)', soft: 'var(--warn-soft)' };
    return { label: 'Authentifié', fg: 'var(--ok)', soft: 'var(--ok-soft)' };
  }, [currentToken.isAuthenticated, timeUntilExpiry]);

  // Donut data
  const donutData = useMemo(() => {
    const active = tokenStats?.activeTokens ?? 0;
    const expired = tokenStats?.expiredTokens ?? 0;
    const total = active + expired;
    if (total === 0) return [];
    return [
      { name: 'Actifs', value: active, color: 'var(--ok)' },
      { name: 'Expirés', value: expired, color: 'var(--err)' },
    ];
  }, [tokenStats]);

  const copyUserId = () => {
    if (!currentToken.userId) return;
    navigator.clipboard.writeText(currentToken.userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Success rate parsed for visualization
  const successRateNum = useMemo(() => {
    if (!tokenStats?.successRate || tokenStats.successRate === 'N/A') return null;
    const m = String(tokenStats.successRate).match(/[\d.]+/);
    return m ? Math.min(100, Math.max(0, parseFloat(m[0]))) : null;
  }, [tokenStats]);

  return (
    <div className="flex flex-col gap-3.5">
      {error && (
        <BuiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* ─── Hero card : current token ─────────────────────────────── */}
      <Card className="gap-0 py-0 p-4 bg-[var(--card)] border-[var(--line)] relative overflow-hidden">
        {currentToken.isAuthenticated ? (
          <div className="flex items-center gap-4 flex-wrap">
            {/* Countdown ring + avatar */}
            <div className="relative w-[96px] h-[96px] shrink-0">
              {/* `-rotate-90` + `origin-center` : le remplissage demarre a midi et
                  tourne dans le sens horaire, comme le faisait MUI. */}
              <svg
                className="absolute top-0 left-0 -rotate-90 origin-center"
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                aria-hidden
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--hover)"
                  strokeWidth={RING_THICKNESS}
                />
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={tokenStatus.fg}
                  strokeWidth={RING_THICKNESS}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, remainingPct)) / 100)}
                  className="transition-[stroke,stroke-dashoffset] duration-300 motion-reduce:transition-none"
                />
              </svg>
              <Avatar className="absolute inset-2 size-auto">
                <AvatarImage
                  src={userAvatarSrc(user)}
                  alt={currentToken.username || currentToken.email || 'avatar'}
                />
                <AvatarFallback className="bg-[var(--accent)] text-[var(--on-accent)] font-[family-name:var(--font-display)] font-semibold text-[1.5rem] tracking-[0.05em]">
                  {getInitials(currentToken.username || currentToken.email)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* User info */}
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <p className="cn-text-body1 text-[1.125rem] font-bold">
                  {currentToken.username || 'admin'}
                </p>
                <StatusChip tokens={{ color: tokenStatus.fg, bg: tokenStatus.soft }} label={tokenStatus.label} icon={<span className="inline-flex text-inherit ms-0.5">
                      <div className="w-[6px] h-[6px] rounded-[50%]" style={{ backgroundColor: tokenStatus.fg }} />
                    </span>} />
              </div>
              <div className="flex flex-row flex-wrap gap-x-3 gap-y-[3px] mb-1.5">
                <div className="flex items-center gap-0.5">
                  <span className="inline-flex text-muted-foreground opacity-60">
                    <Email size={13} strokeWidth={1.75} />
                  </span>
                  <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground">
                    {currentToken.email || 'N/A'}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <span className="inline-flex text-muted-foreground opacity-60">
                    <Person size={13} strokeWidth={1.75} />
                  </span>
                  <p className="cn-text-body1 text-[0.75rem] text-muted-foreground opacity-60 font-mono">
                    {currentToken.userId?.slice(0, 8) ?? '—'}
                  </p>
                  {currentToken.userId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BuiButton
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Copier l'ID complet"
                          onClick={copyUserId}
                        >
                          {copied ? (
                            <CheckCircle size={12} strokeWidth={2} color="var(--ok)" />
                          ) : (
                            <ContentCopy size={12} strokeWidth={1.75} />
                          )}
                        </BuiButton>
                      </TooltipTrigger>
                      <TooltipContent>{copied ? 'Copié !' : "Copier l'ID complet"}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {currentToken.roles?.length ? (
                  currentToken.roles.map((role) => (
                    <StatusChip
                      key={role}
                      tone="accent"
                      size="sm"
                      label={role}
                      className="h-[20px] uppercase tracking-[0.3px]"
                    />
                  ))
                ) : (
                  <p className="cn-text-body1 text-[0.75rem] text-muted-foreground opacity-60 italic">
                    Aucun rôle assigné
                  </p>
                )}
              </div>
            </div>

            {/* Countdown */}
            {/* Le filet gauche n'apparait qu'a partir du breakpoint MUI md (900px). */}
            <div className="min-w-[200px] pl-[18px] min-[900px]:border-l min-[900px]:border-solid min-[900px]:border-l-[var(--line)]">
              <p className="cn-text-body1 text-[0.625rem] font-bold uppercase tracking-[0.6px] text-[var(--muted)] mb-[3px]">
                <AccessTime size={11} strokeWidth={1.75} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Temps avant expiration
              </p>
              <p className="cn-text-body1 text-[1.5rem] font-semibold tabular-nums tracking-[-0.02em] leading-[1.1]" style={{ color: tokenStatus.fg, fontFamily: 'var(--font-display)' }}>
                {formatDuration(timeUntilExpiry)}
              </p>
              {currentToken.expiresAt && (
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground opacity-60 mt-0.5">
                  {new Date(currentToken.expiresAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {/* La teinte de la barre est une valeur d'execution : elle passe par
                  une variable CSS posee inline, lue par la classe du remplissage. */}
              <Progress
                value={remainingPct}
                style={{ '--bar': tokenStatus.fg } as React.CSSProperties}
                className="mt-1.5 h-1 rounded-full bg-[var(--hover)] [&_[data-slot=progress-indicator]]:bg-[var(--bar)] [&_[data-slot=progress-indicator]]:rounded-full"
              />
            </div>
          </div>
        ) : (
          <BuiAlert variant="warning">
            <TriangleAlert />
            <AlertDescription>Aucun token actif détecté. Veuillez vous authentifier.</AlertDescription>
          </BuiAlert>
        )}
      </Card>

      {/* ─── KPI grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_1fr] min-[900px]:grid-cols-[repeat(4,_1fr)] gap-[9px]">
        <StatTile
          icon={<Storage />}
          label="Total des tokens"
          value={tokenStats?.totalTokens ?? 0}
          color="#6B8A9A"
          loading={isLoading && !tokenStats}
        />
        <StatTile
          icon={<CheckCircle />}
          label="Tokens actifs"
          value={tokenStats?.activeTokens ?? 0}
          color="#4A9B8E"
          hint={
            tokenStats?.totalTokens
              ? `${Math.round(((tokenStats.activeTokens ?? 0) / tokenStats.totalTokens) * 100)}% du total`
              : undefined
          }
          loading={isLoading && !tokenStats}
        />
        <StatTile
          icon={<Warning />}
          label="Tokens expirés"
          value={tokenStats?.expiredTokens ?? 0}
          color="#C97A7A"
          hint={
            tokenStats?.totalTokens
              ? `${Math.round(((tokenStats.expiredTokens ?? 0) / tokenStats.totalTokens) * 100)}% du total`
              : undefined
          }
          loading={isLoading && !tokenStats}
        />
        <StatTile
          icon={<TrendingUp />}
          label="Taux de succès"
          value={tokenStats?.successRate ?? 'N/A'}
          color="#7B68A8"
          loading={isLoading && !tokenStats}
        />
      </div>

      {/* ─── Visualisation + métriques ─────────────────────────────── */}
      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[1fr_1.4fr] gap-3">
        {/* Donut */}
        <Card className="gap-0 py-0 p-3.5 bg-[var(--card)] border-[var(--line)]">
          <p className="cn-text-body1 text-[0.875rem] font-bold mb-0.5">
            Distribution des tokens
          </p>
          <p className="cn-text-body1 text-[0.75rem] text-muted-foreground mb-3">
            Répartition entre tokens actifs et expirés
          </p>

          {donutData.length === 0 ? (
            <div className="h-[180px] flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <span className="inline-flex mb-1.5">
                <HourglassEmpty size={32} strokeWidth={1.5} />
              </span>
              <p className="cn-text-body1 text-[0.75rem]">
                En attente de données
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-[160px] h-[160px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--card)',
                        color: 'var(--ink)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-[0px] flex flex-col items-center justify-center pointer-events-none">
                  <p className="cn-text-body1 text-[1.5rem] font-bold leading-[1]">
                    {tokenStats?.totalTokens ?? 0}
                  </p>
                  <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground mt-0.5">
                    Total
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-[7.5px] flex-1">
                {donutData.map((entry) => (
                  <div className="flex items-center gap-1.5" key={entry.name}>
                    <div className="w-[10px] h-[10px] rounded-[50%]" style={{ backgroundColor: entry.color }} />
                    <p className="cn-text-body1 text-[0.8125rem] flex-1">{entry.name}</p>
                    <p className="cn-text-body1 text-[0.8125rem] font-bold">
                      {entry.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Refresh metrics */}
        <Card className="gap-0 py-0 p-3.5 bg-[var(--card)] border-[var(--line)]">
          <p className="cn-text-body1 text-[0.875rem] font-bold mb-0.5">
            Métriques de rafraîchissement
          </p>
          <p className="cn-text-body1 text-[0.75rem] text-muted-foreground mb-3">
            Indicateurs de performance du service de tokens
          </p>

          {/* Success rate bar */}
          {successRateNum !== null && (
            <div className="mb-3.5">
              <div className="flex justify-between items-center mb-0.5">
                <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] font-semibold uppercase tracking-[0.4px]">
                  Fiabilité globale
                </p>
                <p className={cn('cn-text-body1 text-[0.8125rem] font-bold', successRateNum >= 95 ? 'text-[var(--ok)]' : 'text-[var(--warn)]')}>
                  {successRateNum.toFixed(1)}%
                </p>
              </div>
              <Progress
                value={successRateNum}
                className={cn(
                  'h-1.5 rounded-full bg-[var(--hover)] [&_[data-slot=progress-indicator]]:rounded-full',
                  successRateNum >= 95
                    ? '[&_[data-slot=progress-indicator]]:bg-[var(--ok)]'
                    : '[&_[data-slot=progress-indicator]]:bg-[var(--warn)]',
                )}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <MetricRow
              icon={<Refresh size={14} strokeWidth={1.75} />}
              label="Rafraîchissements"
              value={tokenMetrics?.refreshCount ?? 0}
              fg="var(--info)"
              bg="var(--info-soft)"
            />
            <MetricRow
              icon={<ErrorIcon size={14} strokeWidth={1.75} />}
              label="Erreurs"
              value={tokenMetrics?.errorCount ?? 0}
              fg={(tokenMetrics?.errorCount ?? 0) > 0 ? 'var(--err)' : 'var(--ok)'}
              bg={(tokenMetrics?.errorCount ?? 0) > 0 ? 'var(--err-soft)' : 'var(--ok-soft)'}
            />
            <MetricRow
              icon={<AccessTime size={14} strokeWidth={1.75} />}
              label="Dernier refresh"
              value={formatRelativeTime(tokenMetrics?.lastRefresh)}
              fg="var(--accent)"
              bg="var(--accent-soft)"
            />
            <MetricRow
              icon={<Bolt size={14} strokeWidth={1.75} />}
              label="Temps moyen"
              value={`${tokenMetrics?.averageRefreshTime ?? 0}ms`}
              fg="var(--warn)"
              bg="var(--warn-soft)"
            />
          </div>
        </Card>
      </div>

      {/* ─── Architecture note ─────────────────────────────────────── */}
      <BuiAlert variant="info">
        <Bolt size={16} strokeWidth={2} />
        <AlertDescription className="text-[0.8125rem]">
          <strong>Architecture réactive</strong> — TokenService utilise le pattern Observer pour une
          propagation événementielle des changements de session (renouvellement, expiration, échec
          d&apos;authentification).
        </AlertDescription>
      </BuiAlert>
    </div>
  );
};

// ─── Metric row helper ───────────────────────────────────────────────────────

function MetricRow({
  icon,
  label,
  value,
  fg,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  fg: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center shrink-0" style={{ color: fg, backgroundColor: bg }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="cn-text-body1 text-[0.625rem] text-[var(--muted)] font-semibold uppercase tracking-[0.4px] leading-[1.2]">
          {label}
        </p>
        <p className="cn-text-body1 text-[0.875rem] font-bold leading-[1.2] mt-0.5 tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

export default TokenMonitoring;
