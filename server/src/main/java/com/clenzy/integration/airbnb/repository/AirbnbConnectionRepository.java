package com.clenzy.integration.airbnb.repository;

import com.clenzy.integration.airbnb.model.AirbnbConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing {@link AirbnbConnection} entities.
 */
@Repository
public interface AirbnbConnectionRepository extends JpaRepository<AirbnbConnection, Long> {

    Optional<AirbnbConnection> findByUserId(String userId);

    Optional<AirbnbConnection> findByAirbnbUserId(String airbnbUserId);

    List<AirbnbConnection> findByStatus(AirbnbConnection.AirbnbConnectionStatus status);

    boolean existsByUserId(String userId);
}
