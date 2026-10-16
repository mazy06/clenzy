import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/apiClient';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { BaitlyButton, BaitlyField, BaitlyNotice } from '@/design-system/components';
export function AnomalyForm({ id }: { id: number }) {
  const { t } = useTranslation('mobileV1');
  const { isConnected } = useNetworkStatus();
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false); const [sent, setSent] = useState(false);
  const lock = useRef(false);
  async function send() {
    if (lock.current || failed || !isConnected || !title.trim()) return;
    lock.current = true; setBusy(true);
    try { await apiClient.post(`/mobile/missions/${id}/issues`, { title: title.trim(), description: body }); setSent(true); setTitle(''); setBody(''); }
    catch { setFailed(true); }
    finally { setBusy(false); lock.current = false; }
  }
  if (sent) return <BaitlyNotice>{t('anomalySent')}</BaitlyNotice>;
  return <>
    <BaitlyButton secondary title={t('anomaly')} onPress={() => setOpen(!open)} disabled={busy} />
    {open ? <>
      <BaitlyField label={t('anomalyTitle')} value={title} onChangeText={setTitle} maxLength={150} editable={!busy} />
      <BaitlyField label={t('description')} value={body} onChangeText={setBody} multiline maxLength={4000} editable={!busy} />
      {failed ? <BaitlyNotice error>{t('uncertainIssue')}</BaitlyNotice> : null}
      <BaitlyButton title={t('sendRequest')} disabled={!title.trim() || !isConnected || failed} busy={busy} onPress={() => { void send(); }} />
    </> : null}
  </>;
}
