import { Box, Skeleton } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
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

const CURRENCIES = [
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'USD', label: 'Dollar US ($)' },
  { value: 'GBP', label: 'Livre sterling (£)' },
  { value: 'CHF', label: 'Franc suisse (CHF)' },
  { value: 'CAD', label: 'Dollar canadien (C$)' },
  { value: 'MAD', label: 'Dirham marocain (MAD)' },
];

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

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
  if (loading) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 4, py: 4 }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={160} sx={{ mb: 2.5, borderRadius: 'var(--radius-lg)', bgcolor: 'var(--hover)' }} />)}
      </Box>
    );
  }

  if (!config) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, m: 4, p: 2, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
        <AlertTriangle size={18} strokeWidth={2} /> {error ?? 'Config introuvable.'}
      </Box>
    );
  }

  return (
    <SettingsPage
      title="Réservation"
      description="Les règles de réservation appliquées à ce booking engine."
      footer={<SaveBar dirty={dirty} saving={saving} onSave={onSave} error={error} />}
    >
      <SettingCard title="Devise & langue" description="Valeurs par défaut présentées aux voyageurs.">
        <SettingRow label="Devise" htmlFor="cfg-currency" control={
          <SelectControl id="cfg-currency" value={config.defaultCurrency} onChange={(v) => patch({ defaultCurrency: v })} options={CURRENCIES} />
        } />
        <SettingRow label="Langue par défaut" htmlFor="cfg-lang" control={
          <SelectControl id="cfg-lang" value={config.defaultLanguage} onChange={(v) => patch({ defaultLanguage: v })} options={LANGUAGES} />
        } />
      </SettingCard>

      <SettingCard title="Paiement & confirmation">
        <SettingRow
          label="Encaisser à la réservation"
          helper="Le paiement Stripe est exigé au moment de réserver."
          control={<ToggleControl checked={config.collectPaymentOnBooking} onChange={(v) => patch({ collectPaymentOnBooking: v })} />}
        />
        <SettingRow
          label="Confirmation automatique"
          helper="Les réservations sont confirmées sans validation manuelle."
          control={<ToggleControl checked={config.autoConfirm} onChange={(v) => patch({ autoConfirm: v })} />}
        />
        <SettingRow
          label="Durée du hold (minutes)"
          helper="Délai avant qu'une réservation non payée soit annulée et les dates libérées (défaut 30)."
          htmlFor="cfg-hold-minutes"
          control={
            <NumberControl id="cfg-hold-minutes" value={config.pendingHoldMinutes ?? 30}
              onChange={(v) => patch({ pendingHoldMinutes: v >= 1 ? v : null })} min={1} max={1440} />
          }
        />
      </SettingCard>

      <SettingCard title="Frais affichés" description="Lignes de prix visibles dans le récapitulatif.">
        <SettingRow label="Afficher les frais de ménage" control={<ToggleControl checked={config.showCleaningFee} onChange={(v) => patch({ showCleaningFee: v })} />} />
        <SettingRow label="Afficher la taxe de séjour" control={<ToggleControl checked={config.showTouristTax} onChange={(v) => patch({ showTouristTax: v })} />} />
      </SettingCard>

      <SettingCard title="Réservation directe" description="Récompensez la réservation en direct par une remise — « Book Direct & Save ».">
        <SettingRow
          label="Remise réservation directe (%)"
          helper="Appliquée au sous-total ; 0 = aucune. L'économie réalisée est affichée au voyageur dans le récapitulatif."
          htmlFor="cfg-direct-discount"
          control={
            <NumberControl id="cfg-direct-discount" value={config.directBookingDiscountPercent ?? 0}
              onChange={(v) => patch({ directBookingDiscountPercent: v > 0 ? v : null })} min={0} max={100} />
          }
        />
        <SettingRow
          label="Tarif membre (%)"
          helper="Remise pour un voyageur connecté à son compte. Le membre obtient la meilleure des deux remises (directe ou membre) ; 0 = aucune."
          htmlFor="cfg-member-discount"
          control={
            <NumberControl id="cfg-member-discount" value={config.memberDiscountPercent ?? 0}
              onChange={(v) => patch({ memberDiscountPercent: v > 0 ? v : null })} min={0} max={100} />
          }
        />
      </SettingCard>

      <SettingCard title="Fenêtre de réservation" description="Anticipation minimale et maximale, en jours.">
        <SettingRow label="Délai minimum (jours)" htmlFor="cfg-min" control={
          <NumberControl id="cfg-min" value={config.minAdvanceDays} onChange={(v) => patch({ minAdvanceDays: v })} min={0} max={365} />
        } />
        <SettingRow label="Horizon maximum (jours)" htmlFor="cfg-max" control={
          <NumberControl id="cfg-max" value={config.maxAdvanceDays} onChange={(v) => patch({ maxAdvanceDays: v })} min={1} max={1095} />
        } />
      </SettingCard>

      <SettingCard title="Politique & mentions">
        <SettingRow label="Politique d'annulation" htmlFor="cfg-cancel" control={
          <TextAreaControl id="cfg-cancel" value={config.cancellationPolicy ?? ''} onChange={(v) => patch({ cancellationPolicy: v || null })} placeholder="Ex. : annulation gratuite jusqu'à 7 jours avant l'arrivée." />
        } />
        <SettingRow label="URL des CGV" htmlFor="cfg-terms" control={
          <TextControl id="cfg-terms" type="url" value={config.termsUrl ?? ''} onChange={(v) => patch({ termsUrl: v || null })} placeholder="https://…" />
        } />
        <SettingRow label="URL confidentialité" htmlFor="cfg-privacy" control={
          <TextControl id="cfg-privacy" type="url" value={config.privacyUrl ?? ''} onChange={(v) => patch({ privacyUrl: v || null })} placeholder="https://…" />
        } />
      </SettingCard>
    </SettingsPage>
  );
}
