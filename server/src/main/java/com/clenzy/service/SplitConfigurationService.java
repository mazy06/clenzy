package com.clenzy.service;

import com.clenzy.dto.SplitConfigurationDto;
import com.clenzy.model.SplitConfiguration;
import com.clenzy.repository.SplitConfigurationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * CRUD des configurations de repartition (split platform/owner/concierge)
 * d'une organisation.
 *
 * <p>Toute resolution par id ({@code findById} contourne le filtre Hibernate)
 * est suivie d'une verification stricte d'appartenance a l'organisation
 * courante — comportement historique conserve (pas de bypass platform staff :
 * ces ecrans s'utilisent dans le contexte de l'org cible).</p>
 */
@Service
public class SplitConfigurationService {

    private final SplitConfigurationRepository repository;
    private final TenantContext tenantContext;

    public SplitConfigurationService(SplitConfigurationRepository repository,
                                     TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<SplitConfigurationDto> listConfigs() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findByOrganizationId(orgId).stream()
            .map(SplitConfigurationDto::from)
            .toList();
    }

    @Transactional
    public SplitConfigurationDto createConfig(SplitConfigurationDto request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        validateShares(request);

        SplitConfiguration config = new SplitConfiguration();
        config.setOrganizationId(orgId);
        config.setName(request.name());
        config.setOwnerShare(request.ownerShare());
        config.setPlatformShare(request.platformShare());
        config.setConciergeShare(request.conciergeShare());
        // null = champ absent du JSON : on conserve les defaults de l'entite
        // (isDefault=false, active=true), comme l'ancienne deserialisation directe.
        if (request.isDefault() != null) {
            config.setIsDefault(request.isDefault());
        }
        if (request.active() != null) {
            config.setActive(request.active());
        }
        return SplitConfigurationDto.from(repository.save(config));
    }

    @Transactional
    public SplitConfigurationDto updateConfig(Long id, SplitConfigurationDto update) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        SplitConfiguration existing = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("Split config not found: " + id));

        if (!existing.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Access denied");
        }

        validateShares(update);

        existing.setName(update.name());
        existing.setOwnerShare(update.ownerShare());
        existing.setPlatformShare(update.platformShare());
        existing.setConciergeShare(update.conciergeShare());
        existing.setIsDefault(update.isDefault());
        existing.setActive(update.active());

        return SplitConfigurationDto.from(repository.save(existing));
    }

    @Transactional
    public void deleteConfig(Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        SplitConfiguration existing = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("Split config not found: " + id));

        if (!existing.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Access denied");
        }

        if (Boolean.TRUE.equals(existing.getIsDefault())) {
            throw new RuntimeException("Cannot delete the default split configuration");
        }

        repository.delete(existing);
    }

    /**
     * Validates that the three shares sum to exactly 1.0000 (100%).
     */
    private void validateShares(SplitConfigurationDto config) {
        if (config.ownerShare() == null || config.platformShare() == null || config.conciergeShare() == null) {
            throw new RuntimeException("All shares (owner, platform, concierge) are required");
        }
        BigDecimal total = config.ownerShare()
            .add(config.platformShare())
            .add(config.conciergeShare());
        if (total.compareTo(BigDecimal.ONE) != 0) {
            throw new RuntimeException("Shares must sum to 1.0000 (100%). Current total: " + total);
        }
    }
}
