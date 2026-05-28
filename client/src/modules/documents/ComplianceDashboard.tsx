import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
} from '@mui/material';
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
import { softChipSx } from '../../utils/statusUtils';

// ─── Palette Baitly (accents valides) ────────────────────────────────────────
const PRIMARY = '#6B8A9A';
const ACCENT_TEAL = '#4A9B8E';
const SOFT_BLUE = '#7BA3C2';
const WARM = '#D4A574';
const NEUTRAL = '#8A8378';
const DANGER_SOFT = '#C97A7A';

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

const ComplianceDashboard = forwardRef<ComplianceDashboardRef>((_, ref) => {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [complianceResults, setComplianceResults] = useState<Record<number, ComplianceReport>>({});
  const [searchResult, setSearchResult] = useState<DocumentGeneration | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [countryMenuAnchor, setCountryMenuAnchor] = useState<HTMLElement | null>(null);

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
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    setCountryMenuAnchor(null);
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const countryCode = stats?.countryCode || 'FR';
  const standardName = stats?.complianceStandard || 'NF 525';
  const countryLabel = COUNTRY_LABELS[countryCode] || countryCode;
  const countryFlag = COUNTRY_FLAGS[countryCode] || '';

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* ─── Country & Standard indicator ────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {isAdmin ? (
          <>
            <Chip
              icon={<Public size={14} strokeWidth={1.75} color={PRIMARY} />}
              label={`${countryFlag} ${countryLabel} \u2014 ${standardName}`}
              deleteIcon={<ExpandMore color={PRIMARY} />}
              onDelete={(e) => setCountryMenuAnchor(e.currentTarget as HTMLElement)}
              onClick={(e) => setCountryMenuAnchor(e.currentTarget)}
              sx={{ ...softChipSx(PRIMARY), cursor: 'pointer', '&:hover': { backgroundColor: `${PRIMARY}24` } }}
            />
            <Menu
              anchorEl={countryMenuAnchor}
              open={Boolean(countryMenuAnchor)}
              onClose={() => setCountryMenuAnchor(null)}
              slotProps={{ paper: { sx: { borderRadius: 1.5, minWidth: 220, mt: 0.5, boxShadow: '0 4px 12px rgba(107,138,154,0.12)' } } }}
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.code}
                  onClick={() => handleCountryChange(opt.code)}
                  selected={opt.code === countryCode}
                  sx={{ fontSize: '0.85rem', py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Typography sx={{ fontSize: '1.1rem' }}>{opt.flag}</Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={opt.label}
                    secondary={opt.standard}
                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                    secondaryTypographyProps={{ fontSize: '0.72rem' }}
                  />
                  {opt.code === countryCode && (
                    <Box component="span" sx={{ display: 'inline-flex', color: ACCENT_TEAL, ml: 1 }}><Check size={18} strokeWidth={1.75} /></Box>
                  )}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <Chip
            icon={<Public size={14} strokeWidth={1.75} color={PRIMARY} />}
            label={`${countryFlag} ${countryLabel} \u2014 ${standardName}`}
            sx={softChipSx(PRIMARY)}
          />
        )}
      </Box>

      {/* ─── Stats Cards ─────────────────────────────────────────────── */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1.5, boxShadow: 'none' }}>
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: PRIMARY, mb: 1 }}><Description size={32} strokeWidth={1.75} /></Box>
                <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{stats.totalDocuments}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{t('documents.compliance.totalDocuments')}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1.5, boxShadow: 'none' }}>
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: WARM, mb: 1 }}><Lock size={32} strokeWidth={1.75} /></Box>
                <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{stats.totalLocked}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{t('documents.compliance.totalLocked')}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1.5, boxShadow: 'none' }}>
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: SOFT_BLUE, mb: 1 }}><Receipt size={32} strokeWidth={1.75} /></Box>
                <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {stats.totalFacturesLocked}/{stats.totalFactures}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{t('documents.compliance.invoicesLocked')}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1.5, boxShadow: 'none' }}>
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: ACCENT_TEAL, mb: 1 }}><GppGood size={32} strokeWidth={1.75} /></Box>
                <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{stats.averageComplianceScore}%</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{t('documents.compliance.averageScore')}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ─── Search result ────────────────────────────────────────────── */}
      {searchError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSearchError(null)}>{searchError}</Alert>}
      {searchResult && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2">
            <strong>N. Legal :</strong> {searchResult.legalNumber} &nbsp;|&nbsp;
            <strong>Type :</strong> {searchResult.documentType} &nbsp;|&nbsp;
            <strong>{t('documents.compliance.file')} :</strong> {searchResult.fileName || '\u2014'} &nbsp;|&nbsp;
            <strong>Date :</strong> {formatDate(searchResult.createdAt)} &nbsp;|&nbsp;
            <strong>{t('documents.compliance.locked')} :</strong>{' '}
            {searchResult.locked ? (
              <Chip icon={<Lock size={14} strokeWidth={1.75} color={WARM} />} label={t('common.yes')} size="small" sx={softChipSx(WARM)} />
            ) : (
              <Chip label={t('common.no')} size="small" sx={softChipSx(NEUTRAL)} />
            )}
          </Typography>
        </Box>
      )}

      {/* ─── Template compliance check ────────────────────────────────── */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t('documents.compliance.templateVerification')}
            </Typography>
            <Tooltip title="Relancer la verification" arrow>
              <IconButton
                size="small"
                onClick={handleManualRecheck}
                disabled={autoCheckRunning}
                aria-label="Relancer la verification"
                sx={{ cursor: 'pointer', color: PRIMARY, '&:hover': { backgroundColor: `${PRIMARY}14` } }}
              >
                <Box component="span" sx={{ display: 'inline-flex', animation: autoCheckRunning ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }}>
                  <Refresh size={20} strokeWidth={1.75} />
                </Box>
              </IconButton>
            </Tooltip>
          </Box>

          {/* Progress bar during auto-check */}
          {autoCheckRunning && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Verification en cours... {autoCheckProgress}/{autoCheckTotal}
                </Typography>
                <Typography variant="caption" fontWeight={600} sx={{ color: PRIMARY, fontVariantNumeric: 'tabular-nums' }}>
                  {autoCheckTotal > 0 ? Math.round((autoCheckProgress / autoCheckTotal) * 100) : 0}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={autoCheckTotal > 0 ? (autoCheckProgress / autoCheckTotal) * 100 : 0}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: `${PRIMARY}14`,
                  '& .MuiLinearProgress-bar': {
                    transition: 'transform 0.6s ease',
                    borderRadius: 3,
                    backgroundColor: PRIMARY,
                  },
                }}
              />
            </Box>
          )}

          {/* Completion message */}
          {!autoCheckRunning && autoCheckTotal > 0 && autoCheckProgress === autoCheckTotal && (
            <Alert severity="success" sx={{ mb: 2 }} icon={<GppGood />}>
              Verification terminee — {autoCheckTotal} templates verifies
            </Alert>
          )}

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>{t('documents.compliance.activeLabel')}</TableCell>
                  <TableCell>{t('documents.compliance.complianceLabel')}</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">{t('documents.compliance.noTemplates')}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((tpl) => {
                    const report = complianceResults[tpl.id];
                    const isChecking = currentCheckingId === tpl.id;
                    return (
                      <TableRow
                        key={tpl.id}
                        hover
                        sx={{
                          transition: 'all 0.4s ease',
                          ...(isChecking && {
                            backgroundColor: `${PRIMARY}0A`,
                            boxShadow: `inset 3px 0 0 0 ${PRIMARY}`,
                          }),
                          '@keyframes fadeIn': {
                            from: { opacity: 0, transform: 'translateX(-8px)' },
                            to: { opacity: 1, transform: 'translateX(0)' },
                          },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{tpl.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={tpl.documentType} size="small" sx={softChipSx(PRIMARY)} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={tpl.active ? t('documents.compliance.active') : t('documents.compliance.inactive')}
                            size="small"
                            sx={softChipSx(tpl.active ? ACCENT_TEAL : NEUTRAL)}
                          />
                        </TableCell>
                        <TableCell>
                          {isChecking ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={16} sx={{ color: PRIMARY }} />
                              <Typography variant="caption" color="text.secondary">Verification...</Typography>
                            </Box>
                          ) : report ? (
                            <Tooltip
                              arrow
                              title={
                                report.compliant
                                  ? t('documents.compliance.allMentionsPresent')
                                  : `${t('documents.compliance.missingMentionsLabel')} : ${report.missingMentions.join(', ')}`
                              }
                            >
                              {(() => {
                                const hex = report.compliant ? ACCENT_TEAL : DANGER_SOFT;
                                return (
                                  <Chip
                                    icon={
                                      report.compliant
                                        ? <Box component="span" sx={{ display: 'inline-flex', color: hex }}><GppGood size={12} strokeWidth={1.75} /></Box>
                                        : <Box component="span" sx={{ display: 'inline-flex', color: hex }}><GppBad size={12} strokeWidth={1.75} /></Box>
                                    }
                                    label={report.compliant ? t('documents.compliance.compliant') : t('documents.compliance.nonCompliant')}
                                    size="small"
                                    sx={{ ...softChipSx(hex), animation: 'fadeIn 0.4s ease' }}
                                  />
                                );
                              })()}
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">En attente</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {isChecking ? (
                            <CircularProgress size={16} sx={{ color: PRIMARY }} />
                          ) : report ? (
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{
                                fontVariantNumeric: 'tabular-nums',
                                color: report.score >= 80 ? ACCENT_TEAL : report.score >= 50 ? WARM : DANGER_SOFT,
                                animation: 'fadeIn 0.4s ease',
                              }}
                            >
                              {report.score}%
                            </Typography>
                          ) : '\u2014'}
                        </TableCell>
                        <TableCell align="right">
                          {report ? (
                            <Tooltip title={report.compliant ? 'Conforme' : 'Non conforme'} arrow>
                              {report.compliant ? (
                                <Box component="span" sx={{ display: 'inline-flex', color: ACCENT_TEAL, animation: 'fadeIn 0.4s ease' }}>
                                  <GppGood size={20} strokeWidth={1.75} />
                                </Box>
                              ) : (
                                <Box component="span" sx={{ display: 'inline-flex', color: DANGER_SOFT, animation: 'fadeIn 0.4s ease' }}>
                                  <GppBad size={20} strokeWidth={1.75} />
                                </Box>
                              )}
                            </Tooltip>
                          ) : isChecking ? (
                            <CircularProgress size={18} sx={{ color: PRIMARY }} />
                          ) : (
                            <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><VerifiedUser size={20} strokeWidth={1.75} /></Box>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
});

ComplianceDashboard.displayName = 'ComplianceDashboard';

export default ComplianceDashboard;
