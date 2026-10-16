import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useBaitlyUser, selectedDemoProfile } from '@/config/baitlyDemoProfiles';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { BaitlyButton, BaitlyField, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { AccountGroup, AccountRow, accountStyles } from './AccountComponents';

export function AccountDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const { t } = useTranslation('mobileV1');
  const user = useBaitlyUser();
  const preview = useBaitlyDataMode(s=>s.mode) === 'demo';
  const loadUser = useAuthStore(s => s.loadUser);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const changed = firstName.trim() !== (user?.firstName ?? '') || lastName.trim() !== (user?.lastName ?? '');
  const save = async () => {
    if (preview) return;
    setBusy(true); setMessage(''); setFailed(false);
    try {
      await apiClient.patch('/users/me/profile', { firstName: firstName.trim(), lastName: lastName.trim() });
      await loadUser(); setMessage(t('accountProfileSaved'));
    } catch { setFailed(true); setMessage(t('accountProfileFailed')); }
    finally { setBusy(false); }
  };
  return <BaitlyScreen title={t('accountPersonalInfo')}>
    <View style={accountStyles.fields}>
      <BaitlyField label={t('accountFirstName')} value={firstName} onChangeText={setFirstName} autoComplete="given-name" maxLength={100} editable={!preview && !busy} />
      <BaitlyField label={t('accountLastName')} value={lastName} onChangeText={setLastName} autoComplete="family-name" maxLength={100} editable={!preview && !busy} />
      <View><BaitlyText variant="meta" muted>{t('accountEmail')}</BaitlyText><BaitlyText selectable>{user?.email}</BaitlyText></View>
      {user?.organizationName ? <View><BaitlyText variant="meta" muted>{t('accountOrganization')}</BaitlyText><BaitlyText>{user.organizationName}</BaitlyText></View> : null}
      {preview ? <BaitlyNotice>{t('homeDemo')}</BaitlyNotice> : <BaitlyButton title={t('accountSaveChanges')} busy={busy} disabled={!changed || !firstName.trim() || !lastName.trim()} onPress={() => { void save(); }} />}
    </View>
    {message ? <BaitlyNotice error={failed}>{message}</BaitlyNotice> : null}
    {!preview ? <AccountGroup title={t('accountData')}>
      <AccountRow title={t('deleteAccount')} icon="trash-outline" danger last busy={busy} onPress={() => navigation.navigate('DeleteAccount')} />
    </AccountGroup> : null}
  </BaitlyScreen>;
}
