package com.clenzy.service;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyTeam;
import com.clenzy.model.Team;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyTeamRepository;
import com.clenzy.repository.TeamCoverageZoneRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PropertyTeamServiceTest {

    @Mock private PropertyTeamRepository propertyTeamRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private TeamCoverageZoneRepository teamCoverageZoneRepository;
    @Mock private PropertyRepository propertyRepository;

    private TenantContext tenantContext;
    private PropertyTeamService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new PropertyTeamService(propertyTeamRepository, interventionRepository,
                teamRepository, teamCoverageZoneRepository, propertyRepository, tenantContext);
    }

    private Team buildTeam(Long id, String name, String interventionType) {
        Team team = new Team();
        team.setId(id);
        team.setName(name);
        team.setInterventionType(interventionType);
        return team;
    }

    private PropertyTeam buildPropertyTeam(Long id, Long propertyId, Long teamId, Team team) {
        PropertyTeam pt = new PropertyTeam(propertyId, teamId);
        pt.setId(id);
        pt.setTeam(team);
        pt.setOrganizationId(ORG_ID);
        return pt;
    }

    // ===== ASSIGN TEAM =====

    @Nested
    @DisplayName("assignTeamToProperty")
    class AssignTeamToProperty {

        @Test
        @DisplayName("when team exists and no previous mapping then creates new mapping")
        void whenTeamExists_thenCreatesMapping() {
            // Arrange
            Team team = buildTeam(10L, "Equipe A", "CLEANING");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(false);
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(1L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest(5L, 10L);

            // Act
            PropertyTeamDto result = service.assignTeamToProperty(request);

            // Assert
            assertThat(result.getTeamName()).isEqualTo("Equipe A");
            assertThat(result.getTeamInterventionType()).isEqualTo("CLEANING");
            verify(propertyTeamRepository).save(any(PropertyTeam.class));
            verify(propertyTeamRepository, never()).deleteByPropertyIdAndOrganizationId(anyLong(), anyLong());
        }

        @Test
        @DisplayName("when team not found then throws RuntimeException")
        void whenTeamNotFound_thenThrows() {
            // Arrange
            when(teamRepository.findById(99L)).thenReturn(Optional.empty());

            PropertyTeamRequest request = new PropertyTeamRequest(5L, 99L);

            // Act & Assert
            assertThatThrownBy(() -> service.assignTeamToProperty(request))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("non trouvee");
        }

        @Test
        @DisplayName("when existing mapping then deletes old and creates new (upsert)")
        void whenExistingMapping_thenDeletesOldAndCreatesNew() {
            // Arrange
            Team team = buildTeam(10L, "Equipe B", "MAINTENANCE");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(true);
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(2L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest(5L, 10L);

            // Act
            service.assignTeamToProperty(request);

            // Assert
            verify(propertyTeamRepository).deleteByPropertyIdAndOrganizationId(5L, ORG_ID);
            verify(propertyTeamRepository).save(any(PropertyTeam.class));
        }

        @Test
        @DisplayName("then sets organizationId on new mapping")
        void thenSetsOrganizationId() {
            // Arrange
            Team team = buildTeam(10L, "Team", "CLEANING");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(false);
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(3L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest(5L, 10L);

            // Act
            service.assignTeamToProperty(request);

            // Assert
            var captor = org.mockito.ArgumentCaptor.forClass(PropertyTeam.class);
            verify(propertyTeamRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }
    }

    // ===== REMOVE TEAM =====

    @Nested
    @DisplayName("removeTeamFromProperty")
    class RemoveTeamFromProperty {

        @Test
        @DisplayName("when team is assigned then deletes mapping")
        void whenTeamAssigned_thenDeletes() {
            // Arrange
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(true);

            // Act
            service.removeTeamFromProperty(5L);

            // Assert
            verify(propertyTeamRepository).deleteByPropertyIdAndOrganizationId(5L, ORG_ID);
        }

        @Test
        @DisplayName("when no team assigned then throws RuntimeException")
        void whenNoTeamAssigned_thenThrows() {
            // Arrange
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(false);

            // Act & Assert
            assertThatThrownBy(() -> service.removeTeamFromProperty(5L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune equipe");
        }
    }

    // ===== GET BY PROPERTY =====

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {

        @Test
        @DisplayName("when mapping exists then returns DTO")
        void whenMappingExists_thenReturnsDto() {
            // Arrange
            Team team = buildTeam(10L, "Equipe X", "CLEANING");
            PropertyTeam pt = buildPropertyTeam(1L, 5L, 10L, team);
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.of(pt));

            // Act
            Optional<PropertyTeamDto> result = service.getByProperty(5L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get().getTeamName()).isEqualTo("Equipe X");
            assertThat(result.get().getPropertyId()).isEqualTo(5L);
            assertThat(result.get().getTeamId()).isEqualTo(10L);
        }

        @Test
        @DisplayName("when no mapping then returns empty")
        void whenNoMapping_thenReturnsEmpty() {
            // Arrange
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.empty());

            // Act
            Optional<PropertyTeamDto> result = service.getByProperty(5L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===== GET BY PROPERTIES =====

    @Nested
    @DisplayName("getByProperties")
    class GetByProperties {

        @Test
        @DisplayName("when null list then returns empty")
        void whenNullList_thenReturnsEmpty() {
            // Act
            List<PropertyTeamDto> result = service.getByProperties(null);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when empty list then returns empty")
        void whenEmptyList_thenReturnsEmpty() {
            // Act
            List<PropertyTeamDto> result = service.getByProperties(List.of());

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when valid property IDs then returns DTOs")
        void whenValidPropertyIds_thenReturnsDtos() {
            // Arrange
            Team team1 = buildTeam(10L, "Team A", "CLEANING");
            Team team2 = buildTeam(20L, "Team B", "MAINTENANCE");
            PropertyTeam pt1 = buildPropertyTeam(1L, 5L, 10L, team1);
            PropertyTeam pt2 = buildPropertyTeam(2L, 6L, 20L, team2);

            when(propertyTeamRepository.findByPropertyIdIn(List.of(5L, 6L), ORG_ID))
                    .thenReturn(List.of(pt1, pt2));

            // Act
            List<PropertyTeamDto> result = service.getByProperties(List.of(5L, 6L));

            // Assert
            assertThat(result).hasSize(2);
        }
    }

    // ===== FIND AVAILABLE TEAM =====

    @Nested
    @DisplayName("findAvailableTeamForProperty")
    class FindAvailableTeamForProperty {

        private final LocalDateTime scheduledDate = LocalDateTime.of(2026, 2, 22, 10, 0);

        @Test
        @DisplayName("when direct assignment is compatible and available then returns it")
        void whenDirectAssignmentCompatibleAndAvailable_thenReturnsIt() {
            // Arrange
            Team defaultTeam = buildTeam(10L, "Equipe Menage", "CLEANING");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(10L), anyList(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).contains(10L);
        }

        @Test
        @DisplayName("when direct assignment is busy then falls back to zone search")
        void whenDirectAssignmentBusy_thenFallsBackToZone() {
            // Arrange
            Team defaultTeam = buildTeam(10L, "Equipe Busy", "CLEANING");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(10L), anyList(), any(), any(), eq(ORG_ID))).thenReturn(3L);

            Property property = new Property();
            property.setDepartment("75");
            property.setArrondissement("75001");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Team zoneTeam = buildTeam(20L, "Zone Team", "CLEANING");
            when(teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID))
                    .thenReturn(List.of(20L));
            when(teamRepository.findById(20L)).thenReturn(Optional.of(zoneTeam));
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(20L), anyList(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).contains(20L);
        }

        @Test
        @DisplayName("when no team available anywhere then returns empty")
        void whenNoTeamAvailable_thenReturnsEmpty() {
            // Arrange
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.empty());

            Property property = new Property();
            property.setDepartment("75");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));
            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of());

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when property has no department then returns empty")
        void whenPropertyHasNoDepartment_thenReturnsEmpty() {
            // Arrange
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.empty());
            Property property = new Property();
            property.setDepartment(null);
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when property not found then returns empty")
        void whenPropertyNotFound_thenReturnsEmpty() {
            // Arrange
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.empty());
            when(propertyRepository.findById(5L)).thenReturn(Optional.empty());

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when direct team has incompatible type then falls back to zone")
        void whenDirectTeamIncompatibleType_thenFallsBackToZone() {
            // Arrange
            Team maintenanceTeam = buildTeam(10L, "Maintenance", "MAINTENANCE");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, maintenanceTeam);

            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(maintenanceTeam));

            Property property = new Property();
            property.setDepartment("75");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Team cleaningTeam = buildTeam(20L, "Cleaning Zone", "CLEANING");
            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of(20L));
            when(teamRepository.findById(20L)).thenReturn(Optional.of(cleaningTeam));
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(20L), anyList(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).contains(20L);
        }

        @Test
        @DisplayName("when null estimatedDurationHours then uses default of 4 hours")
        void whenNullDuration_thenUsesDefault() {
            // Arrange
            Team defaultTeam = buildTeam(10L, "Team", "CLEANING");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(10L), anyList(), eq(scheduledDate), eq(scheduledDate.plusHours(4)), eq(ORG_ID)))
                    .thenReturn(0L);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, null, "CLEANING");

            // Assert
            assertThat(result).contains(10L);
        }

        @Test
        @DisplayName("when zone search with arrondissement then uses arrondissement query")
        void whenZoneSearchWithArrondissement_thenUsesArrondissementQuery() {
            // Arrange
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.empty());

            Property property = new Property();
            property.setDepartment("75");
            property.setArrondissement("75001");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Team zoneTeam = buildTeam(30L, "Arr Team", "CLEANING");
            when(teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID))
                    .thenReturn(List.of(30L));
            when(teamRepository.findById(30L)).thenReturn(Optional.of(zoneTeam));
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(30L), anyList(), any(), any(), eq(ORG_ID))).thenReturn(0L);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).contains(30L);
            verify(teamCoverageZoneRepository).findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID);
        }

        @Test
        @DisplayName("when zone search without arrondissement then uses department-only query")
        void whenZoneSearchWithoutArrondissement_thenUsesDepartmentQuery() {
            // Arrange
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.empty());

            Property property = new Property();
            property.setDepartment("75");
            property.setArrondissement(null);
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of());

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).isEmpty();
            verify(teamCoverageZoneRepository).findTeamIdsByDepartment("75", ORG_ID);
            verify(teamCoverageZoneRepository, never()).findTeamIdsByDepartmentAndArrondissement(any(), any(), anyLong());
        }

        @Test
        @DisplayName("when zone candidate is same as default team then skips it")
        void whenZoneCandidateIsSameAsDefault_thenSkipsIt() {
            // Arrange
            Team defaultTeam = buildTeam(10L, "Default", "CLEANING");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            // Default team is busy
            when(interventionRepository.countActiveByTeamIdAndDateRange(
                    eq(10L), anyList(), any(), any(), eq(ORG_ID))).thenReturn(2L);

            Property property = new Property();
            property.setDepartment("75");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            // Zone returns only the same default team
            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of(10L));

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "CLEANING");

            // Assert
            assertThat(result).isEmpty();
            // countActive should only be called once (for the default team),
            // not again for the zone candidate since it's the same team
            verify(interventionRepository, times(1))
                    .countActiveByTeamIdAndDateRange(eq(10L), anyList(), any(), any(), eq(ORG_ID));
        }
    }
}
