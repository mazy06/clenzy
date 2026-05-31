package com.clenzy.controller;

import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ChannelSyncHealthService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChannelSyncHealthControllerTest {

    @Mock private ChannelSyncHealthService syncHealthService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private ChannelSyncHealthController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ChannelSyncHealthController(
            syncHealthService, propertyRepository, userRepository, tenantContext);
        jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject("kc-user-1")
            .claim("sub", "kc-user-1")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
    }

    @Test
    void getHealth_emptyIds_returnsEmptyMap() {
        ResponseEntity<Map<Long, ChannelSyncHealthDto>> result = controller.getHealth(List.of(), jwt);

        assertTrue(result.getBody().isEmpty());
    }

    @Test
    void getHealth_nullIds_returnsEmptyMap() {
        ResponseEntity<Map<Long, ChannelSyncHealthDto>> result = controller.getHealth(null, jwt);

        assertTrue(result.getBody().isEmpty());
    }

    @Test
    void getHealth_validPropertiesAsSuperAdmin_returnsHealth() {
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(10L);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
        when(tenantContext.isSuperAdmin()).thenReturn(true);
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
        Map<Long, ChannelSyncHealthDto> health = Map.of(1L, new ChannelSyncHealthDto(1L, 2, 3));
        when(syncHealthService.getHealthByPropertyIds(List.of(1L))).thenReturn(health);

        ResponseEntity<Map<Long, ChannelSyncHealthDto>> result = controller.getHealth(List.of(1L), jwt);

        assertEquals(health, result.getBody());
    }

    @Test
    void getHealth_propertyNotFound_throwsNotFound() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
        when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> controller.getHealth(List.of(99L), jwt));
    }

    @Test
    void getHealth_propertyDifferentOrg_throwsAccessDenied() {
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(999L);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

        assertThrows(AccessDeniedException.class, () -> controller.getHealth(List.of(1L), jwt));
    }

    @Test
    void getHealth_platformStaff_passesValidation() {
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(10L);
        User user = new User();
        user.setId(2L);
        user.setRole(UserRole.SUPER_MANAGER);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
        when(userRepository.findByKeycloakId("kc-user-1")).thenReturn(Optional.of(user));
        when(syncHealthService.getHealthByPropertyIds(List.of(1L))).thenReturn(Map.of());

        ResponseEntity<Map<Long, ChannelSyncHealthDto>> result = controller.getHealth(List.of(1L), jwt);

        assertNotNull(result.getBody());
    }

    @Test
    void getHealth_owner_passesValidation() {
        User owner = new User();
        owner.setId(5L);
        owner.setRole(UserRole.HOST);
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(10L);
        property.setOwner(owner);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
        when(userRepository.findByKeycloakId("kc-user-1")).thenReturn(Optional.of(owner));
        when(syncHealthService.getHealthByPropertyIds(List.of(1L))).thenReturn(Map.of());

        ResponseEntity<Map<Long, ChannelSyncHealthDto>> result = controller.getHealth(List.of(1L), jwt);

        assertNotNull(result.getBody());
    }

    @Test
    void getHealth_notOwnerAndNotStaff_accessDenied() {
        User requester = new User();
        requester.setId(7L);
        requester.setRole(UserRole.HOST);
        User differentOwner = new User();
        differentOwner.setId(99L);
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(10L);
        property.setOwner(differentOwner);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
        when(userRepository.findByKeycloakId("kc-user-1")).thenReturn(Optional.of(requester));

        assertThrows(AccessDeniedException.class, () -> controller.getHealth(List.of(1L), jwt));
    }

    @Test
    void getHealth_userNotFound_accessDenied() {
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(10L);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(10L);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
        when(userRepository.findByKeycloakId("kc-user-1")).thenReturn(Optional.empty());

        assertThrows(AccessDeniedException.class, () -> controller.getHealth(List.of(1L), jwt));
    }
}
