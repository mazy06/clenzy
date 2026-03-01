import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore, type ThemeMode, type AppLanguage } from '@/store/settingsStore';
import { Card } from '@/components/ui/Card';
import { Accordion } from '@/components/ui/Accordion';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Divider } from '@/components/ui/Divider';
import { useNotificationPreferences, useUpdateNotificationPreference, useUpdateCategoryPreferences } from '@/hooks/useNotificationPreferences';
import { useMessagingAutomation, useUpdateMessagingAutomation } from '@/hooks/useMessagingAutomation';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Notification categories config ─── */

interface CategoryConfig {
  label: string;
  icon: IoniconsName;
  keys: string[];
}

const NOTIFICATION_CATEGORIES: CategoryConfig[] = [
  {
    label: 'Interventions',
    icon: 'construct-outline',
    keys: [
      'INTERVENTION_CREATED', 'INTERVENTION_UPDATED', 'INTERVENTION_ASSIGNED_TO_USER',
      'INTERVENTION_ASSIGNED_TO_TEAM', 'INTERVENTION_STARTED', 'INTERVENTION_PROGRESS_UPDATED',
      'INTERVENTION_COMPLETED', 'INTERVENTION_REOPENED', 'INTERVENTION_STATUS_CHANGED',
      'INTERVENTION_VALIDATED', 'INTERVENTION_AWAITING_VALIDATION', 'INTERVENTION_AWAITING_PAYMENT',
      'INTERVENTION_CANCELLED', 'INTERVENTION_DELETED', 'INTERVENTION_PHOTOS_ADDED',
      'INTERVENTION_NOTES_UPDATED', 'INTERVENTION_OVERDUE', 'INTERVENTION_REMINDER',
    ],
  },
  {
    label: 'Demandes de service',
    icon: 'clipboard-outline',
    keys: [
      'SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_UPDATED', 'SERVICE_REQUEST_APPROVED',
      'SERVICE_REQUEST_REJECTED', 'SERVICE_REQUEST_INTERVENTION_CREATED',
      'SERVICE_REQUEST_ASSIGNED', 'SERVICE_REQUEST_CANCELLED', 'SERVICE_REQUEST_URGENT',
    ],
  },
  {
    label: 'Paiements',
    icon: 'card-outline',
    keys: [
      'PAYMENT_SESSION_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED',
      'PAYMENT_GROUPED_SESSION_CREATED', 'PAYMENT_GROUPED_CONFIRMED', 'PAYMENT_GROUPED_FAILED',
      'PAYMENT_DEFERRED_REMINDER', 'PAYMENT_DEFERRED_OVERDUE',
      'PAYMENT_REFUND_INITIATED', 'PAYMENT_REFUND_COMPLETED',
    ],
  },
  {
    label: 'Systeme',
    icon: 'settings-outline',
    keys: [
      'ICAL_IMPORT_SUCCESS', 'ICAL_IMPORT_PARTIAL', 'ICAL_IMPORT_FAILED',
      'ICAL_SYNC_COMPLETED', 'ICAL_FEED_DELETED', 'ICAL_AUTO_INTERVENTIONS_TOGGLED',
      'PORTFOLIO_CREATED', 'PORTFOLIO_CLIENT_ADDED', 'PORTFOLIO_CLIENT_REMOVED',
      'PORTFOLIO_TEAM_MEMBER_ADDED', 'PORTFOLIO_TEAM_MEMBER_REMOVED', 'PORTFOLIO_UPDATED',
      'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED',
      'GDPR_DATA_EXPORTED', 'GDPR_USER_ANONYMIZED', 'GDPR_CONSENTS_UPDATED',
      'PERMISSION_ROLE_UPDATED', 'PERMISSION_CACHE_INVALIDATED',
      'PROPERTY_CREATED', 'PROPERTY_UPDATED', 'PROPERTY_DELETED', 'PROPERTY_STATUS_CHANGED',
      'RECONCILIATION_COMPLETED', 'RECONCILIATION_DIVERGENCE_HIGH', 'RECONCILIATION_FAILED',
      'KPI_THRESHOLD_BREACH', 'KPI_CRITICAL_FAILURE',
    ],
  },
  {
    label: 'Equipe',
    icon: 'people-outline',
    keys: [
      'TEAM_CREATED', 'TEAM_UPDATED', 'TEAM_DELETED', 'TEAM_MEMBER_ADDED',
      'TEAM_MEMBER_REMOVED', 'TEAM_ASSIGNED_INTERVENTION', 'TEAM_ROLE_CHANGED',
      'TEAM_MEMBER_JOINED',
    ],
  },
  {
    label: 'Contact',
    icon: 'mail-outline',
    keys: [
      'CONTACT_MESSAGE_RECEIVED', 'CONTACT_MESSAGE_SENT', 'CONTACT_MESSAGE_REPLIED',
      'CONTACT_MESSAGE_ARCHIVED', 'CONTACT_FORM_RECEIVED', 'CONTACT_FORM_STATUS_CHANGED',
    ],
  },
  {
    label: 'Documents',
    icon: 'document-outline',
    keys: [
      'DOCUMENT_GENERATED', 'DOCUMENT_GENERATION_FAILED',
      'DOCUMENT_TEMPLATE_UPLOADED', 'DOCUMENT_SENT_BY_EMAIL',
    ],
  },
  {
    label: 'Messagerie voyageurs',
    icon: 'chatbubble-outline',
    keys: ['GUEST_MESSAGE_SENT', 'GUEST_MESSAGE_FAILED', 'GUEST_PRICING_PUSHED'],
  },
  {
    label: 'Alertes bruit',
    icon: 'volume-high-outline',
    keys: [
      'NOISE_ALERT_WARNING', 'NOISE_ALERT_CRITICAL',
      'NOISE_ALERT_RESOLVED', 'NOISE_ALERT_CONFIG_CHANGED',
    ],
  },
];

/** Convert NOTIFICATION_KEY_NAME to readable French label */
function keyToLabel(key: string): string {
  const labels: Record<string, string> = {
    // Interventions
    INTERVENTION_CREATED: 'Creation',
    INTERVENTION_UPDATED: 'Mise a jour',
    INTERVENTION_ASSIGNED_TO_USER: 'Assignation utilisateur',
    INTERVENTION_ASSIGNED_TO_TEAM: 'Assignation equipe',
    INTERVENTION_STARTED: 'Demarrage',
    INTERVENTION_PROGRESS_UPDATED: 'Progression',
    INTERVENTION_COMPLETED: 'Terminee',
    INTERVENTION_REOPENED: 'Reouverture',
    INTERVENTION_STATUS_CHANGED: 'Changement statut',
    INTERVENTION_VALIDATED: 'Validation',
    INTERVENTION_AWAITING_VALIDATION: 'En attente de validation',
    INTERVENTION_AWAITING_PAYMENT: 'En attente de paiement',
    INTERVENTION_CANCELLED: 'Annulation',
    INTERVENTION_DELETED: 'Suppression',
    INTERVENTION_PHOTOS_ADDED: 'Photos ajoutees',
    INTERVENTION_NOTES_UPDATED: 'Notes mises a jour',
    INTERVENTION_OVERDUE: 'En retard',
    INTERVENTION_REMINDER: 'Rappel',
    // Service requests
    SERVICE_REQUEST_CREATED: 'Creation',
    SERVICE_REQUEST_UPDATED: 'Mise a jour',
    SERVICE_REQUEST_APPROVED: 'Approuvee',
    SERVICE_REQUEST_REJECTED: 'Rejetee',
    SERVICE_REQUEST_INTERVENTION_CREATED: 'Intervention creee',
    SERVICE_REQUEST_ASSIGNED: 'Assignee',
    SERVICE_REQUEST_CANCELLED: 'Annulee',
    SERVICE_REQUEST_URGENT: 'Urgente',
    // Payments
    PAYMENT_SESSION_CREATED: 'Session creee',
    PAYMENT_CONFIRMED: 'Confirme',
    PAYMENT_FAILED: 'Echoue',
    PAYMENT_GROUPED_SESSION_CREATED: 'Session groupee creee',
    PAYMENT_GROUPED_CONFIRMED: 'Groupe confirme',
    PAYMENT_GROUPED_FAILED: 'Groupe echoue',
    PAYMENT_DEFERRED_REMINDER: 'Rappel differe',
    PAYMENT_DEFERRED_OVERDUE: 'Differe en retard',
    PAYMENT_REFUND_INITIATED: 'Remboursement initie',
    PAYMENT_REFUND_COMPLETED: 'Remboursement termine',
    // System (iCal)
    ICAL_IMPORT_SUCCESS: 'Import iCal reussi',
    ICAL_IMPORT_PARTIAL: 'Import iCal partiel',
    ICAL_IMPORT_FAILED: 'Import iCal echoue',
    ICAL_SYNC_COMPLETED: 'Sync iCal terminee',
    ICAL_FEED_DELETED: 'Flux iCal supprime',
    ICAL_AUTO_INTERVENTIONS_TOGGLED: 'Auto-interventions iCal',
    // System (Portfolio)
    PORTFOLIO_CREATED: 'Portfolio cree',
    PORTFOLIO_CLIENT_ADDED: 'Client ajoute',
    PORTFOLIO_CLIENT_REMOVED: 'Client retire',
    PORTFOLIO_TEAM_MEMBER_ADDED: 'Membre equipe ajoute',
    PORTFOLIO_TEAM_MEMBER_REMOVED: 'Membre equipe retire',
    PORTFOLIO_UPDATED: 'Portfolio mis a jour',
    // System (User)
    USER_CREATED: 'Utilisateur cree',
    USER_UPDATED: 'Utilisateur mis a jour',
    USER_DELETED: 'Utilisateur supprime',
    USER_ROLE_CHANGED: 'Role modifie',
    USER_DEACTIVATED: 'Utilisateur desactive',
    // System (GDPR)
    GDPR_DATA_EXPORTED: 'Donnees exportees',
    GDPR_USER_ANONYMIZED: 'Utilisateur anonymise',
    GDPR_CONSENTS_UPDATED: 'Consentements mis a jour',
    // System (Permission)
    PERMISSION_ROLE_UPDATED: 'Role mis a jour',
    PERMISSION_CACHE_INVALIDATED: 'Cache invalide',
    // System (Property)
    PROPERTY_CREATED: 'Propriete creee',
    PROPERTY_UPDATED: 'Propriete mise a jour',
    PROPERTY_DELETED: 'Propriete supprimee',
    PROPERTY_STATUS_CHANGED: 'Statut propriete',
    // System (Reconciliation / KPI)
    RECONCILIATION_COMPLETED: 'Reconciliation terminee',
    RECONCILIATION_DIVERGENCE_HIGH: 'Divergence elevee',
    RECONCILIATION_FAILED: 'Reconciliation echouee',
    KPI_THRESHOLD_BREACH: 'Seuil KPI depasse',
    KPI_CRITICAL_FAILURE: 'Defaillance critique',
    // Team
    TEAM_CREATED: 'Equipe creee',
    TEAM_UPDATED: 'Equipe mise a jour',
    TEAM_DELETED: 'Equipe supprimee',
    TEAM_MEMBER_ADDED: 'Membre ajoute',
    TEAM_MEMBER_REMOVED: 'Membre retire',
    TEAM_ASSIGNED_INTERVENTION: 'Intervention assignee',
    TEAM_ROLE_CHANGED: 'Role modifie',
    TEAM_MEMBER_JOINED: 'Membre rejoint',
    // Contact
    CONTACT_MESSAGE_RECEIVED: 'Message recu',
    CONTACT_MESSAGE_SENT: 'Message envoye',
    CONTACT_MESSAGE_REPLIED: 'Reponse',
    CONTACT_MESSAGE_ARCHIVED: 'Message archive',
    CONTACT_FORM_RECEIVED: 'Formulaire recu',
    CONTACT_FORM_STATUS_CHANGED: 'Statut formulaire',
    // Document
    DOCUMENT_GENERATED: 'Document genere',
    DOCUMENT_GENERATION_FAILED: 'Generation echouee',
    DOCUMENT_TEMPLATE_UPLOADED: 'Modele televerse',
    DOCUMENT_SENT_BY_EMAIL: 'Envoye par email',
    // Guest messaging
    GUEST_MESSAGE_SENT: 'Message envoye',
    GUEST_MESSAGE_FAILED: 'Envoi echoue',
    GUEST_PRICING_PUSHED: 'Prix pousse',
    // Noise alert
    NOISE_ALERT_WARNING: 'Avertissement',
    NOISE_ALERT_CRITICAL: 'Critique',
    NOISE_ALERT_RESOLVED: 'Resolu',
    NOISE_ALERT_CONFIG_CHANGED: 'Config modifiee',
  };
  return labels[key] ?? key.replace(/_/g, ' ').toLowerCase();
}

const ORG_TYPE_LABELS: Record<string, string> = {
  CONCIERGE: 'Conciergerie',
  CLEANING_COMPANY: 'Societe de menage',
  SYSTEM: 'Systeme',
};

/* ─── Tab definitions ─── */

interface TabDef {
  key: string;
  label: string;
  icon: IoniconsName;
}

const BASE_TABS: TabDef[] = [
  { key: 'general', label: 'General', icon: 'settings-outline' },
  { key: 'notifications', label: 'Notifs', icon: 'notifications-outline' },
  { key: 'messaging', label: 'Messagerie', icon: 'chatbubble-outline' },
];

const ORG_TAB: TabDef = { key: 'organisation', label: 'Organisation', icon: 'business-outline' };

/* ─── Sub-components ─── */

function OptionChip({ label, selected, onPress, theme }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: theme.SPACING.md,
        paddingVertical: 8,
        borderRadius: theme.BORDER_RADIUS.lg,
        backgroundColor: selected ? theme.colors.primary.main : pressed ? theme.colors.background.surface : `${theme.colors.primary.main}08`,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary.main : theme.colors.border.light,
      })}
    >
      <Text style={{
        ...theme.typography.caption,
        fontWeight: '600',
        color: selected ? '#fff' : theme.colors.text.primary,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function NotificationCategorySection({ category, preferences, onToggleKey, onToggleAll, theme }: {
  category: CategoryConfig;
  preferences: Record<string, boolean>;
  onToggleKey: (key: string, enabled: boolean) => void;
  onToggleAll: (keys: string[], enabled: boolean) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const allEnabled = category.keys.every((k) => preferences[k] !== false);
  const enabledCount = category.keys.filter((k) => preferences[k] !== false).length;
  const badge = `${enabledCount}/${category.keys.length}`;

  return (
    <Accordion
      title={category.label}
      iconName={category.icon}
      badge={badge}
      style={{ marginBottom: theme.SPACING.sm }}
    >
      <ToggleRow
        label={allEnabled ? 'Tout desactiver' : 'Tout activer'}
        value={allEnabled}
        onValueChange={(val) => onToggleAll(category.keys, val)}
        iconName={allEnabled ? 'checkmark-done-outline' : 'ellipse-outline'}
        iconColor={theme.colors.primary.main}
      />
      <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginVertical: 4 }} />
      {category.keys.map((key) => (
        <ToggleRow
          key={key}
          label={keyToLabel(key)}
          value={preferences[key] !== false}
          onValueChange={(val) => onToggleKey(key, val)}
        />
      ))}
    </Accordion>
  );
}

/* ─── Tab content components ─── */

function GeneralTab({ theme, configLoading, automationConfig, updateAutomation, themeMode, setThemeMode, themeModes, language, setLanguage, languages }: {
  theme: ReturnType<typeof useTheme>;
  configLoading: boolean;
  automationConfig: any;
  updateAutomation: any;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  themeModes: { value: ThemeMode; label: string }[];
  language: AppLanguage;
  setLanguage: (l: AppLanguage) => void;
  languages: { value: AppLanguage; label: string }[];
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        {configLoading ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.primary.main} />
          </View>
        ) : (
          <ToggleRow
            label="Push automatique des prix"
            description="Envoyer automatiquement les prix aux plateformes"
            value={automationConfig?.autoPushPricingEnabled ?? false}
            onValueChange={(val) => updateAutomation.mutate({ autoPushPricingEnabled: val })}
            iconName="pricetag-outline"
          />
        )}

        <Divider />

        {/* Apparence */}
        <View style={{ paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
            <View style={{
              width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.sm,
              backgroundColor: `${theme.colors.primary.main}0C`,
              alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md,
            }}>
              <Ionicons name={theme.isDark ? 'moon-outline' : 'sunny-outline'} size={18} color={theme.colors.primary.main} />
            </View>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '500' }}>
              Apparence
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, paddingLeft: 48 }}>
            {themeModes.map((m) => (
              <OptionChip
                key={m.value}
                label={m.label}
                selected={themeMode === m.value}
                onPress={() => setThemeMode(m.value)}
                theme={theme}
              />
            ))}
          </View>
        </View>

        <Divider />

        {/* Langue */}
        <View style={{ paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
            <View style={{
              width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.sm,
              backgroundColor: `${theme.colors.primary.main}0C`,
              alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md,
            }}>
              <Ionicons name="language-outline" size={18} color={theme.colors.primary.main} />
            </View>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '500' }}>
              Langue
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, paddingLeft: 48 }}>
            {languages.map((l) => (
              <OptionChip
                key={l.value}
                label={l.label}
                selected={language === l.value}
                onPress={() => setLanguage(l.value)}
                theme={theme}
              />
            ))}
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function NotificationsTab({ theme, prefsLoading, preferences, handleToggleKey, handleToggleAll }: {
  theme: ReturnType<typeof useTheme>;
  prefsLoading: boolean;
  preferences: Record<string, boolean>;
  handleToggleKey: (key: string, enabled: boolean) => void;
  handleToggleAll: (keys: string[], enabled: boolean) => void;
}) {
  if (prefsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.primary.main} />
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: theme.SPACING.sm }}>
          Chargement des preferences...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.md, paddingBottom: 120, gap: theme.SPACING.xs }}
      showsVerticalScrollIndicator={false}
    >
      {NOTIFICATION_CATEGORIES.map((cat) => (
        <NotificationCategorySection
          key={cat.label}
          category={cat}
          preferences={preferences}
          onToggleKey={handleToggleKey}
          onToggleAll={handleToggleAll}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
}

function MessagingTab({ theme, configLoading, automationConfig, updateAutomation }: {
  theme: ReturnType<typeof useTheme>;
  configLoading: boolean;
  automationConfig: any;
  updateAutomation: any;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        {configLoading ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.primary.main} />
          </View>
        ) : (
          <>
            <ToggleRow
              label="Checkin automatique"
              description="Envoyer automatiquement les instructions de checkin"
              value={automationConfig?.autoSendCheckIn ?? false}
              onValueChange={(val) => updateAutomation.mutate({ autoSendCheckIn: val })}
              iconName="log-in-outline"
            />
            <Divider />
            <ToggleRow
              label="Checkout automatique"
              description="Envoyer automatiquement les instructions de checkout"
              value={automationConfig?.autoSendCheckOut ?? false}
              onValueChange={(val) => updateAutomation.mutate({ autoSendCheckOut: val })}
              iconName="log-out-outline"
            />
          </>
        )}
      </Card>
    </ScrollView>
  );
}

function OrganisationTab({ theme, user, navigation }: {
  theme: ReturnType<typeof useTheme>;
  user: any;
  navigation: any;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        {/* Organisation name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${theme.colors.secondary.main}0C`,
            alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md,
          }}>
            <Ionicons name="business-outline" size={18} color={theme.colors.secondary.main} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              Nom
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600', marginTop: 2 }}>
              {user?.organizationName ?? '\u2014'}
            </Text>
          </View>
        </View>

        <Divider />

        {/* Organisation type */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${theme.colors.secondary.main}0C`,
            alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md,
          }}>
            <Ionicons name="briefcase-outline" size={18} color={theme.colors.secondary.main} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              Type
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600', marginTop: 2 }}>
              {ORG_TYPE_LABELS[user?.organizationType ?? ''] ?? user?.organizationType ?? '\u2014'}
            </Text>
          </View>
        </View>

        <Divider />

        {/* Team management link */}
        <Pressable
          onPress={() => navigation.navigate('TeamManagement')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: pressed ? theme.colors.background.surface : 'transparent',
          })}
        >
          <View style={{
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${theme.colors.secondary.main}0C`,
            alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md,
          }}>
            <Ionicons name="people-outline" size={18} color={theme.colors.secondary.main} />
          </View>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '500', flex: 1 }}>
            Gestion d'equipe
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
        </Pressable>
      </Card>
    </ScrollView>
  );
}

/* ─── Main Screen ─── */

export function HostSettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  const isOrganization = user?.organizationType != null && user.organizationType !== 'INDIVIDUAL';
  const tabs = useMemo(() => isOrganization ? [...BASE_TABS, ORG_TAB] : BASE_TABS, [isOrganization]);
  const [activeTab, setActiveTab] = useState(tabs[0].key);

  // Local settings
  const themeMode = useSettingsStore((s) => s.themeMode);
  const language = useSettingsStore((s) => s.language);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  // Server settings - messaging automation
  const { data: automationConfig, isLoading: configLoading } = useMessagingAutomation();
  const updateAutomation = useUpdateMessagingAutomation();

  // Server settings - notification preferences
  const { data: notifPrefs, isLoading: prefsLoading } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();
  const updateCategoryPrefs = useUpdateCategoryPreferences();

  const preferences = useMemo(() => notifPrefs ?? {}, [notifPrefs]);

  const handleToggleKey = useCallback((key: string, enabled: boolean) => {
    updatePref.mutate({ key, enabled });
  }, [updatePref]);

  const handleToggleAll = useCallback((keys: string[], enabled: boolean) => {
    updateCategoryPrefs.mutate({ keys, enabled });
  }, [updateCategoryPrefs]);

  const themeModes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'Systeme' },
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
  ];

  const languages: { value: AppLanguage; label: string }[] = [
    { value: 'fr', label: 'Francais' },
    { value: 'en', label: 'English' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab
            theme={theme}
            configLoading={configLoading}
            automationConfig={automationConfig}
            updateAutomation={updateAutomation}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            themeModes={themeModes}
            language={language}
            setLanguage={setLanguage}
            languages={languages}
          />
        );
      case 'notifications':
        return (
          <NotificationsTab
            theme={theme}
            prefsLoading={prefsLoading}
            preferences={preferences}
            handleToggleKey={handleToggleKey}
            handleToggleAll={handleToggleAll}
          />
        );
      case 'messaging':
        return (
          <MessagingTab
            theme={theme}
            configLoading={configLoading}
            automationConfig={automationConfig}
            updateAutomation={updateAutomation}
          />
        );
      case 'organisation':
        return <OrganisationTab theme={theme} user={user} navigation={navigation} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        backgroundColor: theme.colors.background.paper,
        gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Parametres
        </Text>
      </View>

      {/* Tab bar */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.background.paper,
        paddingHorizontal: theme.SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.light,
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? theme.colors.primary.main : 'transparent',
              }}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={isActive ? theme.colors.primary.main : theme.colors.text.disabled}
                style={{ marginBottom: 2 }}
              />
              <Text style={{
                ...theme.typography.caption,
                fontSize: 11,
                fontWeight: isActive ? '700' : '500',
                color: isActive ? theme.colors.primary.main : theme.colors.text.secondary,
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {renderContent()}
    </SafeAreaView>
  );
}
