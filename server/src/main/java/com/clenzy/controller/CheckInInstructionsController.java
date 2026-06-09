package com.clenzy.controller;

import com.clenzy.dto.CheckInInstructionsDto;
import com.clenzy.dto.UpdateCheckInInstructionsDto;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.access.AccessCodeResolverService;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

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
    private final ReservationRepository reservationRepository;
    private final AccessCodeResolverService accessCodeResolverService;

    public CheckInInstructionsController(
            CheckInInstructionsRepository instructionsRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            PhotoStorageService photoStorageService,
            TenantContext tenantContext,
            ReservationRepository reservationRepository,
            AccessCodeResolverService accessCodeResolverService
    ) {
        this.instructionsRepository = instructionsRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.photoStorageService = photoStorageService;
        this.tenantContext = tenantContext;
        this.reservationRepository = reservationRepository;
        this.accessCodeResolverService = accessCodeResolverService;
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

    /**
     * Code d'accès courant généré par la serrure connectée du logement (séjour en cours/à venir),
     * pour pré-remplir le champ code. {@code hasSmartLock=false} si aucune serrure → boîte à clé.
     */
    @GetMapping("/smart-lock-code")
    public ResponseEntity<Map<String, Object>> getSmartLockCode(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        boolean hasSmartLock = accessCodeResolverService.hasActiveSmartLock(propertyId);
        String code = "";
        if (hasSmartLock) {
            Reservation reservation = reservationRepository
                .findCurrentOrNextByPropertyId(propertyId, LocalDate.now(), orgId)
                .stream().findFirst().orElse(null);
            if (reservation != null) {
                code = accessCodeResolverService.existingAccessCode(reservation.getId()).orElse("");
            }
        }
        return ResponseEntity.ok(Map.of("hasSmartLock", hasSmartLock, "code", code));
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

        // Code change manuellement → repere de rotation rafraichi, sinon le scheduler
        // ecraserait dans l'heure le code que l'hote vient de poser (depart recent).
        boolean accessCodeChanged = !java.util.Objects.equals(instructions.getAccessCode(), dto.accessCode());
        if (accessCodeChanged) {
            instructions.setAccessCodeRotatedAt(LocalDateTime.now());
        }

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
        // extra_access_codes est NOT NULL : idem.
        if (dto.extraAccessCodes() != null) {
            instructions.setExtraAccessCodes(dto.extraAccessCodes());
        }
        instructions.setGuestUnlockEnabled(dto.guestUnlockEnabled());

        // Rotation auto du code d'accès : opt-in + format de génération (pour régénérer à l'identique).
        boolean wasAutoRotate = instructions.isAccessCodeAutoRotate();
        instructions.setAccessCodeAutoRotate(dto.accessCodeAutoRotate());
        if (dto.accessCodeFormat() != null) {
            instructions.setAccessCodeFormat(dto.accessCodeFormat());
        }
        // À l'activation, on pose un repère de rotation (now) pour ne pas régénérer
        // immédiatement à cause d'un départ déjà passé.
        if (dto.accessCodeAutoRotate() && !wasAutoRotate) {
            instructions.setAccessCodeRotatedAt(LocalDateTime.now());
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
