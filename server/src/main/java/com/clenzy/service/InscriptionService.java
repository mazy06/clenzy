package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.InscriptionDto;
import com.clenzy.model.*;
import com.clenzy.repository.PendingInscriptionRepository;
import com.clenzy.util.StringUtils;
import com.clenzy.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Service gerant le flux d'inscription :
 * 1. Validation des donnees + creation de la session Stripe Checkout
 * 2. Stockage de l'inscription en attente (PendingInscription)
 * 3. Confirmation du paiement (webhook) → envoi email de confirmation
 * 4. Confirmation email + creation mot de passe → creation Keycloak + DB user → auto-login
 */
@Service
@Transactional
public class InscriptionService {

    private static final Logger logger = LoggerFactory.getLogger(InscriptionService.class);

    private final PendingInscriptionRepository pendingInscriptionRepository;
    private final UserRepository userRepository;
    private final KeycloakService keycloakService;
    private final OrganizationService organizationService;
    private final PricingConfigService pricingConfigService;
    private final EmailService emailService;
    private final RestTemplate restTemplate;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.inscription.return-url:${FRONTEND_URL:http://localhost:3000}/inscription/success}")
    private String inscriptionReturnUrl;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    @Value("${keycloak.auth-server-url:http://clenzy-keycloak:8080}")
    private String keycloakUrl;

    @Value("${keycloak.realm:clenzy}")
    private String realm;

    @Value("${KEYCLOAK_CLIENT_ID:clenzy-web}")
    private String clientId;

    @Value("${keycloak.credentials.secret:}")
    private String clientSecret;

    public InscriptionService(
            PendingInscriptionRepository pendingInscriptionRepository,
            UserRepository userRepository,
            KeycloakService keycloakService,
            OrganizationService organizationService,
            PricingConfigService pricingConfigService,
            EmailService emailService,
            RestTemplate restTemplate) {
        this.pendingInscriptionRepository = pendingInscriptionRepository;
        this.userRepository = userRepository;
        this.keycloakService = keycloakService;
        this.organizationService = organizationService;
        this.pricingConfigService = pricingConfigService;
        this.emailService = emailService;
        this.restTemplate = restTemplate;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Initiation de l'inscription (identique, sans stockage du mot de passe)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Initie le processus d'inscription :
     * - Verifie que l'email n'est pas deja utilise
     * - Cree une session Stripe Checkout pour le forfait choisi
     * - Sauvegarde l'inscription en attente dans la base
     *
     * @return Le clientSecret de la session Stripe Embedded Checkout
     */
    public Map<String, Object> initiateInscription(InscriptionDto dto) throws StripeException {
        logger.info("Initiation inscription pour email: {}, forfait: {}", dto.getEmail(), dto.getForfait());

        // Verifier que l'email n'est pas deja utilise dans la table users
        // Message generique pour eviter l'enumeration d'emails (AUTH-VULN-10)
        if (userRepository.existsByEmailHash(StringUtils.computeEmailHash(dto.getEmail()))) {
            throw new RuntimeException("Impossible de traiter cette inscription. Veuillez reessayer ou contacter le support.");
        }

        // Verifier s'il existe deja une inscription en attente pour cet email
        // Si oui, la supprimer pour permettre une nouvelle tentative
        pendingInscriptionRepository.findByEmailAndStatus(dto.getEmail(), PendingInscriptionStatus.PENDING_PAYMENT)
                .ifPresent(existing -> {
                    logger.info("Suppression de l'inscription en attente existante pour: {}", dto.getEmail());
                    pendingInscriptionRepository.delete(existing);
                });

        // Valider le type d'organisation
        OrganizationType orgType = dto.getOrganizationTypeEnum();
        if (orgType == OrganizationType.SYSTEM) {
            throw new RuntimeException("Type d'organisation non autorise.");
        }
        if (orgType != OrganizationType.INDIVIDUAL
                && (dto.getCompanyName() == null || dto.getCompanyName().isBlank())) {
            throw new RuntimeException("Le nom de la societe est requis pour une " + orgType.getDisplayName() + ".");
        }

        // Prix de base de l'abonnement PMS en centimes (source unique : PricingConfig)
        // Utiliser le prix "synchro auto" si l'utilisateur a choisi la synchronisation calendrier
        boolean isSyncMode = "sync".equalsIgnoreCase(dto.getCalendarSync());
        int priceInCents = isSyncMode
                ? pricingConfigService.getPmsSyncPriceCents()
                : pricingConfigService.getPmsMonthlyPriceCents();

        // Determiner l'intervalle Stripe et le montant selon la periode de facturation
        BillingPeriod period = dto.getBillingPeriodEnum();
        SessionCreateParams.LineItem.PriceData.Recurring.Interval stripeInterval;
        long stripePriceAmount;
        String billingDescription;

        switch (period) {
            case ANNUAL:
                stripeInterval = SessionCreateParams.LineItem.PriceData.Recurring.Interval.YEAR;
                stripePriceAmount = period.computeMonthlyPriceCents(priceInCents) * 12L;
                billingDescription = "Abonnement annuel (-20%)";
                break;
            case BIENNIAL:
                stripeInterval = SessionCreateParams.LineItem.PriceData.Recurring.Interval.YEAR;
                stripePriceAmount = period.computeMonthlyPriceCents(priceInCents) * 12L;
                billingDescription = "Abonnement bisannuel (-35%), facture annuellement";
                break;
            default: // MONTHLY
                stripeInterval = SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH;
                stripePriceAmount = priceInCents;
                billingDescription = "Abonnement mensuel";
                break;
        }

        // Creer la session Stripe Checkout
        Stripe.apiKey = stripeSecretKey;

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setUiMode(SessionCreateParams.UiMode.EMBEDDED)
                .setReturnUrl(inscriptionReturnUrl + "?session_id={CHECKOUT_SESSION_ID}")
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity(1L)
                                .setPriceData(
                                        SessionCreateParams.LineItem.PriceData.builder()
                                                .setCurrency(currency.toLowerCase())
                                                .setUnitAmount(stripePriceAmount)
                                                .setRecurring(
                                                        SessionCreateParams.LineItem.PriceData.Recurring.builder()
                                                                .setInterval(stripeInterval)
                                                                .build()
                                                )
                                                .setProductData(
                                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                .setName("Clenzy - Abonnement plateforme" + (isSyncMode ? " + Synchro auto" : ""))
                                                                .setDescription(billingDescription + " a la plateforme de gestion Clenzy - Forfait " + dto.getForfaitDisplayName() + (isSyncMode ? " (avec synchronisation calendrier automatique)" : ""))
                                                                .build()
                                                )
                                                .build()
                                )
                                .build()
                )
                .setCustomerEmail(dto.getEmail())
                // Metadata sur la session pour identifier le type dans le webhook
                .putMetadata("type", "inscription")
                .putMetadata("email", dto.getEmail())
                .putMetadata("forfait", dto.getForfait())
                .putMetadata("billingPeriod", period.name())
                // Metadata sur la subscription pour les evenements futurs (invoice.paid, customer.subscription.deleted, etc.)
                .setSubscriptionData(
                        SessionCreateParams.SubscriptionData.builder()
                                .putMetadata("type", "inscription")
                                .putMetadata("email", dto.getEmail())
                                .putMetadata("forfait", dto.getForfait())
                                .putMetadata("billingPeriod", period.name())
                                .build()
                )
                .build();

        Session session = Session.create(params);

        // Sauvegarder l'inscription en attente (SANS le mot de passe)
        PendingInscription pending = new PendingInscription();
        pending.setFirstName(dto.getFirstName());
        pending.setLastName(dto.getLastName());
        pending.setEmail(dto.getEmail());
        // Le mot de passe n'est plus stocke a l'inscription
        pending.setPhoneNumber(dto.getPhone());
        pending.setCompanyName(dto.getCompanyName());
        pending.setOrganizationType(orgType.name());
        pending.setForfait(dto.getForfait());
        pending.setCity(dto.getCity());
        pending.setPostalCode(dto.getPostalCode());
        pending.setPropertyType(dto.getPropertyType());
        pending.setPropertyCount(dto.getPropertyCount());
        pending.setSurface(dto.getSurface());
        pending.setGuestCapacity(dto.getGuestCapacity());
        pending.setBookingFrequency(dto.getBookingFrequency());
        pending.setCleaningSchedule(dto.getCleaningSchedule());
        pending.setCalendarSync(dto.getCalendarSync());
        // Stocker les listes de services en String separe par virgule
        if (dto.getServices() != null && !dto.getServices().isEmpty()) {
            pending.setServices(String.join(",", dto.getServices()));
        }
        if (dto.getServicesDevis() != null && !dto.getServicesDevis().isEmpty()) {
            pending.setServicesDevis(String.join(",", dto.getServicesDevis()));
        }
        pending.setBillingPeriod(period.name());
        pending.setStripeSessionId(session.getId());
        pending.setStatus(PendingInscriptionStatus.PENDING_PAYMENT);
        // Expiration apres 24h si non paye
        pending.setExpiresAt(LocalDateTime.now().plusHours(24));

        pendingInscriptionRepository.save(pending);

        logger.info("Inscription en attente creee pour {}, session Stripe: {}", dto.getEmail(), session.getId());

        // Retourner le clientSecret + les prix reels pour affichage coherent dans le frontend
        int monthlyPriceCents = period.computeMonthlyPriceCents(priceInCents);
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("clientSecret", session.getClientSecret());
        result.put("sessionId", session.getId());
        result.put("pmsBaseCents", priceInCents);
        result.put("monthlyPriceCents", monthlyPriceCents);
        result.put("stripePriceAmount", stripePriceAmount);
        result.put("billingPeriod", period.name());
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Confirmation du paiement (appele par le webhook Stripe)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Confirme le paiement et envoie l'email de confirmation.
     * Appele par le webhook Stripe lors de checkout.session.completed.
     *
     * - Stocke les IDs Stripe (customer + subscription)
     * - Genere un token de confirmation email
     * - Envoie l'email de confirmation avec le lien
     * - Passe le statut a PAYMENT_CONFIRMED
     */
    public void confirmPayment(String stripeSessionId, String stripeCustomerId, String stripeSubscriptionId) {
        logger.info("Confirmation paiement pour la session Stripe: {}", stripeSessionId);

        PendingInscription pending = pendingInscriptionRepository.findByStripeSessionId(stripeSessionId)
                .orElseThrow(() -> new RuntimeException("Inscription en attente non trouvee pour la session: " + stripeSessionId));

        if (pending.getStatus() == PendingInscriptionStatus.COMPLETED) {
            logger.warn("Inscription deja finalisee pour la session: {}", stripeSessionId);
            return;
        }

        if (pending.getStatus() == PendingInscriptionStatus.PAYMENT_CONFIRMED) {
            logger.warn("Paiement deja confirme pour la session: {}, re-envoi de l'email", stripeSessionId);
            // Re-envoyer l'email au cas ou (webhook doublon)
            sendConfirmationEmail(pending);
            return;
        }

        try {
            // 1. Stocker les IDs Stripe
            pending.setStripeCustomerId(stripeCustomerId);
            pending.setStripeSubscriptionId(stripeSubscriptionId);

            // 2. Generer le token de confirmation et l'envoyer par email
            String rawToken = generateAndStoreToken(pending);

            // 3. Mettre a jour le statut et l'expiration (72h pour confirmer l'email)
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setExpiresAt(LocalDateTime.now().plusHours(72));
            pendingInscriptionRepository.save(pending);

            // 4. Envoyer l'email de confirmation
            String confirmationLink = frontendUrl + "/inscription/confirm?token=" + rawToken;
            emailService.sendInscriptionConfirmationEmail(
                    pending.getEmail(),
                    pending.getFullName(),
                    confirmationLink,
                    pending.getExpiresAt()
            );

            logger.info("Email de confirmation envoye a {} pour la session: {}", pending.getEmail(), stripeSessionId);

        } catch (Exception e) {
            logger.error("Erreur lors de la confirmation du paiement pour: {}", pending.getEmail(), e);
            // Ne pas marquer en PAYMENT_FAILED car le paiement a reellement reussi
            // On laisse en PENDING_PAYMENT pour permettre un re-traitement
            throw new RuntimeException("Erreur lors de l'envoi de l'email de confirmation: " + e.getMessage(), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Finalisation avec mot de passe (appele apres confirmation email)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Finalise l'inscription apres confirmation email + creation du mot de passe.
     * - Valide le token de confirmation
     * - Cree l'utilisateur Keycloak + DB + organisation
     * - Retourne les JWT tokens pour auto-login
     *
     * @param rawToken Le token brut recu par email
     * @param password Le mot de passe choisi par l'utilisateur
     * @return Map contenant les JWT tokens (access_token, refresh_token, etc.)
     */
    public Map<String, Object> completeInscriptionWithPassword(String rawToken, String password) {
        logger.info("Finalisation inscription avec mot de passe");

        // Lookup par hash du token
        String tokenHash = sha256(rawToken);
        PendingInscription pending = pendingInscriptionRepository.findByConfirmationTokenHash(tokenHash)
                .orElseThrow(() -> new RuntimeException("Token de confirmation invalide ou expire."));

        // Verifier le statut
        if (pending.getStatus() == PendingInscriptionStatus.COMPLETED) {
            throw new RuntimeException("Cette inscription a deja ete finalisee. Vous pouvez vous connecter.");
        }
        if (pending.getStatus() != PendingInscriptionStatus.PAYMENT_CONFIRMED) {
            throw new RuntimeException("Le paiement n'a pas encore ete confirme pour cette inscription.");
        }

        // Verifier l'expiration
        if (pending.getExpiresAt() != null && pending.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Le lien de confirmation a expire. Veuillez contacter le support.");
        }

        try {
            // 1. Creer l'utilisateur dans Keycloak
            CreateUserDto keycloakUser = new CreateUserDto();
            keycloakUser.setFirstName(pending.getFirstName());
            keycloakUser.setLastName(pending.getLastName());
            keycloakUser.setEmail(pending.getEmail());
            keycloakUser.setPassword(password);
            keycloakUser.setRole("HOST");

            String keycloakId = keycloakService.createUser(keycloakUser);
            logger.info("Utilisateur Keycloak cree avec ID: {}", keycloakId);

            // 2. Creer l'utilisateur dans la base de donnees
            User user = new User();
            user.setFirstName(pending.getFirstName());
            user.setLastName(pending.getLastName());
            user.setEmail(pending.getEmail());
            user.setPassword(password);
            user.setPhoneNumber(pending.getPhoneNumber());
            user.setKeycloakId(keycloakId);
            user.setRole(UserRole.HOST);
            user.setStatus(UserStatus.ACTIVE);
            user.setEmailVerified(true); // Email verifie via le lien de confirmation
            user.setStripeCustomerId(pending.getStripeCustomerId());
            user.setStripeSubscriptionId(pending.getStripeSubscriptionId());
            // Donnees du profil host issues du formulaire de devis
            user.setCompanyName(pending.getCompanyName());
            user.setForfait(pending.getForfait());
            user.setCity(pending.getCity());
            user.setPostalCode(pending.getPostalCode());
            user.setPropertyType(pending.getPropertyType());
            user.setPropertyCount(pending.getPropertyCount());
            user.setSurface(pending.getSurface());
            user.setGuestCapacity(pending.getGuestCapacity());
            user.setBookingFrequency(pending.getBookingFrequency());
            user.setCleaningSchedule(pending.getCleaningSchedule());
            user.setCalendarSync(pending.getCalendarSync());
            user.setServices(pending.getServices());
            user.setServicesDevis(pending.getServicesDevis());
            user.setBillingPeriod(pending.getBillingPeriod());

            userRepository.save(user);
            logger.info("Utilisateur DB cree avec ID: {} pour email: {}", user.getId(), user.getEmail());

            // 3. Creer l'organisation selon le type choisi + membership OWNER
            OrganizationType completionOrgType = OrganizationType.INDIVIDUAL;
            if (pending.getOrganizationType() != null && !pending.getOrganizationType().isBlank()) {
                try {
                    completionOrgType = OrganizationType.valueOf(pending.getOrganizationType());
                } catch (IllegalArgumentException e) {
                    logger.warn("Type d'organisation inconnu '{}', fallback sur INDIVIDUAL", pending.getOrganizationType());
                }
            }

            String orgName = pending.getCompanyName() != null && !pending.getCompanyName().isBlank()
                    ? pending.getCompanyName()
                    : pending.getFirstName() + " " + pending.getLastName();
            organizationService.createForUserWithBilling(
                    user, orgName, completionOrgType,
                    pending.getStripeCustomerId(), pending.getStripeSubscriptionId(),
                    pending.getForfait(), pending.getBillingPeriod());
            logger.info("Organisation creee pour l'utilisateur: {}", user.getEmail());

            // 4. Marquer l'inscription comme terminee
            pending.setStatus(PendingInscriptionStatus.COMPLETED);
            pendingInscriptionRepository.save(pending);

            // 5. Auto-login : obtenir les JWT tokens depuis Keycloak
            Map<String, Object> tokens = authenticateUser(pending.getEmail(), password);

            logger.info("Inscription finalisee avec succes et auto-login pour: {}", pending.getEmail());
            return tokens;

        } catch (Exception e) {
            logger.error("Erreur lors de la finalisation de l'inscription pour: {}", pending.getEmail(), e);
            throw new RuntimeException("Erreur lors de la creation du compte: " + e.getMessage(), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. Informations inscription par token (pour la page de confirmation)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Retourne les informations de l'inscription pour affichage sur la page de confirmation.
     *
     * @param rawToken Le token brut recu par email
     * @return Map avec email, fullName, forfait
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getInscriptionInfoByToken(String rawToken) {
        String tokenHash = sha256(rawToken);
        PendingInscription pending = pendingInscriptionRepository.findByConfirmationTokenHash(tokenHash)
                .orElseThrow(() -> new RuntimeException("Token de confirmation invalide."));

        // Verifier l'expiration
        if (pending.getExpiresAt() != null && pending.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Le lien de confirmation a expire.");
        }

        // Verifier le statut — si deja COMPLETED, indiquer a l'utilisateur
        if (pending.getStatus() == PendingInscriptionStatus.COMPLETED) {
            throw new IllegalStateException("ALREADY_COMPLETED");
        }

        Map<String, Object> info = new java.util.LinkedHashMap<>();
        info.put("email", pending.getEmail());
        info.put("fullName", pending.getFullName());
        info.put("forfait", pending.getForfait());
        info.put("organizationType", pending.getOrganizationType());
        return info;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. Renvoi de l'email de confirmation
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Regenere un token et renvoie l'email de confirmation.
     *
     * @param email L'email de l'utilisateur
     */
    public void resendConfirmationEmail(String email) {
        logger.info("Renvoi email de confirmation pour: {}", email);

        PendingInscription pending = pendingInscriptionRepository
                .findByEmailAndStatus(email, PendingInscriptionStatus.PAYMENT_CONFIRMED)
                .orElseThrow(() -> new RuntimeException("Aucune inscription en attente de confirmation pour cet email."));

        // Regenerer le token
        String rawToken = generateAndStoreToken(pending);

        // Mettre a jour l'expiration (72h a partir de maintenant)
        pending.setExpiresAt(LocalDateTime.now().plusHours(72));
        pendingInscriptionRepository.save(pending);

        // Envoyer l'email
        String confirmationLink = frontendUrl + "/inscription/confirm?token=" + rawToken;
        emailService.sendInscriptionConfirmationEmail(
                pending.getEmail(),
                pending.getFullName(),
                confirmationLink,
                pending.getExpiresAt()
        );

        logger.info("Email de confirmation renvoye a {}", email);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Methodes existantes conservees
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Marque une inscription comme echouee (paiement echoue)
     */
    public void markInscriptionFailed(String stripeSessionId) {
        pendingInscriptionRepository.findByStripeSessionId(stripeSessionId)
                .ifPresent(pending -> {
                    pending.setStatus(PendingInscriptionStatus.PAYMENT_FAILED);
                    pendingInscriptionRepository.save(pending);
                    logger.info("Inscription marquee comme echouee pour: {}", pending.getEmail());
                });
    }

    /**
     * Nettoie les inscriptions expirees (appelable via un cron job)
     */
    public void cleanupExpiredInscriptions() {
        pendingInscriptionRepository.deleteByStatusAndExpiresAtBefore(
                PendingInscriptionStatus.PENDING_PAYMENT,
                LocalDateTime.now()
        );
        logger.info("Nettoyage des inscriptions expirees effectue");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Methodes privees utilitaires
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Genere un token UUID, stocke son hash SHA-256 dans l'inscription, et retourne le token brut.
     */
    private String generateAndStoreToken(PendingInscription pending) {
        String rawToken = UUID.randomUUID().toString();
        pending.setConfirmationTokenHash(sha256(rawToken));
        pendingInscriptionRepository.save(pending);
        return rawToken;
    }

    /**
     * Envoie l'email de confirmation pour une inscription deja confirmee (re-envoi).
     */
    private void sendConfirmationEmail(PendingInscription pending) {
        try {
            String rawToken = generateAndStoreToken(pending);
            String confirmationLink = frontendUrl + "/inscription/confirm?token=" + rawToken;
            emailService.sendInscriptionConfirmationEmail(
                    pending.getEmail(),
                    pending.getFullName(),
                    confirmationLink,
                    pending.getExpiresAt()
            );
        } catch (Exception e) {
            logger.error("Erreur lors du renvoi de l'email de confirmation pour: {}", pending.getEmail(), e);
        }
    }

    /**
     * Authentifie un utilisateur aupres de Keycloak et retourne les JWT tokens.
     * Meme pattern que AuthController.login().
     */
    private Map<String, Object> authenticateUser(String email, String password) {
        String tokenUrl = keycloakUrl + "/realms/" + realm + "/protocol/openid-connect/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("username", email);
        params.add("password", password);
        params.add("grant_type", "password");
        params.add("client_id", clientId);
        if (clientSecret != null && !clientSecret.isEmpty()) {
            params.add("client_secret", clientSecret);
        }

        ResponseEntity<Map> keycloakResponse = restTemplate.postForEntity(tokenUrl, params, Map.class);

        if (keycloakResponse.getStatusCode().is2xxSuccessful() && keycloakResponse.getBody() != null) {
            Map<String, Object> tokenData = keycloakResponse.getBody();
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("access_token", tokenData.get("access_token"));
            result.put("refresh_token", tokenData.get("refresh_token"));
            result.put("id_token", tokenData.get("id_token"));
            result.put("expires_in", tokenData.get("expires_in"));
            result.put("token_type", tokenData.get("token_type"));
            return result;
        }

        throw new RuntimeException("Erreur lors de l'authentification automatique apres inscription.");
    }

    /**
     * Calcule le hash SHA-256 d'une chaine de caracteres.
     * Meme pattern que OrganizationInvitationService.
     */
    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 non disponible", e);
        }
    }
}
