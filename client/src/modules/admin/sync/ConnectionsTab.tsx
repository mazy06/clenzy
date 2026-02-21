import React, { useEffect, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { syncAdminApi, ConnectionSummary } from '../../../services/api/syncAdminApi';

const statusColor = (status: string): 'success' | 'default' => {
  switch (status) {
    case 'ACTIVE': return 'success';
    default: return 'default';
  }
};

const healthColor = (health: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (health) {
    case 'HEALTHY': return 'success';
    case 'DEGRADED': return 'warning';
    case 'UNHEALTHY': return 'error';
    default: return 'default';
  }
};

const ConnectionsTab: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await syncAdminApi.getConnections();
      setConnections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des connexions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleHealthCheck = async (id: number) => {
    try {
      setCheckingId(id);
      const result = await syncAdminApi.forceHealthCheck(id);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, healthStatus: result.healthStatus } : c,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du health check');
    } finally {
      setCheckingId(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Connexions Channel
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Sync</TableCell>
              <TableCell>Last Error</TableCell>
              <TableCell>Mappings</TableCell>
              <TableCell>Health</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Aucune connexion
                </TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell>{conn.id}</TableCell>
                  <TableCell>{conn.channel}</TableCell>
                  <TableCell>
                    <Chip
                      label={conn.status}
                      color={statusColor(conn.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={conn.lastError || undefined}
                    >
                      {conn.lastError || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>{conn.mappingCount}</TableCell>
                  <TableCell>
                    <Chip
                      label={conn.healthStatus}
                      color={healthColor(conn.healthStatus)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={checkingId === conn.id ? <CircularProgress size={16} /> : <Refresh />}
                      onClick={() => handleHealthCheck(conn.id)}
                      disabled={checkingId === conn.id}
                    >
                      Health Check
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ConnectionsTab;
