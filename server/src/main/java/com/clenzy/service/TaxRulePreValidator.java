package com.clenzy.service;

import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.TaxCategory;
import com.clenzy.repository.TaxRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Pre-valide l'existence des regles fiscales AVANT la generation de documents.
 * Echoue tot avec un message explicite listant les categories manquantes,
 * evitant ainsi la creation d'enregistrements DocumentGeneration orphelins.
 */
@Component
public class TaxRulePreValidator {

    private static final Logger log = LoggerFactory.getLogger(TaxRulePreValidator.class);

    /** Categories requises pour la generation d'une FACTURE */
    private static final List<TaxCategory> REQUIRED_CATEGORIES = List.of(
        TaxCategory.ACCOMMODATION,
        TaxCategory.STANDARD,
        TaxCategory.CLEANING,
        TaxCategory.FOOD
    );

    private final TaxRuleRepository taxRuleRepository;

    public TaxRulePreValidator(TaxRuleRepository taxRuleRepository) {
        this.taxRuleRepository = taxRuleRepository;
    }

    /**
     * Verifie que toutes les regles fiscales requises existent pour le pays et la date donnes.
     *
     * @param countryCode     code ISO du pays (ex: FR, MA, SA)
     * @param transactionDate date de la transaction (pour verifier l'effectivite des regles)
     * @throws DocumentValidationException si des regles sont manquantes
     */
    public void validateTaxRulesExist(String countryCode, LocalDate transactionDate) {
        List<String> missing = new ArrayList<>();

        for (TaxCategory category : REQUIRED_CATEGORIES) {
            boolean exists = taxRuleRepository
                .findApplicableRule(countryCode, category.name(), transactionDate)
                .isPresent();
            if (!exists) {
                missing.add(category.name());
            }
        }

        if (!missing.isEmpty()) {
            String msg = String.format(
                "Impossible de generer la facture : regles fiscales manquantes pour le pays %s "
                + "a la date %s. Categories manquantes : %s. "
                + "Configurez les regles fiscales dans Parametres > Fiscal.",
                countryCode, transactionDate, String.join(", ", missing)
            );
            log.warn("Tax rule pre-validation failed: country={}, date={}, missing={}",
                countryCode, transactionDate, missing);
            throw new DocumentValidationException(msg);
        }

        log.debug("Tax rule pre-validation passed: country={}, date={}", countryCode, transactionDate);
    }
}
