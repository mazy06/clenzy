import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/apiClient';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyText } from '@/design-system/components';
interface ThreadMessage { id: number; senderFirstName?: string; senderLastName?: string; message: string; createdAt: string }
export function Discussion({ kind, id }: { kind: 'quote' | 'mission'; id: number }) {
  const { t } = useTranslation('mobileV1');
  const scope = useBaitlyScope();
  const { isConnected } = useNetworkStatus();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [limit, setLimit] = useState(50);
  const lock = useRef(false);
  const thread = useQuery({ queryKey: [...scope, 'discussion', kind, id],
    queryFn: () => apiClient.post<{ threadKey: string }>(`/mobile/discussions/${kind}/${id}/open`), enabled: open && isConnected, retry: false });
  const messages = useQuery({ queryKey: [...scope, 'messages', thread.data?.threadKey],
    queryFn: ({ signal }) => apiClient.get<ThreadMessage[]>(`/contact/threads/${encodeURIComponent(thread.data!.threadKey)}/messages`, { signal }),
    enabled: Boolean(open && thread.data), retry: false });
  async function send() {
    if (lock.current || !body.trim() || !thread.data || !isConnected || uncertain || messages.isError) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      await apiClient.post(`/contact/threads/${encodeURIComponent(thread.data.threadKey)}/reply`, { message: body.trim() });
      setBody(''); await messages.refetch();
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      setError(true); setUncertain(!status || status >= 500 || status === 408);
    } finally { lock.current = false; setBusy(false); }
  }
  if (!open) return <BaitlyButton secondary title={t('messages')} disabled={!isConnected} onPress={() => setOpen(true)} />;
  return <View style={{ gap: 12 }}>
    <BaitlyText variant="heading">{t('messages')}</BaitlyText>
    {thread.isPending || (thread.data && messages.isPending) ? <BaitlyLoading /> : null}
    {thread.isError || messages.isError ? <BaitlyEmpty title={t('discussionUnavailable')} retry={() => { void thread.refetch(); void messages.refetch(); }} /> : null}
    {(messages.data?.length ?? 0) > limit ? <BaitlyButton secondary title={t('loadMore')} onPress={() => setLimit(value => value + 50)} /> : null}
    {messages.data?.slice(-limit).map(message => <View key={message.id} style={{ gap: 4, paddingVertical: 8 }}>
      <BaitlyText variant="meta" muted>{[message.senderFirstName, message.senderLastName].filter(Boolean).join(' ')} · {message.createdAt}</BaitlyText>
      <BaitlyText>{message.message}</BaitlyText>
    </View>)}
    {thread.data && !thread.isError ? <>
      {error ? <BaitlyNotice error>{t('sendFailed')}</BaitlyNotice> : null}
      {uncertain ? <BaitlyNotice>{t('verifyBeforeRetry')}</BaitlyNotice> : null}
      <BaitlyButton secondary title={t('verify')} busy={messages.isFetching} disabled={!isConnected} onPress={() => {
        void messages.refetch().then(result => { if (!result.isError) { setUncertain(false); setError(false); } });
      }} />
      <BaitlyField label={t('messageBody')} value={body} onChangeText={setBody} multiline maxLength={4000} editable={!busy} />
      <BaitlyButton title={t('sendMessage')} busy={busy} disabled={!body.trim() || !isConnected || uncertain || messages.isError}
        onPress={() => { void send(); }} />
    </> : null}
  </View>;
}
