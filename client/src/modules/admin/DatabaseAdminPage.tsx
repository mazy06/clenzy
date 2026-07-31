import React, { useState, useEffect, useCallback } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Button, Snackbar, Alert, CircularProgress, Skeleton, Tooltip, Chip } from '@mui/material';
import {
  Download,
  Delete,
  Storage,
  Refresh,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { databaseAdminApi, BackupInfo } from '../../services/api/databaseAdminApi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(iso: string): string {
  try {
    return DATE_TIME_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

const handleDownload = (filename: string) => {
  databaseAdminApi.downloadBackup(filename);
};

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
    <div>
      <PageHeader
        title="Base de donnees"
        subtitle="Gestion des backups PostgreSQL"
        iconBadge={<Storage />}
        backPath="/admin"
        showBackButton={false}
        actions={
          <div className="flex gap-1.5">
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
          </div>
        }
      />

      <Paper variant="outlined" sx={{ mt: 3, borderRadius: '14px', borderColor: 'var(--line)', overflow: 'hidden' }}>
        {loading ? (
          <div className="flex flex-col gap-1.5 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <EmptyState
            icon={<Storage />}
            title="Aucun backup disponible"
            description={'Cliquez sur "Créer un dump" pour générer votre premier backup.'}
            variant="transparent"
          />
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
                      <div className="flex items-center gap-1.5">
                        <Storage fontSize="small" color="action" />
                        <p className="cn-text-body2 font-mono text-[0.8rem]">
                          {backup.filename}
                        </p>
                        {backup.filename.endsWith('.gz') && (
                          <Chip
                            label="gzip"
                            size="small"
                            sx={{ color: 'var(--muted)', backgroundColor: 'var(--hover)' }}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body2">{formatFileSize(backup.sizeBytes)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body2">{formatDate(backup.createdAt)}</p>
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
    </div>
  );
};

export default DatabaseAdminPage;
