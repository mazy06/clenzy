package com.clenzy.controller;

import com.clenzy.dto.OwnerPayoutConfigDto;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.User;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.StripeConnectService;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/owner-payout-config")
@PreAuthorize("isAuthenticated()")
public class OwnerPayoutConfigController {

    private static final Logger log = LoggerFactory.getLogger(OwnerPayoutConfigController.class);
    private static final Pattern IBAN_PATTERN = Pattern.compile("^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$");

    private final OwnerPayoutConfigRepository configRepository;
    private final TenantContext tenantContext;
    private final UserRepository userRepository;
    private final StripeConnectService stripeConnectService;
    private final NotificationService notificationService;

    public OwnerPayoutConfigController(OwnerPayoutConfigRepository configRepository,
                                        TenantContext tenantContext,
                                        UserRepository userRepository,
                                        StripeConnectService stripeConnectService,
                                        NotificationService notificationService) {
        this.configRepository = configRepository;
        this.tenantContext = tenantContext;
        this.userRepository = userRepository;
        this.stripeConnectService = stripeConnectService;
        this.notificationService = notificationService;
    }

    // ─── Self-service endpoints (current user) ─────────────────────────────────

    @GetMapping("/me")
    public ResponseEntity<OwnerPayoutConfigDto> getMyConfig(@AuthenticationPrincipal Jwt jwt) {
        User currentUser = resolveCurrentUser(jwt);
        Long orgId = tenantContext.getOrganizationId();
        return configRepository.findByOwnerIdAndOrgId(currentUser.getId(), orgId)
                .map(config -> ResponseEntity.ok(OwnerPayoutConfigDto.from(config)))
                .orElse(ResponseEntity.ok(OwnerPayoutConfigDto.empty(currentUser.getId())));
    }

    @PutMapping("/me/sepa")
    public OwnerPayoutConfigDto updateMySepa(@AuthenticationPrincipal Jwt jwt,
                                              @RequestBody UpdateSepaRequest request) {
        User currentUser = resolveCurrentUser(jwt);
        OwnerPayoutConfigDto result = updateSepaInternal(currentUser.getId(), request);

        String ownerName = currentUser.getFirstName() + " " + currentUser.getLastName();
        notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYOUT_CONFIG_SUBMITTED,
                "Configuration de paiement a verifier",
                ownerName + " a renseigne ses coordonnees bancaires (IBAN). Verification requise.",
                "/settings?tab=reversements"
        );

        return result;
    }

    @PostMapping("/me/stripe-connect/init")
    public ResponseEntity<StripeConnectInitResponse> initMyStripeConnect(@AuthenticationPrincipal Jwt jwt) {
        User currentUser = resolveCurrentUser(jwt);
        Long orgId = tenantContext.getOrganizationId();

        try {
            OwnerPayoutConfig config = stripeConnectService.createConnectedAccount(currentUser.getId(), orgId);
            String onboardingUrl = stripeConnectService.generateOnboardingLink(
                    config.getStripeConnectedAccountId());

            String ownerName = currentUser.getFirstName() + " " + currentUser.getLastName();
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.PAYOUT_CONFIG_SUBMITTED,
                    "Connexion Stripe Connect initiee",
                    ownerName + " a initie la connexion de son compte Stripe Connect. Onboarding en cours.",
                    "/settings?tab=reversements"
            );

            return ResponseEntity.ok(new StripeConnectInitResponse(onboardingUrl, OwnerPayoutConfigDto.from(config)));
        } catch (StripeException e) {
            log.error("Erreur Stripe Connect init pour user {}: {}", currentUser.getId(), e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/me/stripe-connect/onboarding-link")
    public ResponseEntity<Map<String, String>> getMyStripeOnboardingLink(@AuthenticationPrincipal Jwt jwt) {
        User currentUser = resolveCurrentUser(jwt);
        Long orgId = tenantContext.getOrganizationId();

        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(currentUser.getId(), orgId)
                .orElseThrow(() -> new IllegalArgumentException("Aucune configuration trouvee"));

        if (config.getStripeConnectedAccountId() == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            String url = stripeConnectService.generateOnboardingLink(config.getStripeConnectedAccountId());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (StripeException e) {
            log.error("Erreur generation lien onboarding pour user {}: {}", currentUser.getId(), e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ─── Admin endpoints ────────────────────────────────────────────────────────

    @GetMapping("/{ownerId}")
    public ResponseEntity<OwnerPayoutConfigDto> getConfig(@PathVariable Long ownerId,
                                                           @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(ownerId, jwt);
        Long orgId = tenantContext.getOrganizationId();
        return configRepository.findByOwnerIdAndOrgId(ownerId, orgId)
                .map(config -> ResponseEntity.ok(OwnerPayoutConfigDto.from(config)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public List<OwnerPayoutConfigDto> getAllConfigs() {
        Long orgId = tenantContext.getOrganizationId();
        return configRepository.findAllByOrgId(orgId).stream()
                .map(OwnerPayoutConfigDto::from)
                .toList();
    }

    @PutMapping("/{ownerId}/method")
    public OwnerPayoutConfigDto updateMethod(@PathVariable Long ownerId,
                                              @RequestBody UpdateMethodRequest request,
                                              @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(ownerId, jwt);
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayoutConfig config = getOrCreate(ownerId, orgId);
        config.setPayoutMethod(request.payoutMethod());
        return OwnerPayoutConfigDto.from(configRepository.save(config));
    }

    @PutMapping("/{ownerId}/sepa")
    public OwnerPayoutConfigDto updateSepa(@PathVariable Long ownerId,
                                            @RequestBody UpdateSepaRequest request,
                                            @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(ownerId, jwt);
        return updateSepaInternal(ownerId, request);
    }

    @PutMapping("/{ownerId}/verify")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN')")
    public OwnerPayoutConfigDto verify(@PathVariable Long ownerId) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(ownerId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Config not found for owner " + ownerId));
        config.setVerified(true);
        OwnerPayoutConfigDto result = OwnerPayoutConfigDto.from(configRepository.save(config));

        // Notify the owner that their config has been verified
        userRepository.findById(ownerId).ifPresent(owner ->
                notificationService.notify(
                        owner.getKeycloakId(),
                        NotificationKey.PAYOUT_CONFIG_VERIFIED,
                        "Configuration de paiement validee",
                        "Vos coordonnees bancaires ont ete verifiees. Vos reversements seront desormais traites automatiquement.",
                        "/settings?tab=reversements"
                )
        );

        return result;
    }

    // ─── Internal helpers ───────────────────────────────────────────────────────

    private OwnerPayoutConfigDto updateSepaInternal(Long ownerId, UpdateSepaRequest request) {
        Long orgId = tenantContext.getOrganizationId();

        String iban = request.iban().replaceAll("\\s+", "").toUpperCase();
        if (!IBAN_PATTERN.matcher(iban).matches()) {
            throw new IllegalArgumentException("Format IBAN invalide");
        }

        OwnerPayoutConfig config = getOrCreate(ownerId, orgId);
        config.setIban(iban);
        config.setBic(request.bic());
        config.setBankAccountHolder(request.bankAccountHolder());
        config.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        config.setStripeConnectedAccountId(null); // Clear Stripe fields when switching to SEPA
        config.setStripeOnboardingComplete(false);
        config.setVerified(false); // Reset verification when details change
        return OwnerPayoutConfigDto.from(configRepository.save(config));
    }

    private OwnerPayoutConfig getOrCreate(Long ownerId, Long orgId) {
        return configRepository.findByOwnerIdAndOrgId(ownerId, orgId)
                .orElseGet(() -> {
                    OwnerPayoutConfig c = new OwnerPayoutConfig();
                    c.setOrganizationId(orgId);
                    c.setOwnerId(ownerId);
                    return c;
                });
    }

    private User resolveCurrentUser(Jwt jwt) {
        String keycloakId = jwt.getSubject();
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new AccessDeniedException("Utilisateur non trouve"));
    }

    private void validateOwnershipOrAdmin(Long ownerId, Jwt jwt) {
        String keycloakId = jwt.getSubject();
        User requester = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new AccessDeniedException("Utilisateur non trouve"));

        boolean isOwner = requester.getId().equals(ownerId);
        boolean isAdmin = false;
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?, ?> ra && ra.get("roles") instanceof List<?> roles) {
            isAdmin = roles.contains("SUPER_ADMIN") || roles.contains("SUPER_MANAGER");
        }

        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Acces refuse : vous ne pouvez acceder qu'a vos propres donnees");
        }
    }

    // ─── DTOs ───────────────────────────────────────────────────────────────────

    public record UpdateMethodRequest(PayoutMethod payoutMethod) {}
    public record UpdateSepaRequest(String iban, String bic, String bankAccountHolder) {}
    public record StripeConnectInitResponse(String onboardingUrl, OwnerPayoutConfigDto config) {}
}
