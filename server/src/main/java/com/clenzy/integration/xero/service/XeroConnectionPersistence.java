package com.clenzy.integration.xero.service;

import com.clenzy.integration.oauth.OAuthConnectionPersistence;
import com.clenzy.integration.xero.model.XeroConnection;
import com.clenzy.integration.xero.repository.XeroConnectionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@ConditionalOnProperty(name = "clenzy.xero.client-id")
public class XeroConnectionPersistence implements OAuthConnectionPersistence<XeroConnection> {

    private final XeroConnectionRepository repository;

    public XeroConnectionPersistence(XeroConnectionRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<XeroConnection> findByOrganizationId(Long organizationId) {
        return repository.findByOrganizationId(organizationId);
    }

    @Override
    public Optional<XeroConnection> findActiveByOrganizationId(Long organizationId) {
        return repository.findByOrganizationIdAndStatus(organizationId, XeroConnection.Status.ACTIVE);
    }

    @Override
    public XeroConnection newConnection() {
        return new XeroConnection();
    }

    @Override
    public XeroConnection save(XeroConnection connection) {
        return repository.save(connection);
    }
}
