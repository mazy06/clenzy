package com.clenzy.integration.quickbooks.repository;

import com.clenzy.integration.quickbooks.model.QuickBooksConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QuickBooksConnectionRepository extends JpaRepository<QuickBooksConnection, Long> {

    Optional<QuickBooksConnection> findByOrganizationId(Long organizationId);

    Optional<QuickBooksConnection> findByOrganizationIdAndStatus(Long organizationId,
                                                                   QuickBooksConnection.Status status);
}
