package com.clenzy.integration.sage.service;

import com.clenzy.integration.oauth.OAuthConnectionPersistence;
import com.clenzy.integration.sage.model.SageConnection;
import com.clenzy.integration.sage.repository.SageConnectionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@ConditionalOnProperty(name = "clenzy.sage.client-id")
public class SageConnectionPersistence implements OAuthConnectionPersistence<SageConnection> {

    private final SageConnectionRepository repository;

    public SageConnectionPersistence(SageConnectionRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<SageConnection> findByOrganizationId(Long organizationId) {
        return repository.findByOrganizationId(organizationId);
    }

    @Override
    public Optional<SageConnection> findActiveByOrganizationId(Long organizationId) {
        return repository.findByOrganizationIdAndStatus(organizationId, SageConnection.Status.ACTIVE);
    }

    @Override
    public SageConnection newConnection() {
        return new SageConnection();
    }

    @Override
    public SageConnection save(SageConnection connection) {
        return repository.save(connection);
    }
}
