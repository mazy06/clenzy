package com.clenzy.service;

import com.clenzy.dto.RatePlanDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service des plans tarifaires par propriete.
 *
 * Logique deplacee de RatePlanController (audit T-ARCH-01 : controller
 * mince — acces donnees, transactions et validation d'org au niveau service).
 *
 * L'acces propriete est valide par la regle transverse unique
 * {@link ReservationService#validatePropertyAccess(Long, String)}
 * (org courante + super admin + platform staff + owner — pattern T-ARCH-08).
 */
@Service
public class RatePlanService {

    private final RatePlanRepository ratePlanRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationService reservationService;
    private final TenantContext tenantContext;

    public RatePlanService(RatePlanRepository ratePlanRepository,
                           PropertyRepository propertyRepository,
                           ReservationService reservationService,
                           TenantContext tenantContext) {
        this.ratePlanRepository = ratePlanRepository;
        this.propertyRepository = propertyRepository;
        this.reservationService = reservationService;
        this.tenantContext = tenantContext;
    }

    /** Plans tarifaires d'une propriete. */
    @Transactional(readOnly = true)
    public List<RatePlanDto> getByProperty(Long propertyId, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return ratePlanRepository.findAllByPropertyId(propertyId, orgId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /** Cree un plan tarifaire. */
    @Transactional
    public RatePlanDto create(RatePlanDto dto, String keycloakId) {
        reservationService.validatePropertyAccess(dto.propertyId(), keycloakId);
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

        return toDto(ratePlanRepository.save(plan));
    }

    /** Met a jour un plan tarifaire (patch partiel champ a champ). */
    @Transactional
    public RatePlanDto update(Long id, RatePlanDto dto, String keycloakId) {
        RatePlan existing = ratePlanRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Plan tarifaire non trouve: " + id));

        // findById contourne le filtre Hibernate : l'org de la propriete est
        // validee par la regle transverse (CLAUDE.md « Lecons », regle 3).
        reservationService.validatePropertyAccess(existing.getProperty().getId(), keycloakId);

        if (dto.name() != null) existing.setName(dto.name());
        if (dto.type() != null) existing.setType(RatePlanType.valueOf(dto.type()));
        if (dto.nightlyPrice() != null) existing.setNightlyPrice(BigDecimal.valueOf(dto.nightlyPrice()));
        if (dto.priority() != null) existing.setPriority(dto.priority());
        if (dto.startDate() != null) existing.setStartDate(LocalDate.parse(dto.startDate()));
        if (dto.endDate() != null) existing.setEndDate(LocalDate.parse(dto.endDate()));
        if (dto.daysOfWeek() != null) existing.setDaysOfWeek(dto.daysOfWeek());
        if (dto.minStayOverride() != null) existing.setMinStayOverride(dto.minStayOverride());
        if (dto.isActive() != null) existing.setIsActive(dto.isActive());

        return toDto(ratePlanRepository.save(existing));
    }

    /** Supprime un plan tarifaire apres validation d'org de la propriete porteuse. */
    @Transactional
    public void delete(Long id, String keycloakId) {
        RatePlan existing = ratePlanRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Plan tarifaire non trouve: " + id));

        reservationService.validatePropertyAccess(existing.getProperty().getId(), keycloakId);

        ratePlanRepository.delete(existing);
    }

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
}
