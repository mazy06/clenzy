package com.clenzy.integration.docusign.repository;

import com.clenzy.integration.docusign.model.DocuSignConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DocuSignConnectionRepository extends JpaRepository<DocuSignConnection, Long> {

    Optional<DocuSignConnection> findByOrganizationId(Long organizationId);

    Optional<DocuSignConnection> findByOrganizationIdAndStatus(Long organizationId,
                                                                 DocuSignConnection.Status status);
}
