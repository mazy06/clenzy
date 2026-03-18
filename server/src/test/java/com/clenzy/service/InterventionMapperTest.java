package com.clenzy.service;

import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.UpdateInterventionRequest;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link InterventionMapper}.
 * Validates DTO-to-Entity (apply/applyUpdate) and Entity-to-Response (convertToResponse) mapping.
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
    @DisplayName("apply - CreateInterventionRequest to Entity")
    class Apply {

        @Test
        void whenAllFieldsProvided_thenAppliesAll() {
            Property property = createProperty(7L, "Appartement Nice");
            User requestor = createUser(3L, "Marie", "Manager");
            when(propertyRepository.findById(7L)).thenReturn(Optional.of(property));
            when(userRepository.findById(3L)).thenReturn(Optional.of(requestor));

            CreateInterventionRequest request = new CreateInterventionRequest(
                    "New Title", "New Description", "MAINTENANCE", "LOW",
                    7L, 3L, "2026-03-15T10:00:00", 3, null, null);

            Intervention intervention = createIntervention();
            mapper.apply(request, intervention);

            assertThat(intervention.getTitle()).isEqualTo("New Title");
            assertThat(intervention.getDescription()).isEqualTo("New Description");
            assertThat(intervention.getType()).isEqualTo("MAINTENANCE");
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING); // unchanged
            assertThat(intervention.getPriority()).isEqualTo("LOW");
            assertThat(intervention.getEstimatedDurationHours()).isEqualTo(3);
            assertThat(intervention.getScheduledDate()).isEqualTo(LocalDateTime.of(2026, 3, 15, 10, 0));
            assertThat(intervention.getProperty()).isEqualTo(property);
            assertThat(intervention.getRequestor()).isEqualTo(requestor);
        }

        @Test
        void whenAssignedToUser_thenSetsUserAndClearsTeam() {
            User user = createUser(10L, "Jean", "Tech");
            Property property = createProperty(7L, "Appt");
            User requestor = createUser(3L, "Marie", "Manager");
            when(userRepository.findById(10L)).thenReturn(Optional.of(user));
            when(propertyRepository.findById(7L)).thenReturn(Optional.of(property));
            when(userRepository.findById(3L)).thenReturn(Optional.of(requestor));

            CreateInterventionRequest request = new CreateInterventionRequest(
                    "Title", null, "CLEANING", "HIGH",
                    7L, 3L, "2026-03-15T10:00:00", null, "user", 10L);

            Intervention intervention = createIntervention();
            intervention.setTeamId(5L);

            mapper.apply(request, intervention);

            assertThat(intervention.getAssignedTechnicianId()).isEqualTo(10L);
            assertThat(intervention.getTeamId()).isNull();
            assertThat(intervention.getAssignedUser()).isEqualTo(user);
        }

        @Test
        void whenAssignedToTeam_thenSetsTeamAndClearsUser() {
            Team team = new Team();
            team.setId(5L);
            team.setName("Equipe Nettoyage");
            Property property = createProperty(7L, "Appt");
            User requestor = createUser(3L, "Marie", "Manager");
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));
            when(propertyRepository.findById(7L)).thenReturn(Optional.of(property));
            when(userRepository.findById(3L)).thenReturn(Optional.of(requestor));

            CreateInterventionRequest request = new CreateInterventionRequest(
                    "Title", null, "CLEANING", "HIGH",
                    7L, 3L, "2026-03-15T10:00:00", null, "team", 5L);

            Intervention intervention = createIntervention();
            intervention.setAssignedTechnicianId(10L);

            mapper.apply(request, intervention);

            assertThat(intervention.getTeamId()).isEqualTo(5L);
            assertThat(intervention.getAssignedTechnicianId()).isNull();
            assertThat(intervention.getAssignedUser()).isNull();
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFoundException() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            CreateInterventionRequest request = new CreateInterventionRequest(
                    "Title", null, "CLEANING", "HIGH",
                    999L, 3L, "2026-03-15T10:00:00", null, null, null);

            Intervention intervention = createIntervention();

            assertThatThrownBy(() -> mapper.apply(request, intervention))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenRequestorNotFound_thenThrowsNotFoundException() {
            Property property = createProperty(7L, "Appt");
            when(propertyRepository.findById(7L)).thenReturn(Optional.of(property));
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            CreateInterventionRequest request = new CreateInterventionRequest(
                    "Title", null, "CLEANING", "HIGH",
                    7L, 999L, "2026-03-15T10:00:00", null, null, null);

            Intervention intervention = createIntervention();

            assertThatThrownBy(() -> mapper.apply(request, intervention))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("applyUpdate - UpdateInterventionRequest to Entity")
    class ApplyUpdate {

        @Test
        void whenAllFieldsProvided_thenAppliesAll() {
            UpdateInterventionRequest request = new UpdateInterventionRequest(
                    "Updated Title", "Updated Desc", "MAINTENANCE", "LOW",
                    3, BigDecimal.valueOf(150), "Some notes", null, null);

            Intervention intervention = createIntervention();
            mapper.applyUpdate(request, intervention);

            assertThat(intervention.getTitle()).isEqualTo("Updated Title");
            assertThat(intervention.getDescription()).isEqualTo("Updated Desc");
            assertThat(intervention.getType()).isEqualTo("MAINTENANCE");
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING); // unchanged
            assertThat(intervention.getPriority()).isEqualTo("LOW");
            assertThat(intervention.getEstimatedDurationHours()).isEqualTo(3);
            assertThat(intervention.getEstimatedCost()).isEqualByComparingTo("150");
            assertThat(intervention.getNotes()).isEqualTo("Some notes");
        }

        @Test
        void whenNullFields_thenDoesNotOverwrite() {
            UpdateInterventionRequest request = new UpdateInterventionRequest(
                    null, null, null, null, null, null, null, null, null);

            Intervention intervention = createIntervention();
            String originalTitle = intervention.getTitle();

            mapper.applyUpdate(request, intervention);

            assertThat(intervention.getTitle()).isEqualTo(originalTitle);
        }

        @Test
        void whenAssignedToUser_thenSetsUserAndClearsTeam() {
            User user = createUser(10L, "Jean", "Tech");
            when(userRepository.findById(10L)).thenReturn(Optional.of(user));

            UpdateInterventionRequest request = new UpdateInterventionRequest(
                    null, null, null, null, null, null, null, "user", 10L);

            Intervention intervention = createIntervention();
            intervention.setTeamId(5L);

            mapper.applyUpdate(request, intervention);

            assertThat(intervention.getAssignedTechnicianId()).isEqualTo(10L);
            assertThat(intervention.getTeamId()).isNull();
            assertThat(intervention.getAssignedUser()).isEqualTo(user);
        }
    }

    @Nested
    @DisplayName("convertToResponse - Entity to Response")
    class ConvertToResponse {

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

            when(photoService.loadPhotoBundle(any())).thenReturn(
                    new InterventionPhotoService.PhotoBundle("[]", "[]", "[]", null, null));

            InterventionResponse response = mapper.convertToResponse(intervention);

            assertThat(response.id()).isEqualTo(1L);
            assertThat(response.title()).isEqualTo("Test intervention");
            assertThat(response.description()).isEqualTo("Description");
            assertThat(response.type()).isEqualTo("CLEANING");
            assertThat(response.status()).isEqualTo("PENDING");
            assertThat(response.priority()).isEqualTo("HIGH");
            assertThat(response.estimatedDurationHours()).isEqualTo(2);
            assertThat(response.estimatedCost()).isEqualByComparingTo("100");
            assertThat(response.notes()).isEqualTo("Test notes");
            assertThat(response.progressPercentage()).isEqualTo(75);
            assertThat(response.scheduledDate()).isEqualTo("2026-03-15T14:00:00");
            assertThat(response.propertyId()).isEqualTo(1L);
            assertThat(response.propertyName()).isEqualTo("Appt Paris");
            assertThat(response.propertyType()).isEqualTo("apartment");
            assertThat(response.requestorId()).isEqualTo(2L);
            assertThat(response.requestorName()).isEqualTo("Marie Martin");
        }

        @Test
        void whenAssignedToUser_thenMapsUserAssignment() {
            Intervention intervention = createIntervention();
            User assignedUser = createUser(10L, "Jean", "Tech");
            intervention.setAssignedTechnicianId(10L);
            intervention.setAssignedUser(assignedUser);

            when(photoService.loadPhotoBundle(any())).thenReturn(
                    new InterventionPhotoService.PhotoBundle(null, null, null, null, null));

            InterventionResponse response = mapper.convertToResponse(intervention);

            assertThat(response.assignedToType()).isEqualTo("user");
            assertThat(response.assignedToId()).isEqualTo(10L);
            assertThat(response.assignedToName()).isEqualTo("Jean Tech");
        }

        @Test
        void whenAssignedToTeam_thenMapsTeamAssignment() {
            Intervention intervention = createIntervention();
            intervention.setTeamId(5L);

            Team team = new Team();
            team.setId(5L);
            team.setName("Equipe Nettoyage");
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));
            when(photoService.loadPhotoBundle(any())).thenReturn(
                    new InterventionPhotoService.PhotoBundle(null, null, null, null, null));

            InterventionResponse response = mapper.convertToResponse(intervention);

            assertThat(response.assignedToType()).isEqualTo("team");
            assertThat(response.assignedToId()).isEqualTo(5L);
            assertThat(response.assignedToName()).isEqualTo("Equipe Nettoyage");
        }

        @Test
        void whenTeamNotFound_thenSetsUnknownName() {
            Intervention intervention = createIntervention();
            intervention.setTeamId(999L);

            when(teamRepository.findById(999L)).thenReturn(Optional.empty());
            when(photoService.loadPhotoBundle(any())).thenReturn(
                    new InterventionPhotoService.PhotoBundle(null, null, null, null, null));

            InterventionResponse response = mapper.convertToResponse(intervention);

            assertThat(response.assignedToName()).isEqualTo("Equipe inconnue");
        }

        @Test
        void whenNoAssignment_thenAllAssignmentFieldsNull() {
            Intervention intervention = createIntervention();

            when(photoService.loadPhotoBundle(any())).thenReturn(
                    new InterventionPhotoService.PhotoBundle(null, null, null, null, null));

            InterventionResponse response = mapper.convertToResponse(intervention);

            assertThat(response.assignedToType()).isNull();
            assertThat(response.assignedToId()).isNull();
            assertThat(response.assignedToName()).isNull();
        }

        @Test
        void whenNoProperty_thenPropertyFieldsNull() {
            Intervention intervention = createIntervention();

            when(photoService.loadPhotoBundle(any())).thenReturn(
                    new InterventionPhotoService.PhotoBundle(null, null, null, null, null));

            InterventionResponse response = mapper.convertToResponse(intervention);

            assertThat(response.propertyId()).isNull();
            assertThat(response.propertyName()).isNull();
        }

        @Test
        void whenNullScheduledDate_thenScheduledDateIsNull() {
            Intervention intervention = createIntervention();
            intervention.setScheduledDate(null);

            when(photoService.loadPhotoBundle(any())).thenReturn(
                    new InterventionPhotoService.PhotoBundle(null, null, null, null, null));

            InterventionResponse response = mapper.convertToResponse(intervention);

            assertThat(response.scheduledDate()).isNull();
        }
    }

    @Nested
    @DisplayName("convertToListResponse - list view without photo loading (C6)")
    class ConvertToListResponse {

        @Test
        @DisplayName("returns null photos and photo IDs")
        void whenConvertToListResponse_thenPhotosAreNull() {
            Intervention intervention = createIntervention();
            intervention.setNotes("Some notes");

            InterventionResponse response = mapper.convertToListResponse(intervention, java.util.Map.of());

            assertThat(response.id()).isEqualTo(1L);
            assertThat(response.title()).isEqualTo("Test intervention");
            assertThat(response.status()).isEqualTo("PENDING");
            assertThat(response.notes()).isEqualTo("Some notes");
            // Photos must be null - not loaded
            assertThat(response.photos()).isNull();
            assertThat(response.beforePhotosUrls()).isNull();
            assertThat(response.afterPhotosUrls()).isNull();
            assertThat(response.beforePhotoIds()).isNull();
            assertThat(response.afterPhotoIds()).isNull();
            // photoService should NOT have been called
            verify(photoService, never()).loadPhotoBundle(any());
        }
    }

    @Nested
    @DisplayName("apply - unknown assignedToType (H3)")
    class ApplyUnknownAssignedToType {

        @Test
        @DisplayName("throws IllegalArgumentException for invalid assignedToType")
        void whenUnknownAssignedToType_thenThrows() {
            UpdateInterventionRequest request = new UpdateInterventionRequest(
                    null, null, null, null, null, null, null, "robot", 1L);

            Intervention intervention = createIntervention();

            assertThatThrownBy(() -> mapper.applyUpdate(request, intervention))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("assignedToType")
                    .hasMessageContaining("robot");
        }
    }
}
