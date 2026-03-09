import React, { useState, forwardRef, useImperativeHandle } from 'react';
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
} from '@mui/icons-material';
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

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useComplianceStats();
  const { data: templates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useTemplates();
  const checkMutation = useCheckTemplateCompliance();
  const { data: fiscalProfile } = useFiscalProfile();
  const updateFiscalMutation = useUpdateFiscalProfile();

  const loading = statsLoading || templatesLoading;
  const error = actionError || (statsError ? t('documents.compliance.loadError') : null);

  const refetchAll = () => {
    refetchStats();
    refetchTemplates();
  };

  useImperativeHandle(ref, () => ({
    fetchData: refetchAll,
    searchByNumber: handleSearchByNumber,
  }));

  const handleCheckCompliance = async (templateId: number) => {
    setActionError(null);
    try {
      const report = await checkMutation.mutateAsync(templateId);
      setComplianceResults((prev) => ({ ...prev, [templateId]: report }));
      setSuccess(
        report.compliant
          ? `Template "${report.templateName}" : ${t('documents.compliance.compliant').toUpperCase()} (score: ${report.score}%)`
          : `Template "${report.templateName}" : ${t('documents.compliance.nonCompliant').toUpperCase()} (score: ${report.score}%) — ${report.missingMentions.length} ${t('documents.compliance.missingMentions')}`
      );
    } catch {
      setActionError(t('documents.compliance.checkError'));
    }
  };

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
              icon={<Public sx={{ fontSize: 16, color: '#1976d2 !important' }} />}
              label={`${countryFlag} ${countryLabel} \u2014 ${standardName}`}
              deleteIcon={<ExpandMore sx={{ color: '#1976d2 !important' }} />}
              onDelete={(e) => setCountryMenuAnchor(e.currentTarget as HTMLElement)}
              onClick={(e) => setCountryMenuAnchor(e.currentTarget)}
              sx={{
                backgroundColor: '#1976d218',
                color: '#1976d2',
                border: '1px solid #1976d240',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#1976d225' },
              }}
            />
            <Menu
              anchorEl={countryMenuAnchor}
              open={Boolean(countryMenuAnchor)}
              onClose={() => setCountryMenuAnchor(null)}
              slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 220, mt: 0.5 } } }}
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
                    <Check sx={{ fontSize: 18, color: 'primary.main', ml: 1 }} />
                  )}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <Chip
            icon={<Public sx={{ fontSize: 16, color: '#1976d2 !important' }} />}
            label={`${countryFlag} ${countryLabel} \u2014 ${standardName}`}
            sx={{
              backgroundColor: '#1976d218',
              color: '#1976d2',
              border: '1px solid #1976d240',
              borderRadius: '6px',
              fontWeight: 600,
            }}
          />
        )}
      </Box>

      {/* ─── Stats Cards ─────────────────────────────────────────────── */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Description sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{stats.totalDocuments}</Typography>
                <Typography variant="body2" color="text.secondary">{t('documents.compliance.totalDocuments')}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Lock sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{stats.totalLocked}</Typography>
                <Typography variant="body2" color="text.secondary">{t('documents.compliance.totalLocked')}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Receipt sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>
                  {stats.totalFacturesLocked}/{stats.totalFactures}
                </Typography>
                <Typography variant="body2" color="text.secondary">{t('documents.compliance.invoicesLocked')}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <GppGood sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{stats.averageComplianceScore}%</Typography>
                <Typography variant="body2" color="text.secondary">{t('documents.compliance.averageScore')}</Typography>
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
              <Chip icon={<Lock sx={{ color: '#ED6C02 !important' }} />} label={t('common.yes')} size="small" sx={{ backgroundColor: '#ED6C0218', color: '#ED6C02', border: '1px solid #ED6C0240', borderRadius: '6px', fontWeight: 600, '& .MuiChip-label': { px: 1 } }} />
            ) : (
              <Chip label={t('common.no')} size="small" sx={{ backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', fontWeight: 600, '& .MuiChip-label': { px: 1 } }} />
            )}
          </Typography>
        </Box>
      )}

      {/* ─── Template compliance check ────────────────────────────────── */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            {t('documents.compliance.templateVerification')}
          </Typography>

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
                    const checking = checkMutation.isPending && checkMutation.variables === tpl.id;
                    return (
                      <TableRow key={tpl.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{tpl.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={tpl.documentType} size="small"
                            sx={{ backgroundColor: '#1976d218', color: '#1976d2', border: '1px solid #1976d240', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }} />
                        </TableCell>
                        <TableCell>
                          {(() => { const c = tpl.active ? '#4A9B8E' : '#757575'; return (
                          <Chip
                            label={tpl.active ? t('documents.compliance.active') : t('documents.compliance.inactive')}
                            size="small"
                            sx={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }}
                          />
                          ); })()}
                        </TableCell>
                        <TableCell>
                          {report ? (
                            <Tooltip title={
                              report.compliant
                                ? t('documents.compliance.allMentionsPresent')
                                : `${t('documents.compliance.missingMentionsLabel')} : ${report.missingMentions.join(', ')}`
                            }>
                              {(() => { const c = report.compliant ? '#4A9B8E' : '#d32f2f'; return (
                              <Chip
                                icon={report.compliant ? <GppGood sx={{ color: `${c} !important` }} /> : <GppBad sx={{ color: `${c} !important` }} />}
                                label={report.compliant ? t('documents.compliance.compliant') : t('documents.compliance.nonCompliant')}
                                size="small"
                                sx={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }}
                              />
                              ); })()}
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">{t('documents.compliance.notChecked')}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {report ? (
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color={report.score >= 80 ? 'success.main' : report.score >= 50 ? 'warning.main' : 'error.main'}
                            >
                              {report.score}%
                            </Typography>
                          ) : '\u2014'}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={`${t('documents.compliance.checkAction')} (${standardName})`}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleCheckCompliance(tpl.id)}
                              disabled={checking}
                            >
                              {checking ? (
                                <CircularProgress size={18} />
                              ) : (
                                <VerifiedUser />
                              )}
                            </IconButton>
                          </Tooltip>
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
