package com.clenzy.repository;

import com.clenzy.model.FrTouristTaxRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Referentiel PLATEFORME des tarifs communaux de taxe de sejour (pas de filtre tenant). */
public interface FrTouristTaxRateRepository extends JpaRepository<FrTouristTaxRate, Long> {

    List<FrTouristTaxRate> findByInseeCodeOrderByEffectiveYearDesc(String inseeCode);

    @Modifying
    @Query("DELETE FROM FrTouristTaxRate r WHERE r.inseeCode = :insee")
    void deleteByInseeCode(@Param("insee") String insee);
}
