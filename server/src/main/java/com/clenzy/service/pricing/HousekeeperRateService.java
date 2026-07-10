package com.clenzy.service.pricing;

import com.clenzy.dto.HousekeeperRatesDto;
import com.clenzy.dto.HousekeeperRatesDto.PropertyRateDto;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.HousekeeperRate;
import com.clenzy.model.HousekeeperRate.RateUnit;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.HousekeeperRateRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Tarifs prestataire ménage (Moteur Ménage 2A) : lecture avec contexte conseil
 * (fourchette par logement, taux de référence org) + upsert « état complet »
 * (le PUT remplace : forfaits absents supprimés, taux horaire null supprimé).
 * Org-scopé fail-closed : toutes les queries portent l'organizationId du tenant,
 * et un forfait ne peut cibler qu'un logement de la même org.
 */
@Service
public class HousekeeperRateService {

    private static final Logger log = LoggerFactory.getLogger(HousekeeperRateService.class);

    /** Borne le listing des logements du GET (advisories calculées par logement). */
    private static final int MAX_PROPERTIES = 200;

    private final HousekeeperRateRepository rateRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final CleaningPricingEngine cleaningPricingEngine;
    private final TenantContext tenantContext;

    public HousekeeperRateService(HousekeeperRateRepository rateRepository,
                                  PropertyRepository propertyRepository,
                                  UserRepository userRepository,
                                  CleaningPricingEngine cleaningPricingEngine,
                                  TenantContext tenantContext) {
        this.rateRepository = rateRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.cleaningPricingEngine = cleaningPricingEngine;
        this.tenantContext = tenantContext;
    }

    /** Résout l'entité User du porteur du JWT (le « moi » des endpoints /me). */
    public User requireCurrentUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé"));
    }

    @Transactional(readOnly = true)
    public HousekeeperRatesDto getRates(Long userId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<HousekeeperRate> rates = rateRepository.findByOrganizationIdAndUserId(orgId, userId);
        BigDecimal hourly = rates.stream()
                .filter(r -> r.getPropertyId() == null && r.getUnit() == RateUnit.HOURLY)
                .map(HousekeeperRate::getAmount)
                .findFirst().orElse(null);
        Map<Long, BigDecimal> flats = new HashMap<>();
        for (HousekeeperRate r : rates) {
            if (r.getPropertyId() != null && r.getUnit() == RateUnit.FLAT) {
                flats.put(r.getPropertyId(), r.getAmount());
            }
        }

        // Logements de l'org (bornés) + fourchette conseil par logement (quote CLEANING).
        List<PropertyRateDto> propertyDtos = new ArrayList<>();
        List<Property> properties = propertyRepository.findByOrganizationId(orgId);
        for (Property property : properties.stream().limit(MAX_PROPERTIES).toList()) {
            CleaningQuote quote = cleaningPricingEngine.quote(property, CleaningPricingEngine.STANDARD_CLEANING);
            propertyDtos.add(new PropertyRateDto(
                    property.getId(),
                    property.getName(),
                    flats.get(property.getId()),
                    quote.min(),
                    quote.recommended(),
                    quote.max()));
        }

        return new HousekeeperRatesDto(
                BigDecimal.valueOf(cleaningPricingEngine.referenceHourlyRate()),
                hourly,
                propertyDtos);
    }

    /**
     * Upsert « état complet » des tarifs d'un pro : le taux horaire est posé/mis à
     * jour/supprimé (null) ; les forfaits reçus sont upsertés, les absents supprimés.
     * Chaque forfait ne peut cibler qu'un logement de l'org courante (fail-closed).
     */
    @Transactional
    public HousekeeperRatesDto updateRates(Long userId, UpdateRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // ── Taux horaire général ──
        HousekeeperRate hourly = rateRepository
                .findByOrganizationIdAndUserIdAndPropertyIdIsNull(orgId, userId)
                .orElse(null);
        if (request.hourlyAmount() != null && request.hourlyAmount().compareTo(BigDecimal.ZERO) > 0) {
            if (hourly == null) {
                hourly = new HousekeeperRate(orgId, userId, null, request.hourlyAmount(), RateUnit.HOURLY);
            } else {
                hourly.setAmount(request.hourlyAmount());
            }
            rateRepository.save(hourly);
        } else if (hourly != null) {
            rateRepository.delete(hourly);
        }

        // ── Forfaits par logement (état complet) ──
        List<UpdateRequest.FlatRateEntry> entries = request.flatRates() != null ? request.flatRates() : List.of();
        Map<Long, BigDecimal> wanted = new HashMap<>();
        for (UpdateRequest.FlatRateEntry entry : entries) {
            if (entry.propertyId() == null || entry.amount() == null
                    || entry.amount().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            wanted.put(entry.propertyId(), entry.amount());
        }

        // Garde org fail-closed : un forfait ne peut cibler qu'un logement de l'org.
        for (Long propertyId : wanted.keySet()) {
            Property property = propertyRepository.findById(propertyId)
                    .orElseThrow(() -> new NotFoundException("Logement non trouvé : " + propertyId));
            if (!Objects.equals(property.getOrganizationId(), orgId)) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "Logement hors de votre organisation : " + propertyId);
            }
        }

        List<HousekeeperRate> existingFlats = rateRepository.findByOrganizationIdAndUserId(orgId, userId).stream()
                .filter(r -> r.getPropertyId() != null && r.getUnit() == RateUnit.FLAT)
                .toList();
        for (HousekeeperRate existing : existingFlats) {
            BigDecimal amount = wanted.remove(existing.getPropertyId());
            if (amount == null) {
                rateRepository.delete(existing);
            } else if (existing.getAmount().compareTo(amount) != 0) {
                existing.setAmount(amount);
                rateRepository.save(existing);
            }
        }
        for (Map.Entry<Long, BigDecimal> entry : wanted.entrySet()) {
            rateRepository.save(new HousekeeperRate(orgId, userId, entry.getKey(), entry.getValue(), RateUnit.FLAT));
        }

        log.info("Housekeeper rates updated: userId={}, orgId={}, hourly={}, flats={}",
                userId, orgId, request.hourlyAmount(), entries.size());

        return getRates(userId);
    }
}
