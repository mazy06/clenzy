package com.clenzy.service.pricing;

import com.clenzy.dto.HousekeeperRatesDto;
import com.clenzy.dto.HousekeeperRatesDto.PropertyRateDto;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.ProviderTariffRepository;
import com.clenzy.model.ProviderTariff;
import com.clenzy.marketplace.model.PricingModel;
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
import java.util.List;

/** Tarif unique de ménage et conseils propres aux logements de l'organisation courante. */
@Service
public class HousekeeperRateService {

    private static final Logger log = LoggerFactory.getLogger(HousekeeperRateService.class);

    /** Borne le listing des logements du GET (advisories calculées par logement). */
    private static final int MAX_PROPERTIES = 200;

    private final ProviderTariffRepository rateRepository;
    private final ProviderTariffService tariffs;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final CleaningPricingEngine cleaningPricingEngine;
    private final TenantContext tenantContext;
    private final HousekeeperScoreService housekeeperScoreService;

    public HousekeeperRateService(ProviderTariffRepository rateRepository,
                                  PropertyRepository propertyRepository,
                                  UserRepository userRepository,
                                  CleaningPricingEngine cleaningPricingEngine,
                                  TenantContext tenantContext,
                                  HousekeeperScoreService housekeeperScoreService, ProviderTariffService tariffs) {
        this.tariffs = tariffs;
        this.rateRepository = rateRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.cleaningPricingEngine = cleaningPricingEngine;
        this.tenantContext = tenantContext;
        this.housekeeperScoreService = housekeeperScoreService;
    }

    /** Résout l'entité User du porteur du JWT (le « moi » des endpoints /me). */
    public User requireCurrentUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé"));
    }

    @Transactional(readOnly = true)
    public HousekeeperRatesDto getRates(Long userId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        ProviderTariff tariff = rateRepository.findByUserIdAndServiceKey(userId, ProviderTariffService.CLEANING).orElse(null);
        BigDecimal hourly = tariff != null && tariff.getPricingModel() == PricingModel.HOURLY ? tariff.getAmount() : null;

        List<PropertyRateDto> propertyDtos = new ArrayList<>();
        List<Property> properties = propertyRepository.findByOrganizationId(orgId);
        for (Property property : properties.stream().limit(MAX_PROPERTIES).toList()) {
            CleaningQuote quote = cleaningPricingEngine.quote(property, CleaningPricingEngine.STANDARD_CLEANING);
            propertyDtos.add(new PropertyRateDto(
                    property.getId(),
                    property.getName(),
                    null,
                    quote.min(),
                    quote.recommended(),
                    quote.max()));
        }

        var score = housekeeperScoreService.computeScore(userId, orgId);
        return new HousekeeperRatesDto(
                BigDecimal.valueOf(cleaningPricingEngine.referenceHourlyRate()),
                hourly,
                propertyDtos,
                new HousekeeperRatesDto.ScoreDto(score.score(), score.completedCount(), score.proofRate()),
                tariff != null ? tariff.getCurrency() : "EUR", tariff != null && tariff.isNeedsReview(),
                tariff != null ? tariff.getPricingModel() : PricingModel.HOURLY,
                tariff != null ? tariff.getAmount() : null,
                tariff != null ? tariff.getUnitLabel() : null);
    }

    /** Modifie le tarif global ; les anciens forfaits par logement sont refusés. */
    @Transactional
    public HousekeeperRatesDto updateRates(Long userId, UpdateRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // ── Taux horaire général ──
        if (request.flatRates() != null && !request.flatRates().isEmpty()) {
            throw new IllegalArgumentException("Les forfaits propres à un logement sont supprimés. Définissez le tarif unique du prestataire.");
        }
        rateRepository.lockUser(userId);
        ProviderTariff existing = rateRepository.findByUserIdAndServiceKey(userId, ProviderTariffService.CLEANING).orElse(null);
        String currency = request.currency() != null ? request.currency() : existing != null ? existing.getCurrency() : "EUR";
        PricingModel model = request.pricingModel() != null ? request.pricingModel()
                : existing != null && existing.getPricingModel().requiresAmount() ? existing.getPricingModel() : PricingModel.HOURLY;
        String unit = request.unitLabel() != null ? request.unitLabel() : existing != null ? existing.getUnitLabel() : null;
        tariffs.set(userId, ProviderTariffService.CLEANING,
                model, request.hourlyAmount(), currency, true, unit);

        return getRates(userId);
    }
}
