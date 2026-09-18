package com.clenzy.service;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.OrganizationRepository;
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
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class PropertyTeamServiceTest {

    @Mock private PropertyTeamRepository propertyTeamRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private TeamCoverageZoneRepository teamCoverageZoneRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private ProviderAvailabilityService availabilityService;
    @Mock private InterventionAllocationGuard allocationGuard;

    @Mock private com.clenzy.repository.ServiceRequestRepository assignments;
    private TenantContext tenantContext;
    private PropertyTeamService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new PropertyTeamService(propertyTeamRepository, interventionRepository,
                teamRepository, teamCoverageZoneRepository, propertyRepository,
                organizationRepository, tenantContext, availabilityService, assignments, allocationGuard);

        lenient().when(assignments.findTeamForCompositionMutation(any())).thenAnswer(i -> teamRepository.findById(i.getArgument(0)));
        // Aucune disponibilite declaree = disponible : c'est le comportement par
        // defaut du service, et celui que ces tests supposaient avant qu'il
        // existe.
        lenient().when(availabilityService.isAvailable(any(), any(), any())).thenReturn(true);

        // Par defaut, l'org du test est de type SYSTEM (recherche uniquement dans sa propre org)
        Organization org = new Organization("Test Org", OrganizationType.SYSTEM, "test-org");
        org.setId(ORG_ID);
        lenient().when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        lenient().when(organizationRepository.findIdsByType(OrganizationType.SYSTEM)).thenReturn(List.of(ORG_ID));
    }


    @Test
    void linkedCleaningAndMaintenanceTeamsAreSelectedByRequestedService() {
        var cleaning=buildTeam(44L,"Ménage","cleaning-turnover");
        var maintenance=buildTeam(45L,"Maintenance","MAINTENANCE");
        when(propertyTeamRepository.findAllByPropertyId(3L,ORG_ID)).thenReturn(List.of(
                buildPropertyTeam(48L,3L,45L,maintenance),buildPropertyTeam(47L,3L,44L,cleaning)));
        when(teamRepository.findById(44L)).thenReturn(Optional.of(cleaning));
        when(teamRepository.findById(45L)).thenReturn(Optional.of(maintenance));
        var date=LocalDateTime.of(2026,9,20,10,0);
        assertThat(service.findAvailableTeamForProperty(3L,date,2,"cleaning-turnover")).contains(44L);
        assertThat(service.findAvailableTeamForProperty(3L,date,2,"maintenance-electrical")).contains(45L);
    }

    @Test
    void secondLinkedTeamCanBeSelectedWhenFirstIsUnavailable() {
        var first=buildTeam(44L,"Ménage 1","cleaning-turnover");
        var second=buildTeam(45L,"Ménage 2","cleaning-turnover");
        when(propertyTeamRepository.findAllByPropertyId(3L,ORG_ID)).thenReturn(List.of(
                buildPropertyTeam(48L,3L,44L,first),buildPropertyTeam(47L,3L,45L,second)));
        when(teamRepository.findById(44L)).thenReturn(Optional.of(first));
        when(teamRepository.findById(45L)).thenReturn(Optional.of(second));
        when(availabilityService.isAvailable(eq(44L),any(),any())).thenReturn(false);
        assertThat(service.findAvailableTeamForProperty(3L,LocalDateTime.of(2026,9,20,10,0),2,"cleaning-turnover")).contains(45L);
    }

    @Test
    void suggestionsKeepEveryCompatibleLinkedTeam() {
        var first=buildTeam(44L,"Ménage 1","cleaning-turnover");
        var second=buildTeam(45L,"Ménage 2","cleaning-turnover");
        when(propertyTeamRepository.findAllByPropertyId(3L,ORG_ID)).thenReturn(List.of(
                buildPropertyTeam(48L,3L,44L,first),buildPropertyTeam(47L,3L,45L,second)));
        when(teamRepository.findById(44L)).thenReturn(Optional.of(first));
        when(teamRepository.findById(45L)).thenReturn(Optional.of(second));
        var result=service.findAssignableTeams(3L,LocalDateTime.of(2026,9,20,10,0),2,"cleaning-turnover",ORG_ID,null,null);
        assertThat(result).extracting(PropertyTeamService.AssignableTeam::teamId).containsExactlyInAnyOrder(44L,45L);
    }

    private Team buildTeam(Long id, String name, String interventionType) {
        Team team = new Team();
        team.setId(id);
        team.setName(name);
        team.setInterventionType(interventionType);
        team.setOrganizationId(ORG_ID);
        team.setServiceItemCodes(java.util.Set.of("MAINTENANCE".equals(interventionType)
            ? "maintenance-electrical" : interventionType));
        return team;
    }

    @Test
    void suggestionsUseGlobalReservationsAndExcludeCurrentMission() {
        var start = LocalDateTime.of(2026, 9, 15, 10, 0);
        var team = buildTeam(7L, "Team", "cleaning-turnover");
        when(teamRepository.findAllForOrg(ORG_ID)).thenReturn(List.of(team));
        when(teamRepository.findById(7L)).thenReturn(Optional.of(team));
        when(assignments.previewAssignmentConflicts(44L, 55L, "team", 7L, start, 3)).thenReturn(true);

        var result = service.findAssignableTeams(20L, start, 3, "cleaning-turnover", ORG_ID, 44L, 55L);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().available()).isFalse();
        verify(assignments).previewAssignmentConflicts(44L, 55L, "team", 7L, start, 3);
        verifyNoInteractions(interventionRepository);
    }

    @Test
    void suggestionsExcludeAPropertyTypeRejectedByTheProvider() {
        var start = LocalDateTime.of(2026, 9, 16, 10, 0);
        var property = new Property(); property.setType(PropertyType.BOAT);
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
        when(teamRepository.findAllForOrg(ORG_ID)).thenReturn(List.of(buildTeam(7L, "Team", "cleaning-turnover")));
        when(teamCoverageZoneRepository.rejectsPropertyType(7L, "BOAT")).thenReturn(true);
        assertThat(service.findAssignableTeams(20L, start, 3, "cleaning-turnover", ORG_ID)).isEmpty();
        verifyNoInteractions(assignments);
    }

    private PropertyTeam buildPropertyTeam(Long id, Long propertyId, Long teamId, Team team) {
        PropertyTeam pt = new PropertyTeam(propertyId, teamId);
        pt.setId(id);
        pt.setTeam(team);
        pt.setServiceItemCode(team.getServiceItemCodes().iterator().next());
        pt.setOrganizationId(ORG_ID);
        return pt;
    }

    @Test
    void automaticSelectionAndSuggestionsAgreeOnReservedZoneTeams() {
        var start = LocalDateTime.of(2026, 9, 16, 10, 0);
        var property = new Property(); property.setCountryCode("FR");
            property.setDepartment("75"); property.setCountryCode("FR");
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
        when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID)).thenReturn(List.of(7L, 8L));
        var busy = buildTeam(7L, "Équipe réservée", "cleaning-turnover");
        var free = buildTeam(8L, "Équipe libre", "cleaning-turnover");
        when(teamRepository.findById(7L)).thenReturn(Optional.of(busy));
        when(teamRepository.findById(8L)).thenReturn(Optional.of(free));
        when(assignments.previewAssignmentConflicts(null, null, "team", 7L, start, 3)).thenReturn(true);
        when(assignments.previewAssignmentConflicts(null, null, "team", 8L, start, 3)).thenReturn(false);

        assertThat(service.findAvailableTeamForProperty(20L, start, 3, "cleaning-turnover")).contains(8L);
        var suggestions = service.findAssignableTeams(20L, start, 3, "cleaning-turnover", ORG_ID);
        assertThat(suggestions).extracting(PropertyTeamService.AssignableTeam::teamId).containsExactly(8L, 7L);
        assertThat(suggestions.getFirst().available()).isTrue();
        assertThat(suggestions.getLast().available()).isFalse();
        verify(assignments, times(2)).previewAssignmentConflicts(null, null, "team", 7L, start, 3);
        verifyNoInteractions(interventionRepository);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"france", "arrondissement", "foreign"})
    void automaticAndManualSearchUseTheSameNormalizedGeography(String scenario) {
        var start = LocalDateTime.of(2026, 9, 16, 10, 0);
        var property = new Property();
        property.setCountryCode(scenario.equals("foreign") ? " ma " : " fr ");
        property.setCity(" Marrakech "); property.setDepartment(" 75 ");
        property.setArrondissement(scenario.equals("arrondissement") ? " 75001 " : "  ");
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
        switch (scenario) {
            case "france" -> when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID)).thenReturn(List.of(8L));
            case "arrondissement" -> when(teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID)).thenReturn(List.of(8L));
            case "foreign" -> when(teamCoverageZoneRepository.findTeamIdsByCountryAndCity("MA", "Marrakech", ORG_ID)).thenReturn(List.of(8L));
        }
        var team = buildTeam(8L, "Équipe de zone", "cleaning-turnover");
        when(teamRepository.findById(8L)).thenReturn(Optional.of(team));

        assertThat(service.findAvailableTeamForProperty(20L, start, 3, "cleaning-turnover")).contains(8L);
        var suggestions = service.findAssignableTeams(20L, start, 3, "cleaning-turnover", ORG_ID);
        assertThat(suggestions).extracting(PropertyTeamService.AssignableTeam::teamId).containsExactly(8L);
        assertThat(suggestions.getFirst().origin()).isEqualTo("ZONE");
        switch (scenario) {
            case "france" -> verify(teamCoverageZoneRepository, times(2)).findTeamIdsByDepartment("75", ORG_ID);
            case "arrondissement" -> verify(teamCoverageZoneRepository, times(2)).findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID);
            case "foreign" -> verify(teamCoverageZoneRepository, times(2)).findTeamIdsByCountryAndCity("MA", "Marrakech", ORG_ID);
        }
        verify(teamCoverageZoneRepository, times(2)).rejectsPropertyType(8L, "APARTMENT");
        verifyNoMoreInteractions(teamCoverageZoneRepository);
    }

    // ===== ASSIGN TEAM =====

    @Nested
    @DisplayName("assignTeamToProperty")
    class AssignTeamToProperty {
        @BeforeEach void propertyOwner() {
            var property = new Property();
            property.setOrganizationId(ORG_ID);
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));
        }

        @Test
        @DisplayName("when team exists and no previous mapping then creates new mapping")
        void whenTeamExists_thenCreatesMapping() {
            // Arrange
            Team team = buildTeam(10L, "Equipe A", "cleaning-turnover");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(1L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest(5L, 10L);
            request.setServiceItemCode(team.getServiceItemCodes().iterator().next());

            // Act
            PropertyTeamDto result = service.assignTeamToProperty(request);

            // Assert
            assertThat(result.getTeamName()).isEqualTo("Equipe A");
            assertThat(result.getTeamInterventionType()).isEqualTo("cleaning-turnover");
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
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("adding one service never deletes another service")
        void whenAnotherServiceExists_thenPreservesIt() {
            // Arrange
            Team team = buildTeam(10L, "Equipe B", "MAINTENANCE");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(2L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest(5L, 10L);
            request.setServiceItemCode(team.getServiceItemCodes().iterator().next());

            // Act
            service.assignTeamToProperty(request);

            // Assert
            verify(propertyTeamRepository, never()).deleteByPropertyIdAndOrganizationId(any(), any());
            verify(propertyTeamRepository).save(any(PropertyTeam.class));
        }

        @Test
        @DisplayName("then sets organizationId on new mapping")
        void thenSetsOrganizationId() {
            // Arrange
            Team team = buildTeam(10L, "Team", "cleaning-turnover");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(3L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest(5L, 10L);
            request.setServiceItemCode(team.getServiceItemCodes().iterator().next());

            // Act
            service.assignTeamToProperty(request);

            // Assert
            var captor = org.mockito.ArgumentCaptor.forClass(PropertyTeam.class);
            verify(propertyTeamRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }
    }

    // ===== REMOVE TEAM =====

    @Test
    void bulkRemovalIsRejectedWithoutDeletingOtherServices() {
        assertThatThrownBy(() -> service.removeTeamFromProperty(5L))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(propertyTeamRepository);
    }

    @Test
    void removalTargetsOnlyOwnedAssociation() {
        var team = buildTeam(10L, "Equipe", "cleaning-turnover");
        var mapping = buildPropertyTeam(77L, 5L, 10L, team);
        when(propertyTeamRepository.findById(77L)).thenReturn(Optional.of(mapping));
        service.removeAssociation(77L);
        verify(propertyTeamRepository).delete(mapping);
        mapping.setOrganizationId(99L);
        assertThatThrownBy(() -> service.removeAssociation(77L))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(propertyTeamRepository, times(1)).delete(any(PropertyTeam.class));
    }

    // ===== GET BY PROPERTY =====

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {

        @Test
        @DisplayName("when mapping exists then returns DTO")
        void whenMappingExists_thenReturnsDto() {
            // Arrange
            Team team = buildTeam(10L, "Equipe X", "cleaning-turnover");
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
            Team team1 = buildTeam(10L, "Team A", "cleaning-turnover");
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
            Team defaultTeam = buildTeam(10L, "Equipe Menage", "cleaning-turnover");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            when(assignments.previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(10L), any(), anyInt())).thenReturn(false);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).contains(10L);
        }

        @Test
        @DisplayName("when direct assignment is busy then falls back to zone search")
        void whenDirectAssignmentBusy_thenFallsBackToZone() {
            // Arrange
            Team defaultTeam = buildTeam(10L, "Equipe Busy", "cleaning-turnover");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            when(assignments.previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(10L), any(), anyInt())).thenReturn(true);

            Property property = new Property();
            property.setCountryCode("FR");
            property.setDepartment("75");
            property.setArrondissement("75001");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Team zoneTeam = buildTeam(20L, "Zone Team", "cleaning-turnover");
            when(teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID))
                    .thenReturn(List.of(20L));
            when(teamRepository.findById(20L)).thenReturn(Optional.of(zoneTeam));
            when(assignments.previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(20L), any(), anyInt())).thenReturn(false);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).contains(20L);
        }

        @Test
        @DisplayName("when no team available anywhere then returns empty")
        void whenNoTeamAvailable_thenReturnsEmpty() {
            // Arrange
            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of());

            Property property = new Property();
            property.setCountryCode("FR");
            property.setDepartment("75");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));
            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of());

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when property has no department then returns empty")
        void whenPropertyHasNoDepartment_thenReturnsEmpty() {
            // Arrange
            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of());
            Property property = new Property();
            property.setDepartment(null);
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when property not found then returns empty")
        void whenPropertyNotFound_thenReturnsEmpty() {
            // Arrange
            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of());
            when(propertyRepository.findById(5L)).thenReturn(Optional.empty());

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when direct team has incompatible type then falls back to zone")
        void whenDirectTeamIncompatibleType_thenFallsBackToZone() {
            // Arrange
            Team maintenanceTeam = buildTeam(10L, "Maintenance", "MAINTENANCE");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, maintenanceTeam);

            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of(mapping));

            Property property = new Property();
            property.setCountryCode("FR");
            property.setDepartment("75");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Team cleaningTeam = buildTeam(20L, "Cleaning Zone", "cleaning-turnover");
            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of(20L));
            when(teamRepository.findById(20L)).thenReturn(Optional.of(cleaningTeam));
            when(assignments.previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(20L), any(), anyInt())).thenReturn(false);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).contains(20L);
        }

        @Test
        @DisplayName("when null estimatedDurationHours then uses default of 4 hours")
        void whenNullDuration_thenUsesDefault() {
            // Arrange
            Team defaultTeam = buildTeam(10L, "Team", "cleaning-turnover");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            when(assignments.previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(10L), eq(scheduledDate), eq(4))).thenReturn(false);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, null, "cleaning-turnover");

            // Assert
            assertThat(result).contains(10L);
        }

        @Test
        @DisplayName("when zone search with arrondissement then uses arrondissement query")
        void whenZoneSearchWithArrondissement_thenUsesArrondissementQuery() {
            // Arrange
            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of());

            Property property = new Property();
            property.setCountryCode("FR");
            property.setDepartment("75");
            property.setArrondissement("75001");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Team zoneTeam = buildTeam(30L, "Arr Team", "cleaning-turnover");
            when(teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID))
                    .thenReturn(List.of(30L));
            when(teamRepository.findById(30L)).thenReturn(Optional.of(zoneTeam));
            when(assignments.previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(30L), any(), anyInt())).thenReturn(false);

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).contains(30L);
            verify(teamCoverageZoneRepository).findTeamIdsByDepartmentAndArrondissement("75", "75001", ORG_ID);
        }

        @Test
        @DisplayName("when zone search without arrondissement then uses department-only query")
        void whenZoneSearchWithoutArrondissement_thenUsesDepartmentQuery() {
            // Arrange
            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of());

            Property property = new Property();
            property.setCountryCode("FR");
            property.setDepartment("75");
            property.setArrondissement(null);
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of());

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).isEmpty();
            verify(teamCoverageZoneRepository).findTeamIdsByDepartment("75", ORG_ID);
            verify(teamCoverageZoneRepository, never()).findTeamIdsByDepartmentAndArrondissement(any(), any(), anyLong());
        }

        @Test
        @DisplayName("when zone candidate is same as default team then skips it")
        void whenZoneCandidateIsSameAsDefault_thenSkipsIt() {
            // Arrange
            Team defaultTeam = buildTeam(10L, "Default", "cleaning-turnover");
            PropertyTeam mapping = buildPropertyTeam(1L, 5L, 10L, defaultTeam);

            when(propertyTeamRepository.findAllByPropertyId(5L, ORG_ID)).thenReturn(List.of(mapping));
            when(teamRepository.findById(10L)).thenReturn(Optional.of(defaultTeam));
            // Default team is busy
            when(assignments.previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(10L), any(), anyInt())).thenReturn(true);

            Property property = new Property();
            property.setCountryCode("FR");
            property.setDepartment("75");
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            // Zone returns only the same default team
            when(teamCoverageZoneRepository.findTeamIdsByDepartment("75", ORG_ID))
                    .thenReturn(List.of(10L));

            // Act
            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, scheduledDate, 2, "cleaning-turnover");

            // Assert
            assertThat(result).isEmpty();
            // The shared conflict check should only be called once (for the default team),
            // not again for the zone candidate since it's the same team (testedTeamIds)
            verify(assignments, times(1))
                    .previewAssignmentConflicts(isNull(), isNull(), eq("team"), eq(10L), any(), anyInt());
        }
    }
    @Test void associationCandidatesUseAuthorizedCapabilitiesAndProtectPropertyOwnership() {
        Property property = new Property();
        property.setOrganizationId(ORG_ID);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(allocationGuard.candidateTeamIds("photo", ORG_ID)).thenReturn(List.of(20L));
        Team partner = new Team(); partner.setId(20L); partner.setName("Partenaire");
        when(teamRepository.findAllById(List.of(20L))).thenReturn(List.of(partner));
        assertThat(service.getAssociationCandidates(100L, "photo"))
            .containsExactly(new PropertyTeamService.AssociationCandidate(20L, "Partenaire"));
        property.setOrganizationId(99L);
        assertThatThrownBy(() -> service.getAssociationCandidates(100L, "photo"))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

}
