package com.clenzy.repository;

import com.clenzy.model.Country;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Acces au referentiel des pays supportes (config globale multi-pays).
 */
@Repository
public interface CountryRepository extends JpaRepository<Country, Long> {

    Optional<Country> findByCountryCode(String countryCode);

    List<Country> findByEnabledTrue();

    boolean existsByCountryCode(String countryCode);
}
