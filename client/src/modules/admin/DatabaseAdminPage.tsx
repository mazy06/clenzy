import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Typography,
  Snackbar,
  Alert,
  CircularProgress,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Download,
  Delete,
  Storage,
  Refresh,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { databaseAdminApi, BackupInfo } from '../../services/api/databaseAdminApi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const DatabaseAdminPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const showMessage = useCallback(
    (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
      setSnackbar({ open: true, message, severity });
    },
    [],
  );

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await databaseAdminApi.listBackups();
      setBackups(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des backups';
      showMessage(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const backup = await databaseAdminApi.createBackup();
      showMessage(`Backup cree : ${backup.filename}`, 'success');
      await fetchBackups();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la creation du backup';
      showMessage(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (filename: string) => {
    databaseAdminApi.downloadBackup(filename);
  };

  const handleDelete = async (filename: string) => {
    setDeletingFile(filename);
    try {
      await databaseAdminApi.deleteBackup(filename);
      showMessage(`Backup supprime : ${filename}`, 'success');
      await fetchBackups();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      showMessage(message, 'error');
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Base de donnees"
        subtitle="Gestion des backups PostgreSQL"
        backPath="/admin"
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={fetchBackups}
              disabled={loading}
            >
              Actualiser
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <Storage />}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Creation en cours...' : 'Creer un dump'}
            </Button>
          </Box>
        }
      />

      <Paper sx={{ mt: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : backups.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Storage sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              Aucun backup disponible
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              Cliquez sur "Creer un dump" pour generer votre premier backup.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fichier</TableCell>
                  <TableCell>Taille</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.filename} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Storage fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {backup.filename}
                        </Typography>
                        {backup.filename.endsWith('.gz') && (
                          <Chip label="gzip" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatFileSize(backup.sizeBytes)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(backup.createdAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Telecharger">
                        <IconButton size="small" onClick={() => handleDownload(backup.filename)} color="primary">
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(backup.filename)}
                          color="error"
                          disabled={deletingFile === backup.filename}
                        >
                          {deletingFile === backup.filename ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Delete fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DatabaseAdminPage;
