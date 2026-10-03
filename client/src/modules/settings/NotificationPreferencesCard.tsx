import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { OPERATIONAL_ROLES } from '../../constants/roles';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import SettingsSection from './components/SettingsSection';
import {
  Notifications,
  Build,
  Description,
  Payment,
  CalendarMonth,
  Groups,
  Business,
  Person,
  Shield,
  Home,
  Email,
  AutoAwesome,
} from '../../icons';
import { notificationPreferencesApi, type NotificationPreferencesMap } from '../../services/api/notificationPreferencesApi';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Constantes: groupement des cles par categorie ────────────────────────────

interface NotificationKeyInfo {
  /** Identifiant backend ; les libelles vivent dans `notifPrefs.<key>.*`. */
  key: string;
}

interface CategoryGroup {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
  keys: NotificationKeyInfo[];
}

/**
 * Ce qu'un INTERVENANT (menage, maintenance, blanchisserie, exterieurs) a besoin
 * de regler.
 *
 * Les 86 types de notification etaient servis a l'identique a tous les roles :
 * une gouvernante se voyait proposer ses alertes RGPD, permissions,
 * portefeuilles, paiements et assistant. Neuf categories entieres ne la
 * concernent pas, et dans « Interventions » la moitie des evenements relevent du
 * pilotage (creee, progression, validee, en attente de paiement, supprimee…),
 * pas de l'execution.
 *
 * On FILTRE l'affichage, on ne touche pas aux preferences stockees : celles des
 * types masques gardent leur valeur, elles cessent seulement d'encombrer un
 * ecran qu'on consulte sur un telephone.
 *
 * `null` = toute la categorie ; une liste = ces types-la seulement.
 */
const FIELD_ROLE_ALLOWLIST: Record<string, string[] | null> = {
  intervention: [
    'INTERVENTION_ASSIGNED_TO_USER',
    'INTERVENTION_ASSIGNED_TO_TEAM',
    'INTERVENTION_REMINDER',
    'INTERVENTION_OVERDUE',
    'INTERVENTION_CANCELLED',
    'INTERVENTION_REOPENED',
  ],
  service_request: ['SERVICE_REQUEST_ASSIGNED', 'SERVICE_REQUEST_URGENT'],
  team: null,
  contact: null,
};

/**
 * Roles dont le quotidien est l'execution sur le terrain. Repris de
 * `OPERATIONAL_ROLES` MOINS le superviseur : lui pilote des equipes, il a besoin
 * des evenements de suivi que l'executant n'a pas a lire.
 */
const FIELD_ROLES = OPERATIONAL_ROLES.filter((role) => role !== 'SUPERVISOR');

const CATEGORIES: CategoryGroup[] = [
  {
    id: 'intervention',
    labelKey: 'notifPrefs.groups.intervention',
    icon: <Build size={16} strokeWidth={1.75} />,
    color: 'var(--bui-primary)',
    keys: [
      { key: 'INTERVENTION_CREATED' },
      { key: 'INTERVENTION_UPDATED' },
      { key: 'INTERVENTION_ASSIGNED_TO_USER' },
      { key: 'INTERVENTION_ASSIGNED_TO_TEAM' },
      { key: 'INTERVENTION_STARTED' },
      { key: 'INTERVENTION_PROGRESS_UPDATED' },
      { key: 'INTERVENTION_COMPLETED' },
      { key: 'INTERVENTION_REOPENED' },
      { key: 'INTERVENTION_STATUS_CHANGED' },
      { key: 'INTERVENTION_VALIDATED' },
      { key: 'INTERVENTION_AWAITING_VALIDATION' },
      { key: 'INTERVENTION_AWAITING_PAYMENT' },
      { key: 'INTERVENTION_CANCELLED' },
      { key: 'INTERVENTION_DELETED' },
      { key: 'INTERVENTION_PHOTOS_ADDED' },
      { key: 'INTERVENTION_NOTES_UPDATED' },
      { key: 'INTERVENTION_OVERDUE' },
      { key: 'INTERVENTION_REMINDER' },
    ],
  },
  {
    id: 'service_request',
    labelKey: 'notifPrefs.groups.service_request',
    icon: <Description size={16} strokeWidth={1.75} />,
    color: 'var(--bui-info)',
    keys: [
      { key: 'SERVICE_REQUEST_CREATED' },
      { key: 'SERVICE_REQUEST_UPDATED' },
      { key: 'SERVICE_REQUEST_APPROVED' },
      { key: 'SERVICE_REQUEST_REJECTED' },
      { key: 'SERVICE_REQUEST_INTERVENTION_CREATED' },
      { key: 'SERVICE_REQUEST_ASSIGNED' },
      { key: 'SERVICE_REQUEST_CANCELLED' },
      { key: 'SERVICE_REQUEST_URGENT' },
      { key: 'ISSUE_REPORTED' },
      { key: 'ISSUE_CONVERTED' },
    ],
  },
  {
    id: 'payment',
    labelKey: 'notifPrefs.groups.payment',
    icon: <Payment size={16} strokeWidth={1.75} />,
    color: 'var(--bui-success)',
    keys: [
      { key: 'PAYMENT_SESSION_CREATED' },
      { key: 'PAYMENT_CONFIRMED' },
      { key: 'PAYMENT_FAILED' },
      { key: 'PAYMENT_GROUPED_SESSION_CREATED' },
      { key: 'PAYMENT_GROUPED_CONFIRMED' },
      { key: 'PAYMENT_GROUPED_FAILED' },
      { key: 'PAYMENT_DEFERRED_REMINDER' },
      { key: 'PAYMENT_DEFERRED_OVERDUE' },
      { key: 'PAYMENT_REFUND_INITIATED' },
      { key: 'PAYMENT_REFUND_COMPLETED' },
      { key: 'PAYOUT_SENT' },
      { key: 'PAYOUT_FAILED' },
      { key: 'PAYOUT_BLOCKED_ONBOARDING' },
    ],
  },
  {
    id: 'team',
    labelKey: 'notifPrefs.groups.team',
    icon: <Groups size={16} strokeWidth={1.75} />,
    color: 'var(--bui-warning)',
    keys: [
      { key: 'TEAM_CREATED' },
      { key: 'TEAM_UPDATED' },
      { key: 'TEAM_DELETED' },
      { key: 'TEAM_MEMBER_ADDED' },
      { key: 'TEAM_MEMBER_REMOVED' },
      { key: 'TEAM_ASSIGNED_INTERVENTION' },
      { key: 'TEAM_ROLE_CHANGED' },
      { key: 'TEAM_MEMBER_JOINED' },
    ],
  },
  {
    id: 'ical',
    labelKey: 'notifPrefs.groups.ical',
    icon: <CalendarMonth size={16} strokeWidth={1.75} />,
    color: 'var(--bui-info)',
    keys: [
      { key: 'ICAL_IMPORT_SUCCESS' },
      { key: 'ICAL_IMPORT_PARTIAL' },
      { key: 'ICAL_IMPORT_FAILED' },
      { key: 'ICAL_SYNC_COMPLETED' },
      { key: 'ICAL_FEED_DELETED' },
      { key: 'ICAL_AUTO_INTERVENTIONS_TOGGLED' },
    ],
  },
  {
    id: 'portfolio',
    labelKey: 'notifPrefs.groups.portfolio',
    icon: <Business size={16} strokeWidth={1.75} />,
    color: 'var(--bui-muted-foreground)',
    keys: [
      { key: 'PORTFOLIO_CREATED' },
      { key: 'PORTFOLIO_CLIENT_ADDED' },
      { key: 'PORTFOLIO_CLIENT_REMOVED' },
      { key: 'PORTFOLIO_TEAM_MEMBER_ADDED' },
      { key: 'PORTFOLIO_TEAM_MEMBER_REMOVED' },
      { key: 'PORTFOLIO_UPDATED' },
    ],
  },
  {
    id: 'user',
    labelKey: 'notifPrefs.groups.user',
    icon: <Person size={16} strokeWidth={1.75} />,
    color: 'var(--bui-destructive)',
    keys: [
      { key: 'USER_CREATED' },
      { key: 'USER_UPDATED' },
      { key: 'USER_DELETED' },
      { key: 'USER_ROLE_CHANGED' },
      { key: 'USER_DEACTIVATED' },
    ],
  },
  {
    id: 'gdpr',
    labelKey: 'notifPrefs.groups.gdpr',
    icon: <Shield size={16} strokeWidth={1.75} />,
    color: 'var(--bui-primary)',
    keys: [
      { key: 'GDPR_DATA_EXPORTED' },
      { key: 'GDPR_USER_ANONYMIZED' },
      { key: 'GDPR_CONSENTS_UPDATED' },
    ],
  },
  {
    id: 'permission',
    labelKey: 'notifPrefs.groups.permission',
    icon: <Shield size={16} strokeWidth={1.75} />,
    color: 'var(--bui-info)',
    keys: [
      { key: 'PERMISSION_ROLE_UPDATED' },
      { key: 'PERMISSION_CACHE_INVALIDATED' },
    ],
  },
  {
    id: 'property',
    labelKey: 'notifPrefs.groups.property',
    icon: <Home size={16} strokeWidth={1.75} />,
    color: 'var(--bui-success)',
    keys: [
      { key: 'PROPERTY_CREATED' },
      { key: 'PROPERTY_UPDATED' },
      { key: 'PROPERTY_DELETED' },
      { key: 'PROPERTY_STATUS_CHANGED' },
    ],
  },
  {
    id: 'contact',
    labelKey: 'notifPrefs.groups.contact',
    icon: <Email size={16} strokeWidth={1.75} />,
    color: 'var(--bui-info)',
    keys: [
      { key: 'CONTACT_MESSAGE_RECEIVED' },
      { key: 'CONTACT_MESSAGE_SENT' },
      { key: 'CONTACT_MESSAGE_REPLIED' },
      { key: 'CONTACT_MESSAGE_ARCHIVED' },
      { key: 'CONTACT_FORM_RECEIVED' },
      { key: 'CONTACT_FORM_STATUS_CHANGED' },
    ],
  },
  {
    id: 'document',
    labelKey: 'notifPrefs.groups.document',
    icon: <Description size={16} strokeWidth={1.75} />,
    color: 'var(--bui-warning)',
    keys: [
      { key: 'DOCUMENT_GENERATED' },
      { key: 'DOCUMENT_GENERATION_FAILED' },
      { key: 'DOCUMENT_TEMPLATE_UPLOADED' },
      { key: 'DOCUMENT_SENT_BY_EMAIL' },
    ],
  },
  {
    // Seule surface de desabonnement de la synthese hebdomadaire : les reglages
    // IA sont reserves a l'equipe plateforme, cet ecran-ci reste celui de
    // l'utilisateur. Couper l'interrupteur n'eteint pas que la notification —
    // le scheduler saute le tour, donc plus d'appel LLM ni de conversation
    // creee (cf. AssistantBriefingScheduler).
    id: 'assistant',
    labelKey: 'notifPrefs.groups.assistant',
    icon: <AutoAwesome size={16} strokeWidth={1.75} />,
    color: 'var(--bui-primary)',
    keys: [
      { key: 'BRIEFING_READY' },
    ],
  },
];

// ─── Handle exposé au parent ──────────────────────────────────────────────────

export interface NotificationPreferencesHandle {
  save: () => Promise<void>;
  hasChanges: () => boolean;
  isSaving: boolean;
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface NotificationPreferencesCardProps {
  onChangeState?: () => void;
  onSaved?: () => void;
}

const NotificationPreferencesCard = forwardRef<NotificationPreferencesHandle, NotificationPreferencesCardProps>(function NotificationPreferencesCard({ onChangeState, onSaved }, ref) {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const isFieldUser = hasAnyRole(FIELD_ROLES);

  const visibleCategories = React.useMemo(() => {
    if (!isFieldUser) return CATEGORIES;
    return CATEGORIES
      .filter((category) => category.id in FIELD_ROLE_ALLOWLIST)
      .map((category) => {
        const allowed = FIELD_ROLE_ALLOWLIST[category.id];
        return allowed === null
          ? category
          : { ...category, keys: category.keys.filter((entry) => allowed.includes(entry.key)) };
      })
      .filter((category) => category.keys.length > 0);
  }, [isFieldUser]);

  const [preferences, setPreferences] = useState<NotificationPreferencesMap>({});
  const [originalPrefs, setOriginalPrefs] = useState<NotificationPreferencesMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useNotification();

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const prefs = await notificationPreferencesApi.getAll();
      setPreferences(prefs);
      setOriginalPrefs(prefs);
    } catch {
      setError(t('notifPrefs.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Notifier le parent APRÈS que le state a été mis à jour (via useEffect)
  useEffect(() => {
    onChangeState?.();
  }, [preferences, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  // Exposer les méthodes au parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    hasChanges,
    isSaving: saving,
  }));

  const handleToggle = (key: string, enabled: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: enabled }));
  };

  const handleToggleCategory = (category: CategoryGroup, enabled: boolean) => {
    setPreferences(prev => {
      const updated = { ...prev };
      category.keys.forEach(k => {
        updated[k.key] = enabled;
      });
      return updated;
    });
  };

  const hasChanges = () => {
    return Object.keys(preferences).some(key => preferences[key] !== originalPrefs[key]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Envoyer uniquement les preferences modifiees
      const changed: NotificationPreferencesMap = {};
      Object.keys(preferences).forEach(key => {
        if (preferences[key] !== originalPrefs[key]) {
          changed[key] = preferences[key];
        }
      });

      if (Object.keys(changed).length === 0) {
        if (onSaved && !loading && !error) {
          // Explicitly confirm defaults in the guided setup; persist real preferences first.
          const updated = await notificationPreferencesApi.update(Object.fromEntries(visibleCategories.flatMap(category => category.keys.map(entry => [entry.key, preferences[entry.key] !== false]))));
          setPreferences(updated); setOriginalPrefs(updated); onSaved();
          return;
        }
        notify.success(t('notifPrefs.nothingToSave'));
        return;
      }

      const updated = await notificationPreferencesApi.update(changed);
      setPreferences(updated);
      setOriginalPrefs(updated);
      notify.success(t('notifPrefs.saved'));
      onSaved?.();
    } catch {
      notify.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryStats = (category: CategoryGroup) => {
    const total = category.keys.length;
    const enabled = category.keys.filter(k => preferences[k.key] !== false).length;
    return { total, enabled };
  };

  const sectionProps = {
    title: t('notifPrefs.sectionTitle'),
    icon: Notifications,
    accent: 'primary' as const,
    description: t('notifPrefs.sectionDescription'),
  };

  if (loading) {
    return (
      <SettingsSection {...sectionProps}>
        <div className="flex min-h-[200px] items-center justify-center">
          <Spinner className="size-8" />
        </div>
      </SettingsSection>
    );
  }

  if (error) {
    return (
      <SettingsSection {...sectionProps}>
        <UiAlert variant="warning">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </UiAlert>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection {...sectionProps}>
      {/* Categories Accordions — grille 2 colonnes */}
      {/* md MUI = 900px (breakpoints non configures) et gap: 1 = 6px (spacing 6). */}
      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[1fr_1fr] gap-1.5 items-start">
        {visibleCategories.map((category) => {
          const stats = getCategoryStats(category);
          const allEnabled = stats.enabled === stats.total;
          const noneEnabled = stats.enabled === 0;

          return (
            // Un Accordion par categorie : les panneaux MUI etaient independants
            // (aucun n'en fermait un autre) et chacun est une cellule de la grille.
            <Accordion
              key={category.id}
              type="single"
              collapsible
              className="rounded-md border border-solid border-border"
            >
              <AccordionItem value={category.id} className="border-b-0">
                {/* Le Switch ne peut PAS vivre dans le trigger : celui-ci est un
                    <button>, en imbriquer un second est invalide et le clic
                    piloterait l'accordeon. Il devient donc son frere de rangee —
                    ce qui rend aussi les stopPropagation d'origine inutiles. */}
                <div className="flex items-center">
                  <div className="flex-1 min-w-0">
                    <AccordionTrigger className="min-h-12 w-full items-center px-3">
                      <div className="flex items-center gap-1.5 w-full pe-1.5">
                        {/* La couleur de categorie vient des donnees : elle passe par style, pas par une classe. */}
                        <div className="flex [transition:color_0.2s]" style={{ color: noneEnabled ? 'var(--bui-faint)' : category.color }}>
                          {category.icon}
                        </div>
                        <p className={cn('flex-1 text-start text-xs font-semibold transition-colors duration-200', noneEnabled ? 'text-faint' : 'text-foreground')}>
                          {t(category.labelKey)}
                        </p>
                        <StatusChip
                          tone={allEnabled ? 'ok' : noneEnabled ? 'neutral' : 'warn'}
                          label={`${stats.enabled}/${stats.total}`}
                          className="text-[0.7rem]"
                        />
                      </div>
                    </AccordionTrigger>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* span : TooltipTrigger asChild pose une ref DOM, que le
                          Switch du kit (fonction, React 18) ne transmet pas. */}
                      <span className="inline-flex me-3">
                        <Switch
                          size="sm"
                          checked={!noneEnabled}
                          onCheckedChange={() => handleToggleCategory(category, noneEnabled ? true : false)}
                          className={allEnabled
                            ? 'data-checked:bg-success'
                            : 'data-checked:bg-warning'}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {allEnabled ? t('notifPrefs.disableSection') : noneEnabled ? t('notifPrefs.enableSection') : t('notifPrefs.enableAll')}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <AccordionContent
                  className={cn('px-3 pt-0 pb-1.5 [transition:opacity_0.2s]', noneEnabled && 'opacity-45')}
                >
                  <ItemGroup>
                    {category.keys.map((nKey) => (
                      <Item key={nKey.key} size="xs" className="px-1.5 py-[1.5px]">
                        <ItemContent>
                          <ItemTitle className="text-[0.82rem] font-normal">
                            {t('notifPrefs.' + nKey.key + '.title')}
                          </ItemTitle>
                          <ItemDescription className="text-[0.72rem]">
                            {t('notifPrefs.' + nKey.key + '.desc')}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <Switch
                            size="sm"
                            checked={preferences[nKey.key] !== false}
                            onCheckedChange={(checked) => handleToggle(nKey.key, checked)}
                          />
                        </ItemActions>
                      </Item>
                    ))}
                  </ItemGroup>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })}
      </div>
    </SettingsSection>
  );
});

export default NotificationPreferencesCard;
