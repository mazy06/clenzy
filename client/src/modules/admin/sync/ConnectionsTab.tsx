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
  Skeleton,
  Alert,
  Typography,
} from '@mui/material';
import { Refresh } from '../../../icons';
import { syncAdminApi, ConnectionSummary } from '../../../services/api/syncAdminApi';

/** Chip -soft : texte couleur + fond -soft (pilule/typo via thème global MuiChip) */
const chipSx = (fg: string, bg: string) => ({ color: fg, backgroundColor: bg });

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

// Statut connexion → tokens sémantiques (ACTIVE = --ok, sinon neutre)
const statusToken = (status: string) =>
  status === 'ACTIVE' ? { fg: 'var(--ok)', bg: 'var(--ok-soft)' } : NEUTRAL_TOKEN;

// Santé → tokens sémantiques (HEALTHY --ok, DEGRADED --warn, UNHEALTHY --err)
const HEALTH_TOKEN: Record<string, { fg: string; bg: string }> = {
  HEALTHY: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  DEGRADED: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  UNHEALTHY: { fg: 'var(--err)', bg: 'var(--err-soft)' },
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
        ))}
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: 'var(--ink)' }}>
        Connexions Channel
      </Typography>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: '14px', borderColor: 'var(--line)' }}
      >
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
                <TableCell colSpan={8} align="center" sx={{ color: 'var(--muted)', py: 3 }}>
                  Aucune connexion
                </TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{conn.id}</TableCell>
                  <TableCell>{conn.channel}</TableCell>
                  <TableCell>
                    <Chip
                      label={conn.status}
                      size="small"
                      sx={(() => {
                        const tk = statusToken(conn.status);
                        return chipSx(tk.fg, tk.bg);
                      })()}
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
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{conn.mappingCount}</TableCell>
                  <TableCell>
                    <Chip
                      label={conn.healthStatus}
                      size="small"
                      sx={(() => {
                        const tk = HEALTH_TOKEN[conn.healthStatus] ?? NEUTRAL_TOKEN;
                        return chipSx(tk.fg, tk.bg);
                      })()}
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
