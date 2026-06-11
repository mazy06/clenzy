package com.clenzy.controller;

import com.clenzy.dto.OpenBankingInitRequest;
import com.clenzy.dto.OpenBankingInitResponse;
import com.clenzy.dto.OwnerPayoutConfigDto;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.openbanking.GoCardlessPisClient;
import com.clenzy.service.OwnerPayoutConfigService;
import com.stripe.exception.StripeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints de configuration des reversements proprietaires.
 *
 * <p>Controller mince : extraction du JWT (sujet + roles platform staff),
 * mapping HTTP et delegation a {@link OwnerPayoutConfigService} qui porte la
 * logique metier, les transactions et la validation d'ownership.</p>
 */
@RestController
@RequestMapping("/api/owner-payout-config")
@PreAuthorize("isAuthenticated()")
public class OwnerPayoutConfigController {

    private static final Logger log = LoggerFactory.getLogger(OwnerPayoutConfigController.class);

    private final OwnerPayoutConfigService configService;

    public OwnerPayoutConfigController(OwnerPayoutConfigService configService) {
        this.configService = configService;
    }

    // ─── Self-service endpoints (current user) ─────────────────────────────────

    @GetMapping("/me")
    public ResponseEntity<OwnerPayoutConfigDto> getMyConfig(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(configService.getMyConfig(jwt.getSubject()));
    }

    @PutMapping("/me/sepa")
    public OwnerPayoutConfigDto updateMySepa(@AuthenticationPrincipal Jwt jwt,
                                              @RequestBody UpdateSepaRequest request) {
        return configService.updateMySepa(jwt.getSubject(),
                request.iban(), request.bic(), request.bankAccountHolder());
    }

    @PostMapping("/me/stripe-connect/init")
    public ResponseEntity<StripeConnectInitResponse> initMyStripeConnect(@AuthenticationPrincipal Jwt jwt) {
        try {
            OwnerPayoutConfigService.StripeConnectInitResult result =
                    configService.initMyStripeConnect(jwt.getSubject());
            return ResponseEntity.ok(new StripeConnectInitResponse(result.onboardingUrl(), result.config()));
        } catch (StripeException e) {
            log.error("Erreur Stripe Connect init pour user {}: {}", jwt.getSubject(), e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/me/stripe-connect/onboarding-link")
    public ResponseEntity<Map<String, String>> getMyStripeOnboardingLink(@AuthenticationPrincipal Jwt jwt) {
        try {
            return configService.generateMyOnboardingLink(jwt.getSubject())
                    .map(url -> ResponseEntity.ok(Map.of("url", url)))
                    .orElseGet(() -> ResponseEntity.badRequest().build());
        } catch (StripeException e) {
            log.error("Erreur generation lien onboarding pour user {}: {}", jwt.getSubject(), e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ─── Admin endpoints ────────────────────────────────────────────────────────

    @GetMapping("/{ownerId}")
    public ResponseEntity<OwnerPayoutConfigDto> getConfig(@PathVariable Long ownerId,
                                                           @AuthenticationPrincipal Jwt jwt) {
        configService.validateOwnershipOrAdmin(ownerId, jwt.getSubject(), isPlatformStaff(jwt));
        return configService.getConfig(ownerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public List<OwnerPayoutConfigDto> getAllConfigs() {
        return configService.getAllConfigs();
    }

    @PutMapping("/{ownerId}/method")
    public OwnerPayoutConfigDto updateMethod(@PathVariable Long ownerId,
                                              @RequestBody UpdateMethodRequest request,
                                              @AuthenticationPrincipal Jwt jwt) {
        configService.validateOwnershipOrAdmin(ownerId, jwt.getSubject(), isPlatformStaff(jwt));
        return configService.updateMethod(ownerId, request.payoutMethod());
    }

    @PutMapping("/{ownerId}/sepa")
    public OwnerPayoutConfigDto updateSepa(@PathVariable Long ownerId,
                                            @RequestBody UpdateSepaRequest request,
                                            @AuthenticationPrincipal Jwt jwt) {
        configService.validateOwnershipOrAdmin(ownerId, jwt.getSubject(), isPlatformStaff(jwt));
        return configService.updateSepa(ownerId, request.iban(), request.bic(), request.bankAccountHolder());
    }

    @PutMapping("/{ownerId}/verify")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN')")
    public OwnerPayoutConfigDto verify(@PathVariable Long ownerId) {
        return configService.verify(ownerId);
    }

    /**
     * Liste les banques disponibles pour le SCA Open Banking par pays.
     *
     * <p>Proxy vers GoCardless avec cache 1h pour limiter la charge. Renvoie
     * une liste {@code [{ id, name, logo }]} triée alphabétiquement, à
     * afficher dans le sélecteur de banque du dialog frontend.</p>
     */
    @GetMapping("/openbanking/institutions")
    public ResponseEntity<List<GoCardlessPisClient.InstitutionInfo>>
        listOpenBankingInstitutions(@RequestParam(defaultValue = "FR") String country) {
        if (!configService.isOpenBankingEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        try {
            return ResponseEntity.ok(configService.listOpenBankingInstitutions(country));
        } catch (Exception e) {
            log.error("Erreur listInstitutions pour pays {}: {}", country, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    // ─── Open Banking SCA endpoints ─────────────────────────────────────────

    /**
     * Initie le flow SCA Open Banking pour le propriétaire courant.
     * Crée une requisition GoCardless et stocke l'ID en BDD ; renvoie
     * l'URL à ouvrir pour signer le SCA.
     */
    @PostMapping("/me/openbanking/init")
    public ResponseEntity<OpenBankingInitResponse> initMyOpenBanking(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody OpenBankingInitRequest request) {
        Long ownerId = configService.getCurrentUserId(jwt.getSubject());
        return initOpenBankingForOwner(ownerId, request);
    }

    /**
     * Variante admin : initier le SCA pour un propriétaire spécifique
     * (utile quand l'admin Clenzy doit configurer Open Banking pour un host
     * qui n'est pas en self-service).
     */
    @PostMapping("/{ownerId}/openbanking/init")
    public ResponseEntity<OpenBankingInitResponse> initOpenBankingAdmin(
            @PathVariable Long ownerId,
            @RequestBody OpenBankingInitRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        configService.validateOwnershipOrAdmin(ownerId, jwt.getSubject(), isPlatformStaff(jwt));
        return initOpenBankingForOwner(ownerId, request);
    }

    /**
     * Callback de retour après SCA bancaire. GoCardless redirige le browser
     * vers cet endpoint avec {@code ?ref=<requisitionId>}. On vérifie le
     * statut côté provider et on enregistre le consent comme actif.
     */
    @GetMapping("/openbanking/callback")
    public ResponseEntity<OwnerPayoutConfigDto> openBankingCallback(@AuthenticationPrincipal Jwt jwt) {
        return configService.completeOpenBankingCallback(jwt.getSubject())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.BAD_REQUEST).build());
    }

    private ResponseEntity<OpenBankingInitResponse> initOpenBankingForOwner(
            Long ownerId, OpenBankingInitRequest request) {
        if (!configService.isOpenBankingEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        return ResponseEntity.ok(configService.initOpenBanking(ownerId, request));
    }

    /** True si le JWT porte un role platform staff (SUPER_ADMIN/SUPER_MANAGER). */
    private boolean isPlatformStaff(Jwt jwt) {
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?, ?> ra && ra.get("roles") instanceof List<?> roles) {
            return roles.contains("SUPER_ADMIN") || roles.contains("SUPER_MANAGER");
        }
        return false;
    }

    // ─── DTOs ───────────────────────────────────────────────────────────────────

    public record UpdateMethodRequest(PayoutMethod payoutMethod) {}
    public record UpdateSepaRequest(String iban, String bic, String bankAccountHolder) {}
    public record StripeConnectInitResponse(String onboardingUrl, OwnerPayoutConfigDto config) {}
}
