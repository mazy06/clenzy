package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.oauth.OAuthConnectionPersistence;
import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Adaptateur Pennylane vers le contrat {@link OAuthConnectionPersistence}.
 * Permet a {@code OAuthFlowEngine} de manipuler des PennylaneConnection sans
 * dependance directe sur le repository concret (Dependency Inversion).
 */
@Component
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneConnectionPersistence implements OAuthConnectionPersistence<PennylaneConnection> {

    private final PennylaneConnectionRepository repository;

    public PennylaneConnectionPersistence(PennylaneConnectionRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<PennylaneConnection> findByOrganizationId(Long organizationId) {
        return repository.findByOrganizationId(organizationId);
    }

    @Override
    public Optional<PennylaneConnection> findActiveByOrganizationId(Long organizationId) {
        return repository.findByOrganizationIdAndStatus(organizationId, PennylaneConnection.Status.ACTIVE);
    }

    @Override
    public PennylaneConnection newConnection() {
        return new PennylaneConnection();
    }

    @Override
    public PennylaneConnection save(PennylaneConnection connection) {
        return repository.save(connection);
    }
}
