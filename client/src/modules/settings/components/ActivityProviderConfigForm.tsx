import React, { useEffect, useId, useState } from 'react';
import { Spinner, Button } from '../../../components/ui';
import { Field, FieldLabel, Input, Switch } from '../../../components/ui';
import { useNotification } from '../../../hooks/useNotification';
import { useTranslation } from '../../../hooks/useTranslation';
import { activitiesApi, type ActivityProvider } from '../../../services/api/activitiesApi';

/**
 * Config d'affiliation d'UN seul fournisseur d'activités (clé API + ID affilié + actif),
 * destinée à être rendue dans le modal du marketplace concerné. La clé API n'est jamais
 * renvoyée par l'API (chiffrée) — on affiche « déjà configurée » si une clé existe.
 */
export default function ActivityProviderConfigForm({ provider }: { provider: ActivityProvider }) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  // Un formulaire par fournisseur peut etre monte plusieurs fois dans la page :
  // les identifiants doivent rester uniques pour que les libelles designent
  // bien LEUR champ.
  const fieldId = useId();
  const [apiKey, setApiKey] = useState('');
  const [affiliateId, setAffiliateId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    activitiesApi
      .listConfigs()
      .then((configs) => {
        if (!active) return;
        const c = configs.find((x) => x.provider === provider);
        setAffiliateId(c?.affiliateId ?? '');
        setEnabled(c?.enabled ?? false);
        setHasKey(c?.hasKey ?? false);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await activitiesApi.upsertConfig(provider, {
        apiKey: apiKey.trim() || null,
        affiliateId: affiliateId.trim() || null,
        enabled,
      });
      setApiKey('');
      setHasKey(saved.hasKey);
      setEnabled(saved.enabled);
      setAffiliateId(saved.affiliateId ?? '');
      notify.success(t('welcomeGuide.messages.updated', 'Enregistré'));
    } catch {
      notify.error(t('welcomeGuide.messages.error', 'Une erreur est survenue'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner className="size-[22px]" />
      </div>
    );
  }

  return (
    // Encart bordé plutôt qu'une Card : il est déjà rendu DANS la carte du
    // modal de détail, et une carte dans une carte est un empilement à plat.
    <div className="border border-border rounded-xl p-2 mb-2">
      <Field orientation="horizontal" className="w-fit gap-2">
        <Switch
          id={`${fieldId}-enabled`}
          size="sm"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked)}
        />
        <FieldLabel htmlFor={`${fieldId}-enabled`} className="cursor-pointer">
          {t('welcomeGuide.activities.enabled', 'Actif')}
        </FieldLabel>
      </Field>
      <Field className="mt-[3px] mb-1.5">
        <FieldLabel htmlFor={`${fieldId}-api-key`}>
          {hasKey
            ? t('welcomeGuide.activities.apiKeySet', 'Clé API (déjà configurée)')
            : t('welcomeGuide.activities.apiKey', 'Clé API')}
        </FieldLabel>
        <Input
          id={`${fieldId}-api-key`}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? '••••••••' : ''}
        />
      </Field>
      <Field className="mb-1.5">
        <FieldLabel htmlFor={`${fieldId}-affiliate-id`}>
          {t('welcomeGuide.activities.affiliateId', 'ID affilié')}
        </FieldLabel>
        <Input
          id={`${fieldId}-affiliate-id`}
          value={affiliateId}
          onChange={(e) => setAffiliateId(e.target.value)}
        />
      </Field>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <Spinner className="size-3.5" /> : null}
        {t('welcomeGuide.actions.save', 'Enregistrer')}
      </Button>
    </div>
  );
}
