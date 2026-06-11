package com.clenzy.service;

import com.clenzy.dto.MinNightsOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.MinNightsOverride;
import com.clenzy.model.Property;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service des overrides de minimum de nuits par date.
 *
 * Logique deplacee de MinNightsOverrideController (audit T-ARCH-01 :
 * controller mince — acces donnees, transactions et validation d'org
 * au niveau service).
 *
 * L'acces propriete est valide par la regle transverse unique
 * {@link ReservationService#validatePropertyAccess(Long, String)}
 * (org courante + super admin + platform staff + owner — pattern T-ARCH-08).
 */
@Service
public class MinNightsOverrideService {

    private final MinNightsOverrideRepository overrideRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationService reservationService;
    private final TenantContext tenantContext;

    public MinNightsOverrideService(MinNightsOverrideRepository overrideRepository,
                                    PropertyRepository propertyRepository,
                                    ReservationService reservationService,
                                    TenantContext tenantContext) {
        this.overrideRepository = overrideRepository;
        this.propertyRepository = propertyRepository;
        this.reservationService = reservationService;
        this.tenantContext = tenantContext;
    }

    /** Overrides d'une propriete sur la plage [from, to]. */
    @Transactional(readOnly = true)
    public List<MinNightsOverrideDto> getByPropertyAndRange(Long propertyId, LocalDate from,
                                                            LocalDate to, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return overrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /** Cree un override pour une date. */
    @Transactional
    public MinNightsOverrideDto create(MinNightsOverrideDto dto, String keycloakId) {
        reservationService.validatePropertyAccess(dto.propertyId(), keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));

        validateMinNights(dto.minNights());

        MinNightsOverride override = new MinNightsOverride(
                property, LocalDate.parse(dto.date()), dto.minNights(),
                dto.source() != null ? dto.source() : "MANUAL", orgId);
        override.setCreatedBy(keycloakId);

        return toDto(overrideRepository.save(override));
    }

    /**
     * Creation en lot (upsert) sur une plage de dates [from, to).
     *
     * Le corps brut est conserve pour preserver l'ordre exact de l'ancien
     * endpoint : validation d'acces propriete AVANT le parsing des dates
     * et la validation metier de minNights.
     */
    @Transactional
    public Map<String, Object> createBulk(Map<String, Object> body, String keycloakId) {
        Long propertyId = Long.valueOf(body.get("propertyId").toString());
        reservationService.validatePropertyAccess(propertyId, keycloakId);
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
                override.setCreatedBy(keycloakId);
            }
            created.add(overrideRepository.save(override));
        }

        return Map.of(
                "propertyId", propertyId,
                "from", from.toString(),
                "to", to.toString(),
                "minNights", minNights,
                "count", created.size()
        );
    }

    /** Supprime un override apres validation d'org de la propriete porteuse. */
    @Transactional
    public void delete(Long id, String keycloakId) {
        MinNightsOverride existing = overrideRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Override non trouve: " + id));

        // findById contourne le filtre Hibernate : l'org de la propriete est
        // validee par la regle transverse (CLAUDE.md « Lecons », regle 3).
        reservationService.validatePropertyAccess(existing.getProperty().getId(), keycloakId);

        overrideRepository.delete(existing);
    }

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
}
