import { useState } from 'react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import {
  Button,
  Field,
  FieldLabel,
  Input,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../../../hooks/useNotification';
import { VpnKey, History, Add, Delete as Trash, LocationOn } from '../../../icons';
import EmptyState from '../../../components/EmptyState';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { keyExchangeApi, type KeyExchangeCodeDto } from '../../../services/api/keyExchangeApi';
import type { ConnectedDevice } from '../types';
import PageTabs from '../../../components/PageTabs';

// Statuts de code → tons sémantiques de la primitive : actif = ok, utilisé =
// info, expiré = neutre, annulé = err. Le couple encre `-ink` / fond `-soft`
// conforme AA est porté par STATUS_TONES, plus par une table locale.
const CODE_STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: 'ok',
  USED: 'info',
  EXPIRED: 'neutral',
  CANCELLED: 'err',
};
const codeStatusTone = (status: string): StatusTone => CODE_STATUS_TONES[status] ?? 'neutral';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground text-end">{value}</span>
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
  const { notify } = useNotification();
  const [subTab, setSubTab] = useState(0);
  const [guestName, setGuestName] = useState('');

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
      notify.success('Code généré');
      void qc.invalidateQueries({ queryKey: ['key-exchange-codes', device.id] });
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => notify.error(e instanceof Error ? e.message : 'Échec de la génération'),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => keyExchangeApi.cancelCode(id),
    onSuccess: () => {
      notify.success('Code annulé');
      void qc.invalidateQueries({ queryKey: ['key-exchange-codes', device.id] });
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => notify.error(e instanceof Error ? e.message : "Échec de l'annulation"),
  });

  const codes: KeyExchangeCodeDto[] = codesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Infos du point */}
      <Card className="gap-0 py-0 p-3">
        <h6 className="text-xs font-semibold mb-1.5 flex items-center gap-0.5">
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
              {/* items-end : le libelle du champ est desormais statique au-dessus,
                  le bouton doit s'aligner sur la ligne de saisie et non au centre. */}
              <div className="flex gap-1.5 items-end">
                <Field className="w-auto flex-1 max-w-[320px]">
                  <FieldLabel htmlFor="keybox-guest-name">Nom du voyageur (optionnel)</FieldLabel>
                  <Input
                    id="keybox-guest-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </Field>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                >
                  {generate.isPending ? <Spinner className="size-3.5" /> : <Add size={16} strokeWidth={2} />}
                  Générer un code
                </Button>
              </div>

              {/* Liste */}
              {codesQuery.isLoading ? (
                <Skeleton className="h-[140px] w-full rounded-xl" />
              ) : codes.length === 0 ? (
                <EmptyState icon={<VpnKey />} title="Aucun code actif" description="Générez un code de remise pour un voyageur." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Voyageur</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-end">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            {/* Code PIN : display (Space Grotesk) tabular-nums sur fond de champ */}
                            <span className="font-[family-name:var(--font-display)] tabular-nums font-semibold tracking-[0.06em] text-foreground bg-field rounded-md px-1.5 py-0.5 inline-block">
                              {c.code}
                            </span>
                          </TableCell>
                          <TableCell>{c.guestName || '—'}</TableCell>
                          <TableCell>
                            <StatusChip tone={codeStatusTone(c.status)} label={c.status} pill />
                          </TableCell>
                          <TableCell className="text-end">
                            {c.status === 'ACTIVE' && (
                              <Tooltip>
                                {/* Le Button du kit ne transmet pas de ref : span d'ancrage. */}
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Annuler ce code"
                                      onClick={() => cancel.mutate(c.id)}
                                      disabled={cancel.isPending}
                                      className="text-destructive hover:text-destructive-ink"
                                    >
                                      <Trash size={16} strokeWidth={1.75} />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Annuler ce code</TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {subTab === 1 && (
            eventsQuery.isLoading ? (
              <Skeleton className="h-[140px] w-full rounded-xl" />
            ) : (eventsQuery.data?.content.length ?? 0) === 0 ? (
              <EmptyState icon={<History />} title="Aucun mouvement" description="Les remises et collectes de clés de ce logement apparaîtront ici." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Acteur</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-end">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventsQuery.data!.content.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>{ev.eventType}</TableCell>
                        <TableCell>{ev.actorName || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{ev.notes || '—'}</TableCell>
                        <TableCell className="text-end whitespace-nowrap tabular-nums text-faint">
                          {new Date(ev.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
