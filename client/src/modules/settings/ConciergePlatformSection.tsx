import React from 'react';
import { NativeSelect, NativeSelectOption, Spinner } from '../../components/ui';
import { Bot, PenLine, Send, Gem } from 'lucide-react';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';
import { usePlatformSettings, useSetConciergeSettings } from '../../hooks/usePlatformSettings';

const FORFAITS = ['essentiel', 'confort', 'premium'] as const;
const FORFAIT_LABELS: Record<string, string> = {
  essentiel: 'Essentiel',
  confort: 'Confort',
  premium: 'Premium',
};

/**
 * Masters plateforme du concierge IA (SUPER_ADMIN / SUPER_MANAGER).
 *
 * Pilotés en base (`platform_settings`) : pris en compte à chaud au prochain message
 * guest entrant, sans redéploiement du serveur. Le comportement par organisation reste
 * gouverné par le module « Communication » de chaque org (activation + autonomie).
 */
const ConciergePlatformSection: React.FC = () => {
  const { data: settings, isLoading } = usePlatformSettings();
  const setConcierge = useSetConciergeSettings();

  const draftEnabled = settings?.conciergeDraftEnabled ?? false;
  const autosendEnabled = settings?.conciergeAutosendEnabled ?? false;
  const minForfait = settings?.conciergeAutosendMinForfait ?? 'premium';

  const save = (partial: Partial<{ draftEnabled: boolean; autosendEnabled: boolean; minForfait: string }>) => {
    setConcierge.mutate({
      draftEnabled: partial.draftEnabled ?? draftEnabled,
      autosendEnabled: partial.autosendEnabled ?? autosendEnabled,
      minForfait: partial.minForfait ?? minForfait,
    });
  };

  return (
    <SettingsSection
      title="Concierge IA"
      icon={Bot}
      accent="primary"
      description="Activation globale du concierge guest — appliquée à chaud, sans redéploiement. Chaque organisation garde la main via son module « Communication » (activation + niveau d'autonomie)."
    >
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-5" />
        </div>
      ) : (
        <>
          <SettingsToggleRow
            icon={PenLine}
            title="Brouillons de réponse"
            description="À chaque message guest entrant, le concierge prépare un brouillon de réponse à valider par l'opérateur (aucun envoi automatique)."
            checked={draftEnabled}
            onChange={(c) => save({ draftEnabled: c, ...(c ? {} : { autosendEnabled: false }) })}
            disabled={setConcierge.isPending}
          />
          <SettingsToggleRow
            icon={Send}
            title="Auto-envoi des réponses"
            description="Ouvre l'auto-envoi au niveau plateforme. Un org n'auto-envoie que si son autonomie « Communication » est ≥ Notifie, sur une intention FAQ sûre, et si son palier atteint le seuil ci-dessous."
            checked={autosendEnabled}
            onChange={(c) => save({ autosendEnabled: c })}
            disabled={setConcierge.isPending || !draftEnabled}
          />
          <SettingsToggleRow
            icon={Gem}
            title="Palier minimal pour l'auto-envoi"
            description="Forfait minimal requis pour qu'un org bénéficie de l'auto-envoi concierge."
            divider={false}
            control={
              // Le libelle de la rangee (« Palier minimal… ») nomme la saisie :
              // le select le reprend en aria-label, faute d'etiquette propre.
              <NativeSelect
                size="sm"
                aria-label="Palier minimal pour l'auto-envoi"
                className="min-w-[130px]"
                value={FORFAITS.includes(minForfait as (typeof FORFAITS)[number]) ? minForfait : 'premium'}
                onChange={(e) => save({ minForfait: e.target.value })}
                disabled={setConcierge.isPending || !autosendEnabled}
              >
                {FORFAITS.map((f) => (
                  <NativeSelectOption key={f} value={f}>
                    {FORFAIT_LABELS[f]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            }
          />
          {settings?.updatedBy && (
            <p className="mt-1.5 text-2xs text-muted-foreground">
              Dernière modification par {settings.updatedBy}.
            </p>
          )}
        </>
      )}
    </SettingsSection>
  );
};

export default ConciergePlatformSection;
