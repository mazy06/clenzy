package com.clenzy.service;

import com.clenzy.dto.OpenBankingInitRequest;
import com.clenzy.dto.OpenBankingInitResponse;
import com.clenzy.dto.OwnerPayoutConfigDto;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.User;
import com.clenzy.payment.payout.openbanking.GoCardlessPisClient;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Logique metier de la configuration de reversement des proprietaires
 * (IBAN/SEPA, Stripe Connect, Open Banking GoCardless).
 *
 * <p>Toutes les lectures/ecritures de config sont scoped par
 * {@code (ownerId, organizationId)} — l'org venant du {@link TenantContext},
 * jamais du client. La validation d'ownership (proprietaire de la ressource ou
 * platform staff) est exposee via {@link #validateOwnershipOrAdmin}.</p>
 *
 * <p>Les methodes qui font un appel HTTP externe (Stripe, GoCardless) ne sont
 * volontairement PAS transactionnelles (regle audit n°2) : les writes y sont
 * des operations repository unitaires.</p>
 */
@Service
public class OwnerPayoutConfigService {

    private static final Logger log = LoggerFactory.getLogger(OwnerPayoutConfigService.class);
    private static final Pattern IBAN_PATTERN = Pattern.compile("^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$");

    private final OwnerPayoutConfigRepository configRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;
    private final StripeConnectService stripeConnectService;
    private final NotificationService notificationService;
    private final GoCardlessPisClient gocardlessClient;

    @Value("${clenzy.base-url:https://app.clenzy.fr}")
    private String clenzyBaseUrl;

    public OwnerPayoutConfigService(OwnerPayoutConfigRepository configRepository,
                                    UserRepository userRepository,
                                    TenantContext tenantContext,
                                    StripeConnectService stripeConnectService,
                                    NotificationService notificationService,
                                    GoCardlessPisClient gocardlessClient) {
        this.configRepository = configRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
        this.stripeConnectService = stripeConnectService;
        this.notificationService = notificationService;
        this.gocardlessClient = gocardlessClient;
    }

    /** Resultat de l'initialisation Stripe Connect (lien onboarding + config). */
    public record StripeConnectInitResult(String onboardingUrl, OwnerPayoutConfigDto config) {}

    // ─── Self-service (utilisateur courant) ─────────────────────────────────

    @Transactional(readOnly = true)
    public OwnerPayoutConfigDto getMyConfig(String keycloakId) {
        User currentUser = resolveCurrentUser(keycloakId);
        Long orgId = tenantContext.getOrganizationId();
        return configRepository.findByOwnerIdAndOrgId(currentUser.getId(), orgId)
                .map(OwnerPayoutConfigDto::from)
                .orElseGet(() -> OwnerPayoutConfigDto.empty(currentUser.getId()));
    }

    @Transactional
    public OwnerPayoutConfigDto updateMySepa(String keycloakId, String iban, String bic,
                                             String bankAccountHolder) {
        User currentUser = resolveCurrentUser(keycloakId);
        OwnerPayoutConfigDto result = updateSepa(currentUser.getId(), iban, bic, bankAccountHolder);

        String ownerName = currentUser.getFirstName() + " " + currentUser.getLastName();
        notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYOUT_CONFIG_SUBMITTED,
                "Configuration de paiement a verifier",
                ownerName + " a renseigne ses coordonnees bancaires (IBAN). Verification requise.",
                "/settings?tab=reversements"
        );

        return result;
    }

    /** Appel Stripe hors transaction — la persistance est geree par StripeConnectService. */
    public StripeConnectInitResult initMyStripeConnect(String keycloakId) throws StripeException {
        User currentUser = resolveCurrentUser(keycloakId);
        Long orgId = tenantContext.getOrganizationId();

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

        return new StripeConnectInitResult(onboardingUrl, OwnerPayoutConfigDto.from(config));
    }

    /**
     * Genere un lien d'onboarding Stripe pour l'utilisateur courant.
     *
     * @return empty si la config n'a pas encore de compte Stripe connecte
     *         (le controller repond 400).
     * @throws IllegalArgumentException si aucune configuration n'existe.
     */
    public Optional<String> generateMyOnboardingLink(String keycloakId) throws StripeException {
        User currentUser = resolveCurrentUser(keycloakId);
        Long orgId = tenantContext.getOrganizationId();

        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(currentUser.getId(), orgId)
                .orElseThrow(() -> new IllegalArgumentException("Aucune configuration trouvee"));

        if (config.getStripeConnectedAccountId() == null) {
            return Optional.empty();
        }
        return Optional.of(stripeConnectService.generateOnboardingLink(config.getStripeConnectedAccountId()));
    }

    // ─── Acces admin / par ownerId ───────────────────────────────────────────

    @Transactional(readOnly = true)
    public Optional<OwnerPayoutConfigDto> getConfig(Long ownerId) {
        Long orgId = tenantContext.getOrganizationId();
        return configRepository.findByOwnerIdAndOrgId(ownerId, orgId)
                .map(OwnerPayoutConfigDto::from);
    }

    @Transactional(readOnly = true)
    public List<OwnerPayoutConfigDto> getAllConfigs() {
        Long orgId = tenantContext.getOrganizationId();
        return configRepository.findAllByOrgId(orgId).stream()
                .map(OwnerPayoutConfigDto::from)
                .toList();
    }

    @Transactional
    public OwnerPayoutConfigDto updateMethod(Long ownerId, PayoutMethod payoutMethod) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayoutConfig config = getOrCreate(ownerId, orgId);
        config.setPayoutMethod(payoutMethod);
        return OwnerPayoutConfigDto.from(configRepository.save(config));
    }

    @Transactional
    public OwnerPayoutConfigDto updateSepa(Long ownerId, String iban, String bic,
                                           String bankAccountHolder) {
        Long orgId = tenantContext.getOrganizationId();

        OwnerPayoutConfig config = getOrCreate(ownerId, orgId);

        // Update partiel : si l'IBAN n'est pas fourni (ou est blank/contient un *
        // = mask non modifié côté frontend), on garde l'IBAN existant.
        boolean ibanProvided = iban != null
            && !iban.isBlank()
            && !iban.contains("*");

        if (ibanProvided) {
            String normalizedIban = iban.replaceAll("\\s+", "").toUpperCase();
            if (!IBAN_PATTERN.matcher(normalizedIban).matches()) {
                throw new IllegalArgumentException("Format IBAN invalide");
            }
            config.setIban(normalizedIban);
            // Si on remplace l'IBAN, on reset la verification (admin doit revalider)
            config.setVerified(false);
        } else if (config.getIban() == null || config.getIban().isBlank()) {
            // Premier setup : IBAN obligatoire
            throw new IllegalArgumentException("L'IBAN est requis pour la première configuration SEPA");
        }

        // BIC et titulaire sont toujours mis à jour s'ils sont fournis
        if (bic != null && !bic.isBlank()) {
            config.setBic(bic);
        }
        if (bankAccountHolder != null && !bankAccountHolder.isBlank()) {
            config.setBankAccountHolder(bankAccountHolder);
        }

        config.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        config.setStripeConnectedAccountId(null); // Clear Stripe fields when switching to SEPA
        config.setStripeOnboardingComplete(false);
        return OwnerPayoutConfigDto.from(configRepository.save(config));
    }

    @Transactional
    public OwnerPayoutConfigDto verify(Long ownerId) {
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

    // ─── Open Banking (GoCardless) ───────────────────────────────────────────

    public boolean isOpenBankingEnabled() {
        return gocardlessClient.isEnabled();
    }

    public List<GoCardlessPisClient.InstitutionInfo> listOpenBankingInstitutions(String country) {
        return gocardlessClient.listInstitutions(country);
    }

    /**
     * Initie le flow SCA Open Banking : cree une requisition GoCardless et
     * stocke son ID en BDD. Appel HTTP externe → hors transaction.
     */
    public OpenBankingInitResponse initOpenBanking(Long ownerId, OpenBankingInitRequest request) {
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
        return new OpenBankingInitResponse(requisition.redirectLink(), requisition.requisitionId());
    }

    /**
     * Finalise le retour SCA : verifie le consent cote GoCardless et active la
     * methode Open Banking.
     *
     * @return empty si le consent est absent ou invalide (le controller repond 400).
     * @throws IllegalArgumentException si aucune configuration n'est en cours.
     */
    public Optional<OwnerPayoutConfigDto> completeOpenBankingCallback(String keycloakId) {
        User currentUser = resolveCurrentUser(keycloakId);
        Long orgId = tenantContext.getOrganizationId();

        // GoCardless ne renvoie pas le requisitionId dans le redirect — on
        // récupère le consent_id depuis la config de l'utilisateur courant.
        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(currentUser.getId(), orgId)
            .orElseThrow(() -> new IllegalArgumentException(
                "Aucune configuration Open Banking en cours pour l'utilisateur."));

        String requisitionId = config.getOpenBankingConsentId();
        if (requisitionId == null || requisitionId.isBlank()) {
            return Optional.empty();
        }

        if (!gocardlessClient.isConsentValid(requisitionId)) {
            log.warn("Open Banking callback : consent {} invalide cote GoCardless", requisitionId);
            return Optional.empty();
        }

        // Consent actif : on marque la méthode active et la verification OK
        config.setPayoutMethod(PayoutMethod.OPEN_BANKING);
        config.setOpenBankingConsentExpiresAt(
            java.time.Instant.now().plus(90, java.time.temporal.ChronoUnit.DAYS));
        config.setVerified(true);
        OwnerPayoutConfig saved = configRepository.save(config);

        log.info("Open Banking : consent {} active pour owner {} (org {})",
            requisitionId, currentUser.getId(), orgId);
        return Optional.of(OwnerPayoutConfigDto.from(saved));
    }

    // ─── Ownership / lookup utilisateur ──────────────────────────────────────

    /**
     * Resout l'ID interne de l'utilisateur courant a partir de son keycloakId.
     * Lookup transverse place ici (UserService.findByKeycloakId retourne null,
     * on veut un AccessDeniedException homogene).
     */
    @Transactional(readOnly = true)
    public Long getCurrentUserId(String keycloakId) {
        return resolveCurrentUser(keycloakId).getId();
    }

    /**
     * Verifie que le requester est le proprietaire de la ressource OU un membre
     * du platform staff (SUPER_ADMIN/SUPER_MANAGER — flag fourni par le
     * controller depuis le JWT).
     *
     * @throws AccessDeniedException sinon.
     */
    @Transactional(readOnly = true)
    public void validateOwnershipOrAdmin(Long ownerId, String keycloakId, boolean platformStaff) {
        User requester = resolveCurrentUser(keycloakId);

        boolean isOwner = requester.getId().equals(ownerId);
        if (!isOwner && !platformStaff) {
            throw new AccessDeniedException("Acces refuse : vous ne pouvez acceder qu'a vos propres donnees");
        }
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    private OwnerPayoutConfig getOrCreate(Long ownerId, Long orgId) {
        return configRepository.findByOwnerIdAndOrgId(ownerId, orgId)
                .orElseGet(() -> {
                    OwnerPayoutConfig c = new OwnerPayoutConfig();
                    c.setOrganizationId(orgId);
                    c.setOwnerId(ownerId);
                    return c;
                });
    }

    private User resolveCurrentUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new AccessDeniedException("Utilisateur non trouve"));
    }
}
