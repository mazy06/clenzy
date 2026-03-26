package com.clenzy.repository;

import com.clenzy.model.ExchangeRate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, Long> {

    /**
     * Trouve le taux de change le plus recent pour une paire de devises
     * a une date donnee ou avant.
     */
    @Query("SELECT e FROM ExchangeRate e WHERE e.baseCurrency = :base " +
           "AND e.targetCurrency = :target " +
           "AND e.rateDate <= :date " +
           "ORDER BY e.rateDate DESC " +
           "LIMIT 1")
    Optional<ExchangeRate> findLatestRate(
        @Param("base") String baseCurrency,
        @Param("target") String targetCurrency,
        @Param("date") LocalDate date
    );

    Optional<ExchangeRate> findByBaseCurrencyAndTargetCurrencyAndRateDate(
        String baseCurrency, String targetCurrency, LocalDate rateDate
    );

    /**
     * Historique des taux pour une paire de devises sur une periode.
     */
    @Query("SELECT e FROM ExchangeRate e WHERE e.baseCurrency = :base " +
           "AND e.targetCurrency = :target " +
           "AND e.rateDate BETWEEN :from AND :to")
    Page<ExchangeRate> findHistory(
        @Param("base") String baseCurrency,
        @Param("target") String targetCurrency,
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        Pageable pageable
    );

    /**
     * Tous les taux sur une periode (toutes paires).
     */
    Page<ExchangeRate> findByRateDateBetween(LocalDate from, LocalDate to, Pageable pageable);
}
