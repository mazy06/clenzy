package com.clenzy.controller;

import com.clenzy.dto.RateOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rate-overrides")
@Tag(name = "Rate Overrides", description = "Prix specifiques par date (priorite maximale)")
@PreAuthorize("isAuthenticated()")
public class RateOverrideController {

    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public RateOverrideController(RateOverrideRepository rateOverrideRepository,
                                  PropertyRepository propertyRepository,
                                  UserRepository userRepository,
                                  TenantContext tenantContext) {
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Overrides de prix pour une propriete et une periode")
    public ResponseEntity<List<RateOverrideDto>> getByPropertyAndRange(
            @RequestParam Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<RateOverrideDto> result = rateOverrideRepository
                .findByPropertyIdAndDateRange(propertyId, from, to, orgId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Operation(summary = "Creer un override de prix")
    public ResponseEntity<RateOverrideDto> create(
            @RequestBody RateOverrideDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(dto.propertyId(), jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));

        RateOverride override = new RateOverride(
                property, LocalDate.parse(dto.date()),
                BigDecimal.valueOf(dto.nightlyPrice()),
                dto.source() != null ? dto.source() : "MANUAL", orgId);
        override.setCreatedBy(jwt.getSubject());

        RateOverride saved = rateOverrideRepository.save(override);
        return ResponseEntity.ok(toDto(saved));
    }

    @PostMapping("/bulk")
    @Operation(summary = "Creer des overrides en lot sur une plage de dates")
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
        BigDecimal price = new BigDecimal(body.get("nightlyPrice").toString());
        String source = body.containsKey("source") ? body.get("source").toString() : "MANUAL";

        List<RateOverride> created = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            RateOverride override = new RateOverride(property, date, price, source, orgId);
            override.setCreatedBy(jwt.getSubject());
            created.add(rateOverrideRepository.save(override));
        }

        return ResponseEntity.ok(Map.of(
                "propertyId", propertyId,
                "from", from.toString(),
                "to", to.toString(),
                "nightlyPrice", price.doubleValue(),
                "count", created.size()
        ));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un override de prix")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        RateOverride existing = rateOverrideRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Override non trouve: " + id));

        validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        rateOverrideRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    // ── Mapper ──────────────────────────────────────────────────────────────

    private RateOverrideDto toDto(RateOverride entity) {
        return new RateOverrideDto(
            entity.getId(),
            entity.getProperty() != null ? entity.getProperty().getId() : null,
            entity.getDate() != null ? entity.getDate().toString() : null,
            entity.getNightlyPrice() != null ? entity.getNightlyPrice().doubleValue() : null,
            entity.getSource()
        );
    }

    // ── Ownership validation ────────────────────────────────────────────────

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

        // Comparaison par ID (PK) pour eviter LazyInitializationException sur le proxy User
        if (user != null && property.getOwner() != null
                && property.getOwner().getId().equals(user.getId())) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
