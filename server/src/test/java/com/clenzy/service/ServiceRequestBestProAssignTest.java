package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice;
import com.clenzy.service.pricing.HousekeeperScoreService;
import com.clenzy.service.pricing.HousekeeperScoreService.HousekeeperScore;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.kafka.core.KafkaTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Auto-assignation du meilleur pro (Moteur Ménage 3D) : après la sélection
 * d'équipe, si l'org a activé {@code autoAssignBestPro}, la SR est promue vers
 * le MEILLEUR housekeeper de l'équipe (score qualité desc, à ±10 pts tarif le
 * plus proche de la médiane conseil, puis moins de missions ouvertes du jour).
 * Toggle OFF (défaut) = comportement équipe strictement intact.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ServiceRequestBestProAssignTest {

    private static final Long ORG_ID = 1L;
    private static final Long TEAM_ID = 5L;

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
    @Mock private HousekeeperScoreService housekeeperScoreService;
    @Mock private com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService;
    @Mock private com.clenzy.service.agent.supervision.SupervisionAutoApplyService supervisionAutoApplyService;
    @Mock private com.clenzy.service.agent.supervision.AutoApplyGate autoApplyGate;
    @Mock private com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;

    private ServiceRequestService service;
    private ServiceRequest sr;
    private Property property;
    private Team team;

    @BeforeEach
    void setUp() {
        service = new ServiceRequestService(
                serviceRequestRepository, userRepository, propertyRepository,
                interventionRepository, reservationRepository, teamRepository, notificationService,
                propertyTeamService, kafkaTemplate, new TenantContext(), serviceRequestMapper,
                assignmentEventRepository, workflowSettingsRepository,
                cleaningPricingEngine, housekeeperScoreService,
                supervisionSuggestionService, supervisionAutoApplyService, autoApplyGate,
                organizationAccessGuard);

        property = new Property();
        property.setId(100L);
        property.setOrganizationId(ORG_ID);

        sr = new ServiceRequest();
        sr.setId(55L);
        sr.setTitle("Menage post-checkout");
        sr.setOrganizationId(ORG_ID);
        sr.setProperty(property);
        sr.setServiceType(ServiceType.CLEANING);
        sr.setDesiredDate(LocalDateTime.of(2026, 7, 14, 10, 30));

        team = new Team();
        team.setId(TEAM_ID);
        team.setName("Equipe menage");
        team.setMembers(new ArrayList<>());

        when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());
        when(propertyTeamService.findAvailableTeamForProperty(anyLong(), any(), any(), any()))
                .thenReturn(Optional.of(TEAM_ID));
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(teamRepository.findById(TEAM_ID)).thenReturn(Optional.of(team));
        // Médiane conseil moteur : 95 €.
        when(cleaningPricingEngine.quote(any(Property.class), anyString()))
                .thenReturn(new CleaningQuote(135, BigDecimal.valueOf(95),
                        BigDecimal.valueOf(80), BigDecimal.valueOf(110)));
    }

    private User addHousekeeper(long id, String keycloakId) {
        User user = new User();
        user.setId(id);
        user.setKeycloakId(keycloakId);
        user.setRole(UserRole.HOUSEKEEPER);
        TeamMember member = new TeamMember();
        member.setUser(user);
        team.getMembers().add(member);
        return user;
    }

    private void stubCandidate(long userId, int score, BigDecimal resolvedRate,
                               CleaningPriceSource source, long openCount) {
        when(housekeeperScoreService.computeScore(userId, ORG_ID))
                .thenReturn(new HousekeeperScore(score, 5, score / 100.0));
        when(cleaningPricingEngine.resolveCleaningPrice(any(Property.class), anyString(), eq(userId)))
                .thenReturn(new ResolvedCleaningPrice(resolvedRate, source, null));
        when(interventionRepository.countOpenOnDay(eq(userId), eq(ORG_ID), any(), any()))
                .thenReturn(openCount);
    }

    // ── Toggle OFF (défaut) : zéro changement ────────────────────────────────

    @Test
    void whenToggleOff_thenTeamAssignmentUntouched() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(false);
        addHousekeeper(10L, "kc-10");

        boolean assigned = service.attemptAutoAssign(sr);

        assertThat(assigned).isTrue();
        assertThat(sr.getAssignedToType()).isEqualTo("team");
        assertThat(sr.getAssignedToId()).isEqualTo(TEAM_ID);
        verify(housekeeperScoreService, never()).computeScore(any(), any());
        verify(interventionRepository, never()).countOpenOnDay(any(), any(), any(), any());
    }

    // ── Toggle ON : promotion vers le meilleur pro ───────────────────────────

    @Test
    void whenToggleOn_thenBestScoreWins() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        addHousekeeper(10L, "kc-10");
        addHousekeeper(20L, "kc-20");
        stubCandidate(10L, 40, BigDecimal.valueOf(95), CleaningPriceSource.HOUSEKEEPER_RATE, 0);
        stubCandidate(20L, 90, BigDecimal.valueOf(120), CleaningPriceSource.HOUSEKEEPER_RATE, 3);

        service.attemptAutoAssign(sr);

        // Écart de score > 10 pts : le score prime, tarif et charge ignorés.
        assertThat(sr.getAssignedToType()).isEqualTo("user");
        assertThat(sr.getAssignedToId()).isEqualTo(20L);
        // Tarif MM-2A appliqué (source HOUSEKEEPER_RATE, non payé).
        assertThat(sr.getEstimatedCost()).isEqualByComparingTo("120");
    }

    @Test
    void whenScoresWithinTenPoints_thenClosestToMedianWins() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        addHousekeeper(10L, "kc-10");
        addHousekeeper(20L, "kc-20");
        // 85 vs 80 = ±10 pts → départage au tarif le plus proche de la médiane (95).
        stubCandidate(10L, 85, BigDecimal.valueOf(130), CleaningPriceSource.HOUSEKEEPER_RATE, 0);
        stubCandidate(20L, 80, BigDecimal.valueOf(100), CleaningPriceSource.HOUSEKEEPER_RATE, 0);

        service.attemptAutoAssign(sr);

        assertThat(sr.getAssignedToId()).isEqualTo(20L);
    }

    @Test
    void whenScoreAndRateTied_thenFewestOpenMissionsWins() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        addHousekeeper(10L, "kc-10");
        addHousekeeper(20L, "kc-20");
        stubCandidate(10L, 80, BigDecimal.valueOf(95), CleaningPriceSource.HOUSEKEEPER_RATE, 4);
        stubCandidate(20L, 80, BigDecimal.valueOf(95), CleaningPriceSource.HOUSEKEEPER_RATE, 1);

        service.attemptAutoAssign(sr);

        assertThat(sr.getAssignedToId()).isEqualTo(20L);
    }

    @Test
    void whenNoHousekeeperInTeam_thenTeamAssignmentKept() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        User tech = new User();
        tech.setId(30L);
        tech.setRole(UserRole.TECHNICIAN);
        TeamMember member = new TeamMember();
        member.setUser(tech);
        team.getMembers().add(member);

        service.attemptAutoAssign(sr);

        assertThat(sr.getAssignedToType()).isEqualTo("team");
        assertThat(sr.getAssignedToId()).isEqualTo(TEAM_ID);
    }

    @Test
    void whenNotCleaningService_thenSelectorSkipped() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        sr.setServiceType(ServiceType.PLUMBING_REPAIR);
        addHousekeeper(10L, "kc-10");

        service.attemptAutoAssign(sr);

        assertThat(sr.getAssignedToType()).isEqualTo("team");
        verify(housekeeperScoreService, never()).computeScore(any(), any());
    }

    @Test
    void whenResolvedSourceIsNotHousekeeperRate_thenEstimatedCostUntouched() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        sr.setEstimatedCost(BigDecimal.valueOf(95));
        addHousekeeper(10L, "kc-10");
        stubCandidate(10L, 80, BigDecimal.valueOf(95), CleaningPriceSource.ENGINE, 0);

        service.attemptAutoAssign(sr);

        assertThat(sr.getAssignedToType()).isEqualTo("user");
        assertThat(sr.getEstimatedCost()).isEqualByComparingTo("95");
    }

    @Test
    void whenSelectorThrows_thenTeamAssignmentSurvives() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        addHousekeeper(10L, "kc-10");
        when(housekeeperScoreService.computeScore(any(), any()))
                .thenThrow(new IllegalStateException("boom"));

        boolean assigned = service.attemptAutoAssign(sr);

        // Best-effort : l'échec du sélecteur ne casse jamais l'assignation équipe.
        assertThat(assigned).isTrue();
        assertThat(sr.getAssignedToType()).isEqualTo("team");
        assertThat(sr.getAssignedToId()).isEqualTo(TEAM_ID);
    }

    @Test
    void whenBestProChosen_thenPushNotificationCarriesRemuneration() {
        when(cleaningPricingEngine.isAutoAssignBestProEnabled()).thenReturn(true);
        addHousekeeper(10L, "kc-10");
        stubCandidate(10L, 80, BigDecimal.valueOf(110), CleaningPriceSource.HOUSEKEEPER_RATE, 0);

        service.attemptAutoAssign(sr);

        verify(notificationService).send(eq("kc-10"), eq(NotificationKey.INTERVENTION_ASSIGNED_TO_USER),
                anyString(), contains("110 EUR"), anyString(), eq(ORG_ID));
    }
}
