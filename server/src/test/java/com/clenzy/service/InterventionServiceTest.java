package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterventionServiceTest {

    @Mock
    private InterventionRepository interventionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private TenantContext tenantContext;

    @Mock
    private InterventionPhotoService photoService;

    @Mock
    private InterventionMapper interventionMapper;

    @InjectMocks
    private InterventionService interventionService;

    private Property property;
    private User owner;
    private User technician;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(10L);
        owner.setKeycloakId("owner-keycloak-id");
        owner.setFirstName("Jean");
        owner.setLastName("Dupont");

        technician = new User();
        technician.setId(20L);
        technician.setKeycloakId("tech-keycloak-id");
        technician.setFirstName("Marie");
        technician.setLastName("Martin");

        property = new Property();
        property.setId(100L);
        property.setName("Appartement Paris");
        property.setAddress("1 rue de Rivoli, Paris");
        property.setOwner(owner);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private Jwt mockJwtWithRole(String role) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getClaim("realm_access")).thenReturn(Map.of("roles", List.of(role)));
        lenient().when(jwt.getSubject()).thenReturn("test-keycloak-id");
        return jwt;
    }

    private InterventionDto buildCreateDto() {
        InterventionDto dto = new InterventionDto();
        dto.title = "Reparation fuite";
        dto.description = "Fuite robinet cuisine";
        dto.type = "PLUMBING";
        dto.priority = "HIGH";
        dto.propertyId = property.getId();
        dto.requestorId = owner.getId();
        dto.scheduledDate = "2026-03-01T10:00:00";
        return dto;
    }

    private InterventionDto buildResultDto(String status, String title) {
        InterventionDto result = new InterventionDto();
        result.id = 1L;
        result.title = title;
        result.status = status;
        result.propertyName = "Appartement Paris";
        return result;
    }

    // ── create ───────────────────────────────────────────────────────────────────

    @Test
    void whenCreateAsHost_thenStatusIsAwaitingValidation() {
        // Arrange
        Jwt jwt = mockJwtWithRole("HOST");
        InterventionDto dto = buildCreateDto();
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
            Intervention saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        InterventionDto resultDto = buildResultDto("AWAITING_VALIDATION", "Reparation fuite");
        resultDto.estimatedCost = null;
        when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

        // Act
        InterventionDto result = interventionService.create(dto, jwt);

        // Assert
        assertThat(result.status).isEqualTo("AWAITING_VALIDATION");
        assertThat(result.estimatedCost).isNull();
        assertThat(result.title).isEqualTo("Reparation fuite");
        verify(interventionMapper).apply(eq(dto), any(Intervention.class));
        verify(interventionRepository).save(any(Intervention.class));
    }

    @Test
    void whenCreateAsPlatformStaff_thenStatusIsPending() {
        // Arrange
        Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
        InterventionDto dto = buildCreateDto();
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
            Intervention saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        InterventionDto resultDto = buildResultDto("PENDING", "Reparation fuite");
        when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

        // Act
        InterventionDto result = interventionService.create(dto, jwt);

        // Assert
        assertThat(result.status).isEqualTo("PENDING");
        assertThat(result.title).isEqualTo("Reparation fuite");
        verify(interventionRepository).save(any(Intervention.class));
    }

    // ── updateStatus ─────────────────────────────────────────────────────────────

    @Test
    void whenUpdateStatusWithValidTransition_thenSucceeds() {
        // Arrange — PENDING -> IN_PROGRESS is allowed
        Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

        Intervention intervention = new Intervention();
        intervention.setId(1L);
        intervention.setOrganizationId(1L);
        intervention.setTitle("Test Intervention");
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setProperty(property);

        when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
        when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));

        InterventionDto resultDto = buildResultDto("IN_PROGRESS", "Test Intervention");
        when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

        // Act
        InterventionDto result = interventionService.updateStatus(1L, "IN_PROGRESS", jwt);

        // Assert
        assertThat(result.status).isEqualTo("IN_PROGRESS");
        verify(interventionRepository).save(any(Intervention.class));
    }

    @Test
    void whenUpdateStatusWithInvalidTransition_thenThrows() {
        // Arrange — CANCELLED -> IN_PROGRESS is NOT allowed
        Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

        Intervention intervention = new Intervention();
        intervention.setId(1L);
        intervention.setOrganizationId(1L);
        intervention.setTitle("Cancelled Intervention");
        intervention.setStatus(InterventionStatus.CANCELLED);
        intervention.setProperty(property);

        when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

        // Act & Assert
        assertThatThrownBy(() -> interventionService.updateStatus(1L, "IN_PROGRESS", jwt))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Transition invalide");
    }

    // ── assign ───────────────────────────────────────────────────────────────────

    @Test
    void whenAssignCleaner_thenUpdatesInterventionAssignments() {
        // Arrange
        Jwt jwt = mockJwtWithRole("SUPER_MANAGER");

        Intervention intervention = new Intervention();
        intervention.setId(1L);
        intervention.setOrganizationId(1L);
        intervention.setTitle("Nettoyage");
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setProperty(property);

        when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
        when(userRepository.findById(technician.getId())).thenReturn(Optional.of(technician));
        when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));

        InterventionDto resultDto = buildResultDto("PENDING", "Nettoyage");
        resultDto.assignedToType = "user";
        resultDto.assignedToId = technician.getId();
        resultDto.assignedToName = "Marie Martin";
        when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

        // Act
        InterventionDto result = interventionService.assign(1L, technician.getId(), null, jwt);

        // Assert
        assertThat(result.assignedToType).isEqualTo("user");
        assertThat(result.assignedToId).isEqualTo(technician.getId());
        assertThat(result.assignedToName).isEqualTo("Marie Martin");
        verify(interventionRepository).save(any(Intervention.class));
    }

    // ── getById ──────────────────────────────────────────────────────────────────

    @Test
    void whenGetByIdExists_thenReturnsDto() {
        // Arrange
        Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

        Intervention intervention = new Intervention();
        intervention.setId(1L);
        intervention.setOrganizationId(1L);
        intervention.setTitle("Inspection chaudiere");
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setProperty(property);

        when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

        InterventionDto resultDto = buildResultDto("PENDING", "Inspection chaudiere");
        when(interventionMapper.convertToDto(intervention)).thenReturn(resultDto);

        // Act
        InterventionDto result = interventionService.getById(1L, jwt);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.id).isEqualTo(1L);
        assertThat(result.title).isEqualTo("Inspection chaudiere");
        assertThat(result.status).isEqualTo("PENDING");
        assertThat(result.propertyName).isEqualTo("Appartement Paris");
    }

    @Test
    void whenGetByIdNotFound_thenThrowsNotFoundException() {
        // Arrange — use plain mock JWT since exception is thrown before JWT is used
        Jwt jwt = mock(Jwt.class);
        when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> interventionService.getById(999L, jwt))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("non trouvée");
    }
}
