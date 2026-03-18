package com.clenzy.controller;

import com.clenzy.dto.OnboardingStatusDto;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.UserOnboardingService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/onboarding")
@PreAuthorize("isAuthenticated()")
public class UserOnboardingController {

    private final UserOnboardingService onboardingService;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public UserOnboardingController(UserOnboardingService onboardingService,
                                     UserRepository userRepository,
                                     TenantContext tenantContext) {
        this.onboardingService = onboardingService;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/me")
    public ResponseEntity<OnboardingStatusDto> getMyStatus(@AuthenticationPrincipal Jwt jwt) {
        final User user = resolveUser(jwt);
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        final Long orgId = tenantContext.getOrganizationId();

        return ResponseEntity.ok(onboardingService.getStatus(user.getId(), role, orgId));
    }

    @PostMapping("/me/steps/{stepKey}/complete")
    public ResponseEntity<Void> completeStep(@AuthenticationPrincipal Jwt jwt,
                                              @PathVariable String stepKey) {
        final User user = resolveUser(jwt);
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        final Long orgId = tenantContext.getOrganizationId();

        onboardingService.completeStep(user.getId(), role, stepKey, orgId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/me/dismiss")
    public ResponseEntity<Void> dismiss(@AuthenticationPrincipal Jwt jwt) {
        final User user = resolveUser(jwt);
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);

        onboardingService.dismiss(user.getId(), role);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/me/reset")
    public ResponseEntity<Void> reset(@AuthenticationPrincipal Jwt jwt) {
        final User user = resolveUser(jwt);
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);

        onboardingService.reset(user.getId(), role);
        return ResponseEntity.ok().build();
    }

    private User resolveUser(Jwt jwt) {
        final String keycloakId = jwt.getSubject();
        return userRepository.findByKeycloakId(keycloakId)
            .orElseThrow(() -> new IllegalStateException("User not found for keycloakId: " + keycloakId));
    }
}
