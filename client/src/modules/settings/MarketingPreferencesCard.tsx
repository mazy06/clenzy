import React, { useEffect, useState, useCallback } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import { Spinner } from '../../components/ui';
import { Mail } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { usersApi } from '../../services/api/usersApi';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Section de gestion des preferences marketing — actuellement uniquement
 * l'opt-in newsletter Baitly.
 *
 * <p><b>Conformite RGPD article 7-3</b> : le retrait du consentement doit etre
 * aussi simple que son octroi. Cette section permet a l'utilisateur de retirer
 * son consentement newsletter en un clic, sans contact support, sans email
 * de confirmation requis.</p>
 *
 * <p>Auto-save au toggle : pas de bouton "Enregistrer" — la valeur est
 * persistee immediatement (optimistic update + rollback en cas d'erreur).</p>
 */
export default function MarketingPreferencesCard() {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [newsletterOptIn, setNewsletterOptIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      const data = await usersApi.getMyMarketingPreferences();
      setNewsletterOptIn(data.newsletterOptIn);
    } catch {
      setLoadError(t('settings.marketing.loadError'));
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggle = async (next: boolean) => {
    if (newsletterOptIn === null) return;

    const previous = newsletterOptIn;
    // Optimistic update — l'utilisateur voit le changement immediatement
    setNewsletterOptIn(next);
    setSaving(true);

    try {
      const result = await usersApi.updateMyMarketingPreferences(next);
      setNewsletterOptIn(result.newsletterOptIn);
      notify.success(
        next
          ? t('settings.marketing.subscribed')
          : t('settings.marketing.unsubscribed'),
      );
    } catch {
      // Rollback en cas d'erreur
      setNewsletterOptIn(previous);
      notify.error(t('settings.marketing.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={t('settings.marketing.title')}
      icon={Mail}
      accent="info"
      description={t('settings.marketing.subtitle')}
      help="Vous pouvez retirer votre consentement à tout moment, conformément à l'article 7-3 du RGPD."
    >
      {loadError && (
        <UiAlert variant="warning" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{loadError}</AlertDescription>
        </UiAlert>
      )}

      {newsletterOptIn === null && !loadError ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-5" />
        </div>
      ) : (
        <SettingsToggleRow
          title="Newsletter Baitly"
          description={t('settings.marketing.newsletterHint')}
          checked={!!newsletterOptIn}
          onChange={(checked) => handleToggle(checked)}
          disabled={saving}
          divider={false}
        />
      )}
    </SettingsSection>
  );
}
