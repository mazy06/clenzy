import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Button, Skeleton, Spinner } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Refresh } from '../../../icons';
import { syncAdminApi, ConnectionSummary } from '../../../services/api/syncAdminApi';
import StatusChip, { type ToneTokens } from '../../../components/StatusChip';

const NEUTRAL_TOKEN: ToneTokens = { color: 'var(--muted)', bg: 'var(--hover)' };

// Statut connexion → tokens sémantiques (ACTIVE = --ok, sinon neutre)
const statusToken = (status: string): ToneTokens =>
  status === 'ACTIVE' ? { color: 'var(--ok)', bg: 'var(--ok-soft)' } : NEUTRAL_TOKEN;

// Santé → tokens sémantiques (HEALTHY --ok, DEGRADED --warn, UNHEALTHY --err)
const HEALTH_TOKEN: Record<string, ToneTokens> = {
  HEALTHY: { color: 'var(--ok)', bg: 'var(--ok-soft)' },
  DEGRADED: { color: 'var(--warn)', bg: 'var(--warn-soft)' },
  UNHEALTHY: { color: 'var(--err)', bg: 'var(--err-soft)' },
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
          <Skeleton key={i} className="h-[36px] w-full rounded-[9px]" />
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
      <h6 className="cn-text-h6 mb-[0.35em] text-[var(--ink)]">
        Connexions Channel
      </h6>

      <div className="overflow-x-auto rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)]">
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
                <TableCell colSpan={8} className="text-center text-[var(--muted)] py-[18px]">
                  Aucune connexion
                </TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="tabular-nums">{conn.id}</TableCell>
                  <TableCell>{conn.channel}</TableCell>
                  <TableCell>
                    <StatusChip label={conn.status} tokens={statusToken(conn.status)} />
                  </TableCell>
                  <TableCell>
                    {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={conn.lastError || undefined}>
                      {conn.lastError || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="tabular-nums">{conn.mappingCount}</TableCell>
                  <TableCell>
                    <StatusChip
                      label={conn.healthStatus}
                      tokens={HEALTH_TOKEN[conn.healthStatus] ?? NEUTRAL_TOKEN}
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
