import { useEffect, useState } from 'react';
import { Alert, AlertDescription, Skeleton } from '../../../../components/ui';
import StatTile from '../../../../components/baitly/StatTile';
import { AlertTriangle, Users, ShoppingCart, Info } from '../../../../icons/glyphs';
import { growthSettingsApi, type GrowthSettings } from '../../../../services/api/growthSettingsApi';
import { SettingsPage, SettingCard, SettingRow, SaveBar, ToggleControl, NumberControl } from './settingsControls';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useCurrency } from '../../../../hooks/useCurrency';
import { currencySign } from '../../../../utils/currencyUtils';

/**
 * Section « Croissance » du Studio (2) — réglages org-level RÉELLEMENT appliqués :
 * capture de leads (gate l'endpoint /leads) et relance de panier abandonné (gate le scheduler).
 * Compteurs réels. Les réglages s'appliquent à toute l'organisation (tous ses booking engines).
 */

export default function GrowthSettingsPanel() {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [loaded, setLoaded] = useState<GrowthSettings | null>(null);
  const [leadCapture, setLeadCapture] = useState(false);
  const [leadCapturePopup, setLeadCapturePopup] = useState(false);
  const [abandoned, setAbandoned] = useState(false);
  const [loyalty, setLoyalty] = useState(0);
  // Crédit de parrainage saisi en EUROS (le backend stocke des centimes).
  const [referralEuros, setReferralEuros] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hydrate = (s: GrowthSettings) => {
    setLoaded(s);
    setLeadCapture(s.leadCaptureEnabled);
    setLeadCapturePopup(s.leadCapturePopupEnabled);
    setAbandoned(s.abandonedCartRecoveryEnabled);
    setLoyalty(s.loyaltyCreditPercent ?? 0);
    setReferralEuros((s.referralCreditCents ?? 0) / 100);
  };

  useEffect(() => {
    let alive = true;
    growthSettingsApi.get()
      .then((s) => { if (alive) hydrate(s); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Chargement impossible'); });
    return () => { alive = false; };
  }, []);

  const referralCents = Math.round(referralEuros * 100);
  const dirty = !!loaded && (leadCapture !== loaded.leadCaptureEnabled
    || leadCapturePopup !== loaded.leadCapturePopupEnabled
    || abandoned !== loaded.abandonedCartRecoveryEnabled
    || loyalty !== (loaded.loyaltyCreditPercent ?? 0)
    || referralCents !== (loaded.referralCreditCents ?? 0));

  const save = () => {
    setSaving(true);
    setError(null);
    growthSettingsApi.update({
      leadCaptureEnabled: leadCapture,
      leadCapturePopupEnabled: leadCapturePopup,
      abandonedCartRecoveryEnabled: abandoned,
      loyaltyCreditPercent: loyalty > 0 ? loyalty : null,
      referralCreditCents: referralCents > 0 ? referralCents : null,
    })
      .then(hydrate)
      .catch((e) => setError(e instanceof Error ? e.message : 'Enregistrement impossible'))
      .finally(() => setSaving(false));
  };

  if (!loaded && !error) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-6">
        {[0, 1].map((i) => <Skeleton key={i} className="h-[140px] mb-[15px] rounded-xl" />)}
      </div>
    );
  }

  if (!loaded) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <SettingsPage
      title="Croissance"
      description="{t('studio.growth.subtitle')}"
      footer={<SaveBar dirty={dirty} saving={saving} onSave={save} error={error} />}
      intro={
        <Alert variant="info" className="mb-3.5">
          <Info />
          <AlertDescription>
            {t('studio.growth.appliesTo')} <b>toute l’organisation</b> — donc à l’ensemble de vos booking engines.
          </AlertDescription>
        </Alert>
      }
    >
      <SettingCard title={t('studio.growth.leadCapture')} description={t('studio.growth.leadCaptureHint')}>
        <SettingRow
          label="{t('studio.growth.enableLeadCapture')}"
          helper="Désactivé, l’endpoint public de capture est refusé (403)."
          control={<ToggleControl checked={leadCapture} onChange={setLeadCapture} />}
        />
        <SettingRow
          label="{t('studio.growth.exitIntent')}"
          helper="Affiche un popup « Ne partez pas les mains vides » à l’intention de sortie. Désactivé par défaut."
          control={<ToggleControl checked={leadCapturePopup} onChange={setLeadCapturePopup} />}
        />
      </SettingCard>

      <SettingCard title={t('studio.growth.cartRecovery')} description={t('studio.growth.cartRecoveryHint')}>
        <SettingRow
          label="{t('studio.growth.enableCartRecovery')}"
          helper="Désactivé, le planificateur n’envoie plus d’email de relance pour votre organisation."
          control={<ToggleControl checked={abandoned} onChange={setAbandoned} />}
        />
      </SettingCard>

      <SettingCard title="{t('studio.growth.loyaltyCredit')}" description="{t('studio.growth.loyaltyHint')}">
        <SettingRow
          label="{t('studio.growth.creditPerStay')}"
          helper="Crédité APRÈS le séjour (check-out passé), réutilisable lors d'une prochaine réservation. 0 = programme désactivé."
          control={<NumberControl value={loyalty} onChange={(v) => setLoyalty(v)} min={0} max={100} />}
        />
      </SettingCard>

      <SettingCard title="Parrainage" description="{t('studio.growth.referralHint')}">
        <SettingRow
          label={t('studio.growth.creditPerReferral', { currency: currencySign(currency) })}
          helper="Montant crédité À CHAQUE côté (parrain et filleul) lorsque le filleul termine son 1er séjour direct. 0 = programme désactivé."
          control={<NumberControl value={referralEuros} onChange={(v) => setReferralEuros(v)} min={0} max={500} />}
        />
      </SettingCard>

      <SettingCard title="Impact" description="{t('studio.growth.metricsHint')}">
        {/* `bg-muted/40` : les tuiles se détachent de la carte qui les contient
            plutôt que d'empiler deux surfaces `bg-card` identiques. */}
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-3 py-[9px]">
          <StatTile icon={<Users />} label="{t('studio.growth.leadsCaptured')}" value={loaded.contactsCaptured} className="bg-muted/40" />
          <StatTile icon={<ShoppingCart />} label="{t('studio.growth.cartsRecovered')}" value={loaded.cartsRecovered} className="bg-muted/40" />
        </div>
      </SettingCard>
    </SettingsPage>
  );
}
