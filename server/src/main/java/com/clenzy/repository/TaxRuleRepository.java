package com.clenzy.repository;

import com.clenzy.model.TaxRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TaxRuleRepository extends JpaRepository<TaxRule, Long> {

    List<TaxRule> findByCountryCode(String countryCode);

    /**
     * Trouve la regle fiscale applicable pour un pays, une categorie et une date.
     * Retourne la regle dont la plage effective_from/effective_to couvre la date donnee.
     */
    @Query("SELECT t FROM TaxRule t WHERE t.countryCode = :countryCode " +
           "AND t.taxCategory = :taxCategory " +
           "AND t.effectiveFrom <= :date " +
           "AND (t.effectiveTo IS NULL OR t.effectiveTo >= :date) " +
           "ORDER BY t.effectiveFrom DESC")
    List<TaxRule> findApplicableRules(
        @Param("countryCode") String countryCode,
        @Param("taxCategory") String taxCategory,
        @Param("date") LocalDate date
    );

    /**
     * Raccourci pour obtenir la premiere regle applicable.
     */
    default Optional<TaxRule> findApplicableRule(String countryCode, String taxCategory, LocalDate date) {
        List<TaxRule> rules = findApplicableRules(countryCode, taxCategory, date);
        return rules.isEmpty() ? Optional.empty() : Optional.of(rules.get(0));
    }
}
