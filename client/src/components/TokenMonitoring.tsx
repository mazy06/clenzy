import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Stack,
  LinearProgress,
  Skeleton,
  CircularProgress,
} from '@mui/material';
import {
  Refresh,
  Delete,
  Security,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const ts = new Date(iso).getTime();
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

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  hint?: string;
  loading?: boolean;
}

function KpiCard({ icon, label, value, color, hint, loading }: KpiCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 200ms, box-shadow 200ms',
        '&:hover': {
          borderColor: color,
          boxShadow: `0 1px 3px ${color}1a`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            bgcolor: `${color}15`,
          }}
        >
          {icon}
        </Box>
      </Box>
      {loading ? (
        <Skeleton variant="text" width={60} height={36} />
      ) : (
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, color: 'text.primary' }}>
          {value}
        </Typography>
      )}
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500, mt: 0.5 }}>
        {label}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );
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

  const currentToken = tokenService.getCurrentTokenInfo();
  const timeUntilExpiry = currentToken.timeUntilExpiry ?? 0;
  // Assumption : un token Keycloak dure 15 min par défaut → on prend max(observé, 900)
  const totalLifetime = Math.max(timeUntilExpiry, 900);
  const remainingPct = totalLifetime > 0 ? Math.round((timeUntilExpiry / totalLifetime) * 100) : 0;

  // Token status (active / expiring / expired)
  const tokenStatus = useMemo(() => {
    if (!currentToken.isAuthenticated) return { label: 'Non authentifié', color: '#9e9e9e' };
    if (timeUntilExpiry <= 0) return { label: 'Expiré', color: '#ef4444' };
    if (timeUntilExpiry < 300) return { label: 'Expiration proche', color: '#f59e0b' };
    return { label: 'Authentifié', color: '#10b981' };
  }, [currentToken.isAuthenticated, timeUntilExpiry]);

  // Donut data
  const donutData = useMemo(() => {
    const active = tokenStats?.activeTokens ?? 0;
    const expired = tokenStats?.expiredTokens ?? 0;
    const total = active + expired;
    if (total === 0) return [];
    return [
      { name: 'Actifs', value: active, color: '#10b981' },
      { name: 'Expirés', value: expired, color: '#ef4444' },
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ─── Header bar ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.main',
              bgcolor: 'primary.main',
              backgroundImage: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.main}25 0%, ${theme.palette.primary.main}10 100%)`,
            }}
          >
            <Security size={18} strokeWidth={2} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>
              Monitoring des Tokens
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              Surveillance en temps réel de l'authentification Keycloak
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={loadTokenStats}
            disabled={isLoading}
            startIcon={
              isLoading ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <Refresh size={16} strokeWidth={1.75} />
              )
            }
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Actualiser
          </Button>
          <Button
            variant="outlined"
            color="warning"
            size="small"
            onClick={cleanupTokens}
            disabled={isLoading}
            startIcon={<Delete size={16} strokeWidth={1.75} />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Nettoyer expirés
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ─── Hero card : current token ─────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 2,
          borderColor: 'divider',
          position: 'relative',
          overflow: 'hidden',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.main}0d 100%)`
              : `linear-gradient(135deg, #fff 0%, ${theme.palette.primary.main}08 100%)`,
        }}
      >
        {currentToken.isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            {/* Countdown ring + avatar */}
            <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
              <CircularProgress
                variant="determinate"
                value={100}
                size={96}
                thickness={3}
                sx={{ color: 'action.hover', position: 'absolute', top: 0, left: 0 }}
              />
              <CircularProgress
                variant="determinate"
                value={remainingPct}
                size={96}
                thickness={3}
                sx={{
                  color: tokenStatus.color,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transition: 'color 300ms',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 8,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  letterSpacing: '0.05em',
                }}
              >
                {getInitials(currentToken.username || currentToken.email)}
              </Box>
            </Box>

            {/* User info */}
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
                  {currentToken.username || 'admin'}
                </Typography>
                <Chip
                  size="small"
                  icon={
                    <Box component="span" sx={{ display: 'inline-flex', color: 'inherit', ml: 0.5 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tokenStatus.color }} />
                    </Box>
                  }
                  label={tokenStatus.label}
                  sx={{
                    height: 22,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    bgcolor: `${tokenStatus.color}15`,
                    color: tokenStatus.color,
                    border: `1px solid ${tokenStatus.color}30`,
                    borderRadius: '6px',
                    '& .MuiChip-icon': { mr: -0.25 },
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                    <Email size={13} strokeWidth={1.75} />
                  </Box>
                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                    {currentToken.email || 'N/A'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                    <Person size={13} strokeWidth={1.75} />
                  </Box>
                  <Typography
                    sx={{ fontSize: '0.75rem', color: 'text.disabled', fontFamily: 'monospace' }}
                  >
                    {currentToken.userId?.slice(0, 8) ?? '—'}
                  </Typography>
                  {currentToken.userId && (
                    <Tooltip title={copied ? 'Copié !' : 'Copier l\'ID complet'}>
                      <IconButton size="small" onClick={copyUserId} sx={{ p: 0.25 }}>
                        {copied ? (
                          <CheckCircle size={12} strokeWidth={2} color="#10b981" />
                        ) : (
                          <ContentCopy size={12} strokeWidth={1.75} />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Stack>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {currentToken.roles?.length ? (
                  currentToken.roles.map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.3,
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  ))
                ) : (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
                    Aucun rôle assigné
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Countdown */}
            <Box
              sx={{
                minWidth: 200,
                pl: 3,
                borderLeft: { md: '1px solid' },
                borderLeftColor: { md: 'divider' },
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: 'text.secondary',
                  mb: 0.5,
                }}
              >
                <AccessTime size={11} strokeWidth={1.75} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Temps avant expiration
              </Typography>
              <Typography
                sx={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: tokenStatus.color,
                  fontFamily: 'monospace',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {formatDuration(timeUntilExpiry)}
              </Typography>
              {currentToken.expiresAt && (
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', mt: 0.25 }}>
                  {new Date(currentToken.expiresAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              )}
              <LinearProgress
                variant="determinate"
                value={remainingPct}
                sx={{
                  mt: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: tokenStatus.color,
                    borderRadius: 2,
                  },
                }}
              />
            </Box>
          </Box>
        ) : (
          <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
            Aucun token actif détecté. Veuillez vous authentifier.
          </Alert>
        )}
      </Paper>

      {/* ─── KPI grid ──────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        <KpiCard
          icon={<Storage size={18} strokeWidth={1.75} />}
          label="Total des tokens"
          value={tokenStats?.totalTokens ?? 0}
          color="#6B8A9A"
          loading={isLoading && !tokenStats}
        />
        <KpiCard
          icon={<CheckCircle size={18} strokeWidth={1.75} />}
          label="Tokens actifs"
          value={tokenStats?.activeTokens ?? 0}
          color="#10b981"
          hint={
            tokenStats?.totalTokens
              ? `${Math.round(((tokenStats.activeTokens ?? 0) / tokenStats.totalTokens) * 100)}% du total`
              : undefined
          }
          loading={isLoading && !tokenStats}
        />
        <KpiCard
          icon={<Warning size={18} strokeWidth={1.75} />}
          label="Tokens expirés"
          value={tokenStats?.expiredTokens ?? 0}
          color="#ef4444"
          hint={
            tokenStats?.totalTokens
              ? `${Math.round(((tokenStats.expiredTokens ?? 0) / tokenStats.totalTokens) * 100)}% du total`
              : undefined
          }
          loading={isLoading && !tokenStats}
        />
        <KpiCard
          icon={<TrendingUp size={18} strokeWidth={1.75} />}
          label="Taux de succès"
          value={tokenStats?.successRate ?? 'N/A'}
          color="#8b5cf6"
          loading={isLoading && !tokenStats}
        />
      </Box>

      {/* ─── Visualisation + métriques ─────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, gap: 2 }}>
        {/* Donut */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 0.25 }}>
            Distribution des tokens
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2 }}>
            Répartition entre tokens actifs et expirés
          </Typography>

          {donutData.length === 0 ? (
            <Box
              sx={{
                height: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.disabled',
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', mb: 1 }}>
                <HourglassEmpty size={32} strokeWidth={1.5} />
              </Box>
              <Typography sx={{ fontSize: '0.75rem' }}>
                En attente de données
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 160, height: 160, position: 'relative' }}>
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
                        border: '1px solid #e5e7eb',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
                    {tokenStats?.totalTokens ?? 0}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mt: 0.25 }}>
                    Total
                  </Typography>
                </Box>
              </Box>
              <Stack spacing={1.25} sx={{ flex: 1 }}>
                {donutData.map((entry) => (
                  <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color }} />
                    <Typography sx={{ fontSize: '0.8125rem', flex: 1 }}>{entry.name}</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                      {entry.value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Paper>

        {/* Refresh metrics */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 0.25 }}>
            Métriques de rafraîchissement
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2 }}>
            Indicateurs de performance du service de tokens
          </Typography>

          {/* Success rate bar */}
          {successRateNum !== null && (
            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Fiabilité globale
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: successRateNum >= 95 ? '#10b981' : '#f59e0b' }}>
                  {successRateNum.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={successRateNum}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: successRateNum >= 95 ? '#10b981' : '#f59e0b',
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <MetricRow
              icon={<Refresh size={14} strokeWidth={1.75} />}
              label="Rafraîchissements"
              value={tokenMetrics?.refreshCount ?? 0}
              color="#0ea5e9"
            />
            <MetricRow
              icon={<ErrorIcon size={14} strokeWidth={1.75} />}
              label="Erreurs"
              value={tokenMetrics?.errorCount ?? 0}
              color={(tokenMetrics?.errorCount ?? 0) > 0 ? '#ef4444' : '#10b981'}
            />
            <MetricRow
              icon={<AccessTime size={14} strokeWidth={1.75} />}
              label="Dernier refresh"
              value={formatRelativeTime(tokenMetrics?.lastRefresh)}
              color="#8b5cf6"
            />
            <MetricRow
              icon={<Bolt size={14} strokeWidth={1.75} />}
              label="Temps moyen"
              value={`${tokenMetrics?.averageRefreshTime ?? 0}ms`}
              color="#f59e0b"
            />
          </Box>
        </Paper>
      </Box>

      {/* ─── Architecture note ─────────────────────────────────────── */}
      <Alert
        severity="info"
        icon={<Bolt size={16} strokeWidth={2} />}
        sx={{
          borderRadius: 1.5,
          '& .MuiAlert-icon': { alignItems: 'center' },
          '& .MuiAlert-message': { fontSize: '0.8125rem' },
        }}
      >
        <strong>Architecture réactive</strong> — TokenService utilise le pattern Observer pour une
        propagation événementielle des changements de session (renouvellement, expiration, échec
        d'authentification).
      </Alert>
    </Box>
  );
};

// ─── Metric row helper ───────────────────────────────────────────────────────

function MetricRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          bgcolor: `${color}15`,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.2, mt: 0.25 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default TokenMonitoring;
