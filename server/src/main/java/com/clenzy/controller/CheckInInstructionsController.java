package com.clenzy.controller;

import com.clenzy.dto.CheckInInstructionsDto;
import com.clenzy.dto.UpdateCheckInInstructionsDto;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Gestion des instructions check-in/check-out par propriete.
 * Backend pour le formulaire CheckInInstructionsForm.tsx.
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/check-in-instructions")
@PreAuthorize("isAuthenticated()")
public class CheckInInstructionsController {

    private final CheckInInstructionsRepository instructionsRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public CheckInInstructionsController(
            CheckInInstructionsRepository instructionsRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            TenantContext tenantContext
    ) {
        this.instructionsRepository = instructionsRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<CheckInInstructionsDto> get(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        return instructionsRepository.findByPropertyIdAndOrganizationId(propertyId, orgId)
            .map(CheckInInstructionsDto::fromEntity)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    public ResponseEntity<CheckInInstructionsDto> update(
            @PathVariable Long propertyId,
            @RequestBody UpdateCheckInInstructionsDto dto,
            @AuthenticationPrincipal Jwt jwt
    ) {
        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();
        Property property = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + propertyId));

        // Upsert : trouve l'existant ou cree un nouveau
        CheckInInstructions instructions = instructionsRepository
            .findByPropertyIdAndOrganizationId(propertyId, orgId)
            .orElseGet(() -> new CheckInInstructions(property, orgId));

        instructions.setAccessCode(dto.accessCode());
        instructions.setWifiName(dto.wifiName());
        instructions.setWifiPassword(dto.wifiPassword());
        instructions.setParkingInfo(dto.parkingInfo());
        instructions.setArrivalInstructions(dto.arrivalInstructions());
        instructions.setDepartureInstructions(dto.departureInstructions());
        instructions.setHouseRules(dto.houseRules());
        instructions.setEmergencyContact(dto.emergencyContact());
        instructions.setAdditionalNotes(dto.additionalNotes());

        CheckInInstructions saved = instructionsRepository.save(instructions);
        return ResponseEntity.ok(CheckInInstructionsDto.fromEntity(saved));
    }

    private void validatePropertyAccess(Long propertyId, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Property property = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + propertyId));

        if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Acces refuse : propriete hors de votre organisation");
        }
        if (tenantContext.isSuperAdmin()) return;

        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user != null && user.getRole() != null && user.getRole().isPlatformStaff()) return;

        if (property.getOwner() != null && property.getOwner().getKeycloakId() != null
                && property.getOwner().getKeycloakId().equals(keycloakId)) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
