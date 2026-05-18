package com.clenzy.controller;

import com.clenzy.dto.MinNightsOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.MinNightsOverride;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/min-nights-overrides")
@Tag(name = "Min Nights Overrides",
     description = "Surcharge du minimum de nuits par date (priorite sur le defaut propriete)")
@PreAuthorize("isAuthenticated()")
public class MinNightsOverrideController {

    private final MinNightsOverrideRepository overrideRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public MinNightsOverrideController(MinNightsOverrideRepository overrideRepository,
                                       PropertyRepository propertyRepository,
                                       UserRepository userRepository,
                                       TenantContext tenantContext) {
        this.overrideRepository = overrideRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Overrides de min-nights pour une propriete et une periode")
    public ResponseEntity<List<MinNightsOverrideDto>> getByPropertyAndRange(
            @RequestParam Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<MinNightsOverrideDto> result = overrideRepository
                .findByPropertyIdAndDateRange(propertyId, from, to, orgId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Operation(summary = "Creer un override de min-nights")
    public ResponseEntity<MinNightsOverrideDto> create(
            @RequestBody MinNightsOverrideDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(dto.propertyId(), jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));

        validateMinNights(dto.minNights());

        MinNightsOverride override = new MinNightsOverride(
                property, LocalDate.parse(dto.date()), dto.minNights(),
                dto.source() != null ? dto.source() : "MANUAL", orgId);
        override.setCreatedBy(jwt.getSubject());

        MinNightsOverride saved = overrideRepository.save(override);
        return ResponseEntity.ok(toDto(saved));
    }

    @PostMapping("/bulk")
    @Operation(summary = "Creer des overrides en lot sur une plage de dates (upsert)")
    public ResponseEntity<Map<String, Object>> createBulk(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        Long propertyId = Long.valueOf(body.get("propertyId").toString());
        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

        LocalDate from = LocalDate.parse(body.get("from").toString());
        LocalDate to = LocalDate.parse(body.get("to").toString());
        Integer minNights = Integer.valueOf(body.get("minNights").toString());
        String source = body.containsKey("source") ? body.get("source").toString() : "MANUAL";

        validateMinNights(minNights);

        List<MinNightsOverride> created = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            // Upsert : si une ligne existe deja sur (property, date), on l'update.
            // Evite l'erreur de contrainte unique et permet de "repeindre" une plage.
            final LocalDate currentDate = date;
            MinNightsOverride override = overrideRepository
                    .findByPropertyIdAndDate(propertyId, currentDate, orgId)
                    .orElseGet(() -> new MinNightsOverride(property, currentDate, minNights, source, orgId));
            override.setMinNights(minNights);
            override.setSource(source);
            if (override.getId() == null) {
                override.setCreatedBy(jwt.getSubject());
            }
            created.add(overrideRepository.save(override));
        }

        return ResponseEntity.ok(Map.of(
                "propertyId", propertyId,
                "from", from.toString(),
                "to", to.toString(),
                "minNights", minNights,
                "count", created.size()
        ));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un override de min-nights")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        MinNightsOverride existing = overrideRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Override non trouve: " + id));

        validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        overrideRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void validateMinNights(Integer minNights) {
        if (minNights == null || minNights < 1 || minNights > 365) {
            throw new IllegalArgumentException(
                    "minNights doit etre compris entre 1 et 365 (valeur recue: " + minNights + ")");
        }
    }

    private MinNightsOverrideDto toDto(MinNightsOverride entity) {
        return new MinNightsOverrideDto(
            entity.getId(),
            entity.getProperty() != null ? entity.getProperty().getId() : null,
            entity.getDate() != null ? entity.getDate().toString() : null,
            entity.getMinNights(),
            entity.getSource()
        );
    }

    private void validatePropertyAccess(Long propertyId, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

        if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Acces refuse : propriete hors de votre organisation");
        }
        if (tenantContext.isSuperAdmin()) return;

        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user != null && user.getRole() != null && user.getRole().isPlatformStaff()) return;

        if (user != null && property.getOwner() != null
                && property.getOwner().getId().equals(user.getId())) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
