package com.clenzy.integration.xero.repository;

import com.clenzy.integration.xero.model.XeroConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface XeroConnectionRepository extends JpaRepository<XeroConnection, Long> {

    Optional<XeroConnection> findByOrganizationId(Long organizationId);

    Optional<XeroConnection> findByOrganizationIdAndStatus(Long organizationId,
                                                            XeroConnection.Status status);
}
