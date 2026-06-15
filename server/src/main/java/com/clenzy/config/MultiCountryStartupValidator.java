package com.clenzy.config;

import com.clenzy.fiscal.TaxCalculatorRegistry;
import com.clenzy.model.Country;
import com.clenzy.service.CountryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Validation fail-fast au demarrage du socle multi-pays (CLZ-P0-03).
 *
 * <p>Pour chaque pays OPERATIONNEL (resolu via {@link CountryService}, qui respecte
 * le flag {@code fiscal.multi-country.enabled} : France seule si OFF, pays
 * {@code enabled} si ON), verifie que sa configuration est exploitable et que les
 * briques deja livrees sont resolvables. Refuse le boot sinon — meme philosophie
 * que {@link EnvironmentValidator} (audit Z1-SEC-03/06 : pas de demarrage avec une
 * configuration indeterminee).</p>
 *
 * <p>Liste POSITIVE (audit #11) : seuls les pays explicitement actifs sont valides,
 * jamais par matching negatif.</p>
 *
 * <p>Lancee sur {@link ApplicationReadyEvent} (et non {@code @PostConstruct}) car la
 * validation lit la table {@code countries}, seedee par Liquibase pendant l'init du
 * contexte.</p>
 *
 * <p><b>Dependance (sequencement)</b> : la validation de resolution des providers
 * e-invoicing / declaration voyageurs sera ajoutee ici quand leurs registries
 * existeront (CLZ-P0-04 et suivants). A ce stade, on valide la config pays + la
 * presence d'un {@link com.clenzy.fiscal.TaxCalculator} (deja livre FR/MA/SA).</p>
 */
@Component
public class MultiCountryStartupValidator {

    private static final Logger log = LoggerFactory.getLogger(MultiCountryStartupValidator.class);

    private final CountryService countryService;
    private final TaxCalculatorRegistry taxCalculatorRegistry;

    public MultiCountryStartupValidator(CountryService countryService,
                                        TaxCalculatorRegistry taxCalculatorRegistry) {
        this.countryService = countryService;
        this.taxCalculatorRegistry = taxCalculatorRegistry;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validateActiveCountries() {
        List<Country> active = countryService.getActiveCountries();
        if (active.isEmpty()) {
            log.warn("Socle multi-pays : aucun pays actif resolu (table countries vide/non seedee ?).");
            return;
        }
        List<String> errors = new ArrayList<>();
        for (Country country : active) {
            validateCountry(country, errors);
        }
        if (!errors.isEmpty()) {
            throw new IllegalStateException(
                    "Configuration multi-pays invalide pour des pays actifs : " + String.join(" | ", errors));
        }
        log.info("Socle multi-pays : {} pays actif(s) valide(s) : {}",
                active.size(), active.stream().map(Country::getCountryCode).toList());
    }

    private void validateCountry(Country country, List<String> errors) {
        String code = country.getCountryCode();
        if (isBlank(country.getDefaultCurrency())) {
            errors.add(code + ": devise par defaut manquante");
        }
        if (isBlank(country.getDefaultLocale())) {
            errors.add(code + ": locale par defaut manquante");
        }
        validateTimezone(code, country.getTimezone(), errors);
        validateWeekend(code, country.getWeekendDays(), errors);
        if (!taxCalculatorRegistry.isSupported(code)) {
            errors.add(code + ": aucun TaxCalculator enregistre");
        }
    }

    private void validateTimezone(String code, String timezone, List<String> errors) {
        if (isBlank(timezone)) {
            errors.add(code + ": fuseau horaire manquant");
            return;
        }
        try {
            ZoneId.of(timezone);
        } catch (RuntimeException e) {
            errors.add(code + ": fuseau horaire invalide '" + timezone + "'");
        }
    }

    private void validateWeekend(String code, String weekendDays, List<String> errors) {
        if (isBlank(weekendDays)) {
            errors.add(code + ": jours de week-end manquants");
            return;
        }
        for (String token : weekendDays.split(",")) {
            try {
                DayOfWeek.valueOf(token.trim().toUpperCase());
            } catch (RuntimeException e) {
                errors.add(code + ": jour de week-end invalide '" + token.trim() + "'");
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
