import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import {
  Spinner,
  Button,
  Collapsible,
  CollapsibleContent,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Separator,
} from '../../components/ui';
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
      <SettingsToggleRow
        icon={Users}
        iconColor="var(--bui-muted-foreground)"
        title="Liste d'attente de lancement"
        description={(
          <span className="tabular-nums">
            {stats ? (
              <>
                {stats.total} inscrit{stats.total > 1 ? 's' : ''}
                {' · '}
                {stats.founderSpotsLeft > 0
                  ? `${stats.founderSpotsLeft} / ${founderSpots} place${founderSpots > 1 ? 's' : ''} fondateur restante${stats.founderSpotsLeft > 1 ? 's' : ''}`
                  : 'Places fondateur complètes'}
              </>
            ) : '—'}
          </span>
        )}
        divider={false}
        control={(
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setShowList((v) => !v)}>
            {showList ? 'Masquer' : 'Voir les inscrits'}
            {showList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </Button>
        )}
      />

      <Collapsible open={showList}>
        <CollapsibleContent>
        <Separator className="mb-1.5" />
        <div className="max-h-[320px] overflow-y-auto">
          {(list ?? []).length === 0 ? (
            <p className="py-3 text-center text-[0.78rem] text-muted-foreground">
              Aucun inscrit pour le moment.
            </p>
          ) : (
            <ItemGroup>
              {(list ?? []).map((w, i) => (
                // Les places « fondateur » (rang < founderSpots) se disent par
                // l'encre du rang, pas par un liseré lateral.
                <Item
                  key={w.id}
                  size="xs"
                  className="gap-1.5 rounded-none border-x-0 border-t-0 border-b border-border px-0 py-[4.5px] last-of-type:border-b-0"
                >
                  <ItemMedia className="w-[30px] justify-start">
                    <span className={cn('text-2xs font-semibold tabular-nums', i < founderSpots ? 'text-primary' : 'text-faint')}>
                      #{i + 1}
                    </span>
                  </ItemMedia>
                  <ItemContent className="min-w-0 gap-0">
                    <ItemTitle className="w-full text-[0.78rem] font-normal text-foreground">
                      {w.fullName || w.email}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1 w-full text-2xs text-muted-foreground">
                      {w.email}{w.city ? ` · ${w.city}` : ''}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="shrink-0">
                    <span className="text-2xs text-muted-foreground tabular-nums">
                      {fmtDate(w.createdAt)}
                    </span>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>
        </CollapsibleContent>
      </Collapsible>
    </SettingsSection>
  );
};

export default LaunchSettingsSection;
