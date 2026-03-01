package com.clenzy.integration.google.repository;

import com.clenzy.integration.google.model.GoogleVrConnection;
import com.clenzy.integration.google.model.GoogleVrConnection.GoogleVrConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour les connexions Google Vacation Rentals.
 */
@Repository
public interface GoogleVrConnectionRepository extends JpaRepository<GoogleVrConnection, Long> {

    Optional<GoogleVrConnection> findByOrganizationId(Long organizationId);

    Optional<GoogleVrConnection> findByPartnerId(String partnerId);

    List<GoogleVrConnection> findByStatus(GoogleVrConnectionStatus status);

    boolean existsByOrganizationId(Long organizationId);
}
