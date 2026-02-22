package com.clenzy.service;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

    // ===== ASSIGN TEAM =====

    @Nested
    class AssignTeamToProperty {

        @Test
        void whenTeamExists_thenCreatesMapping() {
            Team team = new Team();
            team.setId(10L);
            team.setName("Equipe A");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(false);
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(1L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest();
            request.setPropertyId(5L);
            request.setTeamId(10L);

            PropertyTeamDto result = service.assignTeamToProperty(request);

            assertThat(result.getTeamName()).isEqualTo("Equipe A");
            verify(propertyTeamRepository).save(any(PropertyTeam.class));
        }

        @Test
        void whenTeamNotFound_thenThrows() {
            when(teamRepository.findById(99L)).thenReturn(Optional.empty());

            PropertyTeamRequest request = new PropertyTeamRequest();
            request.setPropertyId(5L);
            request.setTeamId(99L);

            assertThatThrownBy(() -> service.assignTeamToProperty(request))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenExistingMapping_thenDeletesOldAndCreatesNew() {
            Team team = new Team();
            team.setId(10L);
            team.setName("Equipe B");
            when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(true);
            when(propertyTeamRepository.save(any(PropertyTeam.class))).thenAnswer(inv -> {
                PropertyTeam pt = inv.getArgument(0);
                pt.setId(2L);
                return pt;
            });

            PropertyTeamRequest request = new PropertyTeamRequest();
            request.setPropertyId(5L);
            request.setTeamId(10L);

            service.assignTeamToProperty(request);

            verify(propertyTeamRepository).deleteByPropertyIdAndOrganizationId(5L, ORG_ID);
            verify(propertyTeamRepository).save(any(PropertyTeam.class));
        }
    }

    // ===== REMOVE TEAM =====

    @Nested
    class RemoveTeamFromProperty {

        @Test
        void whenNoTeamAssigned_thenThrows() {
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(false);

            assertThatThrownBy(() -> service.removeTeamFromProperty(5L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune equipe");
        }

        @Test
        void whenTeamAssigned_thenDeletes() {
            when(propertyTeamRepository.existsByPropertyId(5L)).thenReturn(true);

            service.removeTeamFromProperty(5L);

            verify(propertyTeamRepository).deleteByPropertyIdAndOrganizationId(5L, ORG_ID);
        }
    }

    // ===== GET BY PROPERTIES =====

    @Nested
    class GetByProperties {

        @Test
        void whenNullList_thenReturnsEmpty() {
            List<PropertyTeamDto> result = service.getByProperties(null);
            assertThat(result).isEmpty();
        }

        @Test
        void whenEmptyList_thenReturnsEmpty() {
            List<PropertyTeamDto> result = service.getByProperties(List.of());
            assertThat(result).isEmpty();
        }
    }

    // ===== FIND AVAILABLE TEAM =====

    @Nested
    class FindAvailableTeamForProperty {

        @Test
        void whenPropertyHasNoDepartment_thenReturnsEmpty() {
            when(propertyTeamRepository.findByPropertyId(5L, ORG_ID)).thenReturn(Optional.empty());
            Property property = new Property();
            property.setDepartment(null);
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Optional<Long> result = service.findAvailableTeamForProperty(
                    5L, LocalDateTime.now(), 2, "CLEANING");

            assertThat(result).isEmpty();
        }
    }
}
