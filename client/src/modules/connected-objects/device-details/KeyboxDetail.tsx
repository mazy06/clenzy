import { useState } from 'react';
import { Card } from '../../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Paper, Button, TextField, Chip, IconButton, Tooltip, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, CircularProgress, Skeleton, Snackbar, Alert } from '@mui/material';
import { VpnKey, History, Add, Delete as Trash, LocationOn } from '../../../icons';
import EmptyState from '../../../components/EmptyState';
import { keyExchangeApi, type KeyExchangeCodeDto } from '../../../services/api/keyExchangeApi';
import type { ConnectedDevice } from '../types';
import PageTabs from '../../../components/PageTabs';

// Statuts de code : tokens sémantiques désaturés (texte couleur + fond `-soft`) —
// actif = --ok, utilisé = --info, expiré = neutre, annulé = --err.
const CODE_STATUS_TOKENS: Record<string, { color: string; soft: string }> = {
  ACTIVE: { color: 'var(--ok)', soft: 'var(--ok-soft)' },
  USED: { color: 'var(--info)', soft: 'var(--info-soft)' },
  EXPIRED: { color: 'var(--muted)', soft: 'var(--hover)' },
  CANCELLED: { color: 'var(--err)', soft: 'var(--err-soft)' },
};
/** Pilule soft : fond doux + texte couleur (pattern chips statut baseline §2). */
const codeStatusPillSx = (status: string) => {
  const { color, soft } = CODE_STATUS_TOKENS[status] ?? { color: 'var(--muted)', soft: 'var(--hover)' };
  return {
    height: 22,
    fontSize: '0.6875rem',
    fontWeight: 600,
    backgroundColor: soft,
    color,
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    '& .MuiChip-label': { px: 1 },
  } as const;
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="cn-text-caption text-muted-foreground">{label}</span>
      <span className="cn-text-caption font-semibold text-foreground text-end">{value}</span>
    </div>
  );
}

/**
 * Corps « point de remise des clés » du détail unifié. Gère CE point : infos +
 * codes (génération / liste / annulation) + mouvements du logement. Écrit
 * directement sur `keyExchangeApi` (design cohérent avec le hub, sans le chrome
 * offers / création de gardien des anciens écrans).
 */
export default function KeyboxDetail({ device }: { device: ConnectedDevice }) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState(0);
  const [guestName, setGuestName] = useState('');
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const pointsQuery = useQuery({ queryKey: ['key-exchange-points'], queryFn: () => keyExchangeApi.getPoints(), staleTime: 60_000 });
  const point = pointsQuery.data?.find((p) => p.id === device.id);

  const codesQuery = useQuery({
    queryKey: ['key-exchange-codes', device.id],
    queryFn: () => keyExchangeApi.getActiveCodesByPoint(device.id),
    staleTime: 30_000,
  });

  const eventsQuery = useQuery({
    queryKey: ['key-exchange-events', device.propertyId],
    queryFn: () => keyExchangeApi.getEvents({ propertyId: device.propertyId ?? undefined, page: 0, size: 15 }),
    enabled: subTab === 1,
    staleTime: 30_000,
  });

  const generate = useMutation({
    mutationFn: () => keyExchangeApi.generateCode({ pointId: device.id, guestName: guestName.trim() || undefined }),
    onSuccess: () => {
      setGuestName('');
      setSnack({ msg: 'Code généré', severity: 'success' });
      void qc.invalidateQueries({ queryKey: ['key-exchange-codes', device.id] });
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => setSnack({ msg: e instanceof Error ? e.message : 'Échec de la génération', severity: 'error' }),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => keyExchangeApi.cancelCode(id),
    onSuccess: () => {
      setSnack({ msg: 'Code annulé', severity: 'success' });
      void qc.invalidateQueries({ queryKey: ['key-exchange-codes', device.id] });
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => setSnack({ msg: e instanceof Error ? e.message : "Échec de l'annulation", severity: 'error' }),
  });

  const codes: KeyExchangeCodeDto[] = codesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Infos du point */}
      <Card className="gap-0 py-0 p-3">
        <h6 className="cn-text-subtitle2 mb-1.5 font-bold flex items-center gap-0.5">
          <LocationOn size={15} strokeWidth={1.75} /> Point de remise
        </h6>
        <InfoRow label="Fournisseur" value={point?.provider ?? device.provider} />
        <InfoRow label="Commerce" value={point?.storeName ?? device.name} />
        <InfoRow label="Adresse" value={point?.storeAddress} />
        <InfoRow label="Téléphone" value={point?.storePhone} />
        <InfoRow label="Horaires" value={point?.storeOpeningHours} />
        <InfoRow label="Logement" value={device.propertyName} />
      </Card>

      {/* Codes | Mouvements */}
      <div>
        <PageTabs
          options={[
            { label: 'Codes', icon: <VpnKey /> },
            { label: 'Mouvements', icon: <History /> },
          ]}
          value={subTab}
          onChange={setSubTab}
          size="compact"
          mb={0}
          trail={false}
        />

        <div className="pt-3">
          {subTab === 0 && (
            <div className="flex flex-col gap-2">
              {/* Génération */}
              <div className="flex gap-1.5 items-center">
                <TextField
                  size="small"
                  label="Nom du voyageur (optionnel)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  sx={{ flex: 1, maxWidth: 320 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={generate.isPending ? <CircularProgress size={14} color="inherit" /> : <Add size={16} strokeWidth={2} />}
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                >
                  Générer un code
                </Button>
              </div>

              {/* Liste */}
              {codesQuery.isLoading ? (
                <Skeleton variant="rounded" height={140} sx={{ borderRadius: 'var(--radius-lg)' }} />
              ) : codes.length === 0 ? (
                <EmptyState icon={<VpnKey />} title="Aucun code actif" description="Générez un code de remise pour un voyageur." />
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 'var(--radius-lg)' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Voyageur</TableCell>
                        <TableCell>Statut</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {codes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            {/* Code PIN : display (Space Grotesk) tabular-nums sur fond --field */}
                            <span className="font-[var(--font-display)] tabular-nums font-semibold tracking-[0.06em] text-[var(--ink)] bg-[var(--field)] rounded-[9px] px-1.5 py-0.5 inline-block">
                              {c.code}
                            </span>
                          </TableCell>
                          <TableCell>{c.guestName || '—'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={c.status} sx={codeStatusPillSx(c.status)} />
                          </TableCell>
                          <TableCell align="right">
                            {c.status === 'ACTIVE' && (
                              <Tooltip title="Annuler ce code" arrow>
                                <IconButton size="small" onClick={() => cancel.mutate(c.id)} disabled={cancel.isPending} sx={{ color: 'error.main' }}>
                                  <Trash size={16} strokeWidth={1.75} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </div>
          )}

          {subTab === 1 && (
            eventsQuery.isLoading ? (
              <Skeleton variant="rounded" height={140} sx={{ borderRadius: 'var(--radius-lg)' }} />
            ) : (eventsQuery.data?.content.length ?? 0) === 0 ? (
              <EmptyState icon={<History />} title="Aucun mouvement" description="Les remises et collectes de clés de ce logement apparaîtront ici." />
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 'var(--radius-lg)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Acteur</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell align="right">Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eventsQuery.data!.content.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>{ev.eventType}</TableCell>
                        <TableCell>{ev.actorName || '—'}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{ev.notes || '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'text.disabled' }}>
                          {new Date(ev.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          )}
        </div>
      </div>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)} sx={{ width: '100%' }}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </div>
  );
}
