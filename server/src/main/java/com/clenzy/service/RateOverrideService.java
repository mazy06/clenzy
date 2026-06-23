package com.clenzy.service;

import com.clenzy.dto.RateOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service des overrides de prix par date (priorite maximale du PriceEngine).
 *
 * Logique deplacee de RateOverrideController (audit T-ARCH-01 : controller
 * mince — acces donnees, transactions et validation d'org au niveau service).
 * Les ecritures restent compatibles avec la semantique source MANUAL/YIELD_RULE :
 * la source fournie est conservee, repli "MANUAL" si absente.
 *
 * L'acces propriete est valide par la regle transverse unique
 * {@link ReservationService#validatePropertyAccess(Long, String)}
 * (org courante + super admin + platform staff + owner — pattern T-ARCH-08).
 */
@Service
public class RateOverrideService {

    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationService reservationService;
    private final TenantContext tenantContext;
    private final SearchCacheInvalidator searchCacheInvalidator;

    public RateOverrideService(RateOverrideRepository rateOverrideRepository,
                               PropertyRepository propertyRepository,
                               ReservationService reservationService,
                               TenantContext tenantContext,
                               SearchCacheInvalidator searchCacheInvalidator) {
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.reservationService = reservationService;
        this.tenantContext = tenantContext;
        this.searchCacheInvalidator = searchCacheInvalidator;
    }

    /** Overrides d'une propriete sur la plage [from, to]. */
    @Transactional(readOnly = true)
    public List<RateOverrideDto> getByPropertyAndRange(Long propertyId, LocalDate from,
                                                       LocalDate to, String keycloakId) {
        reservationService.validatePropertyAccess(propertyId, keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        return rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /** Cree un override de prix pour une date. */
    @Transactional
    public RateOverrideDto create(RateOverrideDto dto, String keycloakId) {
        reservationService.validatePropertyAccess(dto.propertyId(), keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + dto.propertyId()));

        RateOverride override = new RateOverride(
                property, LocalDate.parse(dto.date()),
                BigDecimal.valueOf(dto.nightlyPrice()),
                dto.source() != null ? dto.source() : "MANUAL", orgId);
        override.setCurrency(dto.currency() != null ? dto.currency()
                : (property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR"));
        override.setCreatedBy(keycloakId);

        RateOverrideDto saved = toDto(rateOverrideRepository.save(override));
        searchCacheInvalidator.onAvailabilityOrPriceChanged(); // prix changé → invalide le calendrier agrégé
        return saved;
    }

    /**
     * Creation en lot sur une plage de dates [from, to).
     *
     * Le corps brut est conserve pour preserver l'ordre exact de l'ancien
     * endpoint : validation d'acces propriete AVANT le parsing des dates/prix.
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
        BigDecimal price = new BigDecimal(body.get("nightlyPrice").toString());
        String source = body.containsKey("source") ? body.get("source").toString() : "MANUAL";
        String currency = body.containsKey("currency")
                ? body.get("currency").toString()
                : (property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR");

        List<RateOverride> created = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            RateOverride override = new RateOverride(property, date, price, source, orgId);
            override.setCurrency(currency);
            override.setCreatedBy(keycloakId);
            created.add(rateOverrideRepository.save(override));
        }
        searchCacheInvalidator.onAvailabilityOrPriceChanged(); // prix changés → invalide le calendrier agrégé

        return Map.of(
                "propertyId", propertyId,
                "from", from.toString(),
                "to", to.toString(),
                "nightlyPrice", price.doubleValue(),
                "count", created.size()
        );
    }

    /** Supprime un override apres validation d'org de la propriete porteuse. */
    @Transactional
    public void delete(Long id, String keycloakId) {
        RateOverride existing = rateOverrideRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Override non trouve: " + id));

        // findById contourne le filtre Hibernate : l'org de la propriete est
        // validee par la regle transverse (CLAUDE.md « Lecons », regle 3).
        reservationService.validatePropertyAccess(existing.getProperty().getId(), keycloakId);

        rateOverrideRepository.delete(existing);
        searchCacheInvalidator.onAvailabilityOrPriceChanged(); // prix changé → invalide le calendrier agrégé
    }

    private RateOverrideDto toDto(RateOverride entity) {
        return new RateOverrideDto(
            entity.getId(),
            entity.getProperty() != null ? entity.getProperty().getId() : null,
            entity.getDate() != null ? entity.getDate().toString() : null,
            entity.getNightlyPrice() != null ? entity.getNightlyPrice().doubleValue() : null,
            entity.getSource(),
            entity.getCurrency()
        );
    }
}
