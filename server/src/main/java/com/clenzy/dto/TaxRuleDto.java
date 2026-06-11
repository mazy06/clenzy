package com.clenzy.dto;

import com.clenzy.model.TaxRule;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO d'exposition REST d'une regle fiscale (T-ARCH-07).
 *
 * <p>Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite {@link TaxRule} (9 proprietes, memes noms / memes types), pour ne
 * pas casser le contrat consomme par le frontend ({@code taxRulesApi.ts}).
 * Decouple le contrat d'API du schema de persistance : un champ ajoute a
 * l'entite ne fuit plus dans l'API.</p>
 */
public record TaxRuleDto(
    Long id,
    String countryCode,
    String taxCategory,
    BigDecimal taxRate,
    String taxName,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    String description,
    LocalDateTime createdAt
) {
    public static TaxRuleDto from(TaxRule rule) {
        return new TaxRuleDto(
            rule.getId(),
            rule.getCountryCode(),
            rule.getTaxCategory(),
            rule.getTaxRate(),
            rule.getTaxName(),
            rule.getEffectiveFrom(),
            rule.getEffectiveTo(),
            rule.getDescription(),
            rule.getCreatedAt()
        );
    }
}
