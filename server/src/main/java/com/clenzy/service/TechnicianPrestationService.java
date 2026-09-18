package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto.ServicePriceConfig;
import com.clenzy.model.ProviderTariff;
import com.clenzy.model.InterventionType;
import com.clenzy.marketplace.model.PricingModel;
import com.clenzy.service.pricing.ProviderTariffService;
import com.clenzy.repository.ProviderTariffRepository;
import java.math.BigDecimal;
import com.clenzy.model.User;

import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Surcouche « travaux » par technicien : chaque utilisateur gère SES propres
 * prestations et tarifs uniques, communs à tous ses clients.
 * L’identité de l’écrivain est résolue depuis le JWT.
 */
@Service
public class TechnicianPrestationService {

    private final ProviderTariffRepository repository;
    private final ProviderTariffService tariffs;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;
    private final PricingConfigService pricingConfigService;

    public TechnicianPrestationService(ProviderTariffRepository repository,
                                       UserRepository userRepository,
                                       TenantContext tenantContext,
                                       PricingConfigService pricingConfigService, ProviderTariffService tariffs) {
        this.tariffs = tariffs;
        this.repository = repository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
        this.pricingConfigService = pricingConfigService;
    }

    /**
     * Catalogue org (services actifs) pré-listé au technicien pour qu'il pose ses
     * prix sur l'existant plutôt que de partir d'une liste vide. On expose
     * libellé/domaine/type — pas les prix de base de l'org.
     */
    @Transactional(readOnly = true)
    public List<ServicePriceConfig> getCatalogue() {
        List<ServicePriceConfig> travaux = pricingConfigService.getCurrentConfig().getTravauxConfig();
        if (travaux == null) {
            return List.of();
        }
        return travaux.stream()
                .filter(ServicePriceConfig::isEnabled)
                .map(s -> {
                    ServicePriceConfig c = new ServicePriceConfig(s.getInterventionType(), null, true);
                    c.setLabel(s.getLabel());
                    c.setDomain(s.getDomain());
                    return c;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ServicePriceConfig> getMine(String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = resolveUserId(keycloakId);
        return repository.findByUserIdOrderByServiceKeyAsc(userId).stream()
                .filter(e -> e.getPricingModel() == PricingModel.FLAT || e.getPricingModel() == PricingModel.ON_QUOTE)
                .map(this::toConfig)
                .toList();
    }

    /**
     * Remplace intégralement la liste du technicien courant (delete + re-insert).
     * Dédupliqué par type (le dernier gagne). Prix non négatifs.
     */
    @Transactional
    public List<ServicePriceConfig> updateMine(String keycloakId, List<ServicePriceConfig> items) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = resolveUserId(keycloakId);

        // Dédup par interventionType (payload potentiellement redondant) + validation.
        Map<String, ServicePriceConfig> byType = new LinkedHashMap<>();
        if (items != null) {
            for (ServicePriceConfig item : items) {
                if (item == null || item.getInterventionType() == null || item.getInterventionType().isBlank()) {
                    continue;
                }
                if (item.getBasePrice() != null && (!Double.isFinite(item.getBasePrice()) || item.getBasePrice() < 0 || item.getBasePrice() > 1_000_000)) {
                    throw new IllegalArgumentException("basePrice hors limites (0-1000000)");
                }
                byType.put(item.getInterventionType(), item);
            }
        }

        repository.lockUser(userId);
        // Désactiver les prestations retirées conserve les références des offres et des devis.
        for (ProviderTariff existing : repository.findByUserIdOrderByServiceKeyAsc(userId)) {
            if (!byType.containsKey(typeForKey(existing.getServiceKey())) && (existing.getPricingModel() == PricingModel.FLAT || existing.getPricingModel() == PricingModel.ON_QUOTE)) {
                existing.setEnabled(false);
                repository.save(existing);
            }
        }
        for (ServicePriceConfig item : byType.values()) {
            String key = tariffs.keyForType(item.getInterventionType());
            String currency = item.getCurrency() != null ? item.getCurrency() : repository.findByUserIdAndServiceKey(userId, key)
                    .map(ProviderTariff::getCurrency).orElse("EUR");
            tariffs.set(userId, key, PricingModel.FLAT,
                    item.getBasePrice() == null ? null : BigDecimal.valueOf(item.getBasePrice()),
                    currency, item.isEnabled());
        }

        return getMine(keycloakId);
    }

    /** Ids des techniciens de l'org qui proposent au moins un des types donnés (P2). */
    @Transactional(readOnly = true)
    public List<Long> findUsersOffering(Collection<String> interventionTypes) {
        if (interventionTypes == null || interventionTypes.isEmpty()) {
            return List.of();
        }
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findOfferingInOrganization(orgId, interventionTypes.stream().map(tariffs::keyForType).toList());
    }

    /** Prestations (actives) d'un technicien donné — pour appliquer ses tarifs (P3). */
    @Transactional(readOnly = true)
    public List<ServicePriceConfig> getForUser(Long userId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (!repository.belongsToOrganization(userId, orgId))
            throw new org.springframework.security.access.AccessDeniedException("Prestataire hors de votre organisation");
        return repository.findByUserIdOrderByServiceKeyAsc(userId).stream()
                .filter(ProviderTariff::isEnabled)
                .filter(e -> e.getPricingModel() == PricingModel.FLAT || e.getPricingModel() == PricingModel.ON_QUOTE)
                .map(this::toConfig)
                .toList();
    }

    private ServicePriceConfig toConfig(ProviderTariff tariff) {
        var dto = new ServicePriceConfig(typeForKey(tariff.getServiceKey()),
                tariff.getAmount() == null ? null : tariff.getAmount().doubleValue(), tariff.isEnabled());
        dto.setCurrency(tariff.getCurrency());
        dto.setNeedsReview(tariff.isNeedsReview());
        return dto;
    }

    private String typeForKey(String key) { return tariffs.legacyTypeForKey(key); }

    private Long resolveUserId(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .map(User::getId)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Compte prestataire introuvable"));
    }
}
