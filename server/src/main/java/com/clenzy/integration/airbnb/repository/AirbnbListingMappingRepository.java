package com.clenzy.integration.airbnb.repository;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing {@link AirbnbListingMapping} entities.
 */
@Repository
public interface AirbnbListingMappingRepository extends JpaRepository<AirbnbListingMapping, Long> {

    Optional<AirbnbListingMapping> findByAirbnbListingId(String airbnbListingId);

    Optional<AirbnbListingMapping> findByPropertyId(Long propertyId);

    List<AirbnbListingMapping> findBySyncEnabled(boolean syncEnabled);

    List<AirbnbListingMapping> findByPropertyIdIn(List<Long> propertyIds);

    boolean existsByAirbnbListingId(String airbnbListingId);

    boolean existsByPropertyId(Long propertyId);

    List<AirbnbListingMapping> findBySyncEnabledTrueAndAutoPushPricingTrue();
}
