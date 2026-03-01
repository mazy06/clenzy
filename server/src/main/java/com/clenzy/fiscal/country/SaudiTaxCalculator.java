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
 * Calculateur de taxes pour l'Arabie Saoudite.
 *
 * TVA (VAT) :
 * - Taux uniforme de 15% sur toutes les categories depuis janvier 2020
 * - Pas de taux reduit
 *
 * Municipality Fee :
 * - 5% du tarif de la nuitee (en plus de la TVA)
 * - Appliquee sur tous les hebergements touristiques
 *
 * ZATCA (Zakat, Tax and Customs Authority) :
 * - E-invoicing obligatoire (Phase 1 : generation, Phase 2 : integration)
 * - Format XML specifique (Fatoorah)
 * - QR code obligatoire sur les factures
 * - TIN (Tax Identification Number) obligatoire
 */
@Component
public class SaudiTaxCalculator implements TaxCalculator {

    private static final Logger log = LoggerFactory.getLogger(SaudiTaxCalculator.class);
    private static final String COUNTRY_CODE = "SA";
    private static final BigDecimal MUNICIPALITY_FEE_RATE = new BigDecimal("0.05"); // 5%

    private final TaxRuleRepository taxRuleRepository;

    public SaudiTaxCalculator(TaxRuleRepository taxRuleRepository) {
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
                "No tax rule found for SA/" + item.taxCategory() + " at " + transactionDate));

        BigDecimal amountHT = MoneyUtils.round(item.amount());
        BigDecimal taxAmount = MoneyUtils.calculateTaxAmount(amountHT, rule.getTaxRate());
        BigDecimal amountTTC = MoneyUtils.round(amountHT.add(taxAmount));

        log.debug("SA tax calculated: HT={}, rate={}%, tax={}, TTC={}",
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
        // Arabie Saoudite : municipality fee = 5% du tarif nuitee
        BigDecimal percentageRate = input.percentageRate();
        if (percentageRate == null || percentageRate.compareTo(BigDecimal.ZERO) <= 0) {
            percentageRate = MUNICIPALITY_FEE_RATE;
        }

        if (input.nightlyRate() == null || input.nightlyRate().compareTo(BigDecimal.ZERO) <= 0) {
            return TouristTaxResult.zero();
        }

        BigDecimal feePerNight = MoneyUtils.round(
            input.nightlyRate().multiply(percentageRate)
        );
        BigDecimal totalFee = MoneyUtils.round(
            feePerNight.multiply(BigDecimal.valueOf(input.nights()))
        );

        String description = String.format(
            "Municipality fee: %d nuits x %.2f SAR (%.0f%% of %.2f SAR/nuit)",
            input.nights(), feePerNight,
            percentageRate.multiply(BigDecimal.valueOf(100)),
            input.nightlyRate()
        );

        log.debug("SA municipality fee: {}", description);

        return new TouristTaxResult(totalFee, description, feePerNight);
    }

    @Override
    public List<TaxRule> getApplicableRules(String taxCategory, LocalDate date) {
        return taxRuleRepository.findApplicableRules(COUNTRY_CODE, taxCategory, date);
    }
}
