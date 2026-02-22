package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link InterventionMapper}.
 * Validates DTO→Entity (apply) and Entity→DTO (convertToDto) mapping.
 */
@ExtendWith(MockitoExtension.class)
class InterventionMapperTest {

    @Mock
    private PropertyRepository propertyRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private InterventionPhotoService photoService;

    private InterventionMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new InterventionMapper(propertyRepository, userRepository, teamRepository, photoService);
    }

    private Intervention createIntervention() {
        Intervention intervention = new Intervention();
        intervention.setId(1L);
        intervention.setTitle("Test intervention");
        intervention.setDescription("Description");
        intervention.setType("CLEANING");
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPriority("HIGH");
        intervention.setStartTime(LocalDateTime.now());
        return intervention;
    }

    private User createUser(Long id, String firstName, String lastName) {
        User user = new User();
        user.setId(id);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        return user;
    }

    private Property createProperty(Long id, String name) {
        Property property = new Property();
        property.setId(id);
        property.setName(name);
        property.setAddress("123 Rue Test");
        return property;
    }

    @Nested
    @DisplayName("apply - DTO to Entity")
    class Apply {

        @Test
        void whenAllFieldsProvided_thenAppliesAll() {
            InterventionDto dto = new InterventionDto();
            dto.title = "New Title";
            dto.description = "New Description";
            dto.type = "MAINTENANCE";
            dto.status = "IN_PROGRESS";
            dto.priority = "LOW";
            dto.estimatedDurationHours = 3;
            dto.estimatedCost = BigDecimal.valueOf(150);
            dto.notes = "Some notes";
            dto.progressPercentage = 50;
            dto.scheduledDate = "2026-03-15T10:00:00";

            Intervention intervention = createIntervention();
            mapper.apply(dto, intervention);

            assertThat(intervention.getTitle()).isEqualTo("New Title");
            assertThat(intervention.getDescription()).isEqualTo("New Description");
            assertThat(intervention.getType()).isEqualTo("MAINTENANCE");
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
            assertThat(intervention.getPriority()).isEqualTo("LOW");
            assertThat(intervention.getEstimatedDurationHours()).isEqualTo(3);
            assertThat(intervention.getEstimatedCost()).isEqualByComparingTo("150");
            assertThat(intervention.getNotes()).isEqualTo("Some notes");
            assertThat(intervention.getProgressPercentage()).isEqualTo(50);
            assertThat(intervention.getScheduledDate()).isEqualTo(LocalDateTime.of(2026, 3, 15, 10, 0));
        }

        @Test
        void whenNullFields_thenDoesNotOverwrite() {
            InterventionDto dto = new InterventionDto();
            // All fields null

            Intervention intervention = createIntervention();
            String originalTitle = intervention.getTitle();

            mapper.apply(dto, intervention);

            assertThat(intervention.getTitle()).isEqualTo(originalTitle);
        }

        @Test
        void whenInvalidStatus_thenThrowsIllegalArgumentException() {
            InterventionDto dto = new InterventionDto();
            dto.status = "INVALID_STATUS";

            Intervention intervention = createIntervention();

            assertThatThrownBy(() -> mapper.apply(dto, intervention))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Statut invalide");
        }

        @Test
        void whenAssignedToUser_thenSetsUserAndClearsTeam() {
            User user = createUser(10L, "Jean", "Tech");
            when(userRepository.findById(10L)).thenReturn(Optional.of(user));

            InterventionDto dto = new InterventionDto();
            dto.assignedToType = "user";
            dto.assignedToId = 10L;

            Intervention intervention = createIntervention();
            intervention.setTeamId(5L);

            mapper.apply(dto, intervention);

            assertThat(intervention.getAssignedTechnicianId()).isEqualTo(10L);
            assertThat(intervention.getTeamId()).isNull();
            assertThat(intervention.getAssignedUser()).isEqualTo(user);
        }

        @Test
        void whenAssignedToTeam_thenSetsTeamAndClearsUser() {
            Team team = new Team();
            team.setId(5L);
            team.setName("Equipe Nettoyage");
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));

            InterventionDto dto = new InterventionDto();
            dto.assignedToType = "team";
            dto.assignedToId = 5L;

            Intervention intervention = createIntervention();
            intervention.setAssignedTechnicianId(10L);

            mapper.apply(dto, intervention);

            assertThat(intervention.getTeamId()).isEqualTo(5L);
            assertThat(intervention.getAssignedTechnicianId()).isNull();
            assertThat(intervention.getAssignedUser()).isNull();
        }

        @Test
        void whenPropertyProvided_thenSetsProperty() {
            Property property = createProperty(7L, "Appartement Nice");
            when(propertyRepository.findById(7L)).thenReturn(Optional.of(property));

            InterventionDto dto = new InterventionDto();
            dto.propertyId = 7L;

            Intervention intervention = createIntervention();
            mapper.apply(dto, intervention);

            assertThat(intervention.getProperty()).isEqualTo(property);
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFoundException() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            InterventionDto dto = new InterventionDto();
            dto.propertyId = 999L;

            Intervention intervention = createIntervention();

            assertThatThrownBy(() -> mapper.apply(dto, intervention))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenRequestorProvided_thenSetsRequestor() {
            User requestor = createUser(3L, "Marie", "Manager");
            when(userRepository.findById(3L)).thenReturn(Optional.of(requestor));

            InterventionDto dto = new InterventionDto();
            dto.requestorId = 3L;

            Intervention intervention = createIntervention();
            mapper.apply(dto, intervention);

            assertThat(intervention.getRequestor()).isEqualTo(requestor);
        }

        @Test
        void whenRequestorNotFound_thenThrowsNotFoundException() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            InterventionDto dto = new InterventionDto();
            dto.requestorId = 999L;

            Intervention intervention = createIntervention();

            assertThatThrownBy(() -> mapper.apply(dto, intervention))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("convertToDto - Entity to DTO")
    class ConvertToDto {

        @Test
        void whenFullEntity_thenMapsAllFields() {
            Intervention intervention = createIntervention();
            intervention.setEstimatedDurationHours(2);
            intervention.setEstimatedCost(BigDecimal.valueOf(100));
            intervention.setNotes("Test notes");
            intervention.setScheduledDate(LocalDateTime.of(2026, 3, 15, 14, 0));
            intervention.setProgressPercentage(75);

            Property property = createProperty(1L, "Appt Paris");
            property.setType(PropertyType.APARTMENT);
            intervention.setProperty(property);

            User requestor = createUser(2L, "Marie", "Martin");
            intervention.setRequestor(requestor);

            when(photoService.convertPhotosToBase64Urls(intervention)).thenReturn("[]");
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "before")).thenReturn("[]");
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "after")).thenReturn("[]");

            InterventionDto dto = mapper.convertToDto(intervention);

            assertThat(dto.id).isEqualTo(1L);
            assertThat(dto.title).isEqualTo("Test intervention");
            assertThat(dto.description).isEqualTo("Description");
            assertThat(dto.type).isEqualTo("CLEANING");
            assertThat(dto.status).isEqualTo("PENDING");
            assertThat(dto.priority).isEqualTo("HIGH");
            assertThat(dto.estimatedDurationHours).isEqualTo(2);
            assertThat(dto.estimatedCost).isEqualByComparingTo("100");
            assertThat(dto.notes).isEqualTo("Test notes");
            assertThat(dto.progressPercentage).isEqualTo(75);
            assertThat(dto.scheduledDate).isEqualTo("2026-03-15T14:00:00");
            assertThat(dto.propertyId).isEqualTo(1L);
            assertThat(dto.propertyName).isEqualTo("Appt Paris");
            assertThat(dto.propertyType).isEqualTo("apartment");
            assertThat(dto.requestorId).isEqualTo(2L);
            assertThat(dto.requestorName).isEqualTo("Marie Martin");
        }

        @Test
        void whenAssignedToUser_thenMapsUserAssignment() {
            Intervention intervention = createIntervention();
            User assignedUser = createUser(10L, "Jean", "Tech");
            intervention.setAssignedTechnicianId(10L);
            intervention.setAssignedUser(assignedUser);

            when(photoService.convertPhotosToBase64Urls(intervention)).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "before")).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "after")).thenReturn(null);

            InterventionDto dto = mapper.convertToDto(intervention);

            assertThat(dto.assignedToType).isEqualTo("user");
            assertThat(dto.assignedToId).isEqualTo(10L);
            assertThat(dto.assignedToName).isEqualTo("Jean Tech");
        }

        @Test
        void whenAssignedToTeam_thenMapsTeamAssignment() {
            Intervention intervention = createIntervention();
            intervention.setTeamId(5L);

            Team team = new Team();
            team.setId(5L);
            team.setName("Equipe Nettoyage");
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));
            when(photoService.convertPhotosToBase64Urls(intervention)).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "before")).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "after")).thenReturn(null);

            InterventionDto dto = mapper.convertToDto(intervention);

            assertThat(dto.assignedToType).isEqualTo("team");
            assertThat(dto.assignedToId).isEqualTo(5L);
            assertThat(dto.assignedToName).isEqualTo("Equipe Nettoyage");
        }

        @Test
        void whenTeamNotFound_thenSetsUnknownName() {
            Intervention intervention = createIntervention();
            intervention.setTeamId(999L);

            when(teamRepository.findById(999L)).thenReturn(Optional.empty());
            when(photoService.convertPhotosToBase64Urls(intervention)).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "before")).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "after")).thenReturn(null);

            InterventionDto dto = mapper.convertToDto(intervention);

            assertThat(dto.assignedToName).isEqualTo("Equipe inconnue");
        }

        @Test
        void whenNoAssignment_thenAllAssignmentFieldsNull() {
            Intervention intervention = createIntervention();

            when(photoService.convertPhotosToBase64Urls(intervention)).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "before")).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "after")).thenReturn(null);

            InterventionDto dto = mapper.convertToDto(intervention);

            assertThat(dto.assignedToType).isNull();
            assertThat(dto.assignedToId).isNull();
            assertThat(dto.assignedToName).isNull();
        }

        @Test
        void whenNoProperty_thenPropertyFieldsNull() {
            Intervention intervention = createIntervention();

            when(photoService.convertPhotosToBase64Urls(intervention)).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "before")).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "after")).thenReturn(null);

            InterventionDto dto = mapper.convertToDto(intervention);

            assertThat(dto.propertyId).isNull();
            assertThat(dto.propertyName).isNull();
        }

        @Test
        void whenNullScheduledDate_thenScheduledDateIsNull() {
            Intervention intervention = createIntervention();
            intervention.setScheduledDate(null);

            when(photoService.convertPhotosToBase64Urls(intervention)).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "before")).thenReturn(null);
            when(photoService.convertPhotosToBase64UrlsByType(intervention, "after")).thenReturn(null);

            InterventionDto dto = mapper.convertToDto(intervention);

            assertThat(dto.scheduledDate).isNull();
        }
    }
}
