package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SearchCacheInvalidator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Exécute l'action portée par une suggestion actionnable (Phase B).
 *
 * <p>Appelé DANS la transaction d'application (après la transition atomique
 * {@code PENDING → APPLIED}) : un échec ici fait remonter l'exception et
 * annule la transition (pas d'état incohérent). Écritures DB uniquement —
 * la propagation aux canaux se fait via l'outbox de l'écriture d'override.</p>
 */
@Service
public class SuggestionActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(SuggestionActionExecutor.class);
    private static final String OVERRIDE_SOURCE = "SUPERVISION_PRICE_DROP";
    /** Garde-fou : une baisse proposée reste bornée (aucun tarif absurde). */
    private static final int MAX_PERCENT = 90;

    private final PriceEngine priceEngine;
    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final SearchCacheInvalidator searchCacheInvalidator;
    private final ObjectMapper objectMapper;

    public SuggestionActionExecutor(PriceEngine priceEngine,
                                    RateOverrideRepository rateOverrideRepository,
                                    PropertyRepository propertyRepository,
                                    SearchCacheInvalidator searchCacheInvalidator,
                                    ObjectMapper objectMapper) {
        this.priceEngine = priceEngine;
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.searchCacheInvalidator = searchCacheInvalidator;
        this.objectMapper = objectMapper;
    }

    /** Dispatche l'exécution selon {@code actionType}. Lève si le type est inconnu ou les params invalides. */
    public void execute(SupervisionSuggestion suggestion) {
        final String type = suggestion.getActionType();
        if (type == null) {
            throw new IllegalStateException("Suggestion non actionnable (actionType absent)");
        }
        if (SupervisionActionType.PRICE_DROP.equals(type)) {
            applyPriceDrop(suggestion);
            return;
        }
        throw new IllegalStateException("Type d'action non supporté : " + type);
    }

    private void applyPriceDrop(SupervisionSuggestion suggestion) {
        final JsonNode params = parseParams(suggestion.getActionParams());
        final LocalDate from = LocalDate.parse(params.path("from").asText());
        final LocalDate to = LocalDate.parse(params.path("to").asText()); // exclusif
        final int percent = params.path("percent").asInt();
        if (!from.isBefore(to)) {
            throw new IllegalStateException("Plage invalide : from >= to");
        }
        if (percent <= 0 || percent > MAX_PERCENT) {
            throw new IllegalStateException("Pourcentage de baisse hors bornes : " + percent);
        }

        final Long propertyId = suggestion.getPropertyId();
        final Long orgId = suggestion.getOrganizationId();
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalStateException("Logement introuvable : " + propertyId));
        final String currency = property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR";
        final BigDecimal factor = BigDecimal.ONE.subtract(
                BigDecimal.valueOf(percent).divide(BigDecimal.valueOf(100)));

        int applied = 0;
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            final BigDecimal current = priceEngine.resolvePrice(propertyId, date, orgId);
            if (current == null || current.signum() <= 0) {
                continue; // pas de prix résolu → rien à baisser ce jour
            }
            final BigDecimal newPrice = current.multiply(factor).setScale(2, RoundingMode.HALF_UP);
            final LocalDate d = date;
            final RateOverride override = rateOverrideRepository
                    .findByPropertyIdAndDate(propertyId, d, orgId)
                    .orElseGet(() -> new RateOverride(property, d, newPrice, OVERRIDE_SOURCE, orgId));
            override.setNightlyPrice(newPrice);
            override.setSource(OVERRIDE_SOURCE);
            override.setCurrency(currency);
            override.setCreatedBy("system:supervisor");
            rateOverrideRepository.save(override);
            applied++;
        }
        searchCacheInvalidator.onAvailabilityOrPriceChanged();
        log.info("PRICE_DROP appliqué org={} property={} {}→{} −{}% ({} jour(s))",
                orgId, propertyId, from, to, percent, applied);
    }

    private JsonNode parseParams(String json) {
        if (json == null || json.isBlank()) {
            throw new IllegalStateException("Params d'action absents");
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("Params d'action illisibles : " + e.getMessage(), e);
        }
    }
}
