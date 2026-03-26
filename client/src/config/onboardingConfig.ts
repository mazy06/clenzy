/**
 * Onboarding step definitions per user role.
 * Each role has a sequential list of steps the user should complete.
 *
 * Settings tab indices (for navigationPath):
 *   tab=0 → General (all roles)
 *   tab=1 → Notifications (all roles)
 *   tab=2 → Messagerie (all roles)
 *   tab=3 → HOST: "Mes reversements" | ADMIN/MANAGER: "IA"
 *   tab=4 → Fiscal (ADMIN/MANAGER only)
 *   tab=5 → Organisation (ADMIN/MANAGER only)
 *   tab=6 → Paiement (ADMIN/MANAGER only)
 *   tab=7 → Integrations (ADMIN/MANAGER only)
 *   tab=8 → Reversements (ADMIN only)
 */

export interface OnboardingStepConfig {
  key: string;
  labelKey: string;        // i18n key for step label
  descriptionKey: string;  // i18n key for step description
  navigationPath: string;  // where to navigate when user clicks "Go"
  /** If true, step opens a modal instead of navigating (e.g. iCal import) */
  isModal?: boolean;
  /** If true, user can skip this step and move to the next one */
  skippable?: boolean;
}

export const ONBOARDING_STEPS: Record<string, OnboardingStepConfig[]> = {

  // ── SUPER_ADMIN ──────────────────────────────────────────────────────
  SUPER_ADMIN: [
    {
      key: 'configure_org',
      labelKey: 'onboarding.steps.configureOrg.label',
      descriptionKey: 'onboarding.steps.configureOrg.description',
      navigationPath: '/settings?tab=5',
    },
    {
      key: 'setup_fiscal',
      labelKey: 'onboarding.steps.setupFiscal.label',
      descriptionKey: 'onboarding.steps.setupFiscal.description',
      navigationPath: '/settings?tab=4',
    },
    {
      key: 'invite_members',
      labelKey: 'onboarding.steps.inviteMembers.label',
      descriptionKey: 'onboarding.steps.inviteMembers.description',
      navigationPath: '/settings?tab=5',
      skippable: true,
    },
    {
      key: 'setup_payment',
      labelKey: 'onboarding.steps.setupPayment.label',
      descriptionKey: 'onboarding.steps.setupPayment.description',
      navigationPath: '/settings?tab=6',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'setup_messaging',
      labelKey: 'onboarding.steps.setupMessaging.label',
      descriptionKey: 'onboarding.steps.setupMessaging.description',
      navigationPath: '/settings?tab=2',
      skippable: true,
    },
    {
      key: 'setup_general',
      labelKey: 'onboarding.steps.setupGeneral.label',
      descriptionKey: 'onboarding.steps.setupGeneral.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'setup_integrations',
      labelKey: 'onboarding.steps.setupIntegrations.label',
      descriptionKey: 'onboarding.steps.setupIntegrations.description',
      navigationPath: '/settings?tab=7',
      skippable: true,
    },
  ],

  // ── SUPER_MANAGER ────────────────────────────────────────────────────
  SUPER_MANAGER: [
    {
      key: 'configure_org',
      labelKey: 'onboarding.steps.configureOrg.label',
      descriptionKey: 'onboarding.steps.configureOrg.description',
      navigationPath: '/settings?tab=5',
    },
    {
      key: 'setup_fiscal',
      labelKey: 'onboarding.steps.setupFiscal.label',
      descriptionKey: 'onboarding.steps.setupFiscal.description',
      navigationPath: '/settings?tab=4',
    },
    {
      key: 'invite_members',
      labelKey: 'onboarding.steps.inviteMembers.label',
      descriptionKey: 'onboarding.steps.inviteMembers.description',
      navigationPath: '/settings?tab=5',
      skippable: true,
    },
    {
      key: 'setup_payment',
      labelKey: 'onboarding.steps.setupPayment.label',
      descriptionKey: 'onboarding.steps.setupPayment.description',
      navigationPath: '/settings?tab=6',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'setup_messaging',
      labelKey: 'onboarding.steps.setupMessaging.label',
      descriptionKey: 'onboarding.steps.setupMessaging.description',
      navigationPath: '/settings?tab=2',
      skippable: true,
    },
    {
      key: 'setup_general',
      labelKey: 'onboarding.steps.setupGeneral.label',
      descriptionKey: 'onboarding.steps.setupGeneral.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'setup_integrations',
      labelKey: 'onboarding.steps.setupIntegrations.label',
      descriptionKey: 'onboarding.steps.setupIntegrations.description',
      navigationPath: '/settings?tab=7',
      skippable: true,
    },
  ],

  // ── HOST ──────────────────────────────────────────────────────────────
  HOST: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'create_property',
      labelKey: 'onboarding.steps.createProperty.label',
      descriptionKey: 'onboarding.steps.createProperty.description',
      navigationPath: '/properties/new',
    },
    {
      key: 'configure_details',
      labelKey: 'onboarding.steps.configureDetails.label',
      descriptionKey: 'onboarding.steps.configureDetails.description',
      navigationPath: '/properties?tab=0',
    },
    {
      key: 'define_pricing',
      labelKey: 'onboarding.steps.definePricing.label',
      descriptionKey: 'onboarding.steps.definePricing.description',
      navigationPath: '/properties?tab=1',
    },
    {
      key: 'connect_channels',
      labelKey: 'onboarding.steps.connectChannels.label',
      descriptionKey: 'onboarding.steps.connectChannels.description',
      navigationPath: '/channels',
      isModal: true,
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'setup_payouts',
      labelKey: 'onboarding.steps.setupPayouts.label',
      descriptionKey: 'onboarding.steps.setupPayouts.description',
      navigationPath: '/settings?tab=3',
      skippable: true,
    },
  ],

  // ── HOUSEKEEPER ──────────────────────────────────────────────────────
  HOUSEKEEPER: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
    },
  ],

  // ── TECHNICIAN ───────────────────────────────────────────────────────
  TECHNICIAN: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
    },
  ],

  // ── SUPERVISOR ───────────────────────────────────────────────────────
  SUPERVISOR: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'create_team',
      labelKey: 'onboarding.steps.createTeam.label',
      descriptionKey: 'onboarding.steps.createTeam.description',
      navigationPath: '/teams/new',
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
      skippable: true,
    },
  ],

  // ── LAUNDRY ──────────────────────────────────────────────────────────
  LAUNDRY: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
    },
  ],

  // ── EXTERIOR_TECH ────────────────────────────────────────────────────
  EXTERIOR_TECH: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=0',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=1',
      skippable: true,
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
    },
  ],
};

/** Get steps for a given role, falling back to empty array */
export function getOnboardingSteps(role: string): OnboardingStepConfig[] {
  return ONBOARDING_STEPS[role] ?? [];
}
