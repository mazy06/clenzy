import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BaitlyScreen, BaitlyText } from '@/design-system/components';
import { AccountGroup, AccountRow } from '@/features/account/AccountComponents';

/** Only show destinations registered in this administration navigator. */
export function ManagerMoreScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation('mobileV1');
  return <BaitlyScreen>
    <BaitlyText variant="heading">{t('adminTools')}</BaitlyText>
    <AccountGroup title={t('adminOperations')}>
      <AccountRow title={t('teamsTab')} icon="people-outline" onPress={() => navigation.navigate('Teams')} />
      <AccountRow title={t('adminServiceRequests')} icon="document-text-outline" onPress={() => navigation.navigate('ServiceRequests')} />
      <AccountRow title={t('adminIncidents')} icon="alert-circle-outline" onPress={() => navigation.navigate('Incidents')} />
      <AccountRow title={t('adminDocuments')} icon="document-text-outline" onPress={() => navigation.navigate('Documents')} />
      <AccountRow title={t('adminUsers')} icon="person-add-outline" onPress={() => navigation.navigate('UserList')} last />
    </AccountGroup>
    <AccountGroup title={t('homeNetwork')}>
      <AccountRow title={t('accountMyProperties')} icon="home-outline" onPress={() => navigation.navigate('MyProperties')} />
      <AccountRow title={t('explore')} icon="search-outline" onPress={() => navigation.navigate('Services')} />
      <AccountRow title={t('properties')} icon="location-outline" onPress={() => navigation.navigate('PublicHomes')} />
      <AccountRow title={t('reelTab')} icon="play-circle-outline" onPress={() => navigation.navigate('Reels')} last />
    </AccountGroup>
    <AccountGroup title={t('account')}>
      <AccountRow title={t('account')} icon="person-outline" onPress={() => navigation.navigate('Account')} />
      <AccountRow title={t('accountPersonalInfo')} icon="person-outline" onPress={() => navigation.navigate('AccountDetails')} />
      <AccountRow title={t('accountPreferences')} icon="settings-outline" onPress={() => navigation.navigate('AccountPreferences')} />
      <AccountRow title={t('adminSubscription')} icon="card-outline" onPress={() => navigation.navigate('Subscription')} last />
    </AccountGroup>
  </BaitlyScreen>;
}
