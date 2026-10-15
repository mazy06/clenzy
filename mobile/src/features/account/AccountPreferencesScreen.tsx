import React, { useRef,useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BaitlyScreen, BaitlyNotice, BaitlyEmpty } from '@/design-system/components';
import { useAccountPreferences } from './useAccountPreferences';
import { useSettingsStore } from '@/store/settingsStore';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { AccountGroup, AccountRow } from './AccountComponents';
import { baitlyDemoProfiles, useBaitlyDemoProfile } from '@/config/baitlyDemoProfiles';

export function AccountPreferencesScreen() {
  const { t } = useTranslation('mobileV1');
  const theme = useSettingsStore(s => s.themeMode);
  const language = useSettingsStore(s => s.language);
  const {query,save}=useAccountPreferences();
  const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  const flight=useRef(false);
  async function update(patch: Parameters<typeof save>[0]) { if(flight.current)return;flight.current=true;setBusy(true);setFailed(false);try{await save(patch);}catch{setFailed(true);}finally{flight.current=false;setBusy(false);} }
  const setTheme = (themeMode: 'system'|'light'|'dark')=>{void update({themeMode});};
  const setLanguage = (language: 'fr'|'en')=>{void update({language});};
  const mode = useBaitlyDataMode(s => s.mode);
  const setMode = useBaitlyDataMode(s => s.setMode);
  const profile = useBaitlyDemoProfile(s => s.key);
  const selectProfile = useBaitlyDemoProfile(s => s.select);
  return <BaitlyScreen title={t('accountPreferences')}>
    {failed?<BaitlyNotice error>{t('sendFailed')}</BaitlyNotice>:null}
    {query.isError?<BaitlyEmpty title={t('loadFailed')} retry={()=>{void query.refetch();}}/>:null}
    <AccountGroup title={t('accountAppearance')}>
      <AccountRow busy={busy} title={t('accountThemeSystem')} icon="phone-portrait-outline" selected={theme === 'system'} onPress={() => setTheme('system')} />
      <AccountRow busy={busy} title={t('accountThemeLight')} icon="sunny-outline" selected={theme === 'light'} onPress={() => setTheme('light')} />
      <AccountRow busy={busy} title={t('accountThemeDark')} icon="moon-outline" selected={theme === 'dark'} onPress={() => setTheme('dark')} last />
    </AccountGroup>
    <AccountGroup title={t('accountLanguage')}>
      <AccountRow busy={busy} title="Français" icon="globe-outline" selected={language === 'fr'} onPress={() => setLanguage('fr')} />
      <AccountRow busy={busy} title="English" icon="globe-outline" selected={language === 'en'} onPress={() => setLanguage('en')} last />
    </AccountGroup>
    {canUseBaitlyDemo() ? <AccountGroup title={t('accountDevData')}>
      <AccountRow title={t('dataModeReal')} icon="wifi-outline" selected={mode === 'real'} onPress={() => setMode('real')} />
      <AccountRow title={t('dataModeDemo')} icon="layers-outline" selected={mode === 'demo'} onPress={() => setMode('demo')} last />
    </AccountGroup> : null}
    {canUseBaitlyDemo() && mode === 'demo' ? <AccountGroup title={t('demoProfiles')}>
      <AccountRow title={t('demoConnectedProfile')} icon="person-outline" selected={profile === null} onPress={() => selectProfile(null)} />
      {baitlyDemoProfiles.map((item, index) => <AccountRow key={item.key} title={t(`demoProfile.${item.key}`)} icon="person-outline" selected={profile === item.key}
        onPress={() => selectProfile(item.key)} last={index === baitlyDemoProfiles.length - 1} />)}
    </AccountGroup> : null}
  </BaitlyScreen>;
}
