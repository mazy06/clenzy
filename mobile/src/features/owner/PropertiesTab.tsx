import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BaitlySegmented } from '@/design-system/primitives';
import { useBaitlyUser } from '@/config/baitlyDemoProfiles';
import { BaitlyPropertiesScreen } from './OwnerScreens';
import { PublicPropertiesScreen } from '@/features/conciergeries/ConciergeScreens';

/**
 * "Logements" tab of the owner space: the user's own homes first, the public directory one tap away.
 * A concierge's directory lists owners looking for management, an owner's lists concierges.
 */
export function OwnerPropertiesTab() {
  const { t } = useTranslation('mobileV1');
  const user = useBaitlyUser();
  const [view, setView] = useState<'mine' | 'directory'>('mine');
  const concierge = user?.organizationType === 'CONCIERGE';
  const switcher = <BaitlySegmented value={view} onChange={setView} options={[
    { value: 'mine', label: t('accountMyProperties') },
    { value: 'directory', label: t(concierge ? 'directoryHomesToManage' : 'directoryTab') },
  ]} />;
  return view === 'mine' ? <BaitlyPropertiesScreen switcher={switcher} /> : <PublicPropertiesScreen switcher={switcher} />;
}
