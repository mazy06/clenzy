package com.clenzy.service;

import com.clenzy.dto.ReportFinancialStatsDto;
import com.clenzy.dto.ReportInterventionStatsDto;
import com.clenzy.dto.ReportPropertyStatsDto;
import com.clenzy.dto.ReportTeamStatsDto;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests des agrégats de l'écran Rapports Baitly (ReportStatsService).
 */
@ExtendWith(MockitoExtension.class)
class ReportStatsServiceTest {

    private static final Long ORG_ID = 1L;
    private static final String KC_ID = "kc-user";
    // Aujourd'hui fixe : 2026-07-21 → fenêtre mensuelle = [2026-02 .. 2026-07].
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 21);

    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private UserRepository userRepository;

    private ReportStatsService service;

    @BeforeEach
    void setUp() {
        Clock fixed = Clock.fixed(
                TODAY.atStartOfDay(ZoneId.of("Europe/Paris")).toInstant(),
                ZoneId.of("Europe/Paris"));
        service = new ReportStatsService(
                interventionRepository, propertyRepository, teamRepository, userRepository, fixed);
    }

    @Test
    void whenStatusAndPriorityRowsReturned_thenMappedToNamedCounts() {
        // Arrange
        when(interventionRepository.countByStatusForReport(ORG_ID, null, null))
                .thenReturn(List.<Object[]>of(
                        new Object[]{InterventionStatus.COMPLETED, 7L},
                        new Object[]{InterventionStatus.PENDING, 3L}));
        when(interventionRepository.countByPriorityForReport(ORG_ID, null, null))
                .thenReturn(List.<Object[]>of(
                        new Object[]{"HIGH", 2L},
                        new Object[]{null, 8L}));
        when(interventionRepository.countAndCostByTypeForReport(ORG_ID, null, null))
                .thenReturn(List.of());
        when(interventionRepository.monthlyCountsAndCostsForReport(any(), any(), eq(ORG_ID), isNull(), isNull()))
                .thenReturn(List.of());

        // Act
        ReportInterventionStatsDto dto = service.getInterventionStats(ORG_ID, UserRole.SUPER_ADMIN, KC_ID);

        // Assert — statuts par nom d'enum ; priorité nulle repliée sur MEDIUM
        assertThat(dto.byStatus()).extracting("name", "value")
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("COMPLETED", 7L),
                        org.assertj.core.groups.Tuple.tuple("PENDING", 3L));
        assertThat(dto.byPriority()).extracting("name", "value")
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("HIGH", 2L),
                        org.assertj.core.groups.Tuple.tuple("MEDIUM", 8L));
    }

    @Test
    void whenMonthlyRowsPartial_thenSixMonthsZeroFilledWithIsoKeys() {
        // Arrange — juillet : 2 terminées + 1 en attente ; mai : 1 en cours ; autres mois vides
        when(interventionRepository.countByStatusForReport(ORG_ID, null, null)).thenReturn(List.of());
        when(interventionRepository.countByPriorityForReport(ORG_ID, null, null)).thenReturn(List.of());
        when(interventionRepository.countAndCostByTypeForReport(ORG_ID, null, null)).thenReturn(List.of());
        when(interventionRepository.monthlyCountsAndCostsForReport(any(), any(), eq(ORG_ID), isNull(), isNull()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{2026, 7, InterventionStatus.COMPLETED, 2L, new BigDecimal("100")},
                        new Object[]{2026, 7, InterventionStatus.PENDING, 1L, new BigDecimal("0")},
                        new Object[]{2026, 5, InterventionStatus.IN_PROGRESS, 1L, new BigDecimal("50")}));

        // Act
        ReportInterventionStatsDto dto = service.getInterventionStats(ORG_ID, UserRole.SUPER_ADMIN, KC_ID);

        // Assert — 6 mois ordonnés, clés ISO, mois sans données à zéro
        assertThat(dto.byMonth()).hasSize(6);
        assertThat(dto.byMonth()).extracting("month")
                .containsExactly("2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07");
        assertThat(dto.byMonth().get(5).total()).isEqualTo(3);
        assertThat(dto.byMonth().get(5).completed()).isEqualTo(2);
        assertThat(dto.byMonth().get(5).pending()).isEqualTo(1);
        assertThat(dto.byMonth().get(3).total()).isEqualTo(1);
        assertThat(dto.byMonth().get(0).total()).isZero();
    }

    @Test
    void whenMonthlyCosts_thenFinancialsUseRevenueMarkupAndRounding() {
        // Arrange — juillet : 100.4 € de coûts répartis sur 2 statuts
        when(interventionRepository.monthlyCountsAndCostsForReport(any(), any(), eq(ORG_ID), isNull(), isNull()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{2026, 7, InterventionStatus.COMPLETED, 1L, new BigDecimal("60.40")},
                        new Object[]{2026, 7, InterventionStatus.PENDING, 1L, new BigDecimal("40.00")}));
        when(interventionRepository.countAndCostByTypeForReport(ORG_ID, null, null))
                .thenReturn(List.<Object[]>of(new Object[]{"CLEANING", 2L, new BigDecimal("100.40")}));

        // Act
        ReportFinancialStatsDto dto = service.getFinancialStats(ORG_ID, UserRole.SUPER_ADMIN, KC_ID);

        // Assert — dépenses 100 (arrondi), revenus 100.4×1.3=130.52→131, profit 31
        ReportFinancialStatsDto.MonthlyFinancialDto july = dto.monthlyFinancials().get(5);
        assertThat(july.month()).isEqualTo("2026-07");
        assertThat(july.expenses()).isEqualTo(100);
        assertThat(july.revenue()).isEqualTo(131);
        assertThat(july.profit()).isEqualTo(31);
        assertThat(dto.costBreakdown()).extracting("name", "value")
                .containsExactly(org.assertj.core.groups.Tuple.tuple("CLEANING", 100L));
    }

    @Test
    void whenTeamHasNoInterventions_thenCountersAreZero() {
        // Arrange — 2 équipes, seule la première a des interventions
        when(teamRepository.findIdAndNameForReport(ORG_ID))
                .thenReturn(List.<Object[]>of(
                        new Object[]{10L, "Equipe A"},
                        new Object[]{11L, "Equipe B"}));
        when(interventionRepository.countByTeamAndStatusForReport(ORG_ID, null))
                .thenReturn(List.<Object[]>of(
                        new Object[]{10L, InterventionStatus.COMPLETED, 4L},
                        new Object[]{10L, InterventionStatus.IN_PROGRESS, 2L},
                        new Object[]{10L, InterventionStatus.PENDING, 1L},
                        new Object[]{10L, InterventionStatus.CANCELLED, 9L}));

        // Act
        ReportTeamStatsDto dto = service.getTeamStats(ORG_ID, UserRole.SUPER_ADMIN, KC_ID);

        // Assert — annulées ignorées ; équipe sans intervention à zéro
        assertThat(dto.teamPerformance()).extracting("name", "completed", "inProgress", "pending")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Equipe A", 4L, 2L, 1L),
                        org.assertj.core.groups.Tuple.tuple("Equipe B", 0L, 0L, 0L));
    }

    @Test
    void whenPropertyRows_thenTopTenRequestedAndCostRounded() {
        // Arrange
        when(propertyRepository.topByInterventionCountForReport(eq(ORG_ID), isNull(), any(Pageable.class)))
                .thenReturn(List.<Object[]>of(
                        new Object[]{"Studio Gueliz", 5L, new BigDecimal("249.60")},
                        new Object[]{"Riad Medina", 0L, BigDecimal.ZERO}));

        // Act
        ReportPropertyStatsDto dto = service.getPropertyStats(ORG_ID, UserRole.SUPER_ADMIN, KC_ID);

        // Assert — coût arrondi à l'euro ; limite top 10 demandée au repository
        assertThat(dto.propertyStats()).extracting("name", "interventions", "cost")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Studio Gueliz", 5L, 250L),
                        org.assertj.core.groups.Tuple.tuple("Riad Medina", 0L, 0L));
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(propertyRepository).topByInterventionCountForReport(eq(ORG_ID), isNull(), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(10);
    }

    @Test
    void whenHostRole_thenQueriesOwnerScoped() {
        // Arrange
        when(interventionRepository.countByStatusForReport(ORG_ID, KC_ID, null)).thenReturn(List.of());
        when(interventionRepository.countByPriorityForReport(ORG_ID, KC_ID, null)).thenReturn(List.of());
        when(interventionRepository.countAndCostByTypeForReport(ORG_ID, KC_ID, null)).thenReturn(List.of());
        when(interventionRepository.monthlyCountsAndCostsForReport(any(), any(), eq(ORG_ID), eq(KC_ID), isNull()))
                .thenReturn(List.of());

        // Act
        service.getInterventionStats(ORG_ID, UserRole.HOST, KC_ID);

        // Assert — scope owner (keycloakId), pas de résolution d'assigné
        verify(interventionRepository).countByStatusForReport(ORG_ID, KC_ID, null);
        verify(userRepository, never()).findByKeycloakId(anyString());
    }

    @Test
    void whenOperationalRole_thenQueriesAssigneeScoped() {
        // Arrange
        User technician = new User();
        technician.setId(42L);
        when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(technician));
        when(interventionRepository.countByStatusForReport(ORG_ID, null, 42L)).thenReturn(List.of());
        when(interventionRepository.countByPriorityForReport(ORG_ID, null, 42L)).thenReturn(List.of());
        when(interventionRepository.countAndCostByTypeForReport(ORG_ID, null, 42L)).thenReturn(List.of());
        when(interventionRepository.monthlyCountsAndCostsForReport(any(), any(), eq(ORG_ID), isNull(), eq(42L)))
                .thenReturn(List.of());

        // Act
        service.getInterventionStats(ORG_ID, UserRole.TECHNICIAN, KC_ID);

        // Assert
        verify(interventionRepository).countByStatusForReport(ORG_ID, null, 42L);
    }

    @Test
    void whenMonthlyWindowComputed_thenSpansSixCalendarMonths() {
        // Arrange
        when(interventionRepository.countByStatusForReport(ORG_ID, null, null)).thenReturn(List.of());
        when(interventionRepository.countByPriorityForReport(ORG_ID, null, null)).thenReturn(List.of());
        when(interventionRepository.countAndCostByTypeForReport(ORG_ID, null, null)).thenReturn(List.of());
        when(interventionRepository.monthlyCountsAndCostsForReport(any(), any(), eq(ORG_ID), isNull(), isNull()))
                .thenReturn(List.of());

        // Act
        service.getInterventionStats(ORG_ID, UserRole.SUPER_ADMIN, KC_ID);

        // Assert — [1er février .. 1er août) pour un « aujourd'hui » au 2026-07-21
        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> to = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(interventionRepository).monthlyCountsAndCostsForReport(
                from.capture(), to.capture(), eq(ORG_ID), isNull(), isNull());
        assertThat(from.getValue()).isEqualTo(LocalDate.of(2026, 2, 1).atStartOfDay());
        assertThat(to.getValue()).isEqualTo(LocalDate.of(2026, 8, 1).atStartOfDay());
    }
}
