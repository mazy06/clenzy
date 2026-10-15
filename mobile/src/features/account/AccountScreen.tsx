import React, { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Reicon } from '@/icons';
import { useAuthStore } from '@/store/authStore';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import { useCapabilities } from '@/features/missions/queries';
import { AccountGroup, AccountRow, accountStyles as styles } from './AccountComponents';
import { useBaitlyUser, selectedDemoProfile } from '@/config/baitlyDemoProfiles';

export function BaitlyAccountScreen({ workspaceControl }: { workspaceControl?: React.ReactNode }) {
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const [error, setError] = useState(false);
  const user = useBaitlyUser();
  const preview = selectedDemoProfile();
  const logout = useAuthStore(s => s.logout);
  const capabilities = useCapabilities();
  const ownerAccess = capabilities.data?.canViewOwnerSpace === true;
  // Field earnings belong to whoever executes missions, in the provider workspace or not.
  const fieldWork = capabilities.data?.canExecuteAssignedMission === true && !preview;
  const concierge = user?.organizationType === 'CONCIERGE';
  const admin = user?.roles.some(role => ['SUPER_ADMIN', 'SUPER_MANAGER', 'ADMIN'].includes(role));
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || t('account');
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const confirmLogout = () => Alert.alert(t('logout'), t('logoutHelp'), [
    { text: t('cancel'), style: 'cancel' }, { text: t('logout'), onPress: () => { void logout(); } },
  ]);
  const openSupport = (url: string) => { setError(false); void Linking.openURL(url).catch(() => setError(true)); };
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  return <BaitlyScreen actions={<BaitlyHeaderAction icon="notifications-outline" label={t('notifications')} onPress={() => navigation.navigate('Alerts')} />}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('accountEditProfile')} onPress={() => navigation.navigate('AccountDetails')}
      style={({ pressed }) => [styles.identity, row, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.avatar, { backgroundColor: colors.ink }]}><BaitlyText style={[styles.initials, { color: colors.background }]}>{initials}</BaitlyText></View>
      <View style={styles.identityBody}>
        <BaitlyText style={styles.name}>{displayName}</BaitlyText>
        <BaitlyText muted variant="meta" numberOfLines={1}>{user?.email}</BaitlyText>
        {admin ? <View style={[styles.role, { backgroundColor: colors.muted }]}><BaitlyText variant="meta" style={{ fontSize: 11, lineHeight: 16 }}>{t(user?.roles.includes('SUPER_ADMIN') ? 'accountSuperAdmin' : 'accountAdmin')}</BaitlyText></View> : null}
      </View>
      <Reicon name={i18n.dir() === 'rtl' ? 'chevron-back' : 'chevron-forward'} size={19} color={colors.secondary} />
    </Pressable>
    {user?.organizationName ? <View style={[styles.organization, row]}><Reicon name="business-outline" size={18} color={colors.secondary} /><BaitlyText variant="meta" muted>{user.organizationName}</BaitlyText></View> : null}
    {workspaceControl}
    {ownerAccess ? <AccountGroup title={t('accountActivity')}>
      <AccountRow icon="briefcase-outline" title={t('ownerInterventions')} onPress={() => navigation.navigate('OwnerMissions')} />
      <AccountRow icon="receipt-outline" title={t('tracking')} onPress={() => navigation.navigate('SentRequests')} />
      {capabilities.data?.canQuote ? <AccountRow icon="document-text-outline" title={t('receivedRequests')} onPress={() => navigation.navigate('ReceivedRequests')} /> : null}
      <AccountRow icon="star-outline" title={t('accountReviews')} onPress={() => navigation.navigate('Reviews')} last />
    </AccountGroup> : null}
    {ownerAccess && !preview ? <AccountGroup title={t('accountFinances')}>
      <AccountRow icon="wallet-outline" title={t('accountBilling')} onPress={() => navigation.navigate('BillingDashboard')} />
      <AccountRow icon="card-outline" title={t('accountPayments')} onPress={() => navigation.navigate('PaymentHistory')} />
      <AccountRow icon="receipt-outline" title={t('accountInvoices')} onPress={() => navigation.navigate('InvoiceList')} />
      <AccountRow icon="stats-chart-outline" title={t('accountReports')} onPress={() => navigation.navigate('Analytics')} />
      <AccountRow icon="documents-outline" title={t('adminDocuments')} onPress={() => navigation.navigate('Documents')} last />
    </AccountGroup> : null}
    {ownerAccess && !preview ? <AccountGroup title={t('accountHomes')}>
      <AccountRow icon="pricetags-outline" title={t('accountPricing')} onPress={() => navigation.navigate('Pricing')} />
      <AccountRow icon="lock-closed-outline" title={t('accountLocks')} onPress={() => navigation.navigate('SmartLocks')} />
      <AccountRow icon="volume-high-outline" title={t('accountNoise')} onPress={() => navigation.navigate('NoiseMonitoring')} />
      {capabilities.data?.canViewOwnerSpace ? <AccountRow icon="create-outline" title={t('ownerMandates')} onPress={() => navigation.navigate('OwnerMandates')} last /> : null}
    </AccountGroup> : null}
    {ownerAccess && concierge && !preview ? <AccountGroup title={t('accountBusiness')}>
      <AccountRow icon="cash-outline" title={t('accountOwnerPayouts')} onPress={() => navigation.navigate('OwnerPayouts')} />
      <AccountRow icon="people-outline" title={t('accountTeam')} onPress={() => navigation.navigate('TeamManagement')} />
      {capabilities.data?.canManagePrivateNetwork ? <AccountRow icon="git-network-outline" title={t('privateNetwork')} onPress={() => navigation.navigate('Network')} /> : null}
      <AccountRow icon="megaphone-outline" title={t('publicProfileSettings')} onPress={() => navigation.navigate('PublicProfilePublication')} />
      <AccountRow icon="mail-outline" title={t('managementContacts')} onPress={() => navigation.navigate('ManagementContacts')} />
      {capabilities.data?.canQuote ? <AccountRow icon="podium-outline" title={t('publicPerformance')} onPress={() => navigation.navigate('ConciergePublication')} /> : null}
      <AccountRow icon="settings-outline" title={t('accountOperations')} onPress={() => navigation.navigate('Settings')} last />
    </AccountGroup> : null}
    {ownerAccess && !concierge && !preview ? <AccountGroup title={t('accountVisibility')}>
      <AccountRow icon="megaphone-outline" title={t('publicProfileSettings')} onPress={() => navigation.navigate('PublicProfilePublication')} />
      <AccountRow icon="mail-outline" title={t('managementContacts')} onPress={() => navigation.navigate('ManagementContacts')} last />
    </AccountGroup> : null}
    {fieldWork ? <AccountGroup title={t('accountWork')}>
      <AccountRow icon="pricetag-outline" title={t('accountMyRates')} onPress={() => navigation.navigate('MyRates')} />
      <AccountRow icon="wallet-outline" title={t('accountMyPayouts')} onPress={() => navigation.navigate('MyPayouts')} />
      <AccountRow icon="warning-outline" title={t('accountMyIssues')} onPress={() => navigation.navigate('MyIssues')} last />
    </AccountGroup> : null}
    <AccountGroup title={t('accountSettings')}>
      {!preview && (ownerAccess || fieldWork) ? <AccountRow icon="layers-outline" title={t('accountSectorMap')}
        onPress={() => navigation.navigate('SectorMap', { scope: ownerAccess ? 'relevant' : 'mine' })} /> : null}
      <AccountRow icon="settings-outline" title={t('accountPreferences')} onPress={() => navigation.navigate('AccountPreferences')} />
      <AccountRow icon="camera-outline" title={t('reelSettings')} onPress={() => navigation.navigate('ReelSettings')} />
      <AccountRow icon="help-circle-outline" title={t('support')} onPress={() => openSupport('https://baitly.fr/contact')} />
      <AccountRow icon="shield-checkmark-outline" title={t('privacy')} onPress={() => openSupport('https://baitly.fr/legal/confidentialite')} />
      {ownerAccess && !preview ? <AccountRow icon="diamond-outline" title={t('adminSubscription')} onPress={() => navigation.navigate('Subscription')} last /> : null}
    </AccountGroup>
    {error ? <BaitlyNotice error>{t('accountLinkFailed')}</BaitlyNotice> : null}
    <View style={styles.footer}><Pressable accessibilityRole="button" onPress={confirmLogout} style={({ pressed }) => [styles.logout, row, { opacity: pressed ? 0.6 : 1 }]}>
      <Reicon name="log-out-outline" size={19} color={colors.secondary} /><BaitlyText variant="meta" muted>{t('logout')}</BaitlyText>
    </Pressable></View>
  </BaitlyScreen>;
}
