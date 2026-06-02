import React, { useState } from 'react';
import { Box, Typography, CircularProgress, Button, Collapse, Divider } from '@mui/material';
import { Mail, Rocket, Users, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';
import { usePlatformSettings, useSetProspectDevisEmails, useSetDevisLeadsToWaitlist, useSetInternalNotificationEmails, useSetSender } from '../../hooks/usePlatformSettings';
import { useWaitlistStats, useWaitlistList } from '../../hooks/useWaitlist';
import InternalNotificationEmailsRow from './components/InternalNotificationEmailsRow';
import SenderEmailRow from './components/SenderEmailRow';

/**
 * Réglages de pré-lancement (SUPER_ADMIN / SUPER_MANAGER) :
 *  - toggle d'envoi des emails de devis aux prospects,
 *  - suivi de la liste d'attente (total + places fondateur + liste des inscrits).
 */
const LaunchSettingsSection: React.FC = () => {
  const { data: settings, isLoading } = usePlatformSettings();
  const setProspectEmails = useSetProspectDevisEmails();
  const setDevisToWaitlist = useSetDevisLeadsToWaitlist();
  const setInternalEmails = useSetInternalNotificationEmails();
  const setSender = useSetSender();
  const { data: stats } = useWaitlistStats();
  const [showList, setShowList] = useState(false);
  const { data: list } = useWaitlistList(showList);

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return d; }
  };

  const founderSpots = stats?.founderSpots ?? 20;

  return (
    <SettingsSection title="Pré-lancement" icon={Rocket} accent="primary">
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <>
          <SettingsToggleRow
            icon={Mail}
            title="Emails de devis aux prospects"
            description="Quand c'est désactivé, aucun email ni devis n'est envoyé aux prospects depuis la landing (utile tant que le PMS n'est pas public). info@ reste notifié dans tous les cas."
            checked={settings?.sendProspectDevisEmails ?? true}
            onChange={(c) => setProspectEmails.mutate(c)}
            disabled={setProspectEmails.isPending}
          />
          <SettingsToggleRow
            icon={UserPlus}
            title="Ajouter les demandes de devis à la waitlist"
            description="Pendant le pré-lancement, chaque demande de devis depuis la landing inscrit aussi l'email à la liste d'attente de lancement."
            checked={settings?.addDevisLeadsToWaitlist ?? true}
            onChange={(c) => setDevisToWaitlist.mutate(c)}
            disabled={setDevisToWaitlist.isPending}
          />
          <InternalNotificationEmailsRow
            value={settings?.internalNotificationEmails ?? ['info@clenzy.fr']}
            onSave={(emails) => setInternalEmails.mutate(emails)}
            saving={setInternalEmails.isPending}
          />
          <SenderEmailRow
            email={settings?.senderEmail ?? 'info@clenzy.fr'}
            name={settings?.senderName ?? 'Baitly'}
            onSave={(email, name) => setSender.mutate({ email, name })}
            saving={setSender.isPending}
          />
        </>
      )}

      {/* Liste d'attente de lancement */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, py: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box sx={{ color: 'text.secondary', display: 'inline-flex', flexShrink: 0 }}><Users size={18} /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.primary' }}>
              Liste d'attente de lancement
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {stats ? (
                <>
                  {stats.total} inscrit{stats.total > 1 ? 's' : ''}
                  {' · '}
                  {stats.founderSpotsLeft > 0
                    ? `${stats.founderSpotsLeft} / ${founderSpots} place${founderSpots > 1 ? 's' : ''} fondateur restante${stats.founderSpotsLeft > 1 ? 's' : ''}`
                    : 'Places fondateur complètes'}
                </>
              ) : '—'}
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          variant="text"
          onClick={() => setShowList((v) => !v)}
          endIcon={showList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          sx={{ textTransform: 'none', fontSize: '0.75rem', flexShrink: 0 }}
        >
          {showList ? 'Masquer' : 'Voir les inscrits'}
        </Button>
      </Box>

      <Collapse in={showList} unmountOnExit>
        <Divider sx={{ mb: 1 }} />
        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {(list ?? []).length === 0 ? (
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textAlign: 'center', py: 2 }}>
              Aucun inscrit pour le moment.
            </Typography>
          ) : (
            (list ?? []).map((w, i) => (
              <Box
                key={w.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, py: 0.75,
                  borderBottom: '1px solid', borderColor: 'divider',
                  '&:last-of-type': { borderBottom: 'none' },
                }}
              >
                <Typography sx={{
                  fontSize: '0.7rem', fontWeight: 600, width: 30, flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  color: i < founderSpots ? 'primary.main' : 'text.disabled',
                }}>
                  #{i + 1}
                </Typography>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.fullName || w.email}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.email}{w.city ? ` · ${w.city}` : ''}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.66rem', color: 'text.disabled', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDate(w.createdAt)}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Collapse>
    </SettingsSection>
  );
};

export default LaunchSettingsSection;
