package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.core.KafkaTemplate;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Flux deterministe menage auto post-checkout (fiche 08, F1a/F2a/F4d) :
 * creation idempotente par cle propriete x dates, gates metier explicites,
 * annulation liee.
 */
@ExtendWith(MockitoExtension.class)
class ServiceRequestAutoCleaningTest {

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private UserRepository userRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private NotificationService notificationService;
    @Mock private PropertyTeamService propertyTeamService;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private ServiceRequestMapper serviceRequestMapper;
    @Mock private AssignmentEventRepository assignmentEventRepository;
    @Mock private WorkflowSettingsRepository workflowSettingsRepository;
    @Mock
    private com.clenzy.service.pricing.CleaningPricingEngine cleaningPricingEngine;
    @Mock private com.clenzy.service.pricing.HousekeeperScoreService housekeeperScoreService;

    private ServiceRequestService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;
    private static final LocalDate CHECK_IN = LocalDate.of(2026, 7, 10);
    private static final LocalDate CHECK_OUT = LocalDate.of(2026, 7, 14);
    private static final String EXPECTED_KEY = "AUTO_CLEANING:100:2026-07-10:2026-07-14";

    private Property property;
    private User owner;

    @BeforeEach
    void setUp() {
        service = new ServiceRequestService(
                serviceRequestRepository, userRepository, propertyRepository,
                interventionRepository, reservationRepository, teamRepository, notificationService,
                propertyTeamService, kafkaTemplate, new TenantContext(), serviceRequestMapper,
                assignmentEventRepository, workflowSettingsRepository,
                cleaningPricingEngine, housekeeperScoreService);

        // Le moteur ménage est mocké : conseil 95 € (fourchette 80-110, 135 min).
        // lenient : certains tests s'arrêtent avant le calcul (skip idempotent).
        lenient().when(cleaningPricingEngine.resolveCleaningPrice(any(), any(), isNull(), any()))
                .thenReturn(new com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice(
                        java.math.BigDecimal.valueOf(95),
                        com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource.ENGINE,
                        new com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote(
                                135, java.math.BigDecimal.valueOf(95),
                                java.math.BigDecimal.valueOf(80), java.math.BigDecimal.valueOf(110))));

        owner = new User();
        owner.setId(7L);
        owner.setKeycloakId("owner-kc");

        property = new Property();
        property.setId(PROPERTY_ID);
        property.setName("Studio Paris");
        property.setOrganizationId(ORG_ID);
        property.setOwner(owner);
        property.setCleaningFrequency(CleaningFrequency.AFTER_EACH_STAY);
        property.setDefaultCheckOutTime("10:30");
    }

    // ── Creation (F1a) ───────────────────────────────────────────────────────

    @Test
    void whenEligibleBooking_thenCreatesCleaningRequestAtCheckoutDate() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID)).thenReturn(Optional.empty());
        when(serviceRequestRepository.save(any(ServiceRequest.class)))
            .thenAnswer(inv -> {
                ServiceRequest sr = inv.getArgument(0);
                if (sr.getId() == null) sr.setId(55L);
                return sr;
            });
        when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());
        when(propertyTeamService.findAvailableTeamForProperty(anyLong(), any(), any(), any(), anyLong()))
            .thenReturn(Optional.empty());

        var outcome = service.createAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT, 42L);

        assertThat(outcome.executed()).isTrue();
        ServiceRequest created = outcome.request();
        assertThat(created.getAutoFlowKey()).isEqualTo(EXPECTED_KEY);
        assertThat(created.getServiceType()).isEqualTo(ServiceType.CLEANING);
        assertThat(created.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(created.getReservationId()).isEqualTo(42L);
        assertThat(created.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(created.getUser()).isEqualTo(owner);
        // Planifie a la date de check-out, a l'heure de checkout de la propriete.
        assertThat(created.getDesiredDate().toLocalDate()).isEqualTo(CHECK_OUT);
        assertThat(created.getDesiredDate().toLocalTime()).isEqualTo(LocalTime.of(10, 30));
        // Notification interne org.
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(ORG_ID), eq(NotificationKey.SERVICE_REQUEST_CREATED), anyString(), anyString(), anyString());
    }

    @Test
    void whenRequestAlreadyExistsForStay_thenIdempotentSkip() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID))
            .thenReturn(Optional.of(new ServiceRequest()));

        var outcome = service.createAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT, 42L);

        assertThat(outcome.executed()).isFalse();
        assertThat(outcome.skipReason()).contains("deja existante");
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void whenConcurrentInsertHitsUniqueIndex_thenIdempotentSkip() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID)).thenReturn(Optional.empty());
        when(serviceRequestRepository.save(any(ServiceRequest.class)))
            .thenThrow(new DataIntegrityViolationException("duplicate key idx_service_requests_auto_flow_key"));

        var outcome = service.createAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT, 42L);

        assertThat(outcome.executed()).isFalse();
        assertThat(outcome.skipReason()).contains("concurrente");
    }

    @Test
    void whenCleaningFrequencyIsNotAfterEachStay_thenSkips() {
        property.setCleaningFrequency(CleaningFrequency.WEEKLY);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

        var outcome = service.createAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT, 42L);

        assertThat(outcome.executed()).isFalse();
        assertThat(outcome.skipReason()).contains("WEEKLY");
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void whenPropertyBelongsToAnotherOrganization_thenSkips() {
        property.setOrganizationId(999L);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

        var outcome = service.createAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT, 42L);

        assertThat(outcome.executed()).isFalse();
        assertThat(outcome.skipReason()).contains("hors organisation");
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void whenAutoAssignDisabledForOrg_thenNoAssignmentAttempt() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID)).thenReturn(Optional.empty());
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        WorkflowSettings ws = new WorkflowSettings();
        ws.setAutoAssignInterventions(false);
        when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(ws));

        var outcome = service.createAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT, 42L);

        assertThat(outcome.executed()).isTrue();
        verifyNoInteractions(propertyTeamService);
    }

    // ── Annulation liee (F2a) ────────────────────────────────────────────────

    @Test
    void whenReservationCancelled_thenCancelsPendingAutoRequest_andFreesKey() {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(55L);
        sr.setTitle("Menage apres depart - Studio Paris");
        sr.setStatus(RequestStatus.PENDING);
        sr.setAutoFlowKey(EXPECTED_KEY);
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID)).thenReturn(Optional.of(sr));
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        var outcome = service.cancelAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT);

        assertThat(outcome.executed()).isTrue();
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.CANCELLED);
        // La cle est liberee : une re-reservation des memes dates recree un menage,
        // et une re-livraison du CANCELLED devient un no-op.
        assertThat(sr.getAutoFlowKey()).isEqualTo(EXPECTED_KEY + ":CANCELLED:55");
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(ORG_ID), eq(NotificationKey.SERVICE_REQUEST_CANCELLED), anyString(), anyString(), anyString());
    }

    @Test
    void whenNoAutoRequestForStay_thenCancelIsNoOp() {
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID)).thenReturn(Optional.empty());

        var outcome = service.cancelAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT);

        assertThat(outcome.executed()).isFalse();
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void whenCleaningAlreadyStarted_thenCancelSkips() {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(55L);
        sr.setStatus(RequestStatus.IN_PROGRESS);
        sr.setAutoFlowKey(EXPECTED_KEY);
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID)).thenReturn(Optional.of(sr));

        var outcome = service.cancelAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT);

        assertThat(outcome.executed()).isFalse();
        assertThat(outcome.skipReason()).contains("commencee");
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void whenCleaningCompleted_thenCancelSkips() {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(55L);
        sr.setStatus(RequestStatus.COMPLETED);
        sr.setAutoFlowKey(EXPECTED_KEY);
        when(serviceRequestRepository.findByAutoFlowKey(EXPECTED_KEY, ORG_ID)).thenReturn(Optional.of(sr));

        var outcome = service.cancelAutomaticCleaningRequest(ORG_ID, PROPERTY_ID, CHECK_IN, CHECK_OUT);

        assertThat(outcome.executed()).isFalse();
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void buildAutoCleaningKey_isStablePerPropertyAndStayDates() {
        assertThat(ServiceRequestService.buildAutoCleaningKey(PROPERTY_ID, CHECK_IN, CHECK_OUT))
            .isEqualTo(EXPECTED_KEY);
        assertThat(ServiceRequestService.buildAutoCleaningKey(PROPERTY_ID, null, CHECK_OUT))
            .isEqualTo("AUTO_CLEANING:100:NA:2026-07-14");
    }
}
