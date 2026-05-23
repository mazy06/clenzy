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
    private final com.clenzy.payment.payout.openbanking.GoCardlessPisClient gocardlessClient;

    @org.springframework.beans.factory.annotation.Value("${clenzy.base-url:https://app.clenzy.fr}")
    private String clenzyBaseUrl;

    public OwnerPayoutConfigController(OwnerPayoutConfigRepository configRepository,
                                        TenantContext tenantContext,
                                        UserRepository userRepository,
                                        StripeConnectService stripeConnectService,
                                        NotificationService notificationService,
                                        com.clenzy.payment.payout.openbanking.GoCardlessPisClient gocardlessClient) {
        this.configRepository = configRepository;
        this.tenantContext = tenantContext;
        this.userRepository = userRepository;
        this.stripeConnectService = stripeConnectService;
        this.notificationService = notificationService;
        this.gocardlessClient = gocardlessClient;
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

        OwnerPayoutConfig config = getOrCreate(ownerId, orgId);

        // Update partiel : si l'IBAN n'est pas fourni (ou est blank/contient un *
        // = mask non modifié côté frontend), on garde l'IBAN existant.
        boolean ibanProvided = request.iban() != null
            && !request.iban().isBlank()
            && !request.iban().contains("*");

        if (ibanProvided) {
            String iban = request.iban().replaceAll("\\s+", "").toUpperCase();
            if (!IBAN_PATTERN.matcher(iban).matches()) {
                throw new IllegalArgumentException("Format IBAN invalide");
            }
            config.setIban(iban);
            // Si on remplace l'IBAN, on reset la verification (admin doit revalider)
            config.setVerified(false);
        } else if (config.getIban() == null || config.getIban().isBlank()) {
            // Premier setup : IBAN obligatoire
            throw new IllegalArgumentException("L'IBAN est requis pour la première configuration SEPA");
        }

        // BIC et titulaire sont toujours mis à jour s'ils sont fournis
        if (request.bic() != null && !request.bic().isBlank()) {
            config.setBic(request.bic());
        }
        if (request.bankAccountHolder() != null && !request.bankAccountHolder().isBlank()) {
            config.setBankAccountHolder(request.bankAccountHolder());
        }

        config.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        config.setStripeConnectedAccountId(null); // Clear Stripe fields when switching to SEPA
        config.setStripeOnboardingComplete(false);
        return OwnerPayoutConfigDto.from(configRepository.save(config));
    }

    /**
     * Liste les banques disponibles pour le SCA Open Banking par pays.
     *
     * <p>Proxy vers GoCardless avec cache 1h pour limiter la charge. Renvoie
     * une liste {@code [{ id, name, logo }]} triée alphabétiquement, à
     * afficher dans le sélecteur de banque du dialog frontend.</p>
     */
    @org.springframework.web.bind.annotation.GetMapping("/openbanking/institutions")
    public ResponseEntity<List<com.clenzy.payment.payout.openbanking.GoCardlessPisClient.InstitutionInfo>>
        listOpenBankingInstitutions(@org.springframework.web.bind.annotation.RequestParam(defaultValue = "FR") String country) {
        if (!gocardlessClient.isEnabled()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        try {
            return ResponseEntity.ok(gocardlessClient.listInstitutions(country));
        } catch (Exception e) {
            log.error("Erreur listInstitutions pour pays {}: {}", country, e.getMessage());
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_GATEWAY).build();
        }
    }

    // ─── Open Banking SCA endpoints ─────────────────────────────────────────

    /**
     * Initie le flow SCA Open Banking pour le propriétaire courant.
     * Crée une requisition GoCardless et stocke l'ID en BDD ; renvoie
     * l'URL à ouvrir pour signer le SCA.
     */
    @org.springframework.web.bind.annotation.PostMapping("/me/openbanking/init")
    public ResponseEntity<com.clenzy.dto.OpenBankingInitResponse> initMyOpenBanking(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody com.clenzy.dto.OpenBankingInitRequest request) {
        User currentUser = resolveCurrentUser(jwt);
        return initOpenBankingForOwner(currentUser.getId(), request);
    }

    /**
     * Variante admin : initier le SCA pour un propriétaire spécifique
     * (utile quand l'admin Clenzy doit configurer Open Banking pour un host
     * qui n'est pas en self-service).
     */
    @org.springframework.web.bind.annotation.PostMapping("/{ownerId}/openbanking/init")
    public ResponseEntity<com.clenzy.dto.OpenBankingInitResponse> initOpenBankingAdmin(
            @PathVariable Long ownerId,
            @RequestBody com.clenzy.dto.OpenBankingInitRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(ownerId, jwt);
        return initOpenBankingForOwner(ownerId, request);
    }

    /**
     * Callback de retour après SCA bancaire. GoCardless redirige le browser
     * vers cet endpoint avec {@code ?ref=<requisitionId>}. On vérifie le
     * statut côté provider et on enregistre le consent comme actif.
     */
    @org.springframework.web.bind.annotation.GetMapping("/openbanking/callback")
    public ResponseEntity<OwnerPayoutConfigDto> openBankingCallback(@AuthenticationPrincipal Jwt jwt) {
        User currentUser = resolveCurrentUser(jwt);
        Long orgId = tenantContext.getOrganizationId();

        // GoCardless ne renvoie pas le requisitionId dans le redirect — on
        // récupère le consent_id depuis la config de l'utilisateur courant.
        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(currentUser.getId(), orgId)
            .orElseThrow(() -> new IllegalArgumentException(
                "Aucune configuration Open Banking en cours pour l'utilisateur."));

        String requisitionId = config.getOpenBankingConsentId();
        if (requisitionId == null || requisitionId.isBlank()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).build();
        }

        if (!gocardlessClient.isConsentValid(requisitionId)) {
            log.warn("Open Banking callback : consent {} invalide cote GoCardless", requisitionId);
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).build();
        }

        // Consent actif : on marque la méthode active et la verification OK
        config.setPayoutMethod(PayoutMethod.OPEN_BANKING);
        config.setOpenBankingConsentExpiresAt(
            java.time.Instant.now().plus(90, java.time.temporal.ChronoUnit.DAYS));
        config.setVerified(true);
        OwnerPayoutConfig saved = configRepository.save(config);

        log.info("Open Banking : consent {} active pour owner {} (org {})",
            requisitionId, currentUser.getId(), orgId);
        return ResponseEntity.ok(OwnerPayoutConfigDto.from(saved));
    }

    private ResponseEntity<com.clenzy.dto.OpenBankingInitResponse> initOpenBankingForOwner(
            Long ownerId, com.clenzy.dto.OpenBankingInitRequest request) {
        if (!gocardlessClient.isEnabled()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (request.institutionId() == null || request.institutionId().isBlank()) {
            throw new IllegalArgumentException("institutionId requis");
        }
        String provider = request.provider() != null ? request.provider().toUpperCase() : "GOCARDLESS";
        if (!"GOCARDLESS".equals(provider)) {
            throw new IllegalArgumentException("Provider non supporté en MVP : " + provider);
        }

        Long orgId = tenantContext.getOrganizationId();
        OwnerPayoutConfig config = getOrCreate(ownerId, orgId);

        // L'URL de retour pointe vers le frontend Clenzy qui appellera ensuite
        // l'endpoint /openbanking/callback. GoCardless ne modifie pas le redirect ;
        // on inclut un marqueur pour que le frontend sache qu'il revient d'un SCA.
        String redirectUrl = clenzyBaseUrl + "/settings?tab=reversements&openbanking=callback";
        String reference = "clenzy-" + orgId + "-" + ownerId + "-" + System.currentTimeMillis();

        var requisition = gocardlessClient.createRequisition(redirectUrl, request.institutionId(), reference);

        // On stocke le requisitionId en BDD immédiatement : au retour SCA, le
        // frontend appellera /openbanking/callback?ref=<requisitionId> et on
        // pourra finaliser. L'utilisateur retrouve aussi son consent_id si la
        // session expire entre-temps (lookup par owner+org).
        config.setOpenBankingProvider(provider);
        config.setOpenBankingConsentId(requisition.requisitionId());
        configRepository.save(config);

        log.info("Open Banking init : requisition {} cree pour owner {} (org {})",
            requisition.requisitionId(), ownerId, orgId);
        return ResponseEntity.ok(new com.clenzy.dto.OpenBankingInitResponse(
            requisition.redirectLink(), requisition.requisitionId()));
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
