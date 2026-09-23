package com.clenzy.integration.regulatory.repository;

import com.clenzy.integration.regulatory.model.RegulatoryConnection;
import com.clenzy.integration.regulatory.model.RegulatoryProviderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RegulatoryConnectionRepository extends JpaRepository<RegulatoryConnection, Long> {

    Optional<RegulatoryConnection> findByOrganizationIdAndProvider(Long organizationId,
                                                                  RegulatoryProviderType provider);
}
