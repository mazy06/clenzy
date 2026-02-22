package com.clenzy.controller;

import com.clenzy.dto.RatePlanDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rate-plans")
@Tag(name = "Rate Plans", description = "Gestion des plans tarifaires par propriete")
@PreAuthorize("isAuthenticated()")
public class RatePlanController {

    private final RatePlanRepository ratePlanRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public RatePlanController(RatePlanRepository ratePlanRepository,
                              PropertyRepository propertyRepository,
                              UserRepository userRepository,
                              TenantContext tenantContext) {
        this.ratePlanRepository = ratePlanRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Plans tarifaires d'une propriete")
    public ResponseEntity<List<RatePlanDto>> getByProperty(
            @RequestParam Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(propertyId, jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<RatePlanDto> result = ratePlanRepository.findAllByPropertyId(propertyId, orgId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Operation(summary = "Creer un plan tarifaire")
    public ResponseEntity<RatePlanDto> create(
            @RequestBody RatePlanDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        validatePropertyAccess(dto.propertyId(), jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));

        RatePlan plan = new RatePlan(property, dto.name(),
                RatePlanType.valueOf(dto.type()), BigDecimal.valueOf(dto.nightlyPrice()), orgId);
        plan.setPriority(dto.priority() != null ? dto.priority() : 0);
        plan.setCurrency(dto.currency() != null ? dto.currency() : "EUR");
        if (dto.startDate() != null) plan.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) plan.setEndDate(LocalDate.parse(dto.endDate()));
        if (dto.daysOfWeek() != null) plan.setDaysOfWeek(dto.daysOfWeek());
        if (dto.minStayOverride() != null) plan.setMinStayOverride(dto.minStayOverride());
        plan.setIsActive(dto.isActive() != null ? dto.isActive() : true);

        RatePlan saved = ratePlanRepository.save(plan);
        return ResponseEntity.ok(toDto(saved));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifier un plan tarifaire")
    public ResponseEntity<RatePlanDto> update(
            @PathVariable Long id,
            @RequestBody RatePlanDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        RatePlan existing = ratePlanRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Plan tarifaire non trouve: " + id));

        validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        if (dto.name() != null) existing.setName(dto.name());
        if (dto.type() != null) existing.setType(RatePlanType.valueOf(dto.type()));
        if (dto.nightlyPrice() != null) existing.setNightlyPrice(BigDecimal.valueOf(dto.nightlyPrice()));
        if (dto.priority() != null) existing.setPriority(dto.priority());
        if (dto.startDate() != null) existing.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) existing.setEndDate(LocalDate.parse(dto.endDate()));
        if (dto.daysOfWeek() != null) existing.setDaysOfWeek(dto.daysOfWeek());
        if (dto.minStayOverride() != null) existing.setMinStayOverride(dto.minStayOverride());
        if (dto.isActive() != null) existing.setIsActive(dto.isActive());

        RatePlan saved = ratePlanRepository.save(existing);
        return ResponseEntity.ok(toDto(saved));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un plan tarifaire")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        RatePlan existing = ratePlanRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Plan tarifaire non trouve: " + id));

        validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        ratePlanRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    // ── Mapper ──────────────────────────────────────────────────────────────

    private RatePlanDto toDto(RatePlan entity) {
        return new RatePlanDto(
            entity.getId(),
            entity.getProperty() != null ? entity.getProperty().getId() : null,
            entity.getName(),
            entity.getType() != null ? entity.getType().name() : null,
            entity.getPriority(),
            entity.getNightlyPrice() != null ? entity.getNightlyPrice().doubleValue() : null,
            entity.getCurrency(),
            entity.getStartDate() != null ? entity.getStartDate().toString() : null,
            entity.getEndDate() != null ? entity.getEndDate().toString() : null,
            entity.getDaysOfWeek(),
            entity.getMinStayOverride(),
            entity.getIsActive()
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

        if (property.getOwner() != null && property.getOwner().getKeycloakId() != null
                && property.getOwner().getKeycloakId().equals(keycloakId)) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
