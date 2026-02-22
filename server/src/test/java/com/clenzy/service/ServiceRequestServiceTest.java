package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiceRequestServiceTest {

    @Mock
    private ServiceRequestRepository serviceRequestRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private InterventionRepository interventionRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private PropertyTeamService propertyTeamService;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private ServiceRequestMapper serviceRequestMapper;

    private TenantContext tenantContext;
    private ServiceRequestService serviceRequestService;

    private User testUser;
    private Property testProperty;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(1L);

        serviceRequestService = new ServiceRequestService(
                serviceRequestRepository,
                userRepository,
                propertyRepository,
                interventionRepository,
                teamRepository,
                notificationService,
                propertyTeamService,
                kafkaTemplate,
                tenantContext,
                serviceRequestMapper
        );

        testUser = new User();
        testUser.setId(10L);
        testUser.setFirstName("Jean");
        testUser.setKeycloakId("kc-user-10");

        testProperty = new Property();
        testProperty.setId(20L);
        testProperty.setName("Appartement Paris");
    }

    @Test
    void whenCreate_thenSavesAndNotifies() {
        // Arrange
        ServiceRequestDto dto = new ServiceRequestDto();
        dto.title = "Reparation fuite";
        dto.userId = 10L;
        dto.propertyId = 20L;
        dto.status = RequestStatus.PENDING;

        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(invocation -> {
            ServiceRequest sr = invocation.getArgument(0);
            sr.setId(1L);
            sr.setTitle("Reparation fuite");
            return sr;
        });

        ServiceRequestDto resultDto = new ServiceRequestDto();
        resultDto.id = 1L;
        resultDto.title = "Reparation fuite";
        when(serviceRequestMapper.toDto(any(ServiceRequest.class))).thenReturn(resultDto);

        // Act
        ServiceRequestDto result = serviceRequestService.create(dto);

        // Assert
        assertNotNull(result);
        assertEquals(1L, result.id);
        assertEquals("Reparation fuite", result.title);

        verify(serviceRequestMapper).apply(eq(dto), any(ServiceRequest.class));
        verify(serviceRequestRepository).save(any(ServiceRequest.class));
        verify(notificationService).notifyAdminsAndManagers(
                eq(NotificationKey.SERVICE_REQUEST_CREATED),
                anyString(),
                contains("Reparation fuite"),
                contains("/service-requests/1")
        );
    }

    @Test
    void whenUpdateToRejected_thenNotifiesRequester() {
        // Arrange
        ServiceRequest existing = new ServiceRequest();
        existing.setId(1L);
        existing.setTitle("Menage urgent");
        existing.setUser(testUser);
        existing.setProperty(testProperty);
        existing.setStatus(RequestStatus.PENDING);

        when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(invocation -> {
            ServiceRequest sr = invocation.getArgument(0);
            return sr;
        });

        ServiceRequestDto resultDto = new ServiceRequestDto();
        resultDto.id = 1L;
        resultDto.title = "Menage urgent";
        when(serviceRequestMapper.toDto(any(ServiceRequest.class))).thenReturn(resultDto);

        ServiceRequestDto dto = new ServiceRequestDto();
        dto.title = "Menage urgent";
        dto.status = RequestStatus.REJECTED;

        // Mock apply to actually set the status on the entity (needed for notification check)
        doAnswer(invocation -> {
            ServiceRequest entity = invocation.getArgument(1);
            ServiceRequestDto d = invocation.getArgument(0);
            if (d.status != null) entity.setStatus(d.status);
            return null;
        }).when(serviceRequestMapper).apply(any(ServiceRequestDto.class), any(ServiceRequest.class));

        // Act
        ServiceRequestDto result = serviceRequestService.update(1L, dto);

        // Assert
        assertNotNull(result);
        verify(notificationService).notify(
                eq("kc-user-10"),
                eq(NotificationKey.SERVICE_REQUEST_REJECTED),
                anyString(),
                contains("Menage urgent"),
                contains("/service-requests/1")
        );
    }

    @Test
    void whenGetByIdExists_thenReturnsDto() {
        // Arrange
        ServiceRequest entity = new ServiceRequest();
        entity.setId(1L);
        entity.setTitle("Remplacement serrure");
        entity.setStatus(RequestStatus.PENDING);
        entity.setUser(testUser);
        entity.setProperty(testProperty);

        when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(entity));

        ServiceRequestDto resultDto = new ServiceRequestDto();
        resultDto.id = 1L;
        resultDto.title = "Remplacement serrure";
        when(serviceRequestMapper.toDto(entity)).thenReturn(resultDto);

        // Act
        ServiceRequestDto result = serviceRequestService.getById(1L);

        // Assert
        assertNotNull(result);
        assertEquals(1L, result.id);
        assertEquals("Remplacement serrure", result.title);
    }

    @Test
    void whenGetByIdNotFound_thenThrowsNotFoundException() {
        // Arrange
        when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(NotFoundException.class, () -> serviceRequestService.getById(999L));
    }

    @Test
    void whenDelete_thenRemovesEntity() {
        // Arrange
        when(serviceRequestRepository.existsById(1L)).thenReturn(true);

        // Act
        serviceRequestService.delete(1L);

        // Assert
        verify(serviceRequestRepository).deleteById(1L);
    }
}
