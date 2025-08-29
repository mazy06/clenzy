import React, { useState, useEffect } from 'react';
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
  Error,
  CheckCircle,
  Security,
  Person,
  Settings,
  FilterList,
  Clear,
  Download,
  Refresh,
} from '@mui/icons-material';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  category: string;
  action: string;
  userId: string;
  userRole: string;
  details: string;
  ipAddress: string;
  userAgent: string;
}

interface AuditLogFilters {
  level: string;
  category: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
}

const AuditLogging: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    level: '',
    category: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulation des données d'audit (remplacer par un vrai appel API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockLogs: AuditLogEntry[] = [
        {
          id: '1',
          timestamp: '2024-01-15 14:30:25',
          level: 'INFO',
          category: 'AUTHENTICATION',
          action: 'Connexion utilisateur',
          userId: 'user123',
          userRole: 'ADMIN',
          details: 'Connexion réussie depuis 192.168.1.100',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        {
          id: '2',
          timestamp: '2024-01-15 14:28:15',
          level: 'WARNING',
          category: 'SECURITY',
          action: 'Tentative de connexion échouée',
          userId: 'unknown',
          userRole: 'N/A',
          details: '3 tentatives de connexion échouées pour user456',
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        {
          id: '3',
          timestamp: '2024-01-15 14:25:42',
          level: 'SUCCESS',
          category: 'USER_MANAGEMENT',
          action: 'Création d\'utilisateur',
          userId: 'admin001',
          userRole: 'ADMIN',
          details: 'Nouvel utilisateur créé: john.doe@example.com',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        {
          id: '4',
          timestamp: '2024-01-15 14:22:18',
          level: 'ERROR',
          category: 'SYSTEM',
          action: 'Erreur de base de données',
          userId: 'system',
          userRole: 'SYSTEM',
          details: 'Timeout lors de la requête de synchronisation des permissions',
          ipAddress: '127.0.0.1',
          userAgent: 'Clenzy-System/1.0',
        },
        {
          id: '5',
          timestamp: '2024-01-15 14:20:05',
          level: 'INFO',
          category: 'PERMISSIONS',
          action: 'Modification des rôles',
          userId: 'manager001',
          userRole: 'MANAGER',
          details: 'Rôle TECHNICIAN ajouté à l\'utilisateur tech001',
          ipAddress: '192.168.1.102',
          userAgent: 'Mozilla/5.0 (Linux x86_64)',
        },
        {
          id: '6',
          timestamp: '2024-01-15 14:18:33',
          level: 'WARNING',
          category: 'PERFORMANCE',
          action: 'Temps de réponse élevé',
          userId: 'system',
          userRole: 'SYSTEM',
          details: 'Requête de rapport prend plus de 5 secondes',
          ipAddress: '127.0.0.1',
          userAgent: 'Clenzy-System/1.0',
        },
        {
          id: '7',
          timestamp: '2024-01-15 14:15:20',
          level: 'SUCCESS',
          category: 'BACKUP',
          action: 'Sauvegarde automatique',
          userId: 'system',
          userRole: 'SYSTEM',
          details: 'Sauvegarde de la base de données terminée avec succès',
          ipAddress: '127.0.0.1',
          userAgent: 'Clenzy-System/1.0',
        },
        {
          id: '8',
          timestamp: '2024-01-15 14:12:45',
          level: 'INFO',
          category: 'AUDIT',
          action: 'Export des logs',
          userId: 'admin001',
          userRole: 'ADMIN',
          details: 'Export des logs d\'audit pour la période 2024-01-01 à 2024-01-15',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      ];
      
      setLogs(mockLogs);
      setTotalPages(Math.ceil(mockLogs.length / 10));
      setLastUpdate(new Date());
      
    } catch (err) {
      setError('Erreur lors de la récupération des logs d\'audit');
      console.error('Erreur AuditLogging:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const handleRefresh = () => {
    fetchAuditLogs();
  };

  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      level: '',
      category: '',
      userId: '',
      dateFrom: '',
      dateTo: '',
    });
    setPage(1);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'INFO':
        return <Info color="info" />;
      case 'WARNING':
        return <Warning color="warning" />;
      case 'ERROR':
        return <Error color="error" />;
      case 'SUCCESS':
        return <CheckCircle color="success" />;
      default:
        return <Info color="info" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'info';
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'error';
      case 'SUCCESS':
        return 'success';
      default:
        return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'AUTHENTICATION':
      case 'SECURITY':
        return <Security />;
      case 'USER_MANAGEMENT':
      case 'PERMISSIONS':
        return <Person />;
      case 'SYSTEM':
      case 'PERFORMANCE':
      case 'BACKUP':
        return <Settings />;
      default:
        return <Info />;
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filters.level && log.level !== filters.level) return false;
    if (filters.category && log.category !== filters.category) return false;
    if (filters.userId && !log.userId.toLowerCase().includes(filters.userId.toLowerCase())) return false;
    if (filters.dateFrom && log.timestamp < filters.dateFrom) return false;
    if (filters.dateTo && log.timestamp > filters.dateTo) return false;
    return true;
  });

  const paginatedLogs = filteredLogs.slice((page - 1) * 10, page * 10);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
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
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Niveau</InputLabel>
                <Select
                  value={filters.level}
                  label="Niveau"
                  onChange={(e) => handleFilterChange('level', e.target.value)}
                >
                  <MenuItem value="">Tous</MenuItem>
                  <MenuItem value="INFO">Info</MenuItem>
                  <MenuItem value="WARNING">Warning</MenuItem>
                  <MenuItem value="ERROR">Error</MenuItem>
                  <MenuItem value="SUCCESS">Success</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Catégorie</InputLabel>
                <Select
                  value={filters.category}
                  label="Catégorie"
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <MenuItem value="">Toutes</MenuItem>
                  <MenuItem value="AUTHENTICATION">Authentification</MenuItem>
                  <MenuItem value="SECURITY">Sécurité</MenuItem>
                  <MenuItem value="USER_MANAGEMENT">Gestion utilisateurs</MenuItem>
                  <MenuItem value="PERMISSIONS">Permissions</MenuItem>
                  <MenuItem value="SYSTEM">Système</MenuItem>
                  <MenuItem value="PERFORMANCE">Performance</MenuItem>
                  <MenuItem value="BACKUP">Sauvegarde</MenuItem>
                  <MenuItem value="AUDIT">Audit</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="ID Utilisateur"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Date de début"
                type="datetime-local"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Date de fin"
                type="datetime-local"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Clear />}
                  onClick={clearFilters}
                >
                  Effacer
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Download />}
                >
                  Export
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Logs d'audit ({filteredLogs.length} entrées)
            </Typography>
            <Chip 
              label={`Page ${page} sur ${totalPages}`}
              color="primary"
              variant="outlined"
            />
          </Box>

          <List>
            {paginatedLogs.map((log, index) => (
              <React.Fragment key={log.id}>
                <ListItem alignItems="flex-start">
                  <ListItemIcon>
                    {getLevelIcon(log.level)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="subtitle2" component="span">
                          {log.action}
                        </Typography>
                        <Chip 
                          label={log.level}
                          color={getLevelColor(log.level) as any}
                          size="small"
                        />
                        <Chip 
                          label={log.category}
                          variant="outlined"
                          size="small"
                          icon={getCategoryIcon(log.category)}
                        />
                      </Box>
                    }
                    secondary={
                      <Box mt={1}>
                        <Typography variant="body2" color="text.primary" gutterBottom>
                          {log.details}
                        </Typography>
                        <Box display="flex" gap={2} flexWrap="wrap" mt={1}>
                          <Typography variant="caption" color="text.secondary">
                            <strong>Utilisateur:</strong> {log.userId} ({log.userRole})
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <strong>IP:</strong> {log.ipAddress}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <strong>Timestamp:</strong> {log.timestamp}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < paginatedLogs.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
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
