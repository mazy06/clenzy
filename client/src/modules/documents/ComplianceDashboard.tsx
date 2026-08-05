import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert as UiAlert, AlertDescription, AlertAction, Button } from '../../components/ui';
import { TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Lock,
  GppGood,
  GppBad,
  VerifiedUser,
  Description,
  Receipt,
  Public,
  ExpandMore,
  Check,
  Refresh,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useFiscalProfile, useUpdateFiscalProfile } from '../../hooks/useFiscalProfile';
import {
  documentsApi,
  ComplianceReport,
  DocumentGeneration,
} from '../../services/api/documentsApi';
import {
  useComplianceStats,
  useTemplates,
  useCheckTemplateCompliance,
} from './hooks/useDocuments';
import StatTile from '../../components/baitly/StatTile';

// ─── Teintes d'icone des tuiles KPI (classes Baitly UI) ─────────────────────
const PRIMARY = 'text-primary';
const ACCENT_TEAL = 'text-success';
const SOFT_BLUE = 'text-info';
const WARM = 'text-warning';

// ─── Country display ─────────────────────────────────────────────────────────

const COUNTRY_LABELS: Record<string, string> = {
  FR: 'France',
  MA: 'Maroc',
  SA: 'Arabie Saoudite',
};

const COUNTRY_FLAGS: Record<string, string> = {
  FR: '\uD83C\uDDEB\uD83C\uDDF7',
  MA: '\uD83C\uDDF2\uD83C\uDDE6',
  SA: '\uD83C\uDDF8\uD83C\uDDE6',
};

const COUNTRY_STANDARDS: Record<string, string> = {
  FR: 'NF 525',
  MA: 'CGI Maroc',
  SA: 'ZATCA',
};

const COUNTRY_OPTIONS = Object.keys(COUNTRY_LABELS).map((code) => ({
  code,
  label: COUNTRY_LABELS[code],
  flag: COUNTRY_FLAGS[code] || '',
  standard: COUNTRY_STANDARDS[code] || '',
}));

// ─── Component ───────────────────────────────────────────────────────────────

export interface ComplianceDashboardRef {
  fetchData: () => void;
  searchByNumber: (number: string) => void;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const ComplianceDashboard = forwardRef<ComplianceDashboardRef>((_, ref) => {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [complianceResults, setComplianceResults] = useState<Record<number, ComplianceReport>>({});
  const [searchResult, setSearchResult] = useState<DocumentGeneration | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Auto-verification state
  const [autoCheckProgress, setAutoCheckProgress] = useState(0);
  const [autoCheckTotal, setAutoCheckTotal] = useState(0);
  const [autoCheckRunning, setAutoCheckRunning] = useState(false);
  const [currentCheckingId, setCurrentCheckingId] = useState<number | null>(null);
  const autoCheckRanRef = useRef(false);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useComplianceStats();
  const { data: templates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useTemplates();
  const checkMutation = useCheckTemplateCompliance();
  const { data: fiscalProfile } = useFiscalProfile();
  const updateFiscalMutation = useUpdateFiscalProfile();

  const loading = statsLoading || templatesLoading;
  const error = actionError || (statsError ? t('documents.compliance.loadError') : null);

  // ─── Auto-verification: check all templates sequentially on load ───
  const runAutoCheck = useCallback(async (templateList: typeof templates) => {
    if (templateList.length === 0) return;
    setAutoCheckRunning(true);
    setAutoCheckProgress(0);
    setAutoCheckTotal(templateList.length);
    setComplianceResults({});

    for (let i = 0; i < templateList.length; i++) {
      const tpl = templateList[i];
      setCurrentCheckingId(tpl.id);
      // Minimum visible duration per template for a polished feel
      const [report] = await Promise.all([
        documentsApi.checkTemplateCompliance(tpl.id).catch(() => null),
        delay(800 + Math.random() * 400), // 800-1200ms per template
      ]);
      if (report) {
        setComplianceResults((prev) => ({ ...prev, [tpl.id]: report }));
      }
      setAutoCheckProgress(i + 1);
      // Short pause between items for visual rhythm
      await delay(150);
    }

    setCurrentCheckingId(null);
    setAutoCheckRunning(false);
    refetchStats();
  }, [refetchStats]);

  // Trigger auto-check when templates are loaded
  useEffect(() => {
    if (!templatesLoading && templates.length > 0 && !autoCheckRanRef.current) {
      autoCheckRanRef.current = true;
      runAutoCheck(templates);
    }
  }, [templatesLoading, templates, runAutoCheck]);

  const refetchAll = () => {
    refetchStats();
    refetchTemplates();
  };

  const handleManualRecheck = () => {
    autoCheckRanRef.current = false;
    setComplianceResults({});
    runAutoCheck(templates);
  };

  useImperativeHandle(ref, () => ({
    fetchData: () => {
      refetchAll();
      handleManualRecheck();
    },
    searchByNumber: handleSearchByNumber,
  }));

  const handleSearchByNumber = async (number: string) => {
    if (!number.trim()) return;
    setSearchError(null);
    setSearchResult(null);
    try {
      const result = await documentsApi.getGenerationByLegalNumber(number.trim());
      setSearchResult(result);
    } catch {
      setSearchError(t('documents.compliance.searchNotFound'));
    }
  };

  const handleCountryChange = async (newCountryCode: string) => {
    if (!fiscalProfile || newCountryCode === fiscalProfile.countryCode) return;
    try {
      await updateFiscalMutation.mutateAsync({
        ...fiscalProfile,
        countryCode: newCountryCode,
      });
      refetchStats();
      setSuccess(t('documents.compliance.countryChanged'));
    } catch {
      setActionError(t('documents.compliance.countryChangeError'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  const countryCode = stats?.countryCode || 'FR';
  const standardName = stats?.complianceStandard || 'NF 525';
  const countryLabel = COUNTRY_LABELS[countryCode] || countryCode;
  const countryFlag = COUNTRY_FLAGS[countryCode] || '';

  return (
    <div>
      {error && <UiAlert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setActionError(null)}>
            <X />
          </Button>
        </AlertAction>
      </UiAlert>}
      {success && <UiAlert variant="success" className="mb-3">
        <CircleCheck />
        <AlertDescription>{success}</AlertDescription>
        <AlertAction>
          <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setSuccess(null)}>
            <X />
          </Button>
        </AlertAction>
      </UiAlert>}

      {/* ─── Country & Standard indicator ────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-3">
        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Bouton natif plutot que le span attendu : il porte la ref que
                  Radix pose sur son enfant (StatusChip est une fonction, il n'en
                  transmet pas) ET reste atteignable au clavier.
                  Le chevron etait monte en `deleteIcon`, avec un `onDelete` qui
                  ouvrait le meme menu que le corps de la puce : deux commandes
                  pour une seule action, dont une annoncee \u00ab supprimer \u00bb. Ici, une
                  puce = un bouton, et le chevron n'est plus qu'un decor. */}
              <button
                type="button"
                aria-label={`${countryLabel} \u2014 ${standardName}`}
                className="inline-flex cursor-pointer border-0 bg-transparent p-0"
              >
                <StatusChip
                  tone="accent"
                  icon={<Public size={14} strokeWidth={1.75} />}
                  label={
                    <span className="inline-flex items-center gap-1">
                      {`${countryFlag} ${countryLabel} \u2014 ${standardName}`}
                      <ExpandMore className="size-3.5 opacity-70" aria-hidden />
                    </span>
                  }
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              {COUNTRY_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.code}
                  onSelect={() => handleCountryChange(opt.code)}
                  className="gap-2 py-1.5 text-[0.85rem]"
                >
                  <span className="w-8 shrink-0 text-[1.1rem] leading-none">{opt.flag}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[0.85rem] font-medium">{opt.label}</span>
                    <span className="text-[0.72rem] text-muted-foreground">{opt.standard}</span>
                  </span>
                  {opt.code === countryCode && (
                    <span className="inline-flex text-success ms-1.5"><Check size={18} strokeWidth={1.75} /></span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge variant="secondary" className="text-primary bg-primary-soft [&>svg]:text-primary"><Public size={14} strokeWidth={1.75} />{`${countryFlag} ${countryLabel} \u2014 ${standardName}`}</Badge>
        )}
      </div>

      {/* ─── KPIs (primitive StatTile) ───────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(4,_1fr)] gap-[9px] mb-[18px]">
          <StatTile
            icon={<Description size={16} strokeWidth={1.75} />}
            label={t('documents.compliance.totalDocuments')}
            value={stats.totalDocuments}
            iconClassName={PRIMARY}
          />
          <StatTile
            icon={<Lock size={16} strokeWidth={1.75} />}
            label={t('documents.compliance.totalLocked')}
            value={stats.totalLocked}
            iconClassName={WARM}
          />
          <StatTile
            icon={<Receipt size={16} strokeWidth={1.75} />}
            label={t('documents.compliance.invoicesLocked')}
            value={`${stats.totalFacturesLocked}/${stats.totalFactures}`}
            iconClassName={SOFT_BLUE}
          />
          <StatTile
            icon={<GppGood size={16} strokeWidth={1.75} />}
            label={t('documents.compliance.averageScore')}
            value={`${stats.averageComplianceScore}%`}
            iconClassName={ACCENT_TEAL}
          />
        </div>
      )}

      {/* ─── Search result ────────────────────────────────────────────── */}
      {searchError && <UiAlert variant="warning" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{searchError}</AlertDescription>
        <AlertAction>
          <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setSearchError(null)}>
            <X />
          </Button>
        </AlertAction>
      </UiAlert>}
      {searchResult && (
        <Card className="mb-3 gap-0 p-3 py-0">
          <p className="text-xs">
            <strong>N. Legal :</strong> {searchResult.legalNumber} &nbsp;|&nbsp;
            <strong>Type :</strong> {searchResult.documentType} &nbsp;|&nbsp;
            <strong>{t('documents.compliance.file')} :</strong> {searchResult.fileName || '\u2014'} &nbsp;|&nbsp;
            <strong>Date :</strong> {formatDate(searchResult.createdAt)} &nbsp;|&nbsp;
            <strong>{t('documents.compliance.locked')} :</strong>{' '}
            {searchResult.locked ? (
              <Badge variant="secondary" className="text-warning-ink bg-warning-soft [&>svg]:text-warning"><Lock size={14} strokeWidth={1.75} />{t('common.yes')}</Badge>
            ) : (
              <Badge variant="secondary" className="text-muted-foreground bg-muted">{t('common.no')}</Badge>
            )}
          </p>
        </Card>
      )}

      {/* ─── Template compliance check ────────────────────────────────── */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <p className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-balance text-foreground">
              {t('documents.compliance.templateVerification')}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Le span porte la ref que Radix pose sur son enfant : Button
                    est une fonction, il n'en transmet pas. */}
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleManualRecheck}
                    disabled={autoCheckRunning}
                    aria-label="Relancer la verification"
                    className="text-primary hover:text-primary hover:bg-primary-soft"
                  >
                    {/* `animate-spin` de Tailwind = animation: spin 1s linear infinite, identique aux keyframes locales remplacees. */}
                    <span className={cn('inline-flex', autoCheckRunning && 'animate-spin motion-reduce:animate-none')}>
                      <Refresh size={20} strokeWidth={1.75} />
                    </span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Relancer la verification</TooltipContent>
            </Tooltip>
          </div>

          {/* Progress bar during auto-check */}
          {autoCheckRunning && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Verification en cours... {autoCheckProgress}/{autoCheckTotal}
                </span>
                <span className="text-xs font-semibold text-primary tabular-nums font-[family-name:var(--font-display)]">
                  {autoCheckTotal > 0 ? Math.round((autoCheckProgress / autoCheckTotal) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={autoCheckTotal > 0 ? (autoCheckProgress / autoCheckTotal) * 100 : 0}
                className={cn(
                  'h-1.5 rounded-[3px] bg-primary-soft',
                  '[&_[data-slot=progress-indicator]]:rounded-[24px]',
                  '[&_[data-slot=progress-indicator]]:bg-primary',
                  '[&_[data-slot=progress-indicator]]:duration-[600ms]',
                  'motion-reduce:[&_[data-slot=progress-indicator]]:transition-none',
                )}
              />
            </div>
          )}

          {/* Completion message */}
          {!autoCheckRunning && autoCheckTotal > 0 && autoCheckProgress === autoCheckTotal && (
            <UiAlert variant="success" className="mb-3">
              <GppGood />
              <AlertDescription>
                Verification terminee — {autoCheckTotal} templates verifies
              </AlertDescription>
            </UiAlert>
          )}

          {/* Surface de tableau : filet `border` + fond `card` de Baitly UI. */}
          <div className="overflow-x-auto rounded-lg border border-solid border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>{t('documents.compliance.activeLabel')}</TableHead>
                  <TableHead>{t('documents.compliance.complianceLabel')}</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-end">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-[18px]">
                      <p className="text-sm text-muted-foreground">{t('documents.compliance.noTemplates')}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((tpl) => {
                    const report = complianceResults[tpl.id];
                    const isChecking = currentCheckingId === tpl.id;
                    return (
                      <TableRow
                        key={tpl.id}
                        className={cn(
                          'transition-colors duration-[.4s] motion-reduce:transition-none',
                          // Pas de side-stripe (interdit absolu) : surlignage -soft seul.
                          isChecking && 'bg-primary-soft',
                        )}
                      >
                        <TableCell>
                          <p className="text-xs font-medium">{tpl.name}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-primary bg-primary-soft">{tpl.documentType}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusChip
                            tone={tpl.active ? 'ok' : 'neutral'}
                            label={tpl.active ? t('documents.compliance.active') : t('documents.compliance.inactive')}
                          />
                        </TableCell>
                        <TableCell>
                          {isChecking ? (
                            <div className="flex items-center gap-1.5">
                              <Spinner className="size-4 text-primary" />
                              <span className="text-xs text-muted-foreground">Verification...</span>
                            </div>
                          ) : report ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {/* Le `span` porte la ref que Tooltip pose sur son
                                    enfant : StatusChip est une fonction, il n'en
                                    transmet pas, et l'infobulle ne s'ancrerait pas. */}
                                <span className="inline-flex">
                                  <StatusChip
                                    tone={report.compliant ? 'ok' : 'err'}
                                    icon={
                                      report.compliant
                                        ? <GppGood size={12} strokeWidth={1.75} />
                                        : <GppBad size={12} strokeWidth={1.75} />
                                    }
                                    label={report.compliant ? t('documents.compliance.compliant') : t('documents.compliance.nonCompliant')}
                                    className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 duration-300"
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {report.compliant
                                  ? t('documents.compliance.allMentionsPresent')
                                  : `${t('documents.compliance.missingMentionsLabel')} : ${report.missingMentions.join(', ')}`}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">En attente</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isChecking ? (
                            <Spinner className="size-4 text-primary" />
                          ) : report ? (
                            <p
                              className={cn(
                                'text-xs font-semibold tabular-nums [font-family:var(--font-display)] animate-[fadeIn_0.4s_ease] motion-reduce:animate-none',
                                report.score >= 80 ? 'text-success-ink' : report.score >= 50 ? 'text-warning-ink' : 'text-destructive-ink',
                              )}
                            >
                              {report.score}%
                            </p>
                          ) : '\u2014'}
                        </TableCell>
                        <TableCell className="text-end">
                          {report ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {report.compliant ? (
                                  <span className="inline-flex text-success animate-[fadeIn_0.4s_ease] motion-reduce:animate-none">
                                    <GppGood size={20} strokeWidth={1.75} />
                                  </span>
                                ) : (
                                  <span className="inline-flex text-destructive animate-[fadeIn_0.4s_ease] motion-reduce:animate-none">
                                    <GppBad size={20} strokeWidth={1.75} />
                                  </span>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>{report.compliant ? 'Conforme' : 'Non conforme'}</TooltipContent>
                            </Tooltip>
                          ) : isChecking ? (
                            <Spinner className="size-[18px] text-primary" />
                          ) : (
                            <span className="inline-flex text-faint"><VerifiedUser size={20} strokeWidth={1.75} /></span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ComplianceDashboard.displayName = 'ComplianceDashboard';

export default ComplianceDashboard;
