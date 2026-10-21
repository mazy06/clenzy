import React from 'react';
import { ShieldCheck } from '../../icons/glyphs';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useBaitlyAnalyticsConsent } from '../../providers/BaitlyAnalyticsConsentProvider';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';

export default function AnalyticsConsentSection() {
  const { t } = useTranslation();
  const consent = useBaitlyAnalyticsConsent();
  const dnt = typeof navigator !== 'undefined' && navigator.doNotTrack === '1';
  return (
    <SettingsSection title={t('settings.analytics.title')} icon={ShieldCheck} accent="accent"
      description={t('settings.analytics.subtitle')}>
      <SettingsToggleRow title={t('settings.analytics.toggle')} description={t('settings.analytics.description')}
        checked={consent.granted} onChange={value => { void consent.change(value); }} divider={false}
        disabled={!consent.available || consent.busy || consent.error === 'load' || consent.error === 'withdraw'} />
      <p className="mt-2 text-xs text-muted-foreground">{t('settings.analytics.withdrawHint')}</p>
      <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
        {t(`settings.analytics.${!consent.available ? 'unavailable' : consent.busy ? 'busy' : consent.granted ? 'accepted' : 'declined'}`)}
      </p>
      {dnt && <p className="mt-2 text-xs text-muted-foreground">{t('settings.analytics.dnt')}</p>}
      {consent.error && <Alert variant="warning" className="mt-3">
        <AlertDescription>{t(`settings.analytics.${consent.error}Error`)}</AlertDescription>
        <Button variant="outline" size="sm"
          onClick={consent.error === 'save' ? () => { void consent.change(true); } : consent.retry}
          className="mt-2 cursor-pointer">
          {t('settings.analytics.retry')}
        </Button>
      </Alert>}
    </SettingsSection>
  );
}
