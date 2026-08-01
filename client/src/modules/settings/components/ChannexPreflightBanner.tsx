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
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { IconButton, CircularProgress, Collapse, Stack, Skeleton, Tooltip } from '@mui/material';
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
    <div className={cn('flex gap-[7.5px] py-[3.9000000000000004px] px-1.5 rounded-[6px] items-start', isIssue ? '[object Object]' : 'bg-[transparent]')}>
      <div className="mt-0.5 shrink-0">
        <SeverityIcon severity={check.severity} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('cn-text-body2 leading-[1.3] text-[var(--ink)]', isIssue ? 'font-semibold' : 'font-medium')}>
          {check.label}
        </p>
        <span className="cn-text-caption text-muted-foreground block leading-[1.45] mt-0">
          {check.detail}
        </span>
        {check.remediation && (
          <span className={cn('cn-text-caption block leading-[1.45] mt-[2.4000000000000004px] italic', check.severity === 'BLOCKER' ? 'text-[var(--err)]' : 'text-[var(--warn)]')}>
            ↳ {check.remediation}
          </span>
        )}
      </div>
    </div>
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
    <div className="rounded-[8px] overflow-hidden" style={{ border: `1px solid ${accent}33`, backgroundColor: `${accent}08` }}>
      {/* Header (toujours visible) */}
      {/* La teinte de survol depend du verdict (calcule au rendu) : on la passe par
          variable CSS, une classe Tailwind ne pouvant pas naitre d'une valeur d'execution. */}
      <div
        className="flex items-center gap-[7.5px] px-[9px] py-[7.5px] cursor-pointer select-none transition-[background-color] duration-150 hover:bg-[var(--pf-hover)]"
        style={{ '--pf-hover': `${accent}12` } as React.CSSProperties}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1A`, color: accent }}>
          <Stethoscope size={16} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="cn-text-body2 font-semibold leading-[1.3]">
            Diagnostic Channex
            {propertyId != null && (
              <span className="cn-text-caption text-muted-foreground ms-1 font-normal">
                · propriete #{propertyId}
              </span>
            )}
          </p>
          {loading && (
            <span className="cn-text-caption text-muted-foreground leading-[1.4]">
              Verification en cours…
            </span>
          )}
          {!loading && error && (
            <span className="cn-text-caption text-destructive leading-[1.4]">
              {error}
            </span>
          )}
          {!loading && report && (
            <span className="cn-text-caption text-muted-foreground leading-[1.4]">
              {report.canProceed ? 'Pret a connecter' : 'Action requise avant connexion'}
              {okCount > 0 && ` · ${okCount} OK`}
              {warningCount > 0 && ` · ${warningCount} attention`}
              {blockerCount > 0 && ` · ${blockerCount} bloquant${blockerCount > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
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
      </div>

      {/* Corps (deroulable) */}
      <Collapse in={!collapsed}>
        <div className="px-2 pb-2 pt-0.5">
          {loading && !report && (
            <Stack spacing={0.5}>
              <Skeleton variant="rounded" height={36} />
              <Skeleton variant="rounded" height={36} />
              <Skeleton variant="rounded" height={36} />
            </Stack>
          )}
          {error && !loading && (
            <Alert variant="destructive" className="mt-0.5">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {report && !loading && (
            <Stack spacing={0.25}>
              {report.checks.map((check) => (
                <CheckRow key={check.code + '-' + check.label} check={check} />
              ))}
            </Stack>
          )}
        </div>
      </Collapse>
    </div>
  );
}
