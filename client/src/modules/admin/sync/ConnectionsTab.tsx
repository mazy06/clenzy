import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Button, Skeleton, Spinner } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Refresh } from '../../../icons';
import { syncAdminApi, ConnectionSummary } from '../../../services/api/syncAdminApi';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';

// Statut connexion → ton sémantique (ACTIVE = succès, sinon neutre)
const statusTone = (status: string): StatusTone => (status === 'ACTIVE' ? 'ok' : 'neutral');

// Santé → ton sémantique. Le couple encre/fond conforme AA est tenu par
// StatusChip (STATUS_TONES) : ici on ne dit que le SENS, pas la couleur.
const HEALTH_TONE: Record<string, StatusTone> = {
  HEALTHY: 'ok',
  DEGRADED: 'warn',
  UNHEALTHY: 'err',
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
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert variant="destructive" className="mb-3">
      <TriangleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>;
  }

  return (
    <div>
      <h6 className="text-sm font-semibold text-foreground mb-[0.35em]">
        Connexions Channel
      </h6>

      <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead>Last Error</TableHead>
              <TableHead>Mappings</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-[18px]">
                  Aucune connexion
                </TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="tabular-nums">{conn.id}</TableCell>
                  <TableCell>{conn.channel}</TableCell>
                  <TableCell>
                    <StatusChip label={conn.status} tone={statusTone(conn.status)} />
                  </TableCell>
                  <TableCell>
                    {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <p className="text-xs max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={conn.lastError || undefined}>
                      {conn.lastError || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="tabular-nums">{conn.mappingCount}</TableCell>
                  <TableCell>
                    <StatusChip
                      label={conn.healthStatus}
                      tone={HEALTH_TONE[conn.healthStatus] ?? 'neutral'}
                    />
                  </TableCell>
                  <TableCell>
                    {/* Action repetee sur chaque ligne : registre tertiaire du kit,
                        pour ne pas paver le tableau de cadres. */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleHealthCheck(conn.id)}
                      disabled={checkingId === conn.id}
                    >
                      {checkingId === conn.id ? <Spinner className="size-4" /> : <Refresh />}
                      Health Check
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ConnectionsTab;
