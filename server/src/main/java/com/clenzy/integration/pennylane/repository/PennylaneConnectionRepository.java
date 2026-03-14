package com.clenzy.integration.pennylane.repository;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PennylaneConnectionRepository extends JpaRepository<PennylaneConnection, Long> {

    Optional<PennylaneConnection> findByOrganizationId(Long organizationId);

    Optional<PennylaneConnection> findByOrganizationIdAndStatus(
        Long organizationId, PennylaneConnection.Status status);
}
