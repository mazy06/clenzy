/**
 * Channex Pre-flight Banner
 *
 * Quick Win #3 de la strategie Channex : un panneau de diagnostic compact qui
 * verifie en amont si une connexion Channex peut aboutir, avant que l'utilisateur
 * n'investisse 5 minutes dans un wizard OAuth pour decouvrir un blocage trivial.
 *
 * <p><b>Affichage</b> : 1 ligne par check (icone + label + detail + remediation
 * si applicable). Le banner peut etre replie/deplie. Un bouton de refresh
 * permet de re-lancer le check (utile apres correction d'une cle API).</p>
 *
 * <p><b>Variantes de severite</b> :</p>
 * <ul>
 *   <li>OK (vert)      : info purement positive</li>
 *   <li>WARNING (orange) : on peut continuer mais defaut sera applique</li>
 *   <li>BLOCKER (rouge) : impossible de continuer — affiche la remediation</li>
 * </ul>
 *
 * <p>Le {@code canProceed} global du report est expose via {@code onResult} pour
 * que le parent puisse desactiver les boutons "Connecter" tant qu'un BLOCKER
 * existe.</p>
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Collapse,
  Stack,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Stethoscope,
} from 'lucide-react';

import { channexApi } from '../../../services/api/channexApi';
import type {
  ChannexPreflightCheck,
  ChannexPreflightReport,
} from '../../../services/api/channexApi';

interface ChannexPreflightBannerProps {
  /** Optionnel : si fourni, ajoute les checks per-property au rapport. */
  propertyId?: number;
  /** Callback appele quand le report est dispo (ou rafraichi). */
  onResult?: (report: ChannexPreflightReport) => void;
  /** Replie par defaut. false pour montrer tous les checks au mount. */
  defaultCollapsed?: boolean;
}

function SeverityIcon({ severity }: { severity: ChannexPreflightCheck['severity'] }) {
  if (severity === 'OK') {
    return <CheckCircle2 size={16} color="var(--ok)" strokeWidth={2.2} />;
  }
  if (severity === 'WARNING') {
    return <AlertTriangle size={16} color="var(--warn)" strokeWidth={2.2} />;
  }
  return <XCircle size={16} color="var(--err)" strokeWidth={2.2} />;
}

function CheckRow({ check }: { check: ChannexPreflightCheck }) {
  const isIssue = check.severity !== 'OK';
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.25,
        py: 0.65,
        px: 1,
        borderRadius: 0.75,
        alignItems: 'flex-start',
        bgcolor: isIssue
          ? check.severity === 'BLOCKER'
            ? 'color-mix(in srgb, var(--err) 5%, transparent)'
            : 'color-mix(in srgb, var(--warn) 5%, transparent)'
          : 'transparent',
      }}
    >
      <Box sx={{ mt: 0.2, flexShrink: 0 }}>
        <SeverityIcon severity={check.severity} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          fontWeight={isIssue ? 600 : 500}
          sx={{ lineHeight: 1.3, color: 'text.primary' }}
        >
          {check.label}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', lineHeight: 1.45, mt: 0.15 }}
        >
          {check.detail}
        </Typography>
        {check.remediation && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              lineHeight: 1.45,
              mt: 0.4,
              color: check.severity === 'BLOCKER' ? 'var(--err)' : 'var(--warn)',
              fontStyle: 'italic',
            }}
          >
            ↳ {check.remediation}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function ChannexPreflightBanner({
  propertyId,
  onResult,
  defaultCollapsed = true,
}: ChannexPreflightBannerProps) {
  const [report, setReport] = useState<ChannexPreflightReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await channexApi.preflight(propertyId);
      setReport(res);
      onResult?.(res);
      // Auto-ouvre si un blocker / warning est detecte (pour ne rien rater)
      if (!res.canProceed || res.checks.some((c) => c.severity === 'WARNING')) {
        setCollapsed(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de lancer le diagnostic Channex.',
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId, onResult]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const blockerCount = report?.checks.filter((c) => c.severity === 'BLOCKER').length ?? 0;
  const warningCount = report?.checks.filter((c) => c.severity === 'WARNING').length ?? 0;
  const okCount = report?.checks.filter((c) => c.severity === 'OK').length ?? 0;

  // Couleur principale du banner selon le verdict
  const accent = !report
    ? 'var(--accent)'
    : blockerCount > 0
      ? 'var(--err)'
      : warningCount > 0
        ? 'var(--warn)'
        : 'var(--ok)';

  return (
    <Box
      sx={{
        border: `1px solid ${accent}33`,
        bgcolor: `${accent}08`,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header (toujours visible) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.5,
          py: 1.25,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: `${accent}12` },
          transition: 'background-color 150ms',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 0.75,
            bgcolor: `${accent}1A`,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Stethoscope size={16} strokeWidth={2.2} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
            Diagnostic Channex
            {propertyId != null && (
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 0.75, fontWeight: 400 }}
              >
                · propriete #{propertyId}
              </Typography>
            )}
          </Typography>
          {loading && (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              Verification en cours…
            </Typography>
          )}
          {!loading && error && (
            <Typography variant="caption" color="error" sx={{ lineHeight: 1.4 }}>
              {error}
            </Typography>
          )}
          {!loading && report && (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              {report.canProceed ? 'Pret a connecter' : 'Action requise avant connexion'}
              {okCount > 0 && ` · ${okCount} OK`}
              {warningCount > 0 && ` · ${warningCount} attention`}
              {blockerCount > 0 && ` · ${blockerCount} bloquant${blockerCount > 1 ? 's' : ''}`}
            </Typography>
          )}
        </Box>
        <Tooltip title="Relancer le diagnostic" arrow placement="top">
          <span>
            <IconButton
              size="small"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                void runCheck();
              }}
              sx={{ width: 28, height: 28 }}
            >
              {loading ? (
                <CircularProgress size={14} sx={{ color: accent }} />
              ) : (
                <RefreshCw size={14} color={accent} strokeWidth={2.2} />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <IconButton
          size="small"
          sx={{ width: 28, height: 28 }}
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
        >
          {collapsed ? (
            <ChevronDown size={16} color={accent} strokeWidth={2.2} />
          ) : (
            <ChevronUp size={16} color={accent} strokeWidth={2.2} />
          )}
        </IconButton>
      </Box>

      {/* Corps (deroulable) */}
      <Collapse in={!collapsed}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.25 }}>
          {loading && !report && (
            <Stack spacing={0.5}>
              <Skeleton variant="rounded" height={36} />
              <Skeleton variant="rounded" height={36} />
              <Skeleton variant="rounded" height={36} />
            </Stack>
          )}
          {error && !loading && (
            <Alert severity="error" sx={{ mt: 0.5 }}>
              {error}
            </Alert>
          )}
          {report && !loading && (
            <Stack spacing={0.25}>
              {report.checks.map((check) => (
                <CheckRow key={check.code + '-' + check.label} check={check} />
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
