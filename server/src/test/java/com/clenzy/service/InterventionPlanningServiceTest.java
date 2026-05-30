package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterventionPlanningServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private UserRepository userRepository;
    @Mock private TeamRepository teamRepository;

    private TenantContext tenantContext;
    private InterventionPlanningService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new InterventionPlanningService(
                interventionRepository, reservationRepository,
                userRepository, teamRepository, tenantContext);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Jwt jwt(String sub) {
        Jwt jwt = mock(Jwt.class);
        lenient().when(jwt.getSubject()).thenReturn(sub);
        return jwt;
    }

    private User user(Long id, String kc, UserRole role) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId(kc);
        u.setFirstName("F" + id);
        u.setLastName("L" + id);
        u.setRole(role);
        return u;
    }

    private Property property(Long id, String name, User owner) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setOwner(owner);
        return p;
    }

    private Intervention intervention(Long id, Property prop, InterventionStatus status, String type) {
        Intervention i = new Intervention();
        i.setId(id);
        i.setOrganizationId(ORG_ID);
        i.setTitle("T" + id);
        i.setDescription("Desc " + id);
        i.setType(type);
        i.setStatus(status);
        i.setPriority("MEDIUM");
        i.setProperty(prop);
        i.setScheduledDate(LocalDateTime.of(2026, 6, 10, 11, 0));
        i.setEstimatedDurationHours(3);
        i.setEstimatedCost(new BigDecimal("50.00"));
        return i;
    }

    // ── getPlanningInterventions ─────────────────────────────────────────────

    @Nested
    @DisplayName("getPlanningInterventions(jwt, propertyIds, from, to, type)")
    class GetPlanning {

        @Test
        @DisplayName("when user not found - throws RuntimeException")
        void whenUserMissing_thenThrows() {
            Jwt j = jwt("kc-x");
            when(userRepository.findByKeycloakId("kc-x")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getPlanningInterventions(
                    j, null, LocalDate.now(), LocalDate.now().plusDays(1), null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Utilisateur introuvable");
        }

        @Test
        @DisplayName("when admin & propertyIds null - uses findAllByDateRange")
        void whenAdminNoFilter_thenFindAll() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "Prop A", admin);
            Intervention i = intervention(100L, p, InterventionStatus.PENDING, "CLEANING");

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(eq(List.of(100L)), eq(ORG_ID)))
                    .thenReturn(List.of());

            List<Map<String, Object>> result = service.getPlanningInterventions(
                    j, null, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).get("id")).isEqualTo(100L);
            assertThat(result.get(0).get("propertyId")).isEqualTo(20L);
            assertThat(result.get(0).get("propertyName")).isEqualTo("Prop A");
            assertThat(result.get(0).get("type")).isEqualTo("cleaning");
            assertThat(result.get(0).get("status")).isEqualTo("scheduled");
            assertThat(result.get(0).get("priority")).isEqualTo("medium");
            assertThat(result.get(0).get("startDate")).isEqualTo("2026-06-10");
            assertThat(result.get(0).get("startTime")).isEqualTo("11:00");
            assertThat(result.get(0).get("endTime")).isEqualTo("14:00");
            assertThat(result.get(0).get("estimatedDurationHours")).isEqualTo(3);
        }

        @Test
        @DisplayName("when host (not staff) - uses findByOwnerKeycloakIdAndDateRange")
        void whenHost_thenFindByOwner() {
            Jwt j = jwt("kc-host");
            User host = user(2L, "kc-host", UserRole.HOST);
            Property p = property(20L, "Prop", host);
            Intervention i = intervention(200L, p, InterventionStatus.IN_PROGRESS, "MAINTENANCE");

            when(userRepository.findByKeycloakId("kc-host")).thenReturn(Optional.of(host));
            when(interventionRepository.findByOwnerKeycloakIdAndDateRange(
                    eq("kc-host"), any(), any(), eq(ORG_ID))).thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());

            List<Map<String, Object>> result = service.getPlanningInterventions(
                    j, null, null, null, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).get("status")).isEqualTo("in_progress");
        }

        @Test
        @DisplayName("when propertyIds provided - uses findByPropertyIdsAndDateRange")
        void whenPropertyIds_thenFindByProperty() {
            Jwt j = jwt("kc-host");
            User host = user(2L, "kc-host", UserRole.HOST);
            Property p = property(20L, "X", host);
            Intervention i = intervention(300L, p, InterventionStatus.COMPLETED, "CLEANING");

            when(userRepository.findByKeycloakId("kc-host")).thenReturn(Optional.of(host));
            when(interventionRepository.findByPropertyIdsAndDateRange(
                    eq(List.of(20L)), any(), any(), eq(ORG_ID))).thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());

            List<Map<String, Object>> result = service.getPlanningInterventions(
                    j, List.of(20L), LocalDate.now(), LocalDate.now().plusDays(7), "all");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).get("status")).isEqualTo("completed");
            verify(interventionRepository).findByPropertyIdsAndDateRange(
                    eq(List.of(20L)), any(), any(), eq(ORG_ID));
        }

        @Test
        @DisplayName("when type filter specified - filters interventions client-side")
        void whenTypeFilter_thenFilters() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);
            Intervention cleaning = intervention(1L, p, InterventionStatus.PENDING, "CLEANING");
            Intervention maint = intervention(2L, p, InterventionStatus.PENDING, "MAINTENANCE");

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(cleaning, maint));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());

            List<Map<String, Object>> result = service.getPlanningInterventions(
                    j, null, null, null, "cleaning");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).get("id")).isEqualTo(1L);
        }

        @Test
        @DisplayName("when type='all' - returns all without filtering")
        void whenTypeAll_thenAll() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(
                            intervention(1L, p, InterventionStatus.PENDING, "CLEANING"),
                            intervention(2L, p, InterventionStatus.PENDING, "MAINTENANCE")));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());

            List<Map<String, Object>> result = service.getPlanningInterventions(
                    j, null, null, null, "all");

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("when status CANCELLED - frontend status='cancelled'")
        void whenStatusCancelled_thenMapped() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);
            Intervention cancelled = intervention(1L, p, InterventionStatus.CANCELLED, "CLEANING");

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(cancelled));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());

            var result = service.getPlanningInterventions(j, null, null, null, null);
            assertThat(result.get(0).get("status")).isEqualTo("cancelled");
        }

        @Test
        @DisplayName("when intervention has assigned user - returns assignee name")
        void whenAssignedUser_thenName() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);
            User tech = user(99L, "kc-99", UserRole.TECHNICIAN);
            tech.setFirstName("Jean");
            tech.setLastName("Martin");

            Intervention i = intervention(1L, p, InterventionStatus.PENDING, "CLEANING");
            i.setAssignedUser(tech);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());

            var result = service.getPlanningInterventions(j, null, null, null, null);
            assertThat(result.get(0).get("assigneeName")).isEqualTo("Jean Martin");
        }

        @Test
        @DisplayName("when team assigned & found - resolves team name")
        void whenTeamAssigned_thenName() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);
            Intervention i = intervention(1L, p, InterventionStatus.PENDING, "CLEANING");
            i.setTeamId(50L);

            Team team = new Team("Equipe Pro", "", "CLEANING");
            team.setId(50L);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());
            when(teamRepository.findAllById(eq(List.of(50L)))).thenReturn(List.of(team));

            var result = service.getPlanningInterventions(j, null, null, null, null);
            assertThat(result.get(0).get("assigneeName")).isEqualTo("Equipe Pro");
        }

        @Test
        @DisplayName("when team id but team not found - falls back to 'Equipe #<id>'")
        void whenTeamMissing_thenFallback() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);
            Intervention i = intervention(1L, p, InterventionStatus.PENDING, "CLEANING");
            i.setTeamId(77L);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());
            when(teamRepository.findAllById(eq(List.of(77L)))).thenReturn(List.of());

            var result = service.getPlanningInterventions(j, null, null, null, null);
            assertThat(result.get(0).get("assigneeName")).isEqualTo("Equipe #77");
        }

        @Test
        @DisplayName("when reservations linked - returns linkedReservationId in result")
        void whenReservationLinked_thenIncluded() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);
            Intervention i = intervention(1L, p, InterventionStatus.PENDING, "CLEANING");

            Reservation r = new Reservation();
            r.setId(500L);
            r.setIntervention(i);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(eq(List.of(1L)), eq(ORG_ID)))
                    .thenReturn(List.of(r));

            var result = service.getPlanningInterventions(j, null, null, null, null);
            assertThat(result.get(0).get("linkedReservationId")).isEqualTo(500L);
        }

        @Test
        @DisplayName("when no interventions - returns empty list (no extra queries)")
        void whenNoInterventions_thenEmptyList() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of());

            var result = service.getPlanningInterventions(j, null, null, null, null);

            assertThat(result).isEmpty();
            verify(reservationRepository, never()).findByInterventionIdIn(anyList(), eq(ORG_ID));
        }

        @Test
        @DisplayName("when null scheduledDate - returns null start/end dates")
        void whenNullScheduledDate_thenNullDates() {
            Jwt j = jwt("kc-admin");
            User admin = user(1L, "kc-admin", UserRole.SUPER_ADMIN);
            Property p = property(20L, "X", admin);

            Intervention i = intervention(1L, p, InterventionStatus.PENDING, "CLEANING");
            i.setScheduledDate(null);
            i.setEstimatedDurationHours(null);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of(i));
            when(reservationRepository.findByInterventionIdIn(anyList(), eq(ORG_ID)))
                    .thenReturn(List.of());

            var result = service.getPlanningInterventions(j, null, null, null, null);
            assertThat(result.get(0).get("startDate")).isNull();
            assertThat(result.get(0).get("startTime")).isEqualTo("11:00");
            assertThat(result.get(0).get("endTime")).isNull();
        }
    }

    // ── checkTeamMemberAvailability ──────────────────────────────────────────

    @Nested
    @DisplayName("checkTeamMemberAvailability(teamId, interventionId, date, durationHours)")
    class CheckTeamMember {

        @Test
        @DisplayName("when team not found - throws RuntimeException")
        void whenTeamMissing_thenThrows() {
            when(teamRepository.findByIdWithMembers(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.checkTeamMemberAvailability(
                    99L, null, "2026-06-10T11:00:00", 2))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Equipe introuvable");
        }

        @Test
        @DisplayName("when interventionId provided & not found - throws RuntimeException")
        void whenInterventionMissing_thenThrows() {
            Team team = new Team("X", "", "CLEANING");
            team.setId(50L);
            when(teamRepository.findByIdWithMembers(50L)).thenReturn(Optional.of(team));
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.checkTeamMemberAvailability(50L, 999L, null, null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Intervention introuvable");
        }

        @Test
        @DisplayName("when no date & no interventionId - returns null")
        void whenNoInputs_thenReturnsNull() {
            Team team = new Team("X", "", "CLEANING");
            team.setId(50L);
            when(teamRepository.findByIdWithMembers(50L)).thenReturn(Optional.of(team));

            Map<String, Object> result = service.checkTeamMemberAvailability(
                    50L, null, null, null);

            assertThat(result).isNull();
        }

        @Test
        @DisplayName("when date provided - computes range and returns members availability")
        void whenDateProvided_thenAvailability() {
            User u1 = user(10L, "kc-10", UserRole.TECHNICIAN);
            User u2 = user(11L, "kc-11", UserRole.TECHNICIAN);

            Team team = new Team("CleanTeam", "desc", "CLEANING");
            team.setId(50L);
            TeamMember m1 = new TeamMember(team, u1, "TECHNICIAN");
            TeamMember m2 = new TeamMember(team, u2, "TECHNICIAN");
            team.setMembers(List.of(m1, m2));

            when(teamRepository.findByIdWithMembers(50L)).thenReturn(Optional.of(team));
            List<Object[]> counts = java.util.List.<Object[]>of(new Object[]{10L, 1L});
            when(interventionRepository.countActiveByUserIdsAndDateRange(
                    any(), any(), any(), any(), eq(ORG_ID)))
                    .thenReturn(counts);
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(50L), any(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            Map<String, Object> result = service.checkTeamMemberAvailability(
                    50L, null, "2026-06-10T11:00:00", 4);

            assertThat(result).isNotNull();
            assertThat(result.get("teamId")).isEqualTo(50L);
            assertThat(result.get("teamName")).isEqualTo("CleanTeam");
            assertThat(result.get("interventionType")).isEqualTo("CLEANING");
            assertThat(result.get("memberCount")).isEqualTo(2);
            assertThat(result.get("teamConflictCount")).isEqualTo(0L);
            assertThat(result.get("allAvailable")).isEqualTo(false);
            assertThat(result.get("rangeStart")).isEqualTo("2026-06-10T11:00");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> members = (List<Map<String, Object>>) result.get("members");
            assertThat(members).hasSize(2);
            // Member 10 has 1 conflict
            Map<String, Object> m10 = members.stream()
                    .filter(m -> ((Long) m.get("userId")).equals(10L))
                    .findFirst().orElseThrow();
            assertThat(m10.get("available")).isEqualTo(false);
            assertThat(m10.get("conflictCount")).isEqualTo(1L);
            // Member 11 has 0
            Map<String, Object> m11 = members.stream()
                    .filter(m -> ((Long) m.get("userId")).equals(11L))
                    .findFirst().orElseThrow();
            assertThat(m11.get("available")).isEqualTo(true);
            assertThat(m11.get("conflictCount")).isEqualTo(0L);
        }

        @Test
        @DisplayName("when interventionId provided - uses intervention's scheduled date")
        void whenInterventionId_thenUsesScheduledDate() {
            User u = user(10L, "kc-10", UserRole.TECHNICIAN);
            Team team = new Team("X", "", "CLEANING");
            team.setId(50L);
            TeamMember m = new TeamMember(team, u, "TECHNICIAN");
            team.setMembers(List.of(m));

            Property p = property(20L, "Prop", user(1L, "kc-host", UserRole.HOST));
            Intervention i = intervention(123L, p, InterventionStatus.PENDING, "CLEANING");

            when(teamRepository.findByIdWithMembers(50L)).thenReturn(Optional.of(team));
            when(interventionRepository.findById(123L)).thenReturn(Optional.of(i));
            when(interventionRepository.countActiveByUserIdsAndDateRange(
                    any(), any(), any(), any(), eq(ORG_ID)))
                    .thenReturn(java.util.Collections.emptyList());
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(50L), any(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            Map<String, Object> result = service.checkTeamMemberAvailability(
                    50L, 123L, null, null);

            assertThat(result).isNotNull();
            assertThat(result.get("rangeStart")).isEqualTo("2026-06-10T11:00");
            // 3 hours estimated → end = 14:00
            assertThat(result.get("rangeEnd")).isEqualTo("2026-06-10T14:00");
            assertThat(result.get("allAvailable")).isEqualTo(true);
        }

        @Test
        @DisplayName("when intervention has null scheduledDate - uses now()")
        void whenNullScheduledDate_thenUsesNow() {
            User u = user(10L, "kc-10", UserRole.TECHNICIAN);
            Team team = new Team("X", "", "CLEANING");
            team.setId(50L);
            TeamMember m = new TeamMember(team, u, "TECHNICIAN");
            team.setMembers(List.of(m));

            Property p = property(20L, "Prop", user(1L, "kc-host", UserRole.HOST));
            Intervention i = intervention(123L, p, InterventionStatus.PENDING, "CLEANING");
            i.setScheduledDate(null);
            i.setEstimatedDurationHours(null);

            when(teamRepository.findByIdWithMembers(50L)).thenReturn(Optional.of(team));
            when(interventionRepository.findById(123L)).thenReturn(Optional.of(i));
            when(interventionRepository.countActiveByUserIdsAndDateRange(
                    any(), any(), any(), any(), eq(ORG_ID)))
                    .thenReturn(java.util.Collections.emptyList());
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(50L), any(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            Map<String, Object> result = service.checkTeamMemberAvailability(
                    50L, 123L, null, null);

            // Uses now() — just check structure is correct, default duration 4h
            assertThat(result).isNotNull();
            assertThat(result.get("rangeStart")).isNotNull();
        }

        @Test
        @DisplayName("when team has no members - empty members list, all available")
        void whenNoMembers_thenAllAvailable() {
            Team team = new Team("Empty", "", "CLEANING");
            team.setId(50L);
            team.setMembers(List.of());

            when(teamRepository.findByIdWithMembers(50L)).thenReturn(Optional.of(team));
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(50L), any(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            Map<String, Object> result = service.checkTeamMemberAvailability(
                    50L, null, "2026-06-10T11:00:00", 3);

            assertThat(result).isNotNull();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> members = (List<Map<String, Object>>) result.get("members");
            assertThat(members).isEmpty();
            assertThat(result.get("allAvailable")).isEqualTo(true);
        }

        @Test
        @DisplayName("when team has conflicts - teamConflictCount > 0")
        void whenTeamHasConflicts_thenReported() {
            User u = user(10L, "kc-10", UserRole.TECHNICIAN);
            Team team = new Team("X", "", "CLEANING");
            team.setId(50L);
            TeamMember m = new TeamMember(team, u, "TECHNICIAN");
            team.setMembers(List.of(m));

            when(teamRepository.findByIdWithMembers(50L)).thenReturn(Optional.of(team));
            when(interventionRepository.countActiveByUserIdsAndDateRange(
                    any(), any(), any(), any(), eq(ORG_ID)))
                    .thenReturn(java.util.Collections.emptyList());
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(50L), any(), any(), any(), eq(ORG_ID))).thenReturn(5L);

            Map<String, Object> result = service.checkTeamMemberAvailability(
                    50L, null, "2026-06-10T11:00:00", 3);

            assertThat(result.get("teamConflictCount")).isEqualTo(5L);
        }
    }

    // ── checkUserAvailability ────────────────────────────────────────────────

    @Nested
    @DisplayName("checkUserAvailability(userId, date, durationHours)")
    class CheckUser {

        @Test
        @DisplayName("when user not found - throws RuntimeException")
        void whenUserMissing_thenThrows() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.checkUserAvailability(
                    999L, "2026-06-10T11:00:00", 4))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Utilisateur introuvable");
        }

        @Test
        @DisplayName("when no conflicts - returns available=true")
        void whenNoConflicts_thenAvailable() {
            User u = user(10L, "kc-10", UserRole.TECHNICIAN);
            u.setFirstName("Alice");
            u.setLastName("Tech");

            when(userRepository.findById(10L)).thenReturn(Optional.of(u));
            when(interventionRepository.countActiveByUserIdAndDateRange(
                    eq(10L), any(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            Map<String, Object> result = service.checkUserAvailability(
                    10L, "2026-06-10T11:00:00", 4);

            assertThat(result.get("userId")).isEqualTo(10L);
            assertThat(result.get("firstName")).isEqualTo("Alice");
            assertThat(result.get("lastName")).isEqualTo("Tech");
            assertThat(result.get("available")).isEqualTo(true);
            assertThat(result.get("conflictCount")).isEqualTo(0L);
            assertThat(result.get("rangeStart")).isEqualTo("2026-06-10T11:00");
            assertThat(result.get("rangeEnd")).isEqualTo("2026-06-10T15:00");
        }

        @Test
        @DisplayName("when conflicts - returns available=false")
        void whenConflicts_thenNotAvailable() {
            User u = user(10L, "kc-10", UserRole.TECHNICIAN);

            when(userRepository.findById(10L)).thenReturn(Optional.of(u));
            when(interventionRepository.countActiveByUserIdAndDateRange(
                    eq(10L), any(), any(), any(), eq(ORG_ID))).thenReturn(2L);

            Map<String, Object> result = service.checkUserAvailability(
                    10L, "2026-06-10T11:00:00", 3);

            assertThat(result.get("available")).isEqualTo(false);
            assertThat(result.get("conflictCount")).isEqualTo(2L);
            assertThat(result.get("rangeEnd")).isEqualTo("2026-06-10T14:00");
        }

        @Test
        @DisplayName("when null durationHours - uses default 4h")
        void whenNullDuration_thenDefault4h() {
            User u = user(10L, "kc-10", UserRole.TECHNICIAN);

            when(userRepository.findById(10L)).thenReturn(Optional.of(u));
            when(interventionRepository.countActiveByUserIdAndDateRange(
                    eq(10L), any(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            Map<String, Object> result = service.checkUserAvailability(
                    10L, "2026-06-10T11:00:00", null);

            assertThat(result.get("rangeEnd")).isEqualTo("2026-06-10T15:00");
        }
    }
}
