package com.clenzy.controller;

import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.dto.UpdateCheckInInstructionsDto;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CheckInInstructionsControllerTest {

    @Mock private CheckInInstructionsRepository instructionsRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;

    private TenantContext tenantContext;
    private CheckInInstructionsController controller;
    private Jwt ownerJwt;
    private Property property;
    private User owner;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(1L);
        controller = new CheckInInstructionsController(
            instructionsRepository, propertyRepository, userRepository, tenantContext);

        owner = new User();
        owner.setKeycloakId("owner-kc-id");

        property = new Property();
        property.setId(10L);
        property.setOrganizationId(1L);
        property.setOwner(owner);

        ownerJwt = Jwt.withTokenValue("mock-token")
            .header("alg", "RS256")
            .subject("owner-kc-id")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
    }

    @Test
    void whenGet_existingInstructions_thenReturnsOk() {
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

        CheckInInstructions instructions = new CheckInInstructions(property, 1L);
        instructions.setId(1L);
        instructions.setAccessCode("1234");
        instructions.setWifiName("MyWifi");

        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(instructions));

        var response = controller.get(10L, ownerJwt);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("1234", response.getBody().accessCode());
        assertEquals("MyWifi", response.getBody().wifiName());
    }

    @Test
    void whenGet_noInstructions_thenReturnsNotFound() {
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.empty());

        var response = controller.get(10L, ownerJwt);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void whenGet_propertyNotFound_thenThrows() {
        when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () ->
            controller.get(999L, ownerJwt));
    }

    @Test
    void whenGet_differentOrg_thenAccessDenied() {
        property.setOrganizationId(99L);
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

        assertThrows(AccessDeniedException.class, () ->
            controller.get(10L, ownerJwt));
    }

    @Test
    void whenGet_notOwner_thenAccessDenied() {
        Jwt otherJwt = Jwt.withTokenValue("mock-token")
            .header("alg", "RS256")
            .subject("other-kc-id")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();

        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(userRepository.findByKeycloakId("other-kc-id")).thenReturn(Optional.empty());

        assertThrows(AccessDeniedException.class, () ->
            controller.get(10L, otherJwt));
    }

    @Test
    void whenUpdate_existingInstructions_thenUpdatesAndReturns() {
        // validatePropertyAccess needs findById
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        // update body also calls findById
        CheckInInstructions existing = new CheckInInstructions(property, 1L);
        existing.setId(1L);

        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(existing));
        when(instructionsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var dto = new UpdateCheckInInstructionsDto(
            "5678", "NewWifi", "pass", "Parking A",
            "Entrez par la porte", "Laissez les cles", "Pas de bruit",
            "+33612345678", "Notes");

        var response = controller.update(10L, dto, ownerJwt);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("5678", response.getBody().accessCode());
        verify(instructionsRepository).save(existing);
    }

    @Test
    void whenUpdate_newInstructions_thenCreatesAndReturns() {
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.empty());
        when(instructionsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var dto = new UpdateCheckInInstructionsDto(
            "9999", null, null, null, null, null, null, null, null);

        var response = controller.update(10L, dto, ownerJwt);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("9999", response.getBody().accessCode());
    }
}
