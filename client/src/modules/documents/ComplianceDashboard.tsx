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
} from '@mui/material';
import {
  Lock,
  GppGood,
  GppBad,
  VerifiedUser,
  Description,
  Receipt,
} from '@mui/icons-material';
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

export interface ComplianceDashboardRef {
  fetchData: () => void;
  searchByNumber: (number: string) => void;
}

const ComplianceDashboard = forwardRef<ComplianceDashboardRef>((_, ref) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [complianceResults, setComplianceResults] = useState<Record<number, ComplianceReport>>({});
  const [searchResult, setSearchResult] = useState<DocumentGeneration | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useComplianceStats();
  const { data: templates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useTemplates();
  const checkMutation = useCheckTemplateCompliance();

  const loading = statsLoading || templatesLoading;
  const error = actionError || (statsError ? 'Erreur lors du chargement des données de conformité' : null);

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
          ? `Template "${report.templateName}" : CONFORME (score: ${report.score}%)`
          : `Template "${report.templateName}" : NON CONFORME (score: ${report.score}%) — ${report.missingMentions.length} mention(s) manquante(s)`
      );
    } catch {
      setActionError('Erreur lors de la vérification de conformité');
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
      setSearchError('Document non trouvé avec ce numéro légal');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
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

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* ─── Stats Cards ─────────────────────────────────────────────────── */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Description sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{stats.totalDocuments}</Typography>
                <Typography variant="body2" color="text.secondary">Documents générés</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Lock sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{stats.totalLocked}</Typography>
                <Typography variant="body2" color="text.secondary">Documents verrouillés</Typography>
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
                <Typography variant="body2" color="text.secondary">Factures verrouillées</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <GppGood sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{stats.averageComplianceScore}%</Typography>
                <Typography variant="body2" color="text.secondary">Score moyen conformité</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ─── Résultat de recherche par N. Légal ──────────────────────────── */}
      {searchError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSearchError(null)}>{searchError}</Alert>}
      {searchResult && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2">
            <strong>N. Légal :</strong> {searchResult.legalNumber} &nbsp;|&nbsp;
            <strong>Type :</strong> {searchResult.documentType} &nbsp;|&nbsp;
            <strong>Fichier :</strong> {searchResult.fileName || '—'} &nbsp;|&nbsp;
            <strong>Date :</strong> {formatDate(searchResult.createdAt)} &nbsp;|&nbsp;
            <strong>Verrouillé :</strong>{' '}
            {searchResult.locked ? (
              <Chip icon={<Lock />} label="Oui" size="small" variant="outlined" color="warning" sx={{ borderWidth: 1.5 }} />
            ) : (
              <Chip label="Non" size="small" variant="outlined" />
            )}
          </Typography>
        </Box>
      )}

      {/* ─── Vérification de conformité des templates ────────────────────── */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Vérification de conformité des templates
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Actif</TableCell>
                  <TableCell>Conformité</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">Aucun template</Typography>
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
                          <Chip label={tpl.documentType} size="small" variant="outlined"
                            sx={{ borderWidth: 1.5, borderColor: 'primary.main' }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={tpl.active ? 'Actif' : 'Inactif'}
                            size="small"
                            variant="outlined"
                            color={tpl.active ? 'success' : 'default'}
                            sx={{ borderWidth: 1.5 }}
                          />
                        </TableCell>
                        <TableCell>
                          {report ? (
                            <Tooltip title={
                              report.compliant
                                ? 'Toutes les mentions légales sont présentes'
                                : `Mentions manquantes : ${report.missingMentions.join(', ')}`
                            }>
                              <Chip
                                icon={report.compliant ? <GppGood /> : <GppBad />}
                                label={report.compliant ? 'Conforme' : 'Non conforme'}
                                size="small"
                                variant="outlined"
                                color={report.compliant ? 'success' : 'error'}
                                sx={{ borderWidth: 1.5 }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">Non vérifié</Typography>
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
                          ) : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Vérifier la conformité NF">
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
