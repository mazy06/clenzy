package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.booking.dto.BookingCheckoutRequestDto;
import com.clenzy.booking.dto.SiteDomainRequest;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SiteDomain;
import com.clenzy.booking.model.SiteDomainStatus;
import com.clenzy.booking.repository.SiteDomainRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.booking.security.BookingFraudScoringService;
import com.clenzy.booking.security.RiskAssessment;
import com.clenzy.booking.security.RiskLevel;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.booking.service.SiteAdminService;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.integration.cloudflare.CloudflareCustomHostnameService;
import com.clenzy.model.FiscalProfile;
import com.clenzy.model.InvoiceType;
import com.clenzy.model.Notification;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.TaxRule;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookDelivery;
import com.clenzy.model.WebhookEventType;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.NotificationRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.TaxRuleRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.WebhookConfigRepository;
import com.clenzy.repository.WebhookDeliveryRepository;
import com.clenzy.service.ICalImportService;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.WebhookEventPublisher;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Écritures déclenchées APRÈS commit, sur base réelle.
 *
 * <p>Dans un callback {@code afterCommit}, Spring garde la transaction déjà commitée liée au
 * thread : un service {@code @Transactional} (REQUIRED) la « rejoint » sans qu'aucun commit ne
 * suive. Un INSERT en IDENTITY y est différé puis jamais flushé, un UPDATE par dirty-checking
 * n'est jamais flushé non plus — la ligne est perdue sans erreur. Chaque scénario passe par le
 * vrai chemin applicatif et relit la base après coup.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class AfterCommitWritesIT extends AbstractIntegrationTest {

    @MockBean private BookingFraudScoringService fraudScoringService;
    @MockBean private PaymentOrchestrationService orchestrationService;
    @MockBean private SupervisionSuggestionService supervisionSuggestionService;
    @MockBean private CloudflareCustomHostnameService cloudflareService;

    @Autowired private PublicBookingService publicBookingService;
    @Autowired private SiteAdminService siteAdminService;
    @Autowired private WebhookEventPublisher webhookEventPublisher;
    @Autowired private ICalImportService icalImportService;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private WebhookConfigRepository webhookConfigRepository;
    @Autowired private WebhookDeliveryRepository webhookDeliveryRepository;
    @Autowired private SiteRepository siteRepository;
    @Autowired private SiteDomainRepository siteDomainRepository;
    @Autowired private FiscalProfileRepository fiscalProfileRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private TaxRuleRepository taxRuleRepository;

    private String salt;
    private Organization org;
    private String adminKeycloakId;
    private Property property;

    @BeforeEach
    void seed() {
        salt = UUID.randomUUID().toString().substring(0, 8);
        org = organizationRepository.save(new Organization(
                "Post-commit " + salt, OrganizationType.INDIVIDUAL, "post-commit-" + salt));

        User admin = new User("Ada", "Admin", "ada." + salt + "@test.com", "password123");
        admin.setOrganizationId(org.getId());
        admin.setRole(UserRole.SUPER_MANAGER);
        adminKeycloakId = "kc-admin-" + salt;
        admin.setKeycloakId(adminKeycloakId);
        userRepository.save(admin);

        User owner = new User("Olga", "Hote", "olga." + salt + "@test.com", "password123");
        owner.setOrganizationId(org.getId());
        owner.setKeycloakId("kc-owner-" + salt);
        owner = userRepository.save(owner);
        property = new Property("Studio " + salt, "3 rue C", 1, 1, owner);
        property.setOrganizationId(org.getId());
        property = propertyRepository.save(property);
    }

    @Test
    void whenCheckoutIsFlaggedForReview_thenFraudReviewNotificationIsCommitted() {
        String code = seedPendingReservation();
        when(fraudScoringService.isEnabled()).thenReturn(true);
        when(fraudScoringService.isEnforcement()).thenReturn(true);
        when(fraudScoringService.score(any())).thenReturn(
                new RiskAssessment(55, RiskLevel.MEDIUM, List.of("vélocité IP")));
        when(orchestrationService.initiatePayment(eq(org.getId()), any(), any())).thenReturn(
                new PaymentOrchestrationResult(null,
                        PaymentResult.success("cs_" + salt, "https://pay.example/cs_" + salt),
                        PaymentProviderType.STRIPE));
        BookingEngineConfig config = new BookingEngineConfig();
        config.setCollectPaymentOnBooking(true);

        publicBookingService.checkout(new PublicBookingService.OrgContext(org, config),
                new BookingCheckoutRequestDto(code, null), "203.0.113.7");

        List<Notification> received = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(adminKeycloakId, PageRequest.of(0, 10));
        assertThat(received).extracting(Notification::getNotificationKey)
                .containsExactly(NotificationKey.BOOKING_FRAUD_REVIEW);
    }

    @Test
    void whenWebhookIsPublishedInATransaction_thenTheImmediateAttemptIsRecorded() {
        WebhookConfig webhook = new WebhookConfig();
        webhook.setOrganizationId(org.getId());
        // Adresse privée : refusée par la garde SSRF, donc tentative en échec sans réseau.
        webhook.setUrl("https://127.0.0.1/hook");
        webhook.setSecretHash("secret-" + salt);
        webhook.setEvents("*");
        Long webhookId = webhookConfigRepository.save(webhook).getId();

        transactionTemplate.executeWithoutResult(status -> webhookEventPublisher.publish(
                WebhookEventType.PAYMENT_CONFIRMED, org.getId(), Map.of("reservationId", 1)));

        WebhookDelivery delivery = webhookDeliveryRepository.findAll().stream()
                .filter(d -> webhookId.equals(d.getWebhookId()))
                .findFirst().orElseThrow();
        assertThat(delivery.getAttempts()).isEqualTo(1);
        assertThat(delivery.getStatus()).isEqualTo(WebhookDelivery.DeliveryStatus.RETRYING);
    }

    @Test
    void whenCustomDomainIsAdded_thenItsCloudflareProvisioningIsCommitted() {
        Site site = new Site();
        site.setOrganizationId(org.getId());
        site.setSlug("site-" + salt);
        Long siteId = siteRepository.save(site).getId();
        when(cloudflareService.isEnabled()).thenReturn(true);
        when(cloudflareService.createCustomHostname(anyString())).thenReturn(Optional.of(
                new CloudflareCustomHostnameService.HostnameResult("cf-" + salt, SiteDomainStatus.ACTIVE)));

        siteAdminService.addDomain(org.getId(), siteId, new SiteDomainRequest("www." + salt + ".example", true));

        SiteDomain domain = siteDomainRepository.findBySiteId(siteId).get(0);
        assertThat(domain.getCloudflareHostnameId()).isEqualTo("cf-" + salt);
        assertThat(domain.getStatus()).isEqualTo(SiteDomainStatus.ACTIVE);
        assertThat(domain.isVerified()).isTrue();
    }

    @Test
    void whenImportedOtaReservationIsInvoicedAfterCommit_thenItsInvoiceIsCommitted() {
        FiscalProfile profile = new FiscalProfile();
        profile.setOrganizationId(org.getId());
        fiscalProfileRepository.save(profile);
        // Référentiel fiscal global (seedé par Liquibase hors test) : une seule règle, sans doublon.
        LocalDate since = LocalDate.now().minusYears(1);
        if (taxRuleRepository.findApplicableRule("FR", "ACCOMMODATION", LocalDate.now()).isEmpty()) {
            taxRuleRepository.save(new TaxRule("FR", "ACCOMMODATION", new BigDecimal("0.1000"), "TVA 10%", since));
        }
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(org.getId());
        reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.now().plusDays(10));
        reservation.setCheckOut(LocalDate.now().plusDays(12));
        reservation.setStatus("confirmed");
        reservation.setSource("airbnb");
        reservation.setGuestName("Ines Voyageuse");
        reservation.setTotalPrice(new BigDecimal("300.00"));
        reservation.setCurrency("EUR");
        Long reservationId = reservationRepository.save(reservation).getId();

        // Reproduit l'import iCal : la facturation part APRÈS le commit de l'import.
        afterCommit(() -> icalImportService.invoiceImportedReservation(reservationId));

        assertThat(invoiceRepository.findByReservationIdAndInvoiceType(reservationId, InvoiceType.GUEST))
                .isPresent();
    }

    private void afterCommit(Runnable action) {
        transactionTemplate.executeWithoutResult(status ->
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        action.run();
                    }
                }));
    }

    private String seedPendingReservation() {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(org.getId());
        reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.now().plusDays(20));
        reservation.setCheckOut(LocalDate.now().plusDays(23));
        reservation.setStatus("pending");
        reservation.setTotalPrice(new BigDecimal("420.00"));
        reservation.setCurrency("EUR");
        reservation.setConfirmationCode("PC-" + salt);
        return reservationRepository.save(reservation).getConfirmationCode();
    }
}
