package com.clenzy.repository;

import com.clenzy.model.MaTouristTaxRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** Referentiel PLATEFORME de la taxe de sejour marocaine (pas de filtre tenant). */
public interface MaTouristTaxRateRepository extends JpaRepository<MaTouristTaxRate, Long> {

    Optional<MaTouristTaxRate> findByCityKeyAndCategory(String cityKey, MaTouristTaxRate.Category category);
}
