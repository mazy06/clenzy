import { useEffect, useState } from 'react';
import { Skeleton } from '@mui/material';
import { AlertTriangle, Users, ShoppingCart, Info } from 'lucide-react';
import { growthSettingsApi, type GrowthSettings } from '../../../../services/api/growthSettingsApi';
import { SettingsPage, SettingCard, SettingRow, SaveBar, ToggleControl, NumberControl } from './settingsControls';

/**
 * Section « Croissance » du Studio (2) — réglages org-level RÉELLEMENT appliqués :
 * capture de leads (gate l'endpoint /leads) et relance de panier abandonné (gate le scheduler).
 * Compteurs réels. Les réglages s'appliquent à toute l'organisation (tous ses booking engines).
 */

export default function GrowthSettingsPanel() {
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
        {[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={140} sx={{ mb: 2.5, borderRadius: 'var(--radius-lg)', bgcolor: 'var(--hover)' }} />)}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-1.5 m-6 p-3 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
        <AlertTriangle size={18} strokeWidth={2} /> {error}
      </div>
    );
  }

  return (
    <SettingsPage
      title="Croissance"
      description="Capture de leads et relance de panier — réellement appliquées côté serveur."
      footer={<SaveBar dirty={dirty} saving={saving} onSave={save} error={error} />}
      intro={
        <div className="flex items-start gap-1.5 mb-3.5 p-2 rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--body)] text-[var(--text-sm)] leading-[1.5]">
          <span className="text-[var(--accent)] mt-0"><Info size={16} strokeWidth={2} /></span>
          Ces réglages s’appliquent à <b>toute l’organisation</b> — donc à l’ensemble de vos booking engines.
        </div>
      }
    >
      <SettingCard title="Capture de leads" description="Newsletter / liste d’attente avec consentement RGPD.">
        <SettingRow
          label="Activer la capture de leads"
          helper="Désactivé, l’endpoint public de capture est refusé (403)."
          control={<ToggleControl checked={leadCapture} onChange={setLeadCapture} />}
        />
        <SettingRow
          label="Popup de sortie (exit-intent)"
          helper="Affiche un popup « Ne partez pas les mains vides » à l’intention de sortie. Désactivé par défaut."
          control={<ToggleControl checked={leadCapturePopup} onChange={setLeadCapturePopup} />}
        />
      </SettingCard>

      <SettingCard title="Relance de panier abandonné" description="Email de récupération automatique pour les réservations non finalisées.">
        <SettingRow
          label="Activer la relance automatique"
          helper="Désactivé, le planificateur n’envoie plus d’email de relance pour votre organisation."
          control={<ToggleControl checked={abandoned} onChange={setAbandoned} />}
        />
      </SettingCard>

      <SettingCard title="Crédit fidélité" description="« Book Direct & Save » : récompensez la réservation en direct par du crédit réutilisable.">
        <SettingRow
          label="Crédit gagné par séjour direct (%)"
          helper="Crédité APRÈS le séjour (check-out passé), réutilisable lors d'une prochaine réservation. 0 = programme désactivé."
          control={<NumberControl value={loyalty} onChange={(v) => setLoyalty(v)} min={0} max={100} />}
        />
      </SettingCard>

      <SettingCard title="Parrainage" description="Récompensez le bouche-à-oreille : parrain et filleul crédités quand le filleul réserve.">
        <SettingRow
          label="Crédit par parrainage réussi (€)"
          helper="Montant crédité À CHAQUE côté (parrain et filleul) lorsque le filleul termine son 1er séjour direct. 0 = programme désactivé."
          control={<NumberControl value={referralEuros} onChange={(v) => setReferralEuros(v)} min={0} max={500} />}
        />
      </SettingCard>

      <SettingCard title="Impact" description="Mesures cumulées sur votre organisation.">
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-3 py-[9px]">
          <StatTile icon={Users} label="Contacts captés" value={loaded.contactsCaptured} />
          <StatTile icon={ShoppingCart} label="Paniers relancés" value={loaded.cartsRecovered} />
        </div>
      </SettingCard>
    </SettingsPage>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--field)]">
      <div className="w-[38px] h-[38px] shrink-0 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon size={19} strokeWidth={1.9} />
      </div>
      <div>
        <div className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-[family-name:var(--fw-bold)] text-[var(--ink)] tabular-nums leading-[1.1]">{value}</div>
        <div className="text-[var(--text-sm)] text-[var(--muted)]">{label}</div>
      </div>
    </div>
  );
}
