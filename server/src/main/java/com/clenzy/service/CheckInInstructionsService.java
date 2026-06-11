package com.clenzy.service;

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
import com.clenzy.service.access.AccessCodeResolverService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Instructions de check-in/check-out par propriete : consultation, upsert et
 * photos d'indication d'acces. Extrait de CheckInInstructionsController
 * (audit T-ARCH-01, regle 4 « Lecons de l'audit 2026-06 »).
 *
 * <p>Chaque operation valide d'abord l'acces a la propriete (org + ownership) :
 * les chargements par ID reposent sur findById, qui ne passe PAS par le filtre
 * Hibernate organizationFilter (regle 3).</p>
 */
@Service
public class CheckInInstructionsService {

    private static final long MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_IMAGE_TYPES =
        Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final CheckInInstructionsRepository instructionsRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;
    private final AccessCodeResolverService accessCodeResolverService;
    private final PhotoStorageService photoStorageService;
    private final TenantContext tenantContext;

    public CheckInInstructionsService(
            CheckInInstructionsRepository instructionsRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            ReservationRepository reservationRepository,
            AccessCodeResolverService accessCodeResolverService,
            PhotoStorageService photoStorageService,
            TenantContext tenantContext
    ) {
        this.instructionsRepository = instructionsRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.reservationRepository = reservationRepository;
        this.accessCodeResolverService = accessCodeResolverService;
        this.photoStorageService = photoStorageService;
        this.tenantContext = tenantContext;
    }

    /** Statut serrure connectee + code courant pour pre-remplir le formulaire. */
    public record SmartLockCodeStatus(boolean hasSmartLock, String code) {}

    /** Instructions de la propriete, vide si aucune n'est enregistree. */
    @Transactional(readOnly = true)
    public Optional<CheckInInstructionsDto> getInstructions(Long propertyId, String keycloakId) {
        validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return instructionsRepository.findByPropertyIdAndOrganizationId(propertyId, orgId)
            .map(CheckInInstructionsDto::fromEntity);
    }

    /**
     * Code d'acces courant genere par la serrure connectee du logement (sejour
     * en cours/a venir). {@code hasSmartLock=false} si aucune serrure → boite a cle.
     */
    @Transactional(readOnly = true)
    public SmartLockCodeStatus getSmartLockCode(Long propertyId, String keycloakId) {
        validatePropertyAccess(propertyId, keycloakId);
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
        return new SmartLockCodeStatus(hasSmartLock, code);
    }

    /** Upsert des instructions : trouve l'existant ou cree un nouveau. */
    @Transactional
    public CheckInInstructionsDto update(Long propertyId, UpdateCheckInInstructionsDto dto, String keycloakId) {
        validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();
        Property property = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + propertyId));

        // Upsert : trouve l'existant ou cree un nouveau
        CheckInInstructions instructions = instructionsRepository
            .findByPropertyIdAndOrganizationId(propertyId, orgId)
            .orElseGet(() -> new CheckInInstructions(property, orgId));

        // Code change manuellement → repere de rotation rafraichi, sinon le scheduler
        // ecraserait dans l'heure le code que l'hote vient de poser (depart recent).
        boolean accessCodeChanged = !Objects.equals(instructions.getAccessCode(), dto.accessCode());
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

        // Rotation auto du code d'acces : opt-in + format de generation (pour regenerer a l'identique).
        boolean wasAutoRotate = instructions.isAccessCodeAutoRotate();
        instructions.setAccessCodeAutoRotate(dto.accessCodeAutoRotate());
        if (dto.accessCodeFormat() != null) {
            instructions.setAccessCodeFormat(dto.accessCodeFormat());
        }
        // A l'activation, on pose un repere de rotation (now) pour ne pas regenerer
        // immediatement a cause d'un depart deja passe.
        if (dto.accessCodeAutoRotate() && !wasAutoRotate) {
            instructions.setAccessCodeRotatedAt(LocalDateTime.now());
        }

        CheckInInstructions saved = instructionsRepository.save(instructions);
        return CheckInInstructionsDto.fromEntity(saved);
    }

    /**
     * Stocke une photo d'indication d'acces et renvoie la cle de stockage ;
     * le front l'ajoute au JSON {@code arrivalPhotos} puis PUT.
     */
    public String uploadAccessPhoto(Long propertyId, String keycloakId, MultipartFile file) {
        validatePropertyAccess(propertyId, keycloakId);
        validateImage(file);
        try {
            return photoStorageService.store(
                file.getBytes(), file.getContentType(), file.getOriginalFilename());
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture du fichier impossible", e);
        }
    }

    /**
     * Photo d'indication d'acces cote admin (apercu dans le formulaire), vide si
     * la cle n'appartient pas aux arrivalPhotos enregistrees de la propriete.
     */
    @Transactional(readOnly = true)
    public Optional<byte[]> findAccessPhoto(Long propertyId, String keycloakId, String key) {
        validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();
        boolean owned = instructionsRepository.findByPropertyIdAndOrganizationId(propertyId, orgId)
            .map(ci -> ci.getArrivalPhotos() != null && ci.getArrivalPhotos().contains("\"" + key + "\""))
            .orElse(false);
        if (!owned) {
            return Optional.empty();
        }
        return Optional.of(photoStorageService.retrieve(key));
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
