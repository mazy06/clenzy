package com.clenzy.service;

import com.clenzy.dto.OnboardingStatusDto;
import com.clenzy.dto.OnboardingStatusDto.StepDto;
import com.clenzy.model.User;
import com.clenzy.model.UserOnboarding;
import com.clenzy.model.UserRole;
import com.clenzy.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages per-role onboarding step progression.
 * Each role has a predefined set of steps; rows are created lazily on first access.
 * Steps are auto-completed based on actual data checks at each status retrieval.
 */
@Service
public class UserOnboardingService {

    private static final Logger log = LoggerFactory.getLogger(UserOnboardingService.class);

    private final UserOnboardingRepository repository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final FiscalProfileRepository fiscalProfileRepository;
    private final PropertyRepository propertyRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final MessagingAutomationConfigRepository messagingAutomationConfigRepository;
    private final PaymentMethodConfigRepository paymentMethodConfigRepository;
    private final ICalFeedRepository icalFeedRepository;

    /**
     * Steps that can be auto-completed AND auto-reverted when data is removed.
     * These are mandatory steps — if the underlying data disappears, the step
     * goes back to incomplete and the onboarding checklist reappears.
     */
    private static final Set<String> REVERTABLE_STEPS = Set.of(
        "configure_org", "setup_fiscal", "setup_payment", "setup_general",
        "complete_profile", "create_property", "configure_details"
    );

    /**
     * Steps that can be auto-completed when data exists, but are NEVER reverted.
     * These are skippable/optional steps — the user may have intentionally skipped them.
     */
    private static final Set<String> AUTO_COMPLETE_ONLY_STEPS = Set.of(
        "invite_members", "setup_notifications", "setup_messaging",
        "setup_integrations", "connect_channels"
    );

    /** Ordered step keys per role — must match client-side onboardingConfig.ts */
    private static final Map<UserRole, List<String>> STEPS_BY_ROLE = Map.ofEntries(
        Map.entry(UserRole.SUPER_ADMIN, List.of(
            "configure_org", "setup_fiscal", "invite_members", "setup_payment",
            "setup_notifications", "setup_messaging", "setup_general", "setup_integrations"
        )),
        Map.entry(UserRole.SUPER_MANAGER, List.of(
            "configure_org", "setup_fiscal", "invite_members", "setup_payment",
            "setup_notifications", "setup_messaging", "setup_general", "setup_integrations"
        )),
        Map.entry(UserRole.HOST, List.of(
            "complete_profile", "create_property", "configure_details",
            "define_pricing", "connect_channels", "setup_notifications", "setup_payouts"
        )),
        Map.entry(UserRole.HOUSEKEEPER, List.of("complete_profile", "setup_notifications", "view_interventions")),
        Map.entry(UserRole.TECHNICIAN, List.of("complete_profile", "setup_notifications", "view_interventions")),
        Map.entry(UserRole.SUPERVISOR, List.of("complete_profile", "setup_notifications", "create_team", "view_interventions")),
        Map.entry(UserRole.LAUNDRY, List.of("complete_profile", "setup_notifications", "view_interventions")),
        Map.entry(UserRole.EXTERIOR_TECH, List.of("complete_profile", "setup_notifications", "view_interventions"))
    );

    public UserOnboardingService(UserOnboardingRepository repository,
                                  UserRepository userRepository,
                                  OrganizationRepository organizationRepository,
                                  OrganizationMemberRepository organizationMemberRepository,
                                  FiscalProfileRepository fiscalProfileRepository,
                                  PropertyRepository propertyRepository,
                                  NotificationPreferenceRepository notificationPreferenceRepository,
                                  MessagingAutomationConfigRepository messagingAutomationConfigRepository,
                                  PaymentMethodConfigRepository paymentMethodConfigRepository,
                                  ICalFeedRepository icalFeedRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.organizationMemberRepository = organizationMemberRepository;
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.propertyRepository = propertyRepository;
        this.notificationPreferenceRepository = notificationPreferenceRepository;
        this.messagingAutomationConfigRepository = messagingAutomationConfigRepository;
        this.paymentMethodConfigRepository = paymentMethodConfigRepository;
        this.icalFeedRepository = icalFeedRepository;
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    @Transactional
    public OnboardingStatusDto getStatus(Long userId, UserRole role, Long organizationId) {
        final List<String> expectedKeys = STEPS_BY_ROLE.getOrDefault(role, List.of());
        if (expectedKeys.isEmpty()) {
            return new OnboardingStatusDto(role.name(), false, List.of());
        }

        List<UserOnboarding> existing = repository.findByUserIdAndRole(userId, role);
        final Map<String, UserOnboarding> byKey = existing.stream()
            .collect(Collectors.toMap(UserOnboarding::getStepKey, o -> o));

        // Create missing rows lazily
        boolean created = false;
        for (final String key : expectedKeys) {
            if (!byKey.containsKey(key)) {
                final var step = new UserOnboarding(userId, role, key, organizationId);
                repository.save(step);
                byKey.put(key, step);
                created = true;
            }
        }
        if (created) {
            repository.flush();
        }

        // Auto-complete or un-complete steps based on real data
        Set<String> autoCompleted = checkAutoCompletions(userId, role, organizationId);
        boolean reactivated = false;
        for (final String key : expectedKeys) {
            final UserOnboarding step = byKey.get(key);
            if (step == null) continue;

            if (autoCompleted.contains(key) && !step.isCompleted()) {
                // Step now satisfied → mark completed
                step.markCompleted();
                repository.save(step);
                log.info("Onboarding step auto-completed: userId={}, role={}, step={}", userId, role, key);
            } else if (!autoCompleted.contains(key) && step.isCompleted() && REVERTABLE_STEPS.contains(key)) {
                // Mandatory step no longer satisfied → revert to incomplete
                step.markUncompleted();
                repository.save(step);
                reactivated = true;
                log.info("Onboarding step reverted (data removed): userId={}, role={}, step={}", userId, role, key);
            }
        }

        // If any step was reactivated, clear the dismissed flag so the checklist reappears
        boolean dismissed = byKey.values().stream().anyMatch(UserOnboarding::isDismissed);
        if (reactivated && dismissed) {
            repository.updateDismissedByUserIdAndRole(userId, role, false);
            dismissed = false;
            log.info("Onboarding re-activated (dismissed cleared): userId={}, role={}", userId, role);
        }

        final List<StepDto> steps = expectedKeys.stream()
            .map(key -> {
                final UserOnboarding o = byKey.get(key);
                return new StepDto(key, o.isCompleted(), o.getCompletedAt());
            })
            .toList();

        return new OnboardingStatusDto(role.name(), dismissed, steps);
    }

    @Transactional
    public void completeStep(Long userId, UserRole role, String stepKey, Long organizationId) {
        final UserOnboarding step = repository
            .findByUserIdAndRoleAndStepKey(userId, role, stepKey)
            .orElseGet(() -> repository.save(new UserOnboarding(userId, role, stepKey, organizationId)));

        if (!step.isCompleted()) {
            step.markCompleted();
            repository.save(step);
            log.info("Onboarding step completed: userId={}, role={}, step={}", userId, role, stepKey);
        }
    }

    @Transactional
    public void dismiss(Long userId, UserRole role) {
        repository.updateDismissedByUserIdAndRole(userId, role, true);
        log.info("Onboarding dismissed: userId={}, role={}", userId, role);
    }

    @Transactional
    public void reset(Long userId, UserRole role) {
        repository.deleteByUserIdAndRole(userId, role);
        log.info("Onboarding reset: userId={}, role={}", userId, role);
    }

    // ─── Auto-completion checks ─────────────────────────────────────────────

    /**
     * Checks real data to determine which steps should be auto-completed.
     * Called on every getStatus() so that steps are validated regardless of
     * whether the user configured things via onboarding or directly via menus.
     */
    private Set<String> checkAutoCompletions(Long userId, UserRole role, Long organizationId) {
        List<String> expectedKeys = STEPS_BY_ROLE.getOrDefault(role, List.of());
        Set<String> completed = new HashSet<>();

        // Resolve user and keycloakId once for all checks
        Optional<User> userOpt = userRepository.findById(userId);
        String keycloakId = userOpt.map(User::getKeycloakId).orElse(null);

        for (String key : expectedKeys) {
            boolean satisfied = switch (key) {
                // ── ADMIN / MANAGER steps ──
                case "configure_org" -> isOrganizationConfigured(organizationId);
                case "setup_fiscal" -> isFiscalProfileConfigured(organizationId);
                case "invite_members" -> hasInvitedMembers(organizationId);
                case "setup_payment" -> hasPaymentConfigured(organizationId);
                case "setup_notifications" -> hasNotificationPreferences(keycloakId);
                case "setup_messaging" -> hasMessagingConfigured(organizationId);
                case "setup_general" -> isGeneralConfigured(userOpt.orElse(null), organizationId);
                case "setup_integrations" -> hasIntegrations(organizationId);

                // ── HOST steps ──
                case "complete_profile" -> isProfileComplete(userOpt.orElse(null));
                case "create_property" -> hasProperties(organizationId);
                case "configure_details" -> hasPropertyWithDetails(organizationId);
                case "define_pricing" -> false; // Requires explicit pricing setup — no simple check
                case "connect_channels" -> hasChannelsConnected(organizationId);
                case "setup_payouts" -> false; // Requires explicit bank info — sensitive, no auto-check

                // ── Operational steps ──
                case "create_team" -> false; // Requires explicit team creation via form
                case "view_interventions" -> false; // Requires the user to visit the page at least once

                default -> false;
            };
            if (satisfied) {
                completed.add(key);
            }
        }

        return completed;
    }

    // ── Individual check methods ────────────────────────────────────────────

    /** Organization has a name set (not default/empty) */
    private boolean isOrganizationConfigured(Long organizationId) {
        if (organizationId == null) return false;
        return organizationRepository.findById(organizationId)
            .map(org -> org.getName() != null && !org.getName().isBlank())
            .orElse(false);
    }

    /** Fiscal profile exists for the organization */
    private boolean isFiscalProfileConfigured(Long organizationId) {
        if (organizationId == null) return false;
        return fiscalProfileRepository.existsByOrganizationId(organizationId);
    }

    /** Organization has more than 1 member (the creator + at least 1 invite) */
    private boolean hasInvitedMembers(Long organizationId) {
        if (organizationId == null) return false;
        return organizationMemberRepository.countByOrganizationId(organizationId) > 1;
    }

    /** At least one payment method configured (e.g. Stripe) */
    private boolean hasPaymentConfigured(Long organizationId) {
        if (organizationId == null) return false;
        List<?> configs = paymentMethodConfigRepository.findByOrganizationIdAndEnabledTrue(organizationId);
        return configs != null && !configs.isEmpty();
    }

    /** User has customized at least one notification preference */
    private boolean hasNotificationPreferences(String keycloakId) {
        if (keycloakId == null) return false;
        List<?> prefs = notificationPreferenceRepository.findByUserId(keycloakId);
        return prefs != null && !prefs.isEmpty();
    }

    /** Messaging automation config exists for the organization */
    private boolean hasMessagingConfigured(Long organizationId) {
        if (organizationId == null) return false;
        return messagingAutomationConfigRepository.findByOrganizationId(organizationId).isPresent();
    }

    /** User has set basic general settings (name + organization name) */
    private boolean isGeneralConfigured(User user, Long organizationId) {
        if (user == null) return false;
        boolean hasFirstName = user.getFirstName() != null && !user.getFirstName().isBlank();
        boolean hasLastName = user.getLastName() != null && !user.getLastName().isBlank();
        // companyName is stored on the Organization, not on the User entity
        boolean hasCompany = organizationId != null && organizationRepository.findById(organizationId)
            .map(org -> org.getName() != null && !org.getName().isBlank())
            .orElse(false);
        return hasFirstName && hasLastName && hasCompany;
    }

    /** At least one channel connection or iCal feed exists */
    private boolean hasIntegrations(Long organizationId) {
        if (organizationId == null) return false;
        // Check for any channel connection (Airbnb, Booking, etc.)
        try {
            long feedCount = icalFeedRepository.count();
            if (feedCount > 0) return true;
        } catch (Exception e) {
            // Ignore — not critical
        }
        return false;
    }

    /** User profile is complete (firstName, lastName, phone) */
    private boolean isProfileComplete(User user) {
        if (user == null) return false;
        boolean hasFirstName = user.getFirstName() != null && !user.getFirstName().isBlank();
        boolean hasLastName = user.getLastName() != null && !user.getLastName().isBlank();
        boolean hasPhone = user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank();
        return hasFirstName && hasLastName && hasPhone;
    }

    /** Organization has at least one property */
    private boolean hasProperties(Long organizationId) {
        if (organizationId == null) return false;
        return propertyRepository.countByOrganizationId(organizationId) > 0;
    }

    /** At least one property has details filled (maxGuests, bedrooms, etc.) */
    private boolean hasPropertyWithDetails(Long organizationId) {
        if (organizationId == null) return false;
        // If properties exist, we consider details configured
        // (property creation form already requires basic details)
        return propertyRepository.countByOrganizationId(organizationId) > 0;
    }

    /** At least one channel connected (iCal feed or OTA channel) */
    private boolean hasChannelsConnected(Long organizationId) {
        if (organizationId == null) return false;
        try {
            // Check iCal feeds linked to properties of this org
            long propCount = propertyRepository.countByOrganizationId(organizationId);
            if (propCount == 0) return false;
            long feedCount = icalFeedRepository.count();
            return feedCount > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
