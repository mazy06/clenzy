package com.clenzy.integration.sage.repository;

import com.clenzy.integration.sage.model.SageConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SageConnectionRepository extends JpaRepository<SageConnection, Long> {

    Optional<SageConnection> findByOrganizationId(Long organizationId);

    Optional<SageConnection> findByOrganizationIdAndStatus(Long organizationId,
                                                            SageConnection.Status status);
}
