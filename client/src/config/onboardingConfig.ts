/**
 * Onboarding step definitions per user role.
 * Each role has a sequential list of steps the user should complete.
 *
 * navigationPath utilise des CLES d'onglet stables (?tab=<key>), robustes au role —
 * l'index visible des onglets shifte selon les roles, jamais la cle. Cf. components/tabKeyParam.ts.
 *   Cles Settings   : general | notifications | messaging | my-payout | ai | fiscal |
 *                     organization | payment | integrations | payouts | amenities-ota
 *   Cles Properties : properties | pricing | vouchers
 */

/** Jalon interne d'une etape — informatif, il ne compte pas dans la progression. */
export interface OnboardingSubstepConfig {
  key: string;
  labelKey: string;
}

export interface OnboardingStepConfig {
  key: string;
  labelKey: string;        // i18n key for step label
  descriptionKey: string;  // i18n key for step description
  navigationPath: string;
  /** Jalons affiches sous la description quand l'etape est depliee. */
  substeps?: OnboardingSubstepConfig[];  // where to navigate when user clicks "Go"
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
      navigationPath: '/settings?tab=organization',
    },
    {
      key: 'setup_fiscal',
      labelKey: 'onboarding.steps.setupFiscal.label',
      descriptionKey: 'onboarding.steps.setupFiscal.description',
      navigationPath: '/settings?tab=fiscal',
    },
    {
      key: 'invite_members',
      labelKey: 'onboarding.steps.inviteMembers.label',
      descriptionKey: 'onboarding.steps.inviteMembers.description',
      navigationPath: '/settings?tab=organization',
      skippable: true,
    },
    {
      key: 'setup_payment',
      labelKey: 'onboarding.steps.setupPayment.label',
      descriptionKey: 'onboarding.steps.setupPayment.description',
      navigationPath: '/settings?tab=payment',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=notifications',
      skippable: true,
    },
    {
      key: 'setup_messaging',
      labelKey: 'onboarding.steps.setupMessaging.label',
      descriptionKey: 'onboarding.steps.setupMessaging.description',
      navigationPath: '/settings?tab=messaging',
      skippable: true,
    },
    {
      key: 'setup_general',
      labelKey: 'onboarding.steps.setupGeneral.label',
      descriptionKey: 'onboarding.steps.setupGeneral.description',
      navigationPath: '/settings?tab=general',
    },
    {
      key: 'setup_integrations',
      labelKey: 'onboarding.steps.setupIntegrations.label',
      descriptionKey: 'onboarding.steps.setupIntegrations.description',
      navigationPath: '/settings?tab=integrations',
      skippable: true,
    },
  ],

  // ── SUPER_MANAGER ────────────────────────────────────────────────────
  SUPER_MANAGER: [
    {
      key: 'configure_org',
      labelKey: 'onboarding.steps.configureOrg.label',
      descriptionKey: 'onboarding.steps.configureOrg.description',
      navigationPath: '/settings?tab=organization',
    },
    {
      key: 'setup_fiscal',
      labelKey: 'onboarding.steps.setupFiscal.label',
      descriptionKey: 'onboarding.steps.setupFiscal.description',
      navigationPath: '/settings?tab=fiscal',
    },
    {
      key: 'invite_members',
      labelKey: 'onboarding.steps.inviteMembers.label',
      descriptionKey: 'onboarding.steps.inviteMembers.description',
      navigationPath: '/settings?tab=organization',
      skippable: true,
    },
    {
      key: 'setup_payment',
      labelKey: 'onboarding.steps.setupPayment.label',
      descriptionKey: 'onboarding.steps.setupPayment.description',
      navigationPath: '/settings?tab=payment',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=notifications',
      skippable: true,
    },
    {
      key: 'setup_messaging',
      labelKey: 'onboarding.steps.setupMessaging.label',
      descriptionKey: 'onboarding.steps.setupMessaging.description',
      navigationPath: '/settings?tab=messaging',
      skippable: true,
    },
    {
      key: 'setup_general',
      labelKey: 'onboarding.steps.setupGeneral.label',
      descriptionKey: 'onboarding.steps.setupGeneral.description',
      navigationPath: '/settings?tab=general',
    },
    {
      key: 'setup_integrations',
      labelKey: 'onboarding.steps.setupIntegrations.label',
      descriptionKey: 'onboarding.steps.setupIntegrations.description',
      navigationPath: '/settings?tab=integrations',
      skippable: true,
    },
  ],

  // ── HOST ──────────────────────────────────────────────────────────────
  HOST: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/settings?tab=general',
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
      navigationPath: '/properties?tab=properties',
    },
    {
      key: 'define_pricing',
      labelKey: 'onboarding.steps.definePricing.label',
      descriptionKey: 'onboarding.steps.definePricing.description',
      navigationPath: '/properties?tab=pricing',
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
      navigationPath: '/settings?tab=notifications',
      skippable: true,
    },
    {
      key: 'setup_payouts',
      labelKey: 'onboarding.steps.setupPayouts.label',
      descriptionKey: 'onboarding.steps.setupPayouts.description',
      navigationPath: '/settings?tab=my-payout',
      skippable: true,
    },
  ],

  // ── HOUSEKEEPER ──────────────────────────────────────────────────────
  HOUSEKEEPER: [
    {
      key: 'complete_profile',
      labelKey: 'onboarding.steps.completeProfile.label',
      descriptionKey: 'onboarding.steps.completeProfile.description',
      navigationPath: '/account?tab=profile',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/account?tab=notifications',
      skippable: true,
    },
    {
      key: 'accept_provider_terms',
      labelKey: 'onboarding.steps.acceptProviderTerms.label',
      descriptionKey: 'onboarding.steps.acceptProviderTerms.description',
      navigationPath: '/account?tab=business',
    },
    {
      key: 'upload_provider_documents',
      labelKey: 'onboarding.steps.uploadProviderDocuments.label',
      descriptionKey: 'onboarding.steps.uploadProviderDocuments.description',
      navigationPath: '/account?tab=business',
      substeps: [
        { key: 'doc_company', labelKey: 'onboarding.substeps.docCompany' },
        { key: 'doc_urssaf', labelKey: 'onboarding.substeps.docUrssaf' },
        { key: 'doc_insurance', labelKey: 'onboarding.substeps.docInsurance' },
      ],
    },
    {
      key: 'setup_payout_account',
      labelKey: 'onboarding.steps.setupPayoutAccount.label',
      descriptionKey: 'onboarding.steps.setupPayoutAccount.description',
      navigationPath: '/account?tab=business',
      // Creer le compte ne suffit pas : tant que Stripe n'a pas valide identite
      // et IBAN, `payouts_enabled` reste faux et l'argent ne part pas.
      substeps: [
        { key: 'stripe_account', labelKey: 'onboarding.substeps.stripeAccount' },
        { key: 'stripe_kyc', labelKey: 'onboarding.substeps.stripeKyc' },
      ],
    },
    {
      key: 'setup_coverage_zone',
      labelKey: 'onboarding.steps.setupCoverageZone.label',
      descriptionKey: 'onboarding.steps.setupCoverageZone.description',
      navigationPath: '/account?tab=business',
    },
    {
      key: 'setup_availability',
      labelKey: 'onboarding.steps.setupAvailability.label',
      descriptionKey: 'onboarding.steps.setupAvailability.description',
      navigationPath: '/mes-disponibilites',
      skippable: true,
    },
    {
      key: 'setup_rates',
      labelKey: 'onboarding.steps.setupRates.label',
      descriptionKey: 'onboarding.steps.setupRates.description',
      navigationPath: '/mes-tarifs',
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
      navigationPath: '/account?tab=profile',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/account?tab=notifications',
      skippable: true,
    },
    {
      key: 'accept_provider_terms',
      labelKey: 'onboarding.steps.acceptProviderTerms.label',
      descriptionKey: 'onboarding.steps.acceptProviderTerms.description',
      navigationPath: '/account?tab=business',
    },
    {
      key: 'upload_provider_documents',
      labelKey: 'onboarding.steps.uploadProviderDocuments.label',
      descriptionKey: 'onboarding.steps.uploadProviderDocuments.description',
      navigationPath: '/account?tab=business',
      substeps: [
        { key: 'doc_company', labelKey: 'onboarding.substeps.docCompany' },
        { key: 'doc_urssaf', labelKey: 'onboarding.substeps.docUrssaf' },
        { key: 'doc_insurance', labelKey: 'onboarding.substeps.docInsurance' },
      ],
    },
    {
      key: 'setup_payout_account',
      labelKey: 'onboarding.steps.setupPayoutAccount.label',
      descriptionKey: 'onboarding.steps.setupPayoutAccount.description',
      navigationPath: '/account?tab=business',
      // Creer le compte ne suffit pas : tant que Stripe n'a pas valide identite
      // et IBAN, `payouts_enabled` reste faux et l'argent ne part pas.
      substeps: [
        { key: 'stripe_account', labelKey: 'onboarding.substeps.stripeAccount' },
        { key: 'stripe_kyc', labelKey: 'onboarding.substeps.stripeKyc' },
      ],
    },
    {
      key: 'setup_coverage_zone',
      labelKey: 'onboarding.steps.setupCoverageZone.label',
      descriptionKey: 'onboarding.steps.setupCoverageZone.description',
      navigationPath: '/account?tab=business',
    },
    {
      key: 'setup_availability',
      labelKey: 'onboarding.steps.setupAvailability.label',
      descriptionKey: 'onboarding.steps.setupAvailability.description',
      navigationPath: '/mes-disponibilites',
      skippable: true,
    },
    {
      key: 'setup_rates',
      labelKey: 'onboarding.steps.setupRates.label',
      descriptionKey: 'onboarding.steps.setupRates.description',
      navigationPath: '/mes-tarifs',
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
      navigationPath: '/account?tab=profile',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/account?tab=notifications',
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
      navigationPath: '/settings?tab=general',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=notifications',
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
      navigationPath: '/settings?tab=general',
    },
    {
      key: 'setup_notifications',
      labelKey: 'onboarding.steps.setupNotifications.label',
      descriptionKey: 'onboarding.steps.setupNotifications.description',
      navigationPath: '/settings?tab=notifications',
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
