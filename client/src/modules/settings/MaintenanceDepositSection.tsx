import React, { useEffect, useState } from 'react';
import { Button, Input, Spinner } from '../../components/ui';
import { Wallet } from 'lucide-react';
import SettingsSection from './components/SettingsSection';
import {
  usePlatformSettings,
  useSetMaintenanceDepositPercent,
} from '../../hooks/usePlatformSettings';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Taux d'acompte des devis de maintenance.
 *
 * <p>Réglage de PLATEFORME, et non du prestataire : si chacun fixait le sien,
 * le propriétaire ne saurait plus à quoi s'attendre d'un devis à l'autre. Le
 * taux est figé sur chaque devis au moment de sa soumission — le modifier ici
 * n'altère aucun devis déjà émis.</p>
 */
const MaintenanceDepositSection: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { data: settings, isLoading } = usePlatformSettings();
  const save = useSetMaintenanceDepositPercent();
  const [percent, setPercent] = useState('');

  // La valeur serveur fait foi tant que l'admin n'a rien saisi.
  useEffect(() => {
    if (settings) setPercent(String(settings.maintenanceDepositPercent ?? 0));
  }, [settings]);

  const numeric = Number(percent);
  const invalid = Number.isNaN(numeric) || numeric < 0 || numeric > 100;

  const submit = () => {
    if (invalid) return;
    save.mutate(numeric, {
      onSuccess: () => notify.success(t('settings.deposit.saved', 'Taux d’acompte enregistré')),
      onError: () => notify.error(t('settings.deposit.error', 'L’enregistrement a échoué.')),
    });
  };

  return (
    <SettingsSection
      title={t('settings.deposit.title', 'Acompte de maintenance')}
      icon={Wallet}
      accent="primary"
      description={t('settings.deposit.description',
        'Part du devis exigible dès sa validation, pour les interventions de maintenance. '
        + 'Le ménage et la lingerie se règlent au travail terminé. '
        + 'Le taux est décidé par la plateforme, pas par le prestataire — et figé sur chaque devis à sa soumission.')}
    >
      {isLoading ? (
        <div className="flex justify-center py-3"><Spinner className="size-5" /></div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-faint">
              {t('settings.deposit.percent', 'Taux')}
            </span>
            <span className="flex items-center gap-1.5">
              <Input
                type="number" min={0} max={100} step="1"
                className="w-24 text-end tabular-nums"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </span>
          </label>
          <Button size="sm" disabled={invalid || save.isPending} onClick={submit}>
            {save.isPending ? <Spinner className="size-4" /> : null}
            {t('common.save', 'Enregistrer')}
          </Button>
          {numeric === 0 && !invalid && (
            <span className="text-xs text-muted-foreground">
              {t('settings.deposit.zero',
                'À zéro, aucun acompte n’est demandé : tout se règle au travail terminé.')}
            </span>
          )}
        </div>
      )}
    </SettingsSection>
  );
};

export default MaintenanceDepositSection;
