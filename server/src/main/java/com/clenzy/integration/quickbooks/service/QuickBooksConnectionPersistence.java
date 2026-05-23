package com.clenzy.integration.quickbooks.service;

import com.clenzy.integration.oauth.OAuthConnectionPersistence;
import com.clenzy.integration.quickbooks.model.QuickBooksConnection;
import com.clenzy.integration.quickbooks.repository.QuickBooksConnectionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Adaptateur QuickBooks vers {@link OAuthConnectionPersistence}.
 * Permet au moteur OAuth de manipuler des QuickBooksConnection sans coupling
 * direct au repository (Dependency Inversion).
 */
@Component
@ConditionalOnProperty(name = "clenzy.quickbooks.client-id")
public class QuickBooksConnectionPersistence implements OAuthConnectionPersistence<QuickBooksConnection> {

    private final QuickBooksConnectionRepository repository;

    public QuickBooksConnectionPersistence(QuickBooksConnectionRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<QuickBooksConnection> findByOrganizationId(Long organizationId) {
        return repository.findByOrganizationId(organizationId);
    }

    @Override
    public Optional<QuickBooksConnection> findActiveByOrganizationId(Long organizationId) {
        return repository.findByOrganizationIdAndStatus(organizationId, QuickBooksConnection.Status.ACTIVE);
    }

    @Override
    public QuickBooksConnection newConnection() {
        return new QuickBooksConnection();
    }

    @Override
    public QuickBooksConnection save(QuickBooksConnection connection) {
        return repository.save(connection);
    }
}
