import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent, Spinner } from '../../components/ui';
import { Person, Notifications as NotificationsIcon, Save, AccountBalance } from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useOnboarding } from '../../hooks/useOnboarding';
import { userAvatarSrc } from '../../services/api/usersApi';
import AccountSecuritySection from '../settings/AccountSecuritySection';
import NotificationPreferencesCard, {
  type NotificationPreferencesHandle,
} from '../settings/NotificationPreferencesCard';
import MarketingPreferencesCard from '../settings/MarketingPreferencesCard';
import MyProPayoutsSettings from '../settings/MyProPayoutsSettings';
import MyRatesSettings from '../settings/MyRatesSettings';
import ProviderTermsCard from './ProviderTermsCard';

const PORTAL_STYLE = { display: 'contents' } as const;

/**
 * « Mon compte » — profil et notifications, accessibles a TOUT utilisateur
 * connecte.
 *
 * Pourquoi cet ecran existe : les reglages personnels vivaient dans
 * `/settings`, dont la route exige `settings:view` — permission absente des
 * roles operationnels. Une gouvernante ou un technicien ne pouvait donc regler
 * ni son profil ni ses notifications, et son parcours d'onboarding l'envoyait
 * droit sur un mur « Acces restreint ». `/settings` reste ce qu'il est : les
 * reglages de l'ORGANISATION, reserves aux gestionnaires.
 */
export default function MyAccountPage() {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  // Profils payes a la mission : leur compte de versement Stripe et leurs tarifs
  // vivaient dans /settings, hors de leur portee. C'est pourtant la condition
  // pour etre paye.
  const isPaidPro = hasAnyRole(['HOUSEKEEPER', 'TECHNICIAN', 'LAUNDRY', 'EXTERIOR_TECH']);
  const notifRef = useRef<NotificationPreferencesHandle>(null);
  const { completeStep } = useOnboarding();
  // Le bouton d'enregistrement vit dans l'en-tete, mais son etat appartient a la
  // carte : ce compteur force le re-rendu quand la carte signale un changement.
  const [, forceUpdate] = useState(0);

  const tabs = [
    { key: 'profile', label: t('account.tabs.profile', 'Profil'), icon: <Person /> },
    { key: 'notifications', label: t('account.tabs.notifications', 'Notifications'), icon: <NotificationsIcon /> },
    ...(isPaidPro
      ? [{ key: 'business', label: t('account.tabs.business', 'Mon activité'), icon: <AccountBalance /> }]
      : []),
  ].map((tab, index) => ({ ...tab, value: index }));

  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const activeKey = tabs[activeTab]?.key;

  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);

  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || user?.username?.[0]?.toUpperCase() || '?';

  const identity: Array<{ label: string; value?: string | null }> = [
    { label: t('account.identity.firstName', 'Prénom'), value: user?.firstName },
    { label: t('account.identity.lastName', 'Nom'), value: user?.lastName },
    { label: t('account.identity.username', "Nom d'utilisateur"), value: user?.username },
    { label: t('account.identity.email', 'Email'), value: user?.email },
  ];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={tabs.find((tab) => tab.value === activeTab)?.label ?? t('account.title', 'Mon compte')}
          subtitle={t('account.subtitle', 'Vos informations personnelles et vos préférences de notification.')}
          showBackButton={false}
          actions={<div ref={setActionsContainer} style={PORTAL_STYLE} />}
        />
      </div>
      <div className="shrink-0">
        <PageTabs options={tabs} value={activeTab} onChange={setActiveTab} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto pt-1.5">
        {activeKey === 'profile' && (
          <div className="flex flex-col gap-3">
            <Card size="sm" className="shadow-none">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarImage src={userAvatarSrc(user ?? undefined)} alt={user?.fullName || user?.username || ''} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user?.fullName || user?.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                {/* Identite en LECTURE : ces valeurs viennent de Keycloak et ne
                    se modifient pas ici. Des champs desactives inviteraient a
                    cliquer dans un formulaire qui n'accepte rien. */}
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-solid border-border bg-muted/30 px-3 py-2.5 sm:grid-cols-2">
                  {identity.map(({ label, value }) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[0.68rem] uppercase tracking-[0.04em] text-muted-foreground">{label}</dt>
                      <dd className="m-0 truncate text-[0.8125rem] text-foreground">
                        {value || <span className="text-muted-foreground">—</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <AccountSecuritySection />
          </div>
        )}

        {activeKey === 'notifications' && (
          <div className="flex flex-col gap-3">
            <NotificationPreferencesCard
              ref={notifRef}
              onChangeState={() => forceUpdate((n) => n + 1)}
            />
            <MarketingPreferencesCard />
          </div>
        )}
        {activeKey === 'business' && (
          <div className="flex flex-col gap-3">
            {/* Les conditions viennent EN TETE : sans elles, ni la commission
                retenue ni le versement ne sont opposables. */}
            <ProviderTermsCard onAccepted={() => completeStep('accept_provider_terms')} />
            <MyProPayoutsSettings />
            <MyRatesSettings />
          </div>
        )}
      </div>

      {/* Enregistrement des notifications, porte dans l'en-tete comme sur
          l'ecran Parametres — meme carte, meme geste. */}
      {activeKey === 'notifications' && actionsContainer && createPortal(
        <Button
          size="sm"
          // Enregistrer SES preferences, c'est avoir fait l'etape du guide de
          // demarrage : sans ce lien, l'etape « Notifications » restait ouverte
          // indefiniment et il fallait la « Passer » pour avancer.
          onClick={async () => {
            // Rien de modifie : on ne poste pas des preferences inchangees, mais
            // l'etape du guide compte comme faite — quelqu'un qui juge les
            // reglages par defaut bons doit pouvoir avancer, et le bouton
            // desactive l'en empechait.
            if (notifRef.current?.hasChanges()) await notifRef.current.save();
            completeStep('setup_notifications');
          }}
          disabled={notifRef.current?.isSaving}
        >
          {notifRef.current?.isSaving ? <Spinner className="size-3.5" /> : <Save size={14} strokeWidth={1.75} />}
          {t('account.savePreferences', 'Enregistrer mes préférences')}
        </Button>,
        actionsContainer,
      )}
    </div>
  );
}
