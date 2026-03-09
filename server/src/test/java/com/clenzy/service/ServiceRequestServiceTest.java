package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceRequestServiceTest {

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

    private TenantContext tenantContext;
    private ServiceRequestService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        service = new ServiceRequestService(
                serviceRequestRepository, userRepository, propertyRepository,
                interventionRepository, reservationRepository, teamRepository, notificationService,
                propertyTeamService, kafkaTemplate, tenantContext, serviceRequestMapper);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ServiceRequest buildEntity(Long id, String title, RequestStatus status) {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(id);
        sr.setTitle(title);
        sr.setStatus(status);
        sr.setPriority(Priority.NORMAL);
        sr.setServiceType(ServiceType.CLEANING);
        sr.setDesiredDate(LocalDateTime.now().plusDays(3));
        return sr;
    }

    private ServiceRequestDto buildDto() {
        ServiceRequestDto dto = new ServiceRequestDto();
        dto.title = "Nettoyage appartement";
        dto.serviceType = ServiceType.CLEANING;
        dto.priority = Priority.NORMAL;
        dto.desiredDate = LocalDateTime.now().plusDays(3);
        dto.userId = 10L;
        dto.propertyId = 20L;
        return dto;
    }

    private User buildUser(Long id, UserRole role, String keycloakId) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setKeycloakId(keycloakId);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setEmail("test@example.com");
        return user;
    }

    private Property buildProperty(Long id, User owner) {
        Property prop = new Property();
        prop.setId(id);
        prop.setName("Appartement Test");
        prop.setOwner(owner);
        return prop;
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create(dto)")
    class Create {

        @Test
        @DisplayName("maps DTO to entity, saves, notifies admins, returns mapped DTO")
        void whenValidDto_thenMapsAndSavesAndReturnsDto() {
            // Arrange
            ServiceRequestDto inputDto = buildDto();
            ServiceRequest savedEntity = buildEntity(1L, inputDto.title, RequestStatus.PENDING);

            ServiceRequestDto resultDto = new ServiceRequestDto();
            resultDto.id = 1L;
            resultDto.title = "Nettoyage appartement";

            when(serviceRequestRepository.save(any(ServiceRequest.class))).thenReturn(savedEntity);
            when(serviceRequestMapper.toDto(savedEntity)).thenReturn(resultDto);

            // Act
            ServiceRequestDto result = service.create(inputDto);

            // Assert
            assertThat(result.id).isEqualTo(1L);
            assertThat(result.title).isEqualTo("Nettoyage appartement");
            verify(serviceRequestMapper).apply(eq(inputDto), any(ServiceRequest.class));
            verify(serviceRequestRepository).save(any(ServiceRequest.class));
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.SERVICE_REQUEST_CREATED),
                    anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("sets organizationId from TenantContext before saving")
        void whenCreating_thenSetsOrganizationId() {
            // Arrange
            ServiceRequestDto inputDto = buildDto();
            ServiceRequest savedEntity = buildEntity(1L, inputDto.title, RequestStatus.PENDING);
            when(serviceRequestRepository.save(any(ServiceRequest.class))).thenReturn(savedEntity);
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            // Act
            service.create(inputDto);

            // Assert
            ArgumentCaptor<ServiceRequest> captor = ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }
    }

    @Nested
    @DisplayName("update(id, dto)")
    class Update {

        @Test
        @DisplayName("when found - applies changes, saves, returns mapped DTO")
        void whenFound_thenUpdatesAndReturnsDto() {
            // Arrange
            ServiceRequest existing = buildEntity(1L, "Old Title", RequestStatus.PENDING);
            ServiceRequestDto updateDto = buildDto();
            updateDto.title = "New Title";

            ServiceRequestDto expectedDto = new ServiceRequestDto();
            expectedDto.id = 1L;
            expectedDto.title = "New Title";

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(serviceRequestRepository.save(any(ServiceRequest.class))).thenReturn(existing);
            when(serviceRequestMapper.toDto(existing)).thenReturn(expectedDto);

            // Act
            ServiceRequestDto result = service.update(1L, updateDto);

            // Assert
            assertThat(result.title).isEqualTo("New Title");
            verify(serviceRequestMapper).apply(eq(updateDto), eq(existing));
            verify(serviceRequestRepository).save(existing);
        }

        @Test
        @DisplayName("when updated to REJECTED - notifies the requester")
        void whenUpdatedToRejected_thenNotifiesRequester() {
            // Arrange
            User user = buildUser(10L, UserRole.HOST, "kc-user-10");
            ServiceRequest existing = buildEntity(1L, "Menage urgent", RequestStatus.PENDING);
            existing.setUser(user);

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            ServiceRequestDto dto = new ServiceRequestDto();
            dto.status = RequestStatus.REJECTED;

            doAnswer(inv -> {
                ServiceRequest entity = inv.getArgument(1);
                ServiceRequestDto d = inv.getArgument(0);
                if (d.status != null) entity.setStatus(d.status);
                return null;
            }).when(serviceRequestMapper).apply(any(), any());

            // Act
            service.update(1L, dto);

            // Assert
            verify(notificationService).notify(
                    eq("kc-user-10"),
                    eq(NotificationKey.SERVICE_REQUEST_REJECTED),
                    anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.update(999L, buildDto()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("not found");
        }
    }

    @Nested
    @DisplayName("getById(id)")
    class GetById {

        @Test
        @DisplayName("when found - returns mapped DTO")
        void whenFound_thenReturnsDto() {
            // Arrange
            ServiceRequest entity = buildEntity(1L, "Test SR", RequestStatus.PENDING);
            ServiceRequestDto expectedDto = new ServiceRequestDto();
            expectedDto.id = 1L;
            expectedDto.title = "Test SR";

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(entity));
            when(serviceRequestMapper.toDto(entity)).thenReturn(expectedDto);

            // Act
            ServiceRequestDto result = service.getById(1L);

            // Assert
            assertThat(result.id).isEqualTo(1L);
            assertThat(result.title).isEqualTo("Test SR");
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getById(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("list()")
    class ListAll {

        @Test
        @DisplayName("returns all service requests mapped to DTOs")
        void whenCalled_thenReturnsMappedList() {
            // Arrange
            ServiceRequest sr1 = buildEntity(1L, "SR 1", RequestStatus.PENDING);
            ServiceRequest sr2 = buildEntity(2L, "SR 2", RequestStatus.ASSIGNED);
            ServiceRequestDto dto1 = new ServiceRequestDto();
            dto1.id = 1L;
            ServiceRequestDto dto2 = new ServiceRequestDto();
            dto2.id = 2L;

            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of(sr1, sr2));
            when(serviceRequestMapper.toDto(sr1)).thenReturn(dto1);
            when(serviceRequestMapper.toDto(sr2)).thenReturn(dto2);

            // Act
            List<ServiceRequestDto> result = service.list();

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).id).isEqualTo(1L);
            assertThat(result.get(1).id).isEqualTo(2L);
        }

        @Test
        @DisplayName("returns empty list when no requests exist")
        void whenNoRequests_thenReturnsEmptyList() {
            // Arrange
            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of());

            // Act
            List<ServiceRequestDto> result = service.list();

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("list(pageable)")
    class ListPaged {

        @Test
        @DisplayName("returns paginated service requests")
        void whenCalled_thenReturnsPaginatedDtos() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            ServiceRequest sr1 = buildEntity(1L, "SR 1", RequestStatus.PENDING);
            Page<ServiceRequest> page = new PageImpl<>(List.of(sr1), pageable, 1);
            ServiceRequestDto dto1 = new ServiceRequestDto();
            dto1.id = 1L;

            when(serviceRequestRepository.findAll(pageable)).thenReturn(page);
            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of(sr1));
            when(serviceRequestMapper.toDto(sr1)).thenReturn(dto1);

            // Act
            Page<ServiceRequestDto> result = service.list(pageable);

            // Assert
            assertThat(result.getTotalElements()).isEqualTo(1);
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("search(pageable, userId, propertyId, status, serviceType)")
    class Search {

        @Test
        @DisplayName("filters by all criteria and returns paginated results")
        void whenCriteriaProvided_thenFiltersAndReturnsPaged() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            User user = buildUser(10L, UserRole.HOST, "kc-10");
            Property property = buildProperty(20L, user);

            ServiceRequest matching = buildEntity(1L, "Matching", RequestStatus.PENDING);
            matching.setUser(user);
            matching.setProperty(property);
            matching.setServiceType(ServiceType.CLEANING);

            ServiceRequest nonMatching = buildEntity(2L, "Other", RequestStatus.ASSIGNED);
            User otherUser = buildUser(99L, UserRole.HOST, "kc-99");
            nonMatching.setUser(otherUser);
            nonMatching.setProperty(property);

            ServiceRequestDto dto1 = new ServiceRequestDto();
            dto1.id = 1L;

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(matching, nonMatching));
            when(serviceRequestMapper.toDto(matching)).thenReturn(dto1);

            // Act
            Page<ServiceRequestDto> result = service.search(pageable, 10L, null, RequestStatus.PENDING, null);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id).isEqualTo(1L);
            assertThat(result.getTotalElements()).isEqualTo(1);
        }

        @Test
        @DisplayName("with null filters returns all results")
        void whenNullFilters_thenReturnsAll() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            ServiceRequest sr = buildEntity(1L, "SR1", RequestStatus.PENDING);
            sr.setUser(buildUser(1L, UserRole.HOST, "kc-1"));
            sr.setProperty(buildProperty(1L, sr.getUser()));
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;

            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of(sr));
            when(serviceRequestMapper.toDto(sr)).thenReturn(dto);

            // Act
            Page<ServiceRequestDto> result = service.search(pageable, null, null, null, null);

            // Assert
            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("delete(id)")
    class Delete {

        @Test
        @DisplayName("when exists - deletes by ID")
        void whenExists_thenDeletes() {
            // Arrange
            when(serviceRequestRepository.existsById(1L)).thenReturn(true);

            // Act
            service.delete(1L);

            // Assert
            verify(serviceRequestRepository).deleteById(1L);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            when(serviceRequestRepository.existsById(999L)).thenReturn(false);

            // Act & Assert
            assertThatThrownBy(() -> service.delete(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

}
