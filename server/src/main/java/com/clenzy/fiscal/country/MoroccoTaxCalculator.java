package com.clenzy.fiscal.country;

import com.clenzy.fiscal.*;
import com.clenzy.model.TaxRule;
import com.clenzy.repository.TaxRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Calculateur de taxes pour le Maroc.
 *
 * TVA :
 * - Hebergement touristique : 10%
 * - Standard : 20%
 * - Alimentation : 7%
 * - Nettoyage : 20%
 *
 * Taxe de sejour :
 * - Montant fixe par personne par nuit (varie selon la categorie de l'hotel)
 * - Typiquement 3-25 MAD par personne par nuit
 * - Enfants de moins de 12 ans exoneres
 *
 * ICE (Identifiant Commun de l'Entreprise) obligatoire sur les factures.
 */
@Component
public class MoroccoTaxCalculator implements TaxCalculator {

    private static final Logger log = LoggerFactory.getLogger(MoroccoTaxCalculator.class);
    private static final String COUNTRY_CODE = "MA";

    private final TaxRuleRepository taxRuleRepository;

    public MoroccoTaxCalculator(TaxRuleRepository taxRuleRepository) {
        this.taxRuleRepository = taxRuleRepository;
    }

    @Override
    public String getCountryCode() {
        return COUNTRY_CODE;
    }

    @Override
    public TaxResult calculateTax(TaxableItem item, LocalDate transactionDate) {
        TaxRule rule = taxRuleRepository
            .findApplicableRule(COUNTRY_CODE, item.taxCategory(), transactionDate)
            .orElseThrow(() -> new IllegalStateException(
                "No tax rule found for MA/" + item.taxCategory() + " at " + transactionDate));

        BigDecimal amountHT = MoneyUtils.round(item.amount());
        BigDecimal taxAmount = MoneyUtils.calculateTaxAmount(amountHT, rule.getTaxRate());
        BigDecimal amountTTC = MoneyUtils.round(amountHT.add(taxAmount));

        log.debug("MA tax calculated: HT={}, rate={}, tax={}, TTC={}",
            amountHT, rule.getTaxRate(), taxAmount, amountTTC);

        return new TaxResult(
            amountHT,
            taxAmount,
            amountTTC,
            rule.getTaxRate(),
            rule.getTaxName(),
            item.taxCategory()
        );
    }

    @Override
    public TouristTaxResult calculateTouristTax(TouristTaxInput input) {
        if (input.ratePerPerson() == null || input.ratePerPerson().compareTo(BigDecimal.ZERO) <= 0) {
            return TouristTaxResult.zero();
        }

        // Taxe de sejour Maroc : montant fixe par personne par nuit
        // Enfants de moins de 12 ans exoneres
        BigDecimal perPersonPerNight = MoneyUtils.round(input.ratePerPerson());
        int taxableGuests = Math.max(0, input.guests());
        BigDecimal totalTax = MoneyUtils.round(
            perPersonPerNight
                .multiply(BigDecimal.valueOf(taxableGuests))
                .multiply(BigDecimal.valueOf(input.nights()))
        );

        String description = String.format(
            "Taxe de sejour: %d pers x %d nuits x %.2f MAD",
            taxableGuests, input.nights(), perPersonPerNight
        );

        log.debug("MA tourist tax: {}", description);

        return new TouristTaxResult(totalTax, description, perPersonPerNight);
    }

    @Override
    public List<TaxRule> getApplicableRules(String taxCategory, LocalDate date) {
        return taxRuleRepository.findApplicableRules(COUNTRY_CODE, taxCategory, date);
    }
}
