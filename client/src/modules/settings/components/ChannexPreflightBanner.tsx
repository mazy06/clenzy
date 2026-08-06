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
import {
  Alert,
  AlertDescription,
  Button,
  Collapsible,
  CollapsibleContent,
  Skeleton,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
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

/** Icone decorative → teinte VIVE (jamais `-ink`, reserve au texte, §2.4). */
function SeverityIcon({ severity }: { severity: ChannexPreflightCheck['severity'] }) {
  if (severity === 'OK') {
    return <CheckCircle2 size={16} strokeWidth={2.2} className="text-success" />;
  }
  if (severity === 'WARNING') {
    return <AlertTriangle size={16} strokeWidth={2.2} className="text-warning" />;
  }
  return <XCircle size={16} strokeWidth={2.2} className="text-destructive" />;
}

function CheckRow({ check }: { check: ChannexPreflightCheck }) {
  const isIssue = check.severity !== 'OK';
  return (
    <div
      className={cn(
        'flex gap-[7.5px] py-1 px-1.5 rounded-md items-start',
        isIssue
          ? (check.severity === 'BLOCKER' ? 'bg-destructive-soft/40' : 'bg-warning-soft/40')
          : 'bg-transparent',
      )}
    >
      <div className="mt-0.5 shrink-0">
        <SeverityIcon severity={check.severity} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs leading-[1.3] text-foreground', isIssue ? 'font-semibold' : 'font-medium')}>
          {check.label}
        </p>
        <span className="text-xs text-muted-foreground block leading-[1.45]">
          {check.detail}
        </span>
        {/* Remediation = TEXTE → encre `-ink`, la teinte vive ne passe pas AA. */}
        {check.remediation && (
          <span className={cn('block text-xs leading-[1.45] mt-0.5 italic', check.severity === 'BLOCKER' ? 'text-destructive-ink' : 'text-warning-ink')}>
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

  // Teinte VIVE du verdict : elle peint la bordure, le fond et l'icone du
  // bandeau, jamais du texte (§2.4). L'ancienne ecriture `${accent}33`
  // concatenait un alpha sur un `var()` — declaration invalide, sans effet :
  // les alphas passent desormais par `color-mix`.
  const accent = !report
    ? 'var(--bui-primary)'
    : blockerCount > 0
      ? 'var(--bui-destructive)'
      : warningCount > 0
        ? 'var(--bui-warning)'
        : 'var(--bui-success)';

  return (
    <div
      className="rounded-lg overflow-hidden border border-solid border-[color-mix(in_srgb,var(--pf-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--pf-accent)_5%,transparent)]"
      style={{ '--pf-accent': accent } as React.CSSProperties}
    >
      {/* Header (toujours visible) */}
      {/* La teinte de survol depend du verdict (calcule au rendu) : on la passe par
          variable CSS, une classe Tailwind ne pouvant pas naitre d'une valeur d'execution. */}
      <div
        className="flex items-center gap-[7.5px] px-[9px] py-[7.5px] cursor-pointer select-none transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-[color-mix(in_srgb,var(--pf-accent)_9%,transparent)]"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-[color-mix(in_srgb,var(--pf-accent)_12%,transparent)] text-[var(--pf-accent)]">
          <Stethoscope size={16} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-[1.3] text-foreground">
            Diagnostic Channex
            {propertyId != null && (
              <span className="text-xs text-muted-foreground ms-1 font-normal tabular-nums">
                · propriete #{propertyId}
              </span>
            )}
          </p>
          {loading && (
            <span className="text-xs text-muted-foreground leading-[1.4]">
              Verification en cours…
            </span>
          )}
          {!loading && error && (
            <span className="text-xs text-destructive-ink leading-[1.4]">
              {error}
            </span>
          )}
          {!loading && report && (
            <span className="text-xs text-muted-foreground leading-[1.4]">
              {report.canProceed ? 'Pret a connecter' : 'Action requise avant connexion'}
              {okCount > 0 && ` · ${okCount} OK`}
              {warningCount > 0 && ` · ${warningCount} attention`}
              {blockerCount > 0 && ` · ${blockerCount} bloquant${blockerCount > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Enveloppe : un bouton desactive n'emet plus d'evenement de survol,
                l'infobulle a besoin d'une cible qui en emette. */}
            <span className="inline-flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Relancer le diagnostic"
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  void runCheck();
                }}
              >
                {loading ? (
                  <Spinner className="size-[14px] text-[var(--pf-accent)]" />
                ) : (
                  <RefreshCw size={14} strokeWidth={2.2} className="text-[var(--pf-accent)]" />
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">Relancer le diagnostic</TooltipContent>
        </Tooltip>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? 'Deplier le diagnostic' : 'Replier le diagnostic'}
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
        >
          {collapsed ? (
            <ChevronDown size={16} strokeWidth={2.2} className="text-[var(--pf-accent)]" />
          ) : (
            <ChevronUp size={16} strokeWidth={2.2} className="text-[var(--pf-accent)]" />
          )}
        </Button>
      </div>

      {/* Corps (deroulable) */}
      <Collapsible open={!collapsed}>
        <CollapsibleContent>
          <div className="px-2 pb-2 pt-0.5">
            {loading && !report && (
              <div className="flex flex-col gap-[3px]">
                <Skeleton className="h-9 rounded-lg" />
                <Skeleton className="h-9 rounded-lg" />
                <Skeleton className="h-9 rounded-lg" />
              </div>
            )}
            {error && !loading && (
              <Alert variant="destructive" className="mt-0.5">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {report && !loading && (
              <div className="flex flex-col gap-[1.5px]">
                {report.checks.map((check) => (
                  <CheckRow key={check.code + '-' + check.label} check={check} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
