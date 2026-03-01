package com.clenzy.integration.tripadvisor.repository;

import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection;
import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection.TripAdvisorConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour les connexions TripAdvisor Vacation Rentals.
 */
@Repository
public interface TripAdvisorConnectionRepository extends JpaRepository<TripAdvisorConnection, Long> {

    Optional<TripAdvisorConnection> findByOrganizationId(Long organizationId);

    Optional<TripAdvisorConnection> findByPartnerId(String partnerId);

    List<TripAdvisorConnection> findByStatus(TripAdvisorConnectionStatus status);

    boolean existsByOrganizationId(Long organizationId);
}
