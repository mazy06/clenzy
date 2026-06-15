package com.clenzy.service;

import com.clenzy.dto.PriceBreakdownDto;
import com.clenzy.dto.PriceSimulationRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.fiscal.FiscalEngine;
import com.clenzy.fiscal.MoneyUtils;
import com.clenzy.fiscal.TaxResult;
import com.clenzy.fiscal.TaxableItem;
import com.clenzy.fiscal.TouristTaxInput;
import com.clenzy.fiscal.TouristTaxResult;
import com.clenzy.model.Country;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

/**
 * Orchestre la simulation de prix TTC par pays (CLZ-P0-18) : résout l'hébergement HT via
 * {@link PriceEngine}, puis injecte la TVA d'hébergement et la taxe de séjour via
 * {@link FiscalEngine} (résolution par pays du bien).
 *
 * <p>Règles CLAUDE.md appliquées : montant <b>recalculé serveur</b> (audit #1, jamais le client) ;
 * ownership <b>{@code requireSameOrganization}</b> après {@code findById} (audit #3) ;
 * arithmétique {@link BigDecimal} avec {@link RoundingMode} explicite, comparaisons via
 * {@code compareTo} (audit #10) ; pays inconnu → exception explicite via le registry (audit #11,
 * pas de défaut silencieux au-delà du repli FR quand le bien n'a pas de pays renseigné).</p>
 */
@Service
public class PriceSimulationService {

    private static final String DEFAULT_COUNTRY = "FR";
    private static final String DEFAULT_CURRENCY = "EUR";
    private static final String ACCOMMODATION_CATEGORY = "ACCOMMODATION";

    private final PriceEngine priceEngine;
    private final FiscalEngine fiscalEngine;
    private final PropertyRepository propertyRepository;
    private final CountryService countryService;
    private final OrganizationAccessGuard accessGuard;

    public PriceSimulationService(PriceEngine priceEngine,
                                  FiscalEngine fiscalEngine,
                                  PropertyRepository propertyRepository,
                                  CountryService countryService,
                                  OrganizationAccessGuard accessGuard) {
        this.priceEngine = priceEngine;
        this.fiscalEngine = fiscalEngine;
        this.propertyRepository = propertyRepository;
        this.countryService = countryService;
        this.accessGuard = accessGuard;
    }

    /**
     * Simule la ventilation HT / TVA / taxe de séjour / TTC pour un séjour.
     *
     * @throws NotFoundException si le bien n'existe pas
     * @throws org.springframework.security.access.AccessDeniedException si le bien n'appartient pas
     *         à l'organisation du tenant courant
     * @throws com.clenzy.fiscal.UnsupportedCountryException si le pays du bien n'a pas de calculateur
     */
    public PriceBreakdownDto simulate(PriceSimulationRequest request) {
        validate(request);

        Property property = propertyRepository.findById(request.propertyId())
            .orElseThrow(() -> new NotFoundException("Property not found: " + request.propertyId()));
        accessGuard.requireSameOrganization(property.getOrganizationId(),
            "Property " + request.propertyId());

        final Long orgId = property.getOrganizationId();
        final String countryCode = resolveCountry(property);
        final String currency = resolveCurrency(countryCode);
        final int nights = (int) ChronoUnit.DAYS.between(request.checkIn(), request.checkOut());

        // 1. Hébergement HT — recalcul serveur depuis la cascade PriceEngine (plage [checkIn, checkOut))
        final BigDecimal accommodationHt = MoneyUtils.round(
            priceEngine.resolvePriceRange(request.propertyId(), request.checkIn(), request.checkOut(), orgId)
                .values().stream()
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        // 2. TVA hébergement (taux par pays à la date d'arrivée)
        final TaxResult vat = fiscalEngine.calculateTax(
            countryCode,
            new TaxableItem(accommodationHt, ACCOMMODATION_CATEGORY,
                "Hébergement " + nights + " nuit(s)"),
            request.checkIn());

        // 3. Taxe de séjour / municipality fee (hors TVA, collectée séparément)
        final BigDecimal avgNightlyHt = nights > 0
            ? accommodationHt.divide(BigDecimal.valueOf(nights), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        final TouristTaxResult touristTax = fiscalEngine.calculateTouristTax(
            countryCode,
            new TouristTaxInput(
                avgNightlyHt,
                request.guests(),
                nights,
                request.childrenUnder(),
                nz(request.touristTaxPerPerson()),
                nz(request.touristTaxPercentage())));

        final BigDecimal grandTotal = MoneyUtils.round(vat.amountTTC().add(touristTax.amount()));

        return new PriceBreakdownDto(
            countryCode,
            currency,
            nights,
            vat.amountHT(),
            vat.taxRate(),
            vat.taxName(),
            vat.taxAmount(),
            vat.amountTTC(),
            touristTax.amount(),
            touristTax.description(),
            grandTotal);
    }

    private void validate(PriceSimulationRequest request) {
        if (request.propertyId() == null) {
            throw new IllegalArgumentException("propertyId is required");
        }
        if (request.checkIn() == null || request.checkOut() == null) {
            throw new IllegalArgumentException("checkIn and checkOut are required");
        }
        if (!request.checkOut().isAfter(request.checkIn())) {
            throw new IllegalArgumentException("checkOut must be after checkIn");
        }
        if (request.guests() < 1) {
            throw new IllegalArgumentException("guests must be >= 1");
        }
    }

    private String resolveCountry(Property property) {
        final String code = property.getCountryCode();
        return (code == null || code.isBlank()) ? DEFAULT_COUNTRY : code.trim().toUpperCase();
    }

    private String resolveCurrency(String countryCode) {
        return countryService.findByCode(countryCode)
            .map(Country::getDefaultCurrency)
            .filter(c -> c != null && !c.isBlank())
            .orElse(DEFAULT_CURRENCY);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
