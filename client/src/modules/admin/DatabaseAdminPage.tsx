import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Button } from '../../components/ui';
import { Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  Download,
  Delete,
  Storage,
  Refresh,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useNotification } from '../../hooks/useNotification';
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
  const { notify } = useNotification();

  const showMessage = useCallback(
    (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
      notify[severity](message);
    },
    [notify],
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
              variant="outline"
              size="sm"
              onClick={fetchBackups}
              disabled={loading}
            >
              <Refresh />
              Actualiser
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? <Spinner className="size-4" /> : <Storage />}
              {creating ? 'Creation en cours...' : 'Creer un dump'}
            </Button>
          </div>
        }
      />

      {/* `Card` porte deja le fond, l'arrondi, le filet (ring) et l'ecretage. */}
      <Card className="gap-0 py-0 mt-4">
        {loading ? (
          <div className="flex flex-col gap-1.5 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.filename}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {/* `color="action"` etait un jeton MUI, pas une couleur CSS. */}
                        <span className="inline-flex text-muted-foreground">
                          <Storage size={18} strokeWidth={1.75} />
                        </span>
                        <p className="font-mono text-xs">
                          {backup.filename}
                        </p>
                        {backup.filename.endsWith('.gz') && (
                          <Badge variant="secondary">gzip</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs tabular-nums">{formatFileSize(backup.sizeBytes)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs tabular-nums">{formatDate(backup.createdAt)}</p>
                    </TableCell>
                    <TableCell className="text-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Telecharger"
                            onClick={() => handleDownload(backup.filename)}
                            className="text-primary"
                          >
                            <Download size={18} strokeWidth={1.75} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Telecharger</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* Le span porte le declencheur : un bouton desactive
                              n'emet plus d'evenement de survol. */}
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Supprimer"
                              onClick={() => handleDelete(backup.filename)}
                              disabled={deletingFile === backup.filename}
                              className="text-destructive"
                            >
                              {deletingFile === backup.filename ? (
                                <Spinner className="size-4" />
                              ) : (
                                <Delete size={18} strokeWidth={1.75} />
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DatabaseAdminPage;
