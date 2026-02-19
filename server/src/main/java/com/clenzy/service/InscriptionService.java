package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.InscriptionDto;
import com.clenzy.model.*;
import com.clenzy.repository.PendingInscriptionRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Service gerant le flux d'inscription :
 * 1. Validation des donnees + creation de la session Stripe Checkout
 * 2. Stockage de l'inscription en attente (PendingInscription)
 * 3. Finalisation apres paiement (creation Keycloak + DB user)
 */
@Service
@Transactional
public class InscriptionService {

    private static final Logger logger = LoggerFactory.getLogger(InscriptionService.class);

    private final PendingInscriptionRepository pendingInscriptionRepository;
    private final UserRepository userRepository;
    private final KeycloakService keycloakService;
    private final OrganizationService organizationService;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.inscription.success-url:${FRONTEND_URL:http://localhost:3000}/login?inscription=success}")
    private String inscriptionSuccessUrl;

    @Value("${stripe.inscription.cancel-url:${FRONTEND_URL:http://localhost:3000}/inscription?payment=cancelled}")
    private String inscriptionCancelUrl;

    public InscriptionService(
            PendingInscriptionRepository pendingInscriptionRepository,
            UserRepository userRepository,
            KeycloakService keycloakService,
            OrganizationService organizationService) {
        this.pendingInscriptionRepository = pendingInscriptionRepository;
        this.userRepository = userRepository;
        this.keycloakService = keycloakService;
        this.organizationService = organizationService;
    }

    /**
     * Initie le processus d'inscription :
     * - Verifie que l'email n'est pas deja utilise
     * - Cree une session Stripe Checkout pour le forfait choisi
     * - Sauvegarde l'inscription en attente dans la base
     *
     * @return L'URL de la session Stripe Checkout pour rediriger le client
     */
    public Map<String, String> initiateInscription(InscriptionDto dto) throws StripeException {
        logger.info("Initiation inscription pour email: {}, forfait: {}", dto.getEmail(), dto.getForfait());

        // Verifier que l'email n'est pas deja utilise dans la table users
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Un compte existe deja avec cet email");
        }

        // Verifier s'il existe deja une inscription en attente pour cet email
        // Si oui, la supprimer pour permettre une nouvelle tentative
        pendingInscriptionRepository.findByEmailAndStatus(dto.getEmail(), PendingInscriptionStatus.PENDING_PAYMENT)
                .ifPresent(existing -> {
                    logger.info("Suppression de l'inscription en attente existante pour: {}", dto.getEmail());
                    pendingInscriptionRepository.delete(existing);
                });

        // Prix de base de l'abonnement PMS mensuel en centimes
        int priceInCents = InscriptionDto.PMS_SUBSCRIPTION_PRICE_CENTS;

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
                .setSuccessUrl(inscriptionSuccessUrl)
                .setCancelUrl(inscriptionCancelUrl)
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
                                                                .setName("Clenzy - Abonnement plateforme")
                                                                .setDescription(billingDescription + " a la plateforme de gestion Clenzy - Forfait " + dto.getForfaitDisplayName())
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

        // Sauvegarder l'inscription en attente
        PendingInscription pending = new PendingInscription();
        pending.setFirstName(dto.getFirstName());
        pending.setLastName(dto.getLastName());
        pending.setEmail(dto.getEmail());
        pending.setPassword(dto.getPassword()); // Stocke en clair, sera passe a Keycloak lors de la finalisation
        pending.setPhoneNumber(dto.getPhone());
        pending.setCompanyName(dto.getCompanyName());
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
        // Stocker les listes de services en String séparé par virgule
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

        return Map.of(
                "checkoutUrl", session.getUrl(),
                "sessionId", session.getId()
        );
    }

    /**
     * Finalise l'inscription apres confirmation du paiement de la subscription Stripe.
     * Appele par le webhook Stripe lors de l'evenement checkout.session.completed.
     *
     * - Cree l'utilisateur dans Keycloak
     * - Cree l'utilisateur dans la base de donnees
     * - Marque l'inscription comme terminee
     *
     * @param stripeSessionId ID de la session Checkout Stripe
     * @param stripeCustomerId ID du customer Stripe (pour gerer la subscription)
     * @param stripeSubscriptionId ID de la subscription Stripe (pour annulation/modification)
     */
    public void completeInscription(String stripeSessionId, String stripeCustomerId, String stripeSubscriptionId) {
        logger.info("Finalisation de l'inscription pour la session Stripe: {}", stripeSessionId);

        PendingInscription pending = pendingInscriptionRepository.findByStripeSessionId(stripeSessionId)
                .orElseThrow(() -> new RuntimeException("Inscription en attente non trouvee pour la session: " + stripeSessionId));

        if (pending.getStatus() == PendingInscriptionStatus.COMPLETED) {
            logger.warn("Inscription deja finalisee pour la session: {}", stripeSessionId);
            return;
        }

        try {
            // 1. Creer l'utilisateur dans Keycloak
            CreateUserDto keycloakUser = new CreateUserDto();
            keycloakUser.setFirstName(pending.getFirstName());
            keycloakUser.setLastName(pending.getLastName());
            keycloakUser.setEmail(pending.getEmail());
            keycloakUser.setPassword(pending.getPassword()); // Mot de passe en clair pour Keycloak
            keycloakUser.setRole("HOST");

            String keycloakId = keycloakService.createUser(keycloakUser);
            logger.info("Utilisateur Keycloak cree avec ID: {}", keycloakId);

            // 2. Creer l'utilisateur dans la base de donnees
            User user = new User();
            user.setFirstName(pending.getFirstName());
            user.setLastName(pending.getLastName());
            user.setEmail(pending.getEmail());
            user.setPassword(pending.getPassword()); // Coherent avec le reste du projet
            user.setPhoneNumber(pending.getPhoneNumber());
            user.setKeycloakId(keycloakId);
            user.setRole(UserRole.HOST);
            user.setStatus(UserStatus.ACTIVE);
            user.setEmailVerified(true); // Email verifie via le paiement
            // Stocker les IDs Stripe pour gerer la subscription (annulation, modification, renouvellement)
            user.setStripeCustomerId(stripeCustomerId);
            user.setStripeSubscriptionId(stripeSubscriptionId);
            // Donnees du profil host issues du formulaire de devis (si l'utilisateur est passe par le formulaire)
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
            logger.info("Utilisateur DB cree avec ID: {} pour email: {}, subscription: {}", user.getId(), user.getEmail(), stripeSubscriptionId);

            // 2b. Creer l'organisation (INDIVIDUAL par defaut) + membership OWNER
            String orgName = pending.getCompanyName() != null && !pending.getCompanyName().isBlank()
                    ? pending.getCompanyName()
                    : pending.getFirstName() + " " + pending.getLastName();
            organizationService.createForUserWithBilling(
                    user, orgName, OrganizationType.INDIVIDUAL,
                    stripeCustomerId, stripeSubscriptionId, pending.getForfait(),
                    pending.getBillingPeriod());
            logger.info("Organisation creee pour l'utilisateur: {}", user.getEmail());

            // 3. Marquer l'inscription comme terminee
            pending.setStatus(PendingInscriptionStatus.COMPLETED);
            pendingInscriptionRepository.save(pending);

            logger.info("Inscription finalisee avec succes pour: {}", pending.getEmail());

        } catch (Exception e) {
            logger.error("Erreur lors de la finalisation de l'inscription pour: {}", pending.getEmail(), e);
            pending.setStatus(PendingInscriptionStatus.PAYMENT_FAILED);
            pendingInscriptionRepository.save(pending);
            throw new RuntimeException("Erreur lors de la creation du compte: " + e.getMessage(), e);
        }
    }

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
}
