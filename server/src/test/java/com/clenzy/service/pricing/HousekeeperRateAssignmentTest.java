package com.clenzy.service.pricing;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Moteur Ménage 2A — application du tarif prestataire à l'ASSIGNATION.
 * Vérifie : montant réévalué quand la mission n'est pas engagée financièrement ;
 * montant INTOUCHÉ quand elle est payée/avancée ; recommendedCost jamais modifié.
 */
@ExtendWith(MockitoExtension.class)
class HousekeeperRateAssignmentTest {

    private static final ResolvedCleaningPrice PRO_PRICE = new ResolvedCleaningPrice(
            BigDecimal.valueOf(88), CleaningPriceSource.HOUSEKEEPER_RATE,
            new CleaningQuote(135, BigDecimal.valueOf(95), BigDecimal.valueOf(80), BigDecimal.valueOf(110)));

    // ─── InterventionService.assign ─────────────────────────────────────────

    @Nested
    @DisplayName("InterventionService.assign — recalcul au tarif du pro")
    class InterventionAssign {

        @Mock private InterventionRepository interventionRepository;
        @Mock private UserRepository userRepository;
        @Mock private TeamRepository teamRepository;
        @Mock private NotificationService notificationService;
        @Mock private TenantContext tenantContext;
        @Mock private InterventionPhotoService photoService;
        @Mock private InterventionMapper interventionMapper;
        @Mock private InterventionAccessPolicy accessPolicy;
        @Mock private CleaningPricingEngine cleaningPricingEngine;
        @Mock private com.clenzy.service.email.MissionAssignmentEmailComposer missionAssignmentEmailComposer;

        private InterventionService service() {
            return new InterventionService(interventionRepository, userRepository, teamRepository,
                    notificationService, tenantContext, photoService, interventionMapper, accessPolicy,
                    cleaningPricingEngine, missionAssignmentEmailComposer);
        }

        private Jwt adminJwt() {
            return Jwt.withTokenValue("t")
                    .header("alg", "RS256")
                    .claim("sub", "admin-kc")
                    .claim("realm_access", Map.of("roles", List.of("SUPER_ADMIN")))
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();
        }

        private Intervention cleaningIntervention(InterventionStatus status, PaymentStatus paymentStatus) {
            Property property = new Property();
            property.setId(3L);
            property.setOrganizationId(7L);
            Intervention intervention = new Intervention();
            intervention.setId(11L);
            intervention.setType(InterventionType.CLEANING.name());
            intervention.setStatus(status);
            intervention.setPaymentStatus(paymentStatus);
            intervention.setProperty(property);
            intervention.setEstimatedCost(BigDecimal.valueOf(120));
            intervention.setRecommendedCost(BigDecimal.valueOf(95));
            return intervention;
        }

        private void stubCommon(Intervention intervention) {
            when(interventionRepository.findById(11L)).thenReturn(Optional.of(intervention));
            when(userRepository.findById(42L)).thenReturn(Optional.of(new User()));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(null);
        }

        @Test
        void whenPendingUnpaid_thenEstimatedCostFollowsProRate_andRecommendedUntouched() {
            Intervention intervention = cleaningIntervention(InterventionStatus.PENDING, PaymentStatus.PENDING);
            stubCommon(intervention);
            when(cleaningPricingEngine.resolveCleaningPrice(any(), any(), eq(42L))).thenReturn(PRO_PRICE);

            service().assign(11L, 42L, null, adminJwt());

            assertThat(intervention.getEstimatedCost()).isEqualByComparingTo("88");
            assertThat(intervention.getRecommendedCost()).isEqualByComparingTo("95");
        }

        @Test
        void whenAlreadyPaid_thenAmountUntouched() {
            Intervention intervention = cleaningIntervention(InterventionStatus.PENDING, PaymentStatus.PAID);
            stubCommon(intervention);

            service().assign(11L, 42L, null, adminJwt());

            assertThat(intervention.getEstimatedCost()).isEqualByComparingTo("120");
            verify(cleaningPricingEngine, never()).resolveCleaningPrice(any(), any(), anyLong());
        }

        @Test
        void whenStatusBeyondPending_thenAmountUntouched() {
            Intervention intervention = cleaningIntervention(InterventionStatus.IN_PROGRESS, PaymentStatus.PENDING);
            stubCommon(intervention);

            service().assign(11L, 42L, null, adminJwt());

            assertThat(intervention.getEstimatedCost()).isEqualByComparingTo("120");
            verify(cleaningPricingEngine, never()).resolveCleaningPrice(any(), any(), anyLong());
        }

        @Test
        void whenNoProRateResolved_thenAmountUntouched() {
            Intervention intervention = cleaningIntervention(InterventionStatus.PENDING, PaymentStatus.PENDING);
            stubCommon(intervention);
            // Repli existant (pas de tarif pro) → source ENGINE : on ne touche pas au pratiqué.
            when(cleaningPricingEngine.resolveCleaningPrice(any(), any(), eq(42L)))
                    .thenReturn(new ResolvedCleaningPrice(BigDecimal.valueOf(95), CleaningPriceSource.ENGINE, PRO_PRICE.quote()));

            service().assign(11L, 42L, null, adminJwt());

            assertThat(intervention.getEstimatedCost()).isEqualByComparingTo("120");
        }
    }

    // ─── ServiceRequestService.manualAssign ─────────────────────────────────

    @Nested
    @DisplayName("ServiceRequestService.manualAssign — recalcul au tarif du pro")
    class ManualAssign {

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
        @Mock private CleaningPricingEngine cleaningPricingEngine;
        @Mock private com.clenzy.service.pricing.HousekeeperScoreService housekeeperScoreService;
        @Mock private com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService;
        @Mock private com.clenzy.service.agent.supervision.SupervisionAutoApplyService supervisionAutoApplyService;
        @Mock private com.clenzy.service.agent.supervision.AutoApplyGate autoApplyGate;

        private ServiceRequestService service() {
            return new ServiceRequestService(serviceRequestRepository, userRepository, propertyRepository,
                    interventionRepository, reservationRepository, teamRepository, notificationService,
                    propertyTeamService, kafkaTemplate, new TenantContext(), serviceRequestMapper,
                    assignmentEventRepository, workflowSettingsRepository, cleaningPricingEngine, housekeeperScoreService,
                    supervisionSuggestionService, supervisionAutoApplyService, autoApplyGate);
        }

        private ServiceRequest cleaningSr(RequestStatus status) {
            Property property = new Property();
            property.setId(3L);
            property.setOrganizationId(7L);
            ServiceRequest sr = new ServiceRequest();
            sr.setId(1L);
            sr.setStatus(status);
            sr.setServiceType(ServiceType.CLEANING);
            sr.setProperty(property);
            sr.setEstimatedCost(BigDecimal.valueOf(120));
            sr.setRecommendedCost(BigDecimal.valueOf(95));
            return sr;
        }

        @Test
        void whenUserAssignedOnUnpaidCleaningSr_thenEstimatedCostFollowsProRate() {
            ServiceRequest sr = cleaningSr(RequestStatus.PENDING);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new com.clenzy.dto.ServiceRequestDto());
            when(cleaningPricingEngine.resolveCleaningPrice(any(), eq("CLEANING"), eq(42L))).thenReturn(PRO_PRICE);

            service().manualAssign(1L, 42L, "user");

            assertThat(sr.getEstimatedCost()).isEqualByComparingTo("88");
            assertThat(sr.getRecommendedCost()).isEqualByComparingTo("95");
        }

        @Test
        void whenTeamAssigned_thenNoRateLookup() {
            ServiceRequest sr = cleaningSr(RequestStatus.PENDING);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new com.clenzy.dto.ServiceRequestDto());

            service().manualAssign(1L, 77L, "team");

            assertThat(sr.getEstimatedCost()).isEqualByComparingTo("120");
            verify(cleaningPricingEngine, never()).resolveCleaningPrice(any(), any(), anyLong());
        }

        @Test
        void whenSrAlreadyPaid_thenAmountUntouched() {
            ServiceRequest sr = cleaningSr(RequestStatus.AWAITING_PAYMENT);
            sr.setPaidAt(java.time.LocalDateTime.now());
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new com.clenzy.dto.ServiceRequestDto());

            service().manualAssign(1L, 42L, "user");

            assertThat(sr.getEstimatedCost()).isEqualByComparingTo("120");
            verify(cleaningPricingEngine, never()).resolveCleaningPrice(any(), any(), anyLong());
        }
    }
}
