import React, { useState, useEffect, useCallback } from 'react';
import StatusChip from './StatusChip';
import { Alert as BuiAlert, AlertDescription, Button } from './ui';
import { Info as BuiInfo } from 'lucide-react';
import { Spinner } from './ui';
import { Card, CardContent, List, ListItem, ListItemText, ListItemIcon, IconButton, Tooltip, TextField, FormControl, InputLabel, Select, MenuItem, Grid, Divider, Alert } from '@mui/material';
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
import PagePagination from './PagePagination';

/** Chip -soft : texte couleur + fond -soft (pilule/typo via theme global MuiChip) */

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
      return <span className="inline-flex text-[var(--ok)]"><CheckCircle size={20} strokeWidth={1.75} /></span>;
    case 'LOGIN_FAILURE':
      return <span className="inline-flex text-[var(--warn)]"><Warning size={20} strokeWidth={1.75} /></span>;
    case 'PERMISSION_DENIED':
      return <span className="inline-flex text-[var(--err)]"><Lock size={20} strokeWidth={1.75} /></span>;
    case 'DATA_ACCESS':
      return <span className="inline-flex text-[var(--info)]"><Visibility size={20} strokeWidth={1.75} /></span>;
    case 'ADMIN_ACTION':
      return <span className="inline-flex text-[var(--info)]"><AdminPanelSettings size={20} strokeWidth={1.75} /></span>;
    case 'SECRET_ROTATION':
      return <span className="inline-flex text-[var(--info)]"><VpnKey size={20} strokeWidth={1.75} /></span>;
    case 'SUSPICIOUS_ACTIVITY':
      return <span className="inline-flex text-[var(--err)]"><ReportProblem size={20} strokeWidth={1.75} /></span>;
    default:
      return <span className="inline-flex text-[var(--info)]"><Info size={20} strokeWidth={1.75} /></span>;
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

  const handleRefresh = useCallback(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Register page-header actions + last-update timestamp.
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-1.5">
        {loading && <Spinner className="size-4" />}
        <Tooltip title="Actualiser les logs">
          <IconButton onClick={handleRefresh} size="small">
            <Refresh size={20} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </div>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, loading, handleRefresh]);

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
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (error && !page) {
    return (
      <Alert severity="error" action={
        <Button variant="outline" size="sm" onClick={handleRefresh}>
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
    <div>
      {/* Filtres */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <h6 className="cn-text-h6 mb-[0.35em] text-[var(--ink)]">
            Filtres
          </h6>
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
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <Clear size={18} strokeWidth={1.75} />
                Effacer
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card variant="outlined">
        <CardContent>
          <div className="flex justify-between items-center mb-3">
            <h6 className="cn-text-h6 text-[var(--ink)]">
              Logs d'audit ({totalElements} entrées)
            </h6>
            {totalPages > 1 && (
              <StatusChip tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }} label={`Page ${currentPage + 1} sur ${totalPages}`} className="tabular-nums" />
            )}
          </div>

          {logs.length === 0 ? (
            <BuiAlert variant="info">
              <BuiInfo />
              <AlertDescription>Aucun log d'audit trouvé pour les filtres sélectionnés</AlertDescription>
            </BuiAlert>
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="cn-text-subtitle2">
                            {log.action || formatEventType(log.eventType)}
                          </span>
                          <StatusChip tokens={{ color: eventToken(log.eventType).fg, bg: eventToken(log.eventType).bg }} label={formatEventType(log.eventType)} />
                          {log.result && (
                            <StatusChip tokens={{ color: resultToken(log.result).fg, bg: resultToken(log.result).bg }} label={log.result} />
                          )}
                        </div>
                      }
                      secondary={
                        <div className="mt-1.5">
                          {log.details && (
                            <p className="cn-text-body2 text-[var(--body)] mb-[0.35em]">
                              {log.details}
                            </p>
                          )}
                          {/* Meta technique : mono compact sur fond --field */}
                          <div className="inline-flex gap-3 flex-wrap mt-0.5 px-1.5 py-0.5 bg-[var(--field)] border border-[var(--field-line)] rounded-[8px]">
                            {log.actorEmail && (
                              <span className="cn-text-caption font-mono text-[11px] text-[var(--muted)]">
                                {log.actorEmail}
                              </span>
                            )}
                            {log.actorIp && (
                              <span className="cn-text-caption font-mono text-[11px] text-[var(--muted)]">
                                IP {log.actorIp}
                              </span>
                            )}
                            {log.timestamp && (
                              <span className="cn-text-caption font-mono text-[11px] text-[var(--muted)] tabular-nums">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      }
                    />
                  </ListItem>
                  {index < logs.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center mt-[18px]">
              <PagePagination
                totalPages={totalPages}
                page={currentPage}
                onPageChange={(value) => setCurrentPage(value)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogging;
