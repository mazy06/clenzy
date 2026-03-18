package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Intervention optimistic locking (@Version)")
class InterventionOptimisticLockingTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private InterventionMapper interventionMapper;
    @Mock private InterventionAccessPolicy accessPolicy;
    @Mock private NotificationService notificationService;
    @Mock private OutboxPublisher outboxPublisher;
    @Mock private ObjectMapper objectMapper;
    @Mock private TenantContext tenantContext;

    private InterventionLifecycleService service;

    @BeforeEach
    void setUp() {
        service = new InterventionLifecycleService(
                interventionRepository, interventionMapper, accessPolicy,
                notificationService, outboxPublisher, objectMapper, tenantContext);
    }

    private Jwt mockJwtWithRole(String role) {
        Jwt jwt = mock(Jwt.class);
        lenient().when(jwt.getClaim("realm_access")).thenReturn(Map.of("roles", List.of(role)));
        lenient().when(jwt.getSubject()).thenReturn("test-kc");
        return jwt;
    }

    private Intervention buildIntervention(Long id, InterventionStatus status) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setOrganizationId(1L);
        intervention.setTitle("Test Intervention");
        intervention.setStatus(status);
        intervention.setVersion(1L);

        User owner = new User();
        owner.setId(10L);
        owner.setKeycloakId("owner-kc");
        owner.setEmail("owner@example.com");

        Property property = new Property();
        property.setId(100L);
        property.setName("Test Property");
        property.setOwner(owner);

        intervention.setProperty(property);
        intervention.setRequestor(owner);
        return intervention;
    }

    @Test
    @DisplayName("concurrent save throws ObjectOptimisticLockingFailureException")
    void whenConcurrentSave_thenThrowsOptimisticLockingException() {
        Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
        Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);

        when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
        when(interventionRepository.save(any(Intervention.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException(Intervention.class.getName(), 1L));

        assertThatThrownBy(() -> service.completeIntervention(1L, jwt))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }

    @Test
    @DisplayName("completeIntervention propagates optimistic locking exception from save")
    void whenCompleteWithStaleVersion_thenPropagatesException() {
        Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
        Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);

        when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
        when(interventionRepository.save(any(Intervention.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException(
                        "Row was updated or deleted by another transaction", null));

        assertThatThrownBy(() -> service.completeIntervention(1L, jwt))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class)
                .hasMessageContaining("Row was updated or deleted");

        verify(interventionRepository).save(any(Intervention.class));
        verify(outboxPublisher, never()).publish(anyString(), anyString(), anyString(),
                anyString(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("startIntervention propagates optimistic locking exception from save")
    void whenStartWithStaleVersion_thenPropagatesException() {
        Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
        Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);

        when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
        when(interventionRepository.save(any(Intervention.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException(Intervention.class.getName(), 1L));

        assertThatThrownBy(() -> service.startIntervention(1L, jwt))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }
}
