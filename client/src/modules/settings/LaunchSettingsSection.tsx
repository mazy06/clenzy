import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from '../../components/ui';
import { Button, Collapse, Divider } from '@mui/material';
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
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
};

const LaunchSettingsSection: React.FC = () => {
  const { data: settings, isLoading } = usePlatformSettings();
  const setProspectEmails = useSetProspectDevisEmails();
  const setDevisToWaitlist = useSetDevisLeadsToWaitlist();
  const setInternalEmails = useSetInternalNotificationEmails();
  const setSender = useSetSender();
  const { data: stats } = useWaitlistStats();
  const [showList, setShowList] = useState(false);
  const { data: list } = useWaitlistList(showList);

  const founderSpots = stats?.founderSpots ?? 20;

  return (
    <SettingsSection title="Pré-lancement" icon={Rocket} accent="primary">
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-5" />
        </div>
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
          {/* key = valeur serveur : remount (etat frais) quand le backend renvoie
              une nouvelle valeur — remplace les anciens effets de resync miroir. */}
          <InternalNotificationEmailsRow
            key={(settings?.internalNotificationEmails ?? ['info@clenzy.fr']).join('|')}
            value={settings?.internalNotificationEmails ?? ['info@clenzy.fr']}
            onSave={(emails) => setInternalEmails.mutate(emails)}
            saving={setInternalEmails.isPending}
          />
          <SenderEmailRow
            key={`${settings?.senderEmail ?? 'info@clenzy.fr'}|${settings?.senderName ?? 'Baitly'}`}
            email={settings?.senderEmail ?? 'info@clenzy.fr'}
            name={settings?.senderName ?? 'Baitly'}
            onSave={(email, name) => setSender.mutate({ email, name })}
            saving={setSender.isPending}
          />
        </>
      )}

      {/* Liste d'attente de lancement */}
      <div className="flex items-center justify-between gap-2 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-muted-foreground inline-flex shrink-0"><Users size={18} /></div>
          <div className="min-w-0">
            <p className="cn-text-body1 text-[0.8125rem] font-medium text-foreground">
              Liste d'attente de lancement
            </p>
            <p className="cn-text-body1 text-[0.75rem] text-muted-foreground tabular-nums">
              {stats ? (
                <>
                  {stats.total} inscrit{stats.total > 1 ? 's' : ''}
                  {' · '}
                  {stats.founderSpotsLeft > 0
                    ? `${stats.founderSpotsLeft} / ${founderSpots} place${founderSpots > 1 ? 's' : ''} fondateur restante${stats.founderSpotsLeft > 1 ? 's' : ''}`
                    : 'Places fondateur complètes'}
                </>
              ) : '—'}
            </p>
          </div>
        </div>
        <Button
          size="small"
          variant="text"
          onClick={() => setShowList((v) => !v)}
          endIcon={showList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          sx={{ textTransform: 'none', fontSize: '0.75rem', flexShrink: 0 }}
        >
          {showList ? 'Masquer' : 'Voir les inscrits'}
        </Button>
      </div>

      <Collapse in={showList} unmountOnExit>
        <Divider sx={{ mb: 1 }} />
        <div className="max-h-[320px] overflow-y-auto">
          {(list ?? []).length === 0 ? (
            <p className="cn-text-body1 text-[0.78rem] text-muted-foreground text-center py-3">
              Aucun inscrit pour le moment.
            </p>
          ) : (
            (list ?? []).map((w, i) => (
              // gap: 1 = 6px et py: 0.75 = 4.5px (theme.spacing vaut 6 dans ce projet).
              <div
                key={w.id}
                className="flex items-center gap-1.5 py-[4.5px] border-b border-solid border-[var(--line)] last-of-type:border-b-0"
              >
                <p className={cn('cn-text-body1 text-[0.7rem] font-semibold w-[30px] shrink-0 tabular-nums', i < founderSpots ? 'text-[var(--mui-primary)]' : 'text-[var(--faint)]')}>
                  #{i + 1}
                </p>
                <div className="min-w-0 flex-1">
                  <p className="cn-text-body1 text-[0.78rem] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                    {w.fullName || w.email}
                  </p>
                  <p className="cn-text-body1 text-[0.68rem] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                    {w.email}{w.city ? ` · ${w.city}` : ''}
                  </p>
                </div>
                <p className="cn-text-body1 text-[0.66rem] text-muted-foreground opacity-60 shrink-0 tabular-nums">
                  {fmtDate(w.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </Collapse>
    </SettingsSection>
  );
};

export default LaunchSettingsSection;
