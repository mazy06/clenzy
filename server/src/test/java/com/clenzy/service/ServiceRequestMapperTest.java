package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link ServiceRequestMapper}.
 * Validates bidirectional mapping between ServiceRequest entities and ServiceRequestDto.
 */
@ExtendWith(MockitoExtension.class)
class ServiceRequestMapperTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PropertyRepository propertyRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private com.clenzy.repository.PropertyPhotoRepository photos;

    private ServiceRequestMapper mapper;
    @Mock
    private com.clenzy.service.catalog.ServiceCatalogReference catalog;

    @BeforeEach
    void setUp() {
        mapper = new ServiceRequestMapper(userRepository, propertyRepository, teamRepository, new com.fasterxml.jackson.databind.ObjectMapper(), catalog,
            photos);
    }

    @Test
    void detailIncludesPropertyInstructionsTimezoneAndPersonPhoto() {
        var request = createServiceRequest();
        var property = createProperty(3L, "Studio");
        property.setTimezone("Africa/Casablanca");
        property.setCleaningNotes("Nettoyer la terrasse");
        request.setProperty(property);
        var user = createUser(2L, "Marie", "Martin");
        user.setProfilePictureUrl("/api/photos/avatar");
        request.setUser(user);
        var dto = mapper.toDto(request);
        assertThat(dto.property.timezone).isEqualTo("Africa/Casablanca");
        assertThat(dto.property.cleaningNotes).isEqualTo("Nettoyer la terrasse");
        assertThat(dto.user.profilePictureUrl).isEqualTo("/api/photos/avatar");
    }

    @Test
    void coversAreLoadedOnceForDistinctPropertiesAndUseFirstOrderedPhoto() {
        var request = createServiceRequest();
        request.setProperty(createProperty(3L, "Studio"));
        var first = mapper.toDto(request);
        var second = mapper.toDto(request);
        var cover = org.mockito.Mockito.mock(PropertyPhoto.class);
        var other = org.mockito.Mockito.mock(PropertyPhoto.class);
        when(cover.getPropertyId()).thenReturn(3L);
        when(cover.getUrl()).thenReturn("/cover.jpg");
        when(other.getPropertyId()).thenReturn(3L);
        when(other.getUrl()).thenReturn("/other.jpg");
        when(photos.findByPropertyIdInOrderBySortOrderAscIdAsc(java.util.List.of(3L)))
                .thenReturn(java.util.List.of(cover, other));
        mapper.enrichPropertyPhotos(java.util.List.of(first, second));
        assertThat(first.property.coverPhotoUrl).isEqualTo("/cover.jpg");
        assertThat(second.property.coverPhotoUrl).isEqualTo("/cover.jpg");
        org.mockito.Mockito.verify(photos).findByPropertyIdInOrderBySortOrderAscIdAsc(java.util.List.of(3L));
    }

    @Test
    void preciseCatalogReferenceSurvivesDtoRoundTrip() {
        ServiceRequest entity = createServiceRequest();
        entity.setServiceType(ServiceType.OTHER);
        entity.setServiceItemCode("photo-new-service");
        ServiceRequestDto dto = mapper.toDto(entity);
        assertThat(dto.serviceItemCode).isEqualTo("photo-new-service");
        when(catalog.resolve("photo-new-service", "OTHER", "photo-new-service", "OTHER"))
                .thenReturn("photo-new-service");
        mapper.apply(dto, entity);
        assertThat(entity.getServiceItemCode()).isEqualTo("photo-new-service");
    }

    @Test
    void missionUserOverridesHistoricalRequestAssignmentWithoutWritingIt() {
        ServiceRequest request = createServiceRequest();
        request.setAssignedToId(99L);
        request.setAssignedToType("team");
        Intervention mission = new Intervention();
        mission.setId(338L);
        mission.setAssignedUser(createUser(12L, "Jean", "Martin"));
        ServiceRequestDto dto = new ServiceRequestDto();
        dto.assignedToTeam = new com.clenzy.dto.TeamDto();
        dto.autoAssignStatus = "exhausted";
        mapper.projectMissionAssignment(dto, mission);
        assertThat(dto.interventionId).isEqualTo(338L);
        assertThat(dto.assignedToId).isEqualTo(12L);
        assertThat(dto.assignedToType).isEqualTo("user");
        assertThat(dto.assignedToUser.firstName).isEqualTo("Jean");
        assertThat(dto.assignedToTeam).isNull();
        assertThat(dto.autoAssignStatus).isNull();
        assertThat(request.getAssignedToId()).isEqualTo(99L);
    }

    @Test
    void missionTeamOverridesUserAndUnassignmentClearsAllHistoricalFields() {
        Intervention mission = new Intervention();
        mission.setId(338L);
        mission.setTeamId(7L);
        Team team = new Team();
        team.setId(7L);
        team.setName("Équipe Tours");
        when(teamRepository.findById(7L)).thenReturn(Optional.of(team));
        ServiceRequestDto dto = new ServiceRequestDto();
        dto.assignedToUser = new com.clenzy.dto.UserDto();
        mapper.projectMissionAssignment(dto, mission);
        assertThat(dto.assignedToId).isEqualTo(7L);
        assertThat(dto.assignedToType).isEqualTo("team");
        assertThat(dto.assignedToTeam.name).isEqualTo("Équipe Tours");
        assertThat(dto.assignedToUser).isNull();
        mission.setTeamId(null);
        mapper.projectMissionAssignment(dto, mission);
        assertThat(dto.assignedToId).isNull();
        assertThat(dto.assignedToType).isNull();
        assertThat(dto.assignedToTeam).isNull();
        assertThat(dto.assignedToUser).isNull();
    }

    private User createUser(Long id, String firstName, String lastName) {
        User user = new User();
        user.setId(id);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(firstName.toLowerCase() + "@clenzy.com");
        return user;
    }

    private Property createProperty(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setAddress("123 Rue Test");
        p.setCity("Nice");
        return p;
    }

    private ServiceRequest createServiceRequest() {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(1L);
        sr.setTitle("Nettoyage complet");
        sr.setDescription("Nettoyage apres depart");
        sr.setServiceType(ServiceType.CLEANING);
        sr.setPriority(Priority.NORMAL);
        sr.setStatus(RequestStatus.PENDING);
        sr.setDesiredDate(LocalDateTime.of(2026, 3, 15, 10, 0));
        sr.setPreferredTimeSlot("morning");
        sr.setEstimatedDurationHours(3);
        sr.setEstimatedCost(BigDecimal.valueOf(120));
        return sr;
    }

    @Nested
    @DisplayName("apply - DTO to Entity")
    class Apply {

        @Test
        void whenAllFieldsProvided_thenAppliesAll() {
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.title = "New Title";
            dto.description = "New Desc";
            dto.serviceType = ServiceType.DEEP_CLEANING;
            dto.priority = Priority.HIGH;
            dto.status = RequestStatus.IN_PROGRESS;
            dto.desiredDate = LocalDateTime.of(2026, 4, 1, 14, 0);
            dto.preferredTimeSlot = "afternoon";
            dto.estimatedDurationHours = 5;
            dto.estimatedCost = BigDecimal.valueOf(200);
            dto.actualCost = BigDecimal.valueOf(180);
            dto.specialInstructions = "Use eco products";
            dto.accessNotes = "Code: 1234";
            dto.urgent = true;
            dto.assignedToId = 10L;
            dto.assignedToType = "user";

            ServiceRequest entity = new ServiceRequest();
            mapper.apply(dto, entity);

            assertThat(entity.getTitle()).isEqualTo("New Title");
            assertThat(entity.getDescription()).isEqualTo("New Desc");
            assertThat(entity.getServiceType()).isEqualTo(ServiceType.DEEP_CLEANING);
            assertThat(entity.getPriority()).isEqualTo(Priority.HIGH);
            assertThat(entity.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
            assertThat(entity.getPreferredTimeSlot()).isEqualTo("afternoon");
            assertThat(entity.getEstimatedDurationHours()).isEqualTo(5);
            assertThat(entity.isUrgent()).isTrue();
            assertThat(entity.getAssignedToId()).isEqualTo(10L);
            assertThat(entity.getAssignedToType()).isEqualTo("user");
        }

        @Test
        void whenUserIdProvided_thenSetsUser() {
            User user = createUser(5L, "Jean", "Martin");
            when(userRepository.findById(5L)).thenReturn(Optional.of(user));

            ServiceRequestDto dto = new ServiceRequestDto();
            dto.userId = 5L;

            ServiceRequest entity = new ServiceRequest();
            mapper.apply(dto, entity);

            assertThat(entity.getUser()).isEqualTo(user);
        }

        @Test
        void whenUserNotFound_thenThrowsNotFoundException() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            ServiceRequestDto dto = new ServiceRequestDto();
            dto.userId = 999L;

            ServiceRequest entity = new ServiceRequest();

            assertThatThrownBy(() -> mapper.apply(dto, entity))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("User not found");
        }

        @Test
        void whenPropertyIdProvided_thenSetsProperty() {
            Property property = createProperty(7L, "Villa Nice");
            when(propertyRepository.findById(7L)).thenReturn(Optional.of(property));

            ServiceRequestDto dto = new ServiceRequestDto();
            dto.propertyId = 7L;

            ServiceRequest entity = new ServiceRequest();
            mapper.apply(dto, entity);

            assertThat(entity.getProperty()).isEqualTo(property);
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFoundException() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            ServiceRequestDto dto = new ServiceRequestDto();
            dto.propertyId = 999L;

            ServiceRequest entity = new ServiceRequest();

            assertThatThrownBy(() -> mapper.apply(dto, entity))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("Property not found");
        }
    }

    @Nested
    @DisplayName("toDto - Entity to DTO")
    class ToDto {

        @Test
        void whenFullEntity_thenMapsAllFields() {
            ServiceRequest sr = createServiceRequest();
            User user = createUser(2L, "Marie", "Martin");
            Property property = createProperty(3L, "Appt Paris");
            sr.setUser(user);
            sr.setProperty(property);

            ServiceRequestDto dto = mapper.toDto(sr);

            assertThat(dto.id).isEqualTo(1L);
            assertThat(dto.title).isEqualTo("Nettoyage complet");
            assertThat(dto.description).isEqualTo("Nettoyage apres depart");
            assertThat(dto.serviceType).isEqualTo(ServiceType.CLEANING);
            assertThat(dto.priority).isEqualTo(Priority.NORMAL);
            assertThat(dto.status).isEqualTo(RequestStatus.PENDING);
            assertThat(dto.userId).isEqualTo(2L);
            assertThat(dto.propertyId).isEqualTo(3L);
            assertThat(dto.user).isNotNull();
            assertThat(dto.property).isNotNull();
            assertThat(dto.property.name).isEqualTo("Appt Paris");
        }

        @Test
        void whenAssignedToUser_thenMapsUserInfo() {
            ServiceRequest sr = createServiceRequest();
            sr.setAssignedToId(10L);
            sr.setAssignedToType("user");

            User assignedUser = createUser(10L, "Paul", "Tech");
            when(userRepository.findById(10L)).thenReturn(Optional.of(assignedUser));

            ServiceRequestDto dto = mapper.toDto(sr);

            assertThat(dto.assignedToId).isEqualTo(10L);
            assertThat(dto.assignedToType).isEqualTo("user");
            assertThat(dto.assignedToUser).isNotNull();
            assertThat(dto.assignedToUser.firstName).isEqualTo("Paul");
        }

        @Test
        void whenAssignedToTeam_thenMapsTeamInfo() {
            ServiceRequest sr = createServiceRequest();
            sr.setAssignedToId(5L);
            sr.setAssignedToType("team");

            Team team = new Team();
            team.setId(5L);
            team.setName("Equipe Nettoyage");
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));

            ServiceRequestDto dto = mapper.toDto(sr);

            assertThat(dto.assignedToTeam).isNotNull();
            assertThat(dto.assignedToTeam.name).isEqualTo("Equipe Nettoyage");
        }

        @Test
        void whenNoUser_thenUserIdIsNull() {
            ServiceRequest sr = createServiceRequest();
            sr.setUser(null);

            ServiceRequestDto dto = mapper.toDto(sr);

            assertThat(dto.userId).isNull();
        }

        @Test
        void whenNoProperty_thenPropertyIdIsNull() {
            ServiceRequest sr = createServiceRequest();
            sr.setProperty(null);

            ServiceRequestDto dto = mapper.toDto(sr);

            assertThat(dto.propertyId).isNull();
        }

        @Test
        void whenNoAssignment_thenAssignmentFieldsNull() {
            ServiceRequest sr = createServiceRequest();
            sr.setAssignedToId(null);
            sr.setAssignedToType(null);

            ServiceRequestDto dto = mapper.toDto(sr);

            assertThat(dto.assignedToUser).isNull();
            assertThat(dto.assignedToTeam).isNull();
        }
    }
}
