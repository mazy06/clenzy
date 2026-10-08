import { useTranslation } from '../../../../hooks/useTranslation';
import { Alert, AlertDescription, Skeleton } from '../../../../components/ui';
import { AlertTriangle } from '../../../../icons/glyphs';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import {
  SettingsPage, SettingCard, SettingRow, SaveBar,
  TextControl, TextAreaControl, NumberControl, ToggleControl, SelectControl,
} from './settingsControls';

/**
 * Section « Réservation » du Studio (F3) — premier panneau réellement persisté.
 * Édite les champs métier de BookingEngineConfig : devise/langue, paiement, frais affichés,
 * fenêtre de réservation, politique d'annulation, liens légaux. Save = PUT config complet.
 */

// Les devises ne portent que leur CODE : le nom se lit dans `currencies.*` au
// rendu, comme dans le sélecteur de l'application. Les libellés d'origine
// répétaient le symbole entre parenthèses — « (MAD) » et « (CHF) » y écrivaient
// un code ISO là où les autres montraient un signe.
//
// SAR figure désormais dans la liste : l'application sait afficher et convertir
// le riyal, le moteur de réservation devait pouvoir être tarifé avec.
const CURRENCY_CODES = ['EUR', 'SAR', 'MAD', 'USD', 'GBP', 'CHF', 'CAD'] as const;

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

// Même règle que les devises : seule la CLEF vit ici, le libellé se lit au
// rendu — figé à l'import, il resterait français.
const DATA_SOURCE_MODES = ['REAL', 'MOCK'] as const;

export interface BookingSettingsPanelProps {
  config: BookingEngineConfig | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  dirty: boolean;
  patch: (changes: Partial<BookingEngineConfig>) => void;
  onSave: () => void;
}

export default function BookingSettingsPanel({ config, loading, error, saving, dirty, patch, onSave }: BookingSettingsPanelProps) {
  // Appelé avant tout retour anticipé (règle des hooks).
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-6">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[160px] mb-4 rounded-[var(--radius-lg)] bg-[var(--hover)]" />)}
      </div>
    );
  }

  // Bandeau d'erreur ecrit a la main -> primitive Alert : elle porte deja le
  // couple fond pastel / encre `-ink` conforme AA. Le texte tenait la teinte
  // VIVE `--err`, sous le seuil.
  if (!config) {
    return (
      <div className="m-6">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error ?? t('bookingSettings.notFound')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <SettingsPage
      title={t('bookingSettings.title', 'Réservation')}
      description={t('bookingSettings.description')}
      footer={<SaveBar dirty={dirty} saving={saving} onSave={onSave} error={error} />}
    >
      <SettingCard
        title={t('bookingSettings.dataSource.title')}
        description={t('bookingSettings.dataSource.description')}
      >
        <SettingRow
          label={t('bookingSettings.dataSource.label')}
          helper={t('bookingSettings.dataSource.helper')}
          htmlFor="cfg-data-source"
          control={
            <SelectControl
              id="cfg-data-source"
              value={config.dataSourceMode ?? 'REAL'}
              onChange={(v) => patch({ dataSourceMode: v as 'REAL' | 'MOCK' })}
              options={DATA_SOURCE_MODES.map((mode) => ({
                value: mode,
                label: t(`bookingSettings.dataSource.${mode === 'REAL' ? 'real' : 'mock'}`),
              }))}
            />
          }
        />
      </SettingCard>

      <SettingCard
        title={t('bookingSettings.locale.title')}
        description={t('bookingSettings.locale.description')}
      >
        <SettingRow label={t('bookingSettings.locale.currency', 'Devise')} htmlFor="cfg-currency" control={
          <SelectControl
            id="cfg-currency"
            value={config.defaultCurrency}
            onChange={(v) => patch({ defaultCurrency: v })}
            options={CURRENCY_CODES.map((code) => ({ value: code, label: t(`currencies.${code}`) }))}
          />
        } />
        <SettingRow label={t('bookingSettings.locale.language')} htmlFor="cfg-lang" control={
          <SelectControl id="cfg-lang" value={config.defaultLanguage} onChange={(v) => patch({ defaultLanguage: v })} options={LANGUAGES} />
        } />
      </SettingCard>

      <SettingCard title={t('bookingSettings.payment.title')}>
        <SettingRow
          label={t('bookingSettings.payment.collect')}
          helper={t('bookingSettings.payment.collectHelper')}
          control={<ToggleControl checked={config.collectPaymentOnBooking} onChange={(v) => patch({ collectPaymentOnBooking: v })} />}
        />
        <SettingRow
          label={t('bookingSettings.payment.autoConfirm')}
          helper={t('bookingSettings.payment.autoConfirmHelper')}
          control={<ToggleControl checked={config.autoConfirm} onChange={(v) => patch({ autoConfirm: v })} />}
        />
        <SettingRow
          label={t('bookingSettings.payment.hold')}
          helper={t('bookingSettings.payment.holdHelper')}
          htmlFor="cfg-hold-minutes"
          control={
            <NumberControl id="cfg-hold-minutes" value={config.pendingHoldMinutes ?? 30}
              onChange={(v) => patch({ pendingHoldMinutes: v >= 1 ? v : null })} min={1} max={1440} />
          }
        />
      </SettingCard>

      <SettingCard
        title={t('bookingSettings.fees.title')}
        description={t('bookingSettings.fees.description')}
      >
        <SettingRow label={t('bookingSettings.fees.cleaning')} control={<ToggleControl checked={config.showCleaningFee} onChange={(v) => patch({ showCleaningFee: v })} />} />
        <SettingRow label={t('bookingSettings.fees.touristTax')} control={<ToggleControl checked={config.showTouristTax} onChange={(v) => patch({ showTouristTax: v })} />} />
      </SettingCard>

      <SettingCard
        title={t('bookingSettings.direct.title')}
        description={t('bookingSettings.direct.description')}
      >
        <SettingRow
          label={t('bookingSettings.direct.discount')}
          helper={t('bookingSettings.direct.discountHelper')}
          htmlFor="cfg-direct-discount"
          control={
            <NumberControl id="cfg-direct-discount" value={config.directBookingDiscountPercent ?? 0}
              onChange={(v) => patch({ directBookingDiscountPercent: v > 0 ? v : null })} min={0} max={100} />
          }
        />
        <SettingRow
          label={t('bookingSettings.direct.member')}
          helper={t('bookingSettings.direct.memberHelper')}
          htmlFor="cfg-member-discount"
          control={
            <NumberControl id="cfg-member-discount" value={config.memberDiscountPercent ?? 0}
              onChange={(v) => patch({ memberDiscountPercent: v > 0 ? v : null })} min={0} max={100} />
          }
        />
      </SettingCard>

      <SettingCard
        title={t('bookingSettings.window.title')}
        description={t('bookingSettings.window.description')}
      >
        <SettingRow label={t('bookingSettings.window.min')} htmlFor="cfg-min" control={
          <NumberControl id="cfg-min" value={config.minAdvanceDays} onChange={(v) => patch({ minAdvanceDays: v })} min={0} max={365} />
        } />
        <SettingRow label={t('bookingSettings.window.max')} htmlFor="cfg-max" control={
          <NumberControl id="cfg-max" value={config.maxAdvanceDays} onChange={(v) => patch({ maxAdvanceDays: v })} min={1} max={1095} />
        } />
      </SettingCard>

      <SettingCard title={t('bookingSettings.policy.title')}>
        <SettingRow label={t('bookingSettings.policy.cancellation')} htmlFor="cfg-cancel" control={
          <TextAreaControl id="cfg-cancel" value={config.cancellationPolicy ?? ''} onChange={(v) => patch({ cancellationPolicy: v || null })} placeholder={t('bookingSettings.policy.cancellationPlaceholder')} />
        } />
        <SettingRow label={t('bookingSettings.policy.terms')} htmlFor="cfg-terms" control={
          <TextControl id="cfg-terms" type="url" value={config.termsUrl ?? ''} onChange={(v) => patch({ termsUrl: v || null })} placeholder="https://…" />
        } />
        <SettingRow label={t('bookingSettings.policy.privacy')} htmlFor="cfg-privacy" control={
          <TextControl id="cfg-privacy" type="url" value={config.privacyUrl ?? ''} onChange={(v) => patch({ privacyUrl: v || null })} placeholder="https://…" />
        } />
      </SettingCard>
    </SettingsPage>
  );
}
