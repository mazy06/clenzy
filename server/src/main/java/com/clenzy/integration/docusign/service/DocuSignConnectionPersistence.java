package com.clenzy.integration.docusign.service;

import com.clenzy.integration.docusign.model.DocuSignConnection;
import com.clenzy.integration.docusign.repository.DocuSignConnectionRepository;
import com.clenzy.integration.oauth.OAuthConnectionPersistence;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Adaptateur DocuSign vers {@link OAuthConnectionPersistence}.
 * Permet au moteur OAuth de manipuler des DocuSignConnection sans coupling
 * direct au repository (Dependency Inversion).
 */
@Component
@ConditionalOnProperty(name = "clenzy.docusign.client-id")
public class DocuSignConnectionPersistence implements OAuthConnectionPersistence<DocuSignConnection> {

    private final DocuSignConnectionRepository repository;

    public DocuSignConnectionPersistence(DocuSignConnectionRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<DocuSignConnection> findByOrganizationId(Long organizationId) {
        return repository.findByOrganizationId(organizationId);
    }

    @Override
    public Optional<DocuSignConnection> findActiveByOrganizationId(Long organizationId) {
        return repository.findByOrganizationIdAndStatus(organizationId, DocuSignConnection.Status.ACTIVE);
    }

    @Override
    public DocuSignConnection newConnection() {
        return new DocuSignConnection();
    }

    @Override
    public DocuSignConnection save(DocuSignConnection connection) {
        return repository.save(connection);
    }
}
