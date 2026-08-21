import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent, Spinner } from '../../components/ui';
import { Person, Notifications as NotificationsIcon, Save, AccountBalance, Description, Room } from '../../icons';
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
import ProviderTermsCard from './ProviderTermsCard';
import ProviderDocumentsCard from './ProviderDocumentsCard';
import MyCoverageZoneCard from './MyCoverageZoneCard';
import MyCompanyCard from './MyCompanyCard';
import { CLEANING_ROLES, FIELD_ROLES } from '../../utils/fieldRoles';

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
  // Profils de terrain : conditions, justificatifs et zone d'intervention les
  // concernent tous. Ils vivaient dans /settings, hors de leur portee.
  const isFieldWorker = hasAnyRole([...FIELD_ROLES]);
  /**
   * Seul le circuit MENAGE genere des versements automatiques :
   * `HousekeeperPayoutService` sort immediatement sur un type maintenance. Un
   * technicien se voyait donc proposer de configurer un compte Stripe qui ne
   * recevrait jamais rien.
   */
  const hasPayouts = hasAnyRole([...CLEANING_ROLES]);
  const notifRef = useRef<NotificationPreferencesHandle>(null);
  const { completeStep } = useOnboarding();
  // Le bouton d'enregistrement vit dans l'en-tete, mais son etat appartient a la
  // carte : ce compteur force le re-rendu quand la carte signale un changement.
  const [, forceUpdate] = useState(0);

  // Un onglet unique « Mon activite » empilait cinq cartes sans lien entre
  // elles : conditions, justificatifs, zone, compte de versement, historique.
  // Chacune se remplit a un moment different et pour une raison differente —
  // elles meritent leur propre onglet.
  const tabs = [
    {
      key: 'profile',
      label: t('account.tabs.profile', 'Profil'),
      icon: <Person />,
      subtitle: t('account.subtitles.profile', 'Votre identité et la sécurité de votre compte.'),
    },
    {
      key: 'notifications',
      label: t('account.tabs.notifications', 'Notifications'),
      icon: <NotificationsIcon />,
      subtitle: t('account.subtitles.notifications', 'Ce dont vous voulez être averti, et par quel canal.'),
    },
    ...(isFieldWorker
      ? [
        {
          key: 'documents',
          label: t('account.tabs.documents', 'Documents'),
          icon: <Description />,
          subtitle: t('account.subtitles.documents',
            'Vos conditions de prestation et les justificatifs que votre conciergerie doit conserver.'),
        },
        {
          key: 'coverage',
          label: t('account.tabs.coverage', "Zone d'intervention"),
          icon: <Room />,
          subtitle: t('account.subtitles.coverage',
            'Les secteurs où vous vous déplacez — ils décident des missions qui vous sont proposées.'),
        },
      ]
      : []),
    ...(hasPayouts
      ? [
        {
          key: 'payouts',
          label: t('account.tabs.payouts', 'Versements'),
          icon: <AccountBalance />,
          subtitle: t('account.subtitles.payouts',
            'Le compte qui reçoit votre rémunération, et l’historique de ce qui vous a été versé.'),
        },
      ]
      : []),
  ].map((tab, index) => ({ ...tab, value: index }));

  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const activeTabMeta = tabs.find((tab) => tab.value === activeTab);
  const activeKey = activeTabMeta?.key;

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
          title={activeTabMeta?.label ?? t('account.title', 'Mon compte')}
          subtitle={activeTabMeta?.subtitle}
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

            {/* Raison sociale et logo : uniquement pour ceux qui facturent des
                missions — ils ressortent sur leurs devis et factures. */}
            {isFieldWorker && <MyCompanyCard />}

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
        {activeKey === 'documents' && (
          <div className="flex flex-col gap-3">
            {/* Les conditions viennent EN TETE : sans elles, ni la commission
                retenue ni le versement ne sont opposables. Les justificatifs
                suivent — on ne confie pas de mission a quelqu'un dont on n'a
                pas les pieces. */}
            <ProviderTermsCard onAccepted={() => completeStep('accept_provider_terms')} />
            <ProviderDocumentsCard onFileComplete={() => completeStep('upload_provider_documents')} />
          </div>
        )}
        {activeKey === 'coverage' && (
          // La zone rend l'intervenant trouvable par l'affectation automatique.
          // C'est le seul reglage qui decide s'il recoit du travail : il ne se
          // range pas au milieu de pieces administratives.
          <MyCoverageZoneCard onSaved={() => completeStep('setup_coverage_zone')} />
        )}
        {activeKey === 'payouts' && <MyProPayoutsSettings />}
        {/* Tarifs et disponibilites ont leurs propres ecrans (sidebar) : on les
            ajuste souvent, alors que tout ce qui vit ici se remplit une fois. */}
      </div>

      {/* Enregistrement des notifications, porte dans l'en-tete comme sur
          l'ecran Parametres — meme carte, meme geste. */}
      {activeKey === 'notifications' && actionsContainer && createPortal(
        <Button
          variant="secondary"
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
