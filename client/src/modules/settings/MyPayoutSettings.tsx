import { useQueryClient } from '@tanstack/react-query';
import SetupPayout from '../../components/onboarding/SetupPayout';
import { ownerPayoutConfigKeys } from '../../hooks/useOwnerPayoutConfig';
import { useTranslation } from '../../hooks/useTranslation';
import '../../components/onboarding/setup-surfaces.css';

/** Un seul parcours PSP, partagé avec le guide et la page Mes versements. */
export default function MyPayoutSettings() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const refresh = async () => { await cache.invalidateQueries({ queryKey: ownerPayoutConfigKeys.all }); };
  return <section className="max-w-3xl rounded-xl border border-border bg-card p-4">
    <h2 className="mb-3 text-sm font-semibold">{t('accounting.psp.myAccount', 'Mon compte de versement')}</h2>
    <SetupPayout stepKey="setup_payout_account" beneficiaryScope="PERSONAL" onCheck={refresh} onSaved={refresh} />
  </section>;
}
