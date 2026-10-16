import { useId, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Badge, Button, Field, FieldDescription, FieldLabel, Input, Skeleton } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { baitlyIotApi, baitlyIotError } from '../../../services/api/baitlyIotApi';
import { noiseDevicesApi } from '../../../services/api/noiseApi';

export default function BaitlySensorControls({ deviceId, timeZone }: { deviceId: number; timeZone: string }) {
  const { t, currentLanguage } = useTranslation();
  const id = useId();
  const qc = useQueryClient();
  // 30 s: enough for a 60 s reporting interval, and half the load of the IoT service per open panel.
  const state = useQuery({ queryKey: ['baitly-iot-state', deviceId], queryFn: () => baitlyIotApi.state(deviceId),
    refetchInterval: 30_000, retry: false });
  const [level, setLevel] = useState('62');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmRotation, setConfirmRotation] = useState<'secret' | 'mqtt' | null>(null);
  const [newMqttIdentity, setNewMqttIdentity] = useState<string | null>(null);
  const attempt = useRef<{ eventId: string; measuredAt: string; laeqDbA: number } | null>(null);
  const number = Number(level);
  const valid = level.trim() !== '' && Number.isFinite(number) && number >= 0 && number <= 150;
  const refresh = async () => {
    await noiseDevicesApi.getStatus(deviceId);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['baitly-iot-state', deviceId] }),
      qc.invalidateQueries({ queryKey: ['noise-device-data', deviceId] }),
      qc.invalidateQueries({ queryKey: ['noise-status', deviceId] }),
      qc.invalidateQueries({ queryKey: ['connected-objects'] }),
    ]);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); }
    catch (cause) { setError(baitlyIotError(cause, t('baitlyIot.actionError'))); }
    finally { setBusy(false); }
  };
  const simulate = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    if (!attempt.current || attempt.current.laeqDbA !== number) {
      attempt.current = { eventId: crypto.randomUUID(), measuredAt: new Date().toISOString(), laeqDbA: number };
    }
    await run(async () => {
      await baitlyIotApi.simulate(deviceId, attempt.current!);
      attempt.current = null;
      setNotice(t('baitlyIot.measurementSaved'));
      await refresh();
    });
  };
  const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat(currentLanguage,
    { dateStyle: 'short', timeStyle: 'medium', timeZone }).format(new Date(value)) : t('baitlyIot.waiting');

  if (state.isLoading) return <Skeleton className="h-32 w-full" />;
  if (state.isError) return <Alert variant="destructive"><AlertDescription>{t('baitlyIot.loadError')}
    <Button size="sm" variant="ghost" onClick={() => { void state.refetch(); }}>{t('common.retry')}</Button>
  </AlertDescription></Alert>;
  if (!state.data) return null;
  return <section className="flex min-w-0 flex-col gap-3 border-b border-border pb-4" aria-labelledby={`${id}-title`}>
    <div className="flex flex-wrap items-center gap-2"><h4 id={`${id}-title`} className="text-sm font-semibold">{t('baitlyIot.controlsTitle')}</h4>
      {state.data.simulation && <Badge variant="secondary">{t('baitlyIot.testSensor')}</Badge>}
      {state.data.revoked && <Badge variant="destructive">{t('baitlyIot.revoked')}</Badge>}
      {!state.data.revoked && state.data.awaitingFirstMeasurement && <Badge variant="outline">{t('baitlyIot.awaitingFirst')}</Badge>}
    </div>
    <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
      <div><dt>{t('baitlyIot.lastMeasurement')}</dt><dd className="mt-1 text-foreground tabular-nums">{displayDate(state.data.lastMeasuredAt)}</dd></div>
      <div><dt>{t('baitlyIot.lastReception')}</dt><dd className="mt-1 text-foreground tabular-nums">{displayDate(state.data.lastReceivedAt)}</dd></div>
    </dl>
    {!state.data.simulation && !state.data.revoked && <details className="text-xs" onToggle={event => {
      if (!event.currentTarget.open) { setSecret(null); setNewMqttIdentity(null); setConfirmRotation(null); }
    }}>
      <summary className="cursor-pointer rounded-sm py-2 text-muted-foreground outline-offset-2 focus-visible:outline-2">{t('baitlyIot.connectionSettings')}</summary>
      <div className="flex flex-col gap-3 pt-2">
        {state.data.awaitingFirstMeasurement && <p className="max-w-prose text-muted-foreground">{t('baitlyIot.awaitingFirstHint')}</p>}
        <dl className="grid gap-2">
          <div><dt className="text-muted-foreground">{t('baitlyIot.provisioned.deviceId')}</dt>
            <dd dir="ltr" className="mt-1 break-all font-mono text-foreground">{state.data.externalDeviceId}</dd></div>
          {state.data.mqttIdentity && <div><dt className="text-muted-foreground">{t('baitlyIot.provisioned.mqttIdentity')}</dt>
            <dd dir="ltr" className="mt-1 break-all font-mono text-foreground">{newMqttIdentity ?? state.data.mqttIdentity}</dd></div>}
        </dl>
        {secret && <Field><FieldLabel htmlFor={`${id}-physical-secret`}>{t('baitlyIot.deviceSecret')}</FieldLabel>
          <Input id={`${id}-physical-secret`} readOnly type="password" autoComplete="off" value={secret} dir="ltr" />
          <Button size="sm" variant="outline" className="self-start" onClick={() => { void run(async () => {
            await navigator.clipboard.writeText(secret); setNotice(t('baitlyIot.secretCopied'));
          }); }}>{t('baitlyIot.copySecret')}</Button></Field>}
        {newMqttIdentity && <p role="status" className="text-muted-foreground">{t('baitlyIot.mqttRotated')}</p>}
        {!confirmRotation ? <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRotation('secret')}>{t('baitlyIot.rotateSecret')}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRotation('mqtt')}>{t('baitlyIot.rotateMqtt')}</Button>
        </div> : <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
          <p>{t(confirmRotation === 'secret' ? 'baitlyIot.rotateSecretHint' : 'baitlyIot.rotateMqttHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => { void run(async () => {
              if (confirmRotation === 'secret') setSecret((await baitlyIotApi.credentials(deviceId)).token);
              else setNewMqttIdentity((await baitlyIotApi.mqttIdentity(deviceId)).mqttIdentity);
              setConfirmRotation(null);
              await qc.invalidateQueries({ queryKey: ['baitly-iot-state', deviceId] });
            }); }}>{t('baitlyIot.confirmRotation')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRotation(null)}>{t('common.cancel')}</Button>
          </div>
        </div>}
      </div>
    </details>}
    {state.data.simulation && !state.data.revoked && <>
      <p className="max-w-prose text-xs text-muted-foreground">{t('baitlyIot.simulationHint')}</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => { void simulate(event); }} aria-busy={busy}>
        <Field className="min-w-0 flex-1"><FieldLabel htmlFor={`${id}-level`}>{t('baitlyIot.level')}</FieldLabel>
          <Input id={`${id}-level`} type="number" min={0} max={150} step="0.1" required value={level} disabled={busy}
            onChange={event => setLevel(event.target.value)} className="tabular-nums" /></Field>
        <Button type="submit" disabled={!valid || busy}>{t(busy ? 'baitlyIot.sending' : 'baitlyIot.send')}</Button>
      </form>
      <details className="text-xs" onToggle={event => { if (!event.currentTarget.open) setSecret(null); }}>
        <summary className="cursor-pointer rounded-sm py-2 text-muted-foreground outline-offset-2 focus-visible:outline-2">{t('baitlyIot.externalSimulator')}</summary>
        <div className="flex flex-col gap-2 pt-2">
          <FieldDescription>{t('baitlyIot.secretHint')}</FieldDescription>
          {!secret ? <Button size="sm" variant="outline" disabled={busy} onClick={() => { void run(async () => {
            const result = await baitlyIotApi.credentials(deviceId); setSecret(result.token);
          }); }}>{t('baitlyIot.generateSecret')}</Button> : <>
            <Field><FieldLabel htmlFor={`${id}-secret`}>{t('baitlyIot.deviceSecret')}</FieldLabel>
              <Input id={`${id}-secret`} readOnly type="password" autoComplete="off" value={secret} dir="ltr" /></Field>
            <Button size="sm" variant="outline" onClick={() => { void run(async () => {
              await navigator.clipboard.writeText(secret); setNotice(t('baitlyIot.secretCopied'));
            }); }}>{t('baitlyIot.copySecret')}</Button>
          </>}
          <p className="text-muted-foreground">{t('baitlyIot.pythonHint')}</p>
          <code dir="ltr" className="block overflow-x-auto rounded-md bg-muted p-2 text-start text-xs">python3 baitly-iot/scripts/simulate_noise.py --level 62</code>
        </div>
      </details>
    </>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { void run(refresh); }}>{t('common.refresh')}</Button>
      {!state.data.revoked && !confirmRevoke && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRevoke(true)}>{t('baitlyIot.revoke')}</Button>}
    </div>
    {confirmRevoke && !state.data.revoked && <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
      <p className="text-xs">{t('baitlyIot.revokeHint')}</p><div className="flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => { void run(async () => {
          await baitlyIotApi.revoke(deviceId); setSecret(null); setConfirmRevoke(false); await refresh();
        }); }}>{t('baitlyIot.confirmRevoke')}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRevoke(false)}>{t('common.cancel')}</Button>
      </div>
    </div>}
    {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </section>;
}
