import React from 'react';
import { Box, CircularProgress, MenuItem, Select, Typography } from '@mui/material';
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
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
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
              <Select
                size="small"
                value={FORFAITS.includes(minForfait as (typeof FORFAITS)[number]) ? minForfait : 'premium'}
                onChange={(e) => save({ minForfait: e.target.value })}
                disabled={setConcierge.isPending || !autosendEnabled}
                sx={{ minWidth: 130, fontSize: '0.8125rem' }}
              >
                {FORFAITS.map((f) => (
                  <MenuItem key={f} value={f} sx={{ fontSize: '0.8125rem' }}>
                    {FORFAIT_LABELS[f]}
                  </MenuItem>
                ))}
              </Select>
            }
          />
          {settings?.updatedBy && (
            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 1 }}>
              Dernière modification par {settings.updatedBy}.
            </Typography>
          )}
        </>
      )}
    </SettingsSection>
  );
};

export default ConciergePlatformSection;
