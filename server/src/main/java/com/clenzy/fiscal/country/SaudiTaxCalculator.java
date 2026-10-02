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
 * Municipality Fee (redevance d'occupation, MOMAH — lâ'iha des redevances de services
 * municipaux, arrete 23542 du 8/5/1440 H modifie par 1/762126 du 24/10/1444 H, poste 16) :
 * - 5 % du prix de la nuit pour les etablissements classes 4 etoiles et plus (hors camps)
 * - 2,5 % pour tous les autres : 3 etoiles et moins, economique, camps et « toute
 *   classification non listee » (logement touristique prive compris)
 * - Taux NATIONAL, identique dans toutes les municipalites ; declaration mensuelle Balady
 *   (5 premiers jours du mois), paiement au plus tard le 15.
 * Le taux applique est celui DECLARE pour le logement ; a defaut, le taux general (2,5 %) :
 * 5 % suppose un classement 4 etoiles que rien ne permet ici de presumer.
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
    /** Taux general (toute categorie hors 4 etoiles et plus). */
    static final BigDecimal MUNICIPALITY_FEE_RATE = new BigDecimal("0.025"); // 2,5 %

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
        // Arabie Saoudite : redevance municipale = taux declare, sinon 2,5 % (taux general)
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
