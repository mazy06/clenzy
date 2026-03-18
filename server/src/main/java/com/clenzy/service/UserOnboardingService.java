package com.clenzy.service;

import com.clenzy.dto.OnboardingStatusDto;
import com.clenzy.dto.OnboardingStatusDto.StepDto;
import com.clenzy.model.UserOnboarding;
import com.clenzy.model.UserRole;
import com.clenzy.repository.UserOnboardingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Manages per-role onboarding step progression.
 * Each role has a predefined set of steps; rows are created lazily on first access.
 */
@Service
public class UserOnboardingService {

    private static final Logger log = LoggerFactory.getLogger(UserOnboardingService.class);

    private final UserOnboardingRepository repository;

    /** Ordered step keys per role. */
    private static final Map<UserRole, List<String>> STEPS_BY_ROLE = Map.ofEntries(
        Map.entry(UserRole.SUPER_ADMIN,   List.of("configure_org", "invite_members", "setup_settings")),
        Map.entry(UserRole.SUPER_MANAGER, List.of("configure_org", "invite_members", "setup_settings")),
        Map.entry(UserRole.HOST,          List.of("create_property", "configure_details", "define_pricing", "connect_channels", "configure_billing")),
        Map.entry(UserRole.HOUSEKEEPER,   List.of("complete_profile", "view_interventions")),
        Map.entry(UserRole.TECHNICIAN,    List.of("complete_profile", "view_interventions")),
        Map.entry(UserRole.SUPERVISOR,    List.of("complete_profile", "create_team")),
        Map.entry(UserRole.LAUNDRY,       List.of("complete_profile", "view_interventions")),
        Map.entry(UserRole.EXTERIOR_TECH, List.of("complete_profile", "view_interventions"))
    );

    public UserOnboardingService(UserOnboardingRepository repository) {
        this.repository = repository;
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

        final boolean dismissed = byKey.values().stream().anyMatch(UserOnboarding::isDismissed);

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
}
