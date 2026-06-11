package com.clenzy.service;

import com.clenzy.model.OrgIntegrationConfig;
import com.clenzy.repository.OrgIntegrationConfigRepository;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Configuration cross-provider des integrations de l'organisation (choix du
 * provider actif par type de service : signature, et plus tard facturation,
 * comptabilite). Logique deplacee depuis {@code IntegrationsConfigController}
 * (refactor T-ARCH-01 — controller mince).
 *
 * <p>Scope organisation : resolu via le {@link TenantContext} du requester.</p>
 */
@Service
public class OrgIntegrationConfigService {

    private static final Logger log = LoggerFactory.getLogger(OrgIntegrationConfigService.class);

    private final OrgIntegrationConfigRepository repository;
    private final TenantContext tenantContext;

    public OrgIntegrationConfigService(OrgIntegrationConfigRepository repository,
                                       TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    /** Provider de signature actif de l'organisation courante, ou {@code null}. */
    @Transactional(readOnly = true)
    public SignatureProviderType getSignatureProvider() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findByOrganizationId(orgId)
                .map(OrgIntegrationConfig::getSignatureProvider)
                .orElse(null);
    }

    /**
     * Upsert du provider de signature actif pour l'organisation courante.
     * {@code null} = signature desactivee pour cette organisation.
     */
    @Transactional
    public SignatureProviderType setSignatureProvider(SignatureProviderType provider) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.info("Set signature provider for org {} → {}", orgId, provider);

        OrgIntegrationConfig config = repository.findByOrganizationId(orgId)
                .orElseGet(() -> {
                    OrgIntegrationConfig c = new OrgIntegrationConfig();
                    c.setOrganizationId(orgId);
                    c.setCreatedAt(Instant.now());
                    return c;
                });
        config.setSignatureProvider(provider);
        config.setUpdatedAt(Instant.now());
        repository.save(config);
        return provider;
    }
}
