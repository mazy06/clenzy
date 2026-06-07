package com.clenzy.controller;

import com.clenzy.dto.CheckInInstructionsDto;
import com.clenzy.dto.UpdateCheckInInstructionsDto;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.tenant.TenantContext;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.Set;

/**
 * Gestion des instructions check-in/check-out par propriete.
 * Backend pour le formulaire CheckInInstructionsForm.tsx.
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/check-in-instructions")
@PreAuthorize("isAuthenticated()")
public class CheckInInstructionsController {

    private static final long MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_IMAGE_TYPES =
        Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final CheckInInstructionsRepository instructionsRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final PhotoStorageService photoStorageService;
    private final TenantContext tenantContext;

    public CheckInInstructionsController(
            CheckInInstructionsRepository instructionsRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            PhotoStorageService photoStorageService,
            TenantContext tenantContext
    ) {
        this.instructionsRepository = instructionsRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.photoStorageService = photoStorageService;
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
    @CacheEvict(value = "properties", allEntries = true)
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
        // arrival_photos est NOT NULL : ne l'ecraser que si le client l'envoie.
        if (dto.arrivalPhotos() != null) {
            instructions.setArrivalPhotos(dto.arrivalPhotos());
        }

        CheckInInstructions saved = instructionsRepository.save(instructions);
        return ResponseEntity.ok(CheckInInstructionsDto.fromEntity(saved));
    }

    /**
     * Upload d'une photo d'indication d'acces. Stocke le binaire via {@link PhotoStorageService}
     * et renvoie la cle de stockage ; le front l'ajoute au JSON {@code arrivalPhotos} puis PUT.
     * Le binaire est servi a la page guest via {@code GET /api/public/guide/{token}/access-photos/{key}}.
     */
    @PostMapping(value = "/access-photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadAccessPhoto(
            @PathVariable Long propertyId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt
    ) {
        validatePropertyAccess(propertyId, jwt.getSubject());
        validateImage(file);
        try {
            String key = photoStorageService.store(
                file.getBytes(), file.getContentType(), file.getOriginalFilename());
            return ResponseEntity.ok(Map.of("key", key));
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture du fichier impossible", e);
        }
    }

    /**
     * Sert une photo d'indication d'acces cote admin (apercu dans le formulaire). Auth + acces
     * propriete + verification que la cle appartient bien aux arrivalPhotos enregistrees.
     */
    @GetMapping("/access-photos")
    public ResponseEntity<byte[]> getAccessPhoto(
            @PathVariable Long propertyId,
            @RequestParam("key") String key,
            @AuthenticationPrincipal Jwt jwt
    ) {
        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();
        boolean owned = instructionsRepository.findByPropertyIdAndOrganizationId(propertyId, orgId)
            .map(ci -> ci.getArrivalPhotos() != null && ci.getArrivalPhotos().contains("\"" + key + "\""))
            .orElse(false);
        if (!owned) {
            return ResponseEntity.notFound().build();
        }
        byte[] data = photoStorageService.retrieve(key);
        return ResponseEntity.ok().contentType(sniffImageType(data)).body(data);
    }

    private static MediaType sniffImageType(byte[] d) {
        if (d.length >= 2 && (d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8) return MediaType.IMAGE_JPEG;
        if (d.length >= 4 && (d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') return MediaType.IMAGE_PNG;
        if (d.length >= 3 && d[0] == 'G' && d[1] == 'I' && d[2] == 'F') return MediaType.IMAGE_GIF;
        if (d.length >= 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }

    private static void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier manquant");
        }
        if (file.getSize() > MAX_PHOTO_BYTES) {
            throw new IllegalArgumentException("Image trop volumineuse (max 5 Mo)");
        }
        String type = file.getContentType();
        if (type == null || !ALLOWED_IMAGE_TYPES.contains(type.toLowerCase())) {
            throw new IllegalArgumentException("Format non supporté (jpeg, png, webp, gif)");
        }
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

        // Comparaison par ID (PK) pour eviter LazyInitializationException sur le proxy User
        if (user != null && property.getOwner() != null
                && property.getOwner().getId().equals(user.getId())) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
