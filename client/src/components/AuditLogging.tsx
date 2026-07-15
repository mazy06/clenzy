import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Pagination,
} from '@mui/material';
import {
  Info,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  Person,
  Clear,
  Refresh,
  AdminPanelSettings,
  Lock,
  ReportProblem,
  Visibility,
  VpnKey,
} from '../icons';
import { monitoringApi } from '../services/api/monitoringApi';
import type { AuditLogEntry, AuditLogPage } from '../services/api/monitoringApi';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';

/** Chip -soft : texte couleur + fond -soft (pilule/typo via theme global MuiChip) */
const chipSx = (fg: string, bg: string) => ({
  color: fg,
  backgroundColor: bg,
  '& .MuiChip-icon': { color: fg },
});

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

// Type d'evenement → tokens semantiques
const EVENT_TOKEN: Record<string, { fg: string; bg: string }> = {
  LOGIN_SUCCESS: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  LOGIN_FAILURE: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  PERMISSION_DENIED: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  SUSPICIOUS_ACTIVITY: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  DATA_ACCESS: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  ADMIN_ACTION: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  SECRET_ROTATION: { fg: 'var(--info)', bg: 'var(--info-soft)' },
};

// Resultat → tokens semantiques (SUCCESS --ok, DENIED/ERROR --err)
const RESULT_TOKEN: Record<string, { fg: string; bg: string }> = {
  SUCCESS: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  DENIED: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  ERROR: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

interface AuditLogFilters {
  eventType: string;
  actorId: string;
  result: string;
}

const PAGE_SIZE = 15;

const getEventTypeIcon = (eventType: string) => {
  switch (eventType) {
    case 'LOGIN_SUCCESS':
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)' }}><CheckCircle size={20} strokeWidth={1.75} /></Box>;
    case 'LOGIN_FAILURE':
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}><Warning size={20} strokeWidth={1.75} /></Box>;
    case 'PERMISSION_DENIED':
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--err)' }}><Lock size={20} strokeWidth={1.75} /></Box>;
    case 'DATA_ACCESS':
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--info)' }}><Visibility size={20} strokeWidth={1.75} /></Box>;
    case 'ADMIN_ACTION':
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--info)' }}><AdminPanelSettings size={20} strokeWidth={1.75} /></Box>;
    case 'SECRET_ROTATION':
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--info)' }}><VpnKey size={20} strokeWidth={1.75} /></Box>;
    case 'SUSPICIOUS_ACTIVITY':
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--err)' }}><ReportProblem size={20} strokeWidth={1.75} /></Box>;
    default:
      return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--info)' }}><Info size={20} strokeWidth={1.75} /></Box>;
  }
};

const eventToken = (eventType: string) => EVENT_TOKEN[eventType] ?? NEUTRAL_TOKEN;
const resultToken = (result: string) => RESULT_TOKEN[result?.toUpperCase()] ?? NEUTRAL_TOKEN;

const formatEventType = (eventType: string) => {
  return eventType.replace(/_/g, ' ');
};

const AuditLogging: React.FC = () => {
  const [page, setPage] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    eventType: '',
    actorId: '',
    result: '',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        page: currentPage,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
      };
      if (filters.eventType) params.eventType = filters.eventType;
      if (filters.actorId) params.actorId = filters.actorId;
      if (filters.result) params.result = filters.result;

      const data = await monitoringApi.getAuditLogs(params);
      setPage(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError("Erreur lors de la récupération des logs d'audit");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleRefresh = () => {
    fetchAuditLogs();
  };

  // Register page-header actions + last-update timestamp.
  useEffect(() => {
    setHeaderActions(
      <Box display="flex" alignItems="center" gap={1}>
        {loading && <CircularProgress size={16} />}
        <Tooltip title="Actualiser les logs">
          <IconButton onClick={handleRefresh} size="small">
            <Refresh size={20} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </Box>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, loading, fetchAuditLogs]);

  useEffect(() => {
    setHeaderLastUpdate(lastUpdate);
  }, [setHeaderLastUpdate, lastUpdate]);

  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters({ eventType: '', actorId: '', result: '' });
    setCurrentPage(0);
  };

  if (loading && !page) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !page) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={handleRefresh}>
          Réessayer
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  const logs = page?.content ?? [];
  const totalPages = page?.totalPages ?? 1;
  const totalElements = page?.totalElements ?? 0;

  return (
    <Box>
      {/* Filtres */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: 'var(--ink)' }}>
            Filtres
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type d'événement</InputLabel>
                <Select
                  value={filters.eventType}
                  label="Type d'événement"
                  onChange={(e) => handleFilterChange('eventType', e.target.value)}
                >
                  <MenuItem value="">Tous</MenuItem>
                  <MenuItem value="LOGIN_SUCCESS">Connexion réussie</MenuItem>
                  <MenuItem value="LOGIN_FAILURE">Échec de connexion</MenuItem>
                  <MenuItem value="PERMISSION_DENIED">Accès refusé</MenuItem>
                  <MenuItem value="DATA_ACCESS">Accès aux données</MenuItem>
                  <MenuItem value="ADMIN_ACTION">Action admin</MenuItem>
                  <MenuItem value="SECRET_ROTATION">Rotation de secret</MenuItem>
                  <MenuItem value="SUSPICIOUS_ACTIVITY">Activité suspecte</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Résultat</InputLabel>
                <Select
                  value={filters.result}
                  label="Résultat"
                  onChange={(e) => handleFilterChange('result', e.target.value)}
                >
                  <MenuItem value="">Tous</MenuItem>
                  <MenuItem value="SUCCESS">Succès</MenuItem>
                  <MenuItem value="DENIED">Refusé</MenuItem>
                  <MenuItem value="ERROR">Erreur</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="ID Acteur"
                value={filters.actorId}
                onChange={(e) => handleFilterChange('actorId', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Clear size={18} strokeWidth={1.75} />}
                onClick={clearFilters}
              >
                Effacer
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card variant="outlined">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ color: 'var(--ink)' }}>
              Logs d'audit ({totalElements} entrées)
            </Typography>
            {totalPages > 1 && (
              <Chip
                label={`Page ${currentPage + 1} sur ${totalPages}`}
                size="small"
                sx={{ ...chipSx('var(--accent)', 'var(--accent-soft)'), fontVariantNumeric: 'tabular-nums' }}
              />
            )}
          </Box>

          {logs.length === 0 ? (
            <Alert severity="info">Aucun log d'audit trouvé pour les filtres sélectionnés</Alert>
          ) : (
            <List>
              {logs.map((log, index) => (
                <React.Fragment key={log.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemIcon>
                      {getEventTypeIcon(log.eventType)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="subtitle2" component="span">
                            {log.action || formatEventType(log.eventType)}
                          </Typography>
                          <Chip
                            label={formatEventType(log.eventType)}
                            size="small"
                            sx={chipSx(eventToken(log.eventType).fg, eventToken(log.eventType).bg)}
                          />
                          {log.result && (
                            <Chip
                              label={log.result}
                              size="small"
                              sx={chipSx(resultToken(log.result).fg, resultToken(log.result).bg)}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box mt={1}>
                          {log.details && (
                            <Typography variant="body2" sx={{ color: 'var(--body)' }} gutterBottom>
                              {log.details}
                            </Typography>
                          )}
                          {/* Meta technique : mono compact sur fond --field */}
                          <Box
                            sx={{
                              display: 'inline-flex',
                              gap: 2,
                              flexWrap: 'wrap',
                              mt: 0.5,
                              px: 1,
                              py: 0.5,
                              bgcolor: 'var(--field)',
                              border: '1px solid var(--field-line)',
                              borderRadius: '8px',
                            }}
                          >
                            {log.actorEmail && (
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>
                                {log.actorEmail}
                              </Typography>
                            )}
                            {log.actorIp && (
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>
                                IP {log.actorIp}
                              </Typography>
                            )}
                            {log.timestamp && (
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                                {new Date(log.timestamp).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < logs.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={currentPage + 1}
                onChange={(_, value) => setCurrentPage(value - 1)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditLogging;
