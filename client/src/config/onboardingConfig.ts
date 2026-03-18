/**
 * Onboarding step definitions per user role.
 * Each role has a sequential list of steps the user should complete.
 */

export interface OnboardingStepConfig {
  key: string;
  labelKey: string;        // i18n key for step label
  descriptionKey: string;  // i18n key for step description
  navigationPath: string;  // where to navigate when user clicks "Go"
  /** If true, step opens a modal instead of navigating (e.g. iCal import) */
  isModal?: boolean;
}

export const ONBOARDING_STEPS: Record<string, OnboardingStepConfig[]> = {
  SUPER_ADMIN: [
    {
      key: 'configure_org',
      labelKey: 'onboarding.steps.configureOrg.label',
      descriptionKey: 'onboarding.steps.configureOrg.description',
      navigationPath: '/settings',
    },
    {
      key: 'invite_members',
      labelKey: 'onboarding.steps.inviteMembers.label',
      descriptionKey: 'onboarding.steps.inviteMembers.description',
      navigationPath: '/settings?tab=users',
    },
    {
      key: 'setup_settings',
      labelKey: 'onboarding.steps.setupSettings.label',
      descriptionKey: 'onboarding.steps.setupSettings.description',
      navigationPath: '/settings',
    },
  ],

  SUPER_MANAGER: [
    {
      key: 'configure_org',
      labelKey: 'onboarding.steps.configureOrg.label',
      descriptionKey: 'onboarding.steps.configureOrg.description',
      navigationPath: '/settings',
    },
    {
      key: 'invite_members',
      labelKey: 'onboarding.steps.inviteMembers.label',
      descriptionKey: 'onboarding.steps.inviteMembers.description',
      navigationPath: '/settings?tab=users',
    },
    {
      key: 'setup_settings',
      labelKey: 'onboarding.steps.setupSettings.label',
      descriptionKey: 'onboarding.steps.setupSettings.description',
      navigationPath: '/settings',
    },
  ],

  HOST: [
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
      key: 'configure_billing',
      labelKey: 'onboarding.steps.configureBilling.label',
      descriptionKey: 'onboarding.steps.configureBilling.description',
      navigationPath: '/settings?tab=4',
    },
  ],

  HOUSEKEEPER: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=profile',
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
    },
  ],

  TECHNICIAN: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=profile',
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
    },
  ],

  SUPERVISOR: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=profile',
    },
    {
      key: 'create_team',
      labelKey: 'onboarding.steps.createTeam.label',
      descriptionKey: 'onboarding.steps.createTeam.description',
      navigationPath: '/teams/new',
    },
  ],

  LAUNDRY: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=profile',
    },
    {
      key: 'view_interventions',
      labelKey: 'onboarding.steps.viewInterventions.label',
      descriptionKey: 'onboarding.steps.viewInterventions.description',
      navigationPath: '/interventions',
    },
  ],

  EXTERIOR_TECH: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=profile',
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
