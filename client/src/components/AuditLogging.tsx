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
  Security,
  Person,
  Settings,
  Clear,
  Refresh,
  AdminPanelSettings,
  Lock,
  ReportProblem,
  Visibility,
  VpnKey,
} from '@mui/icons-material';
import { monitoringApi } from '../services/api/monitoringApi';
import type { AuditLogEntry, AuditLogPage } from '../services/api/monitoringApi';

interface AuditLogFilters {
  eventType: string;
  actorId: string;
  result: string;
}

const PAGE_SIZE = 15;

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

  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters({ eventType: '', actorId: '', result: '' });
    setCurrentPage(0);
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'LOGIN_SUCCESS':
        return <CheckCircle color="success" />;
      case 'LOGIN_FAILURE':
        return <Warning color="warning" />;
      case 'PERMISSION_DENIED':
        return <Lock color="error" />;
      case 'DATA_ACCESS':
        return <Visibility color="info" />;
      case 'ADMIN_ACTION':
        return <AdminPanelSettings color="info" />;
      case 'SECRET_ROTATION':
        return <VpnKey color="info" />;
      case 'SUSPICIOUS_ACTIVITY':
        return <ReportProblem color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  const getEventTypeColor = (eventType: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (eventType) {
      case 'LOGIN_SUCCESS':
        return 'success';
      case 'LOGIN_FAILURE':
        return 'warning';
      case 'PERMISSION_DENIED':
      case 'SUSPICIOUS_ACTIVITY':
        return 'error';
      case 'DATA_ACCESS':
      case 'ADMIN_ACTION':
      case 'SECRET_ROTATION':
        return 'info';
      default:
        return 'default';
    }
  };

  const getResultColor = (result: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (result?.toUpperCase()) {
      case 'SUCCESS':
        return 'success';
      case 'DENIED':
      case 'ERROR':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.replace(/_/g, ' ');
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <Security sx={{ mr: 1, color: 'primary.main' }} />
          Audit et Logging
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          {loading && <CircularProgress size={16} />}
          <Tooltip title="Actualiser les logs">
            <IconButton onClick={handleRefresh} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filtres */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
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
                startIcon={<Clear />}
                onClick={clearFilters}
              >
                Effacer
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Logs d'audit ({totalElements} entrées)
            </Typography>
            {totalPages > 1 && (
              <Chip
                label={`Page ${currentPage + 1} sur ${totalPages}`}
                color="primary"
                variant="outlined"
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
                            color={getEventTypeColor(log.eventType)}
                            size="small"
                          />
                          {log.result && (
                            <Chip
                              label={log.result}
                              color={getResultColor(log.result)}
                              variant="outlined"
                              size="small"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box mt={1}>
                          {log.details && (
                            <Typography variant="body2" color="text.primary" gutterBottom>
                              {log.details}
                            </Typography>
                          )}
                          <Box display="flex" gap={2} flexWrap="wrap" mt={1}>
                            {log.actorEmail && (
                              <Typography variant="caption" color="text.secondary">
                                <strong>Utilisateur:</strong> {log.actorEmail}
                              </Typography>
                            )}
                            {log.actorIp && (
                              <Typography variant="caption" color="text.secondary">
                                <strong>IP:</strong> {log.actorIp}
                              </Typography>
                            )}
                            {log.timestamp && (
                              <Typography variant="caption" color="text.secondary">
                                <strong>Date:</strong> {new Date(log.timestamp).toLocaleString()}
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
