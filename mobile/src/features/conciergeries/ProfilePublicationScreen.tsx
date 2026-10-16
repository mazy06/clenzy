import React, { useEffect, useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/apiClient';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useAuthStore } from '@/store/authStore';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyProperties, useBaitlyScope } from '@/features/marketplace/queries';
import type { PublicClient } from './publicProfiles';

export function ProfilePublicationScreen() {
  const { t } = useTranslation('mobileV1');
  const scope = useBaitlyScope();
  const mode = useBaitlyDataMode(s => s.mode);
  const cache = useQueryClient();
  const user = useAuthStore(s => s.user);
  const existing = useQuery({ queryKey: [...scope, 'own-public-profile'], enabled: mode === 'real',
    queryFn: () => apiClient.get<Partial<PublicClient> & { propertyIds?: number[]; hideLastName?: boolean }>('/mobile/public-profile') });
  const properties = useBaitlyProperties();
  const [name, setName] = useState(user?.fullName ?? '');
  const [hideLastName, setHideLastName] = useState(false);
  const [publishFinancialPerformance, setPublishFinancialPerformance] = useState(false);
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [avatar, setAvatar] = useState('');
  const [ids, setIds] = useState<number[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [managementFee,setManagementFee]=useState('');
  const [seeking, setSeeking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialized = useRef(false), lock = useRef(false);
  const validFee=!managementFee.trim() || /^\d{1,3}([.,]\d{1,2})?$/.test(managementFee.trim()) && Number(managementFee.replace(',','.'))<=100;
  useEffect(() => {
    if (!existing.data || initialized.current) return;
    initialized.current = true;
    setName(existing.data.name ?? user?.fullName ?? ''); setCity(existing.data.city ?? ''); setBio(existing.data.bio ?? '');
    setHideLastName(existing.data.hideLastName ?? false);
    setPublishFinancialPerformance(existing.data.publishFinancialPerformance ?? false);
    setWebsite(existing.data.bookingDomain ?? ''); setAvatar(existing.data.avatarUrl ?? '');
    setIds(existing.data.propertyIds ?? []); setServices(existing.data.managementServices ?? []); setSeeking(existing.data.seekingManagement ?? false);
    setManagementFee(existing.data.managementFeePct==null?'':String(existing.data.managementFeePct));
  }, [existing.data, user?.fullName]);
  async function save(withdraw = false) {
    if (mode !== 'real' || lock.current) return;
    lock.current = true; setBusy(true); setError(false); setSaved(false);
    try {
      if (withdraw) await apiClient.delete('/mobile/public-profile');
      else await apiClient.put('/mobile/public-profile', { published: true, name, city, bio, bookingUrl: website,
        avatarUrl: avatar, propertyIds: ids, managementServices: services, seekingManagement: seeking, hideLastName, publishFinancialPerformance,
        managementFeePct:managementFee.trim()?Number(managementFee.replace(',','.')):null });
      await cache.invalidateQueries({ queryKey: scope }); setSaved(true);
    } catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  if (mode === 'demo') return <BaitlyScreen title={t('publicProfileSettings')}><BaitlyNotice>{t('publicationDemoBlocked')}</BaitlyNotice></BaitlyScreen>;
  return <BaitlyScreen title={t('publicProfileSettings')}>
    {existing.isPending ? <BaitlyLoading /> : existing.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void existing.refetch(); }} /> : <>
      <BaitlyField label={t('publicName')} value={name} onChangeText={setName} maxLength={150} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BaitlyText style={{ flex: 1 }}>{t('hidePublicLastName')}</BaitlyText>
        <Switch accessibilityLabel={t('hidePublicLastName')} value={hideLastName} onValueChange={setHideLastName} />
      </View>
      <BaitlyText muted variant="meta">{t('publicNamePreview', { name: hideLastName ? name.trim().replace(/\s+/gu, ' ').replace(/ (\S+)$/u, (_, last: string) => ` ${Array.from(last)[0].toLocaleUpperCase()}.`) : name })}</BaitlyText>
      <BaitlyField label={t('publicPropertyCity')} value={city} onChangeText={setCity} maxLength={150} />
      <BaitlyField label={t('publicBio')} value={bio} onChangeText={setBio} multiline maxLength={1000} />
      <BaitlyField label={t('publicWebsiteUrl')} value={website} onChangeText={setWebsite} autoCapitalize="none" maxLength={2048} />
      <BaitlyField label={t('publicAvatarUrl')} value={avatar} onChangeText={setAvatar} autoCapitalize="none" maxLength={2048} />
      <BaitlyText variant="heading">{t('publicSelectedHomes')}</BaitlyText>
      {properties.isPending ? <BaitlyLoading /> : properties.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void properties.refetch(); }} />
        : properties.data?.pages.flatMap(page => page.content).map(property => <BaitlyButton key={property.id} secondary title={property.name}
          selected={ids.includes(property.id)} onPress={() => setIds(current => current.includes(property.id) ? current.filter(id => id !== property.id) : [...current, property.id].slice(0, 30))} />)}
      {properties.hasNextPage ? <BaitlyButton secondary title={t('loadMore')} onPress={() => { void properties.fetchNextPage(); }} /> : null}
      <BaitlyButton secondary selected={seeking} title={t('directorySeekingShort')} onPress={() => setSeeking(value => !value)} />
      {existing.data?.role === 'CONCIERGE' || user?.organizationType === 'CONCIERGE' ? <View style={{ gap: 8 }}>
        <BaitlyField label={t('publicManagementFeeLabel')} value={managementFee} onChangeText={setManagementFee} keyboardType="decimal-pad" maxLength={6}/>
        {['LISTINGS', 'PRICING', 'GUESTS', 'CLEANING', 'MAINTENANCE', 'OWNER_REPORTING'].map(service => <BaitlyButton key={service} secondary
          title={t(`managementService${service}`)} selected={services.includes(service)}
          onPress={() => setServices(current => current.includes(service) ? current.filter(value => value !== service) : [...current, service])} />)}
      </View> : null}
      <BaitlyNotice>{t('publicProfileConsent')}</BaitlyNotice>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BaitlyText style={{ flex: 1 }}>{t('financialPublicationConsent')}</BaitlyText>
        <Switch accessibilityLabel={t('financialPublicationConsent')} value={publishFinancialPerformance} onValueChange={setPublishFinancialPerformance} />
      </View>
      <BaitlyText muted variant="meta">{t('financialPublicationHelp')}</BaitlyText>
      {error ? <BaitlyNotice error>{t('sendFailed')}</BaitlyNotice> : null}
      {saved ? <BaitlyNotice>{t('publicProfileSaved')}</BaitlyNotice> : null}
      <BaitlyButton title={t('publicPublishProfile')} busy={busy} disabled={!name.trim()||!validFee||properties.isPending||properties.isError} onPress={() => { void save(); }} />
      {existing.data?.networkPublished ? <BaitlyButton title={t('withdrawPublication')} secondary busy={busy} onPress={() => { void save(true); }} /> : null}
    </>}
  </BaitlyScreen>;
}

export function ManagementContactsScreen() {
  const { t, i18n } = useTranslation('mobileV1');
  const scope = useBaitlyScope();
  const mode = useBaitlyDataMode(s => s.mode);
  const query = useQuery({ queryKey: [...scope, 'management-contacts'], enabled: mode === 'real',
    queryFn: () => apiClient.get<{ id: string; message: string; profile_name: string; side: 'SENT' | 'RECEIVED'; created_at: string }[]>('/mobile/management-contacts') });
  return <BaitlyScreen title={t('managementContacts')}>
    {mode === 'demo' ? <BaitlyNotice>{t('publicationDemoBlocked')}</BaitlyNotice> : query.isPending ? <BaitlyLoading />
      : query.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} /> : !query.data?.length ? <BaitlyEmpty title={t('noManagementContacts')} />
        : query.data.map(contact => <View key={contact.id} style={{ gap: 6, paddingVertical: 12 }}>
          <BaitlyText variant="heading">{contact.profile_name}</BaitlyText>
          <BaitlyText muted variant="meta">{t(contact.side === 'SENT' ? 'contactSent' : 'contactReceived')} · {new Intl.DateTimeFormat(i18n.language).format(new Date(contact.created_at))}</BaitlyText>
          <BaitlyText>{contact.message}</BaitlyText>
        </View>)}
  </BaitlyScreen>;
}
