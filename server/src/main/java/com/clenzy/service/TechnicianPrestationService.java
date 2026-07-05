package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto.ServicePriceConfig;
import com.clenzy.model.TechnicianPrestation;
import com.clenzy.model.User;
import com.clenzy.repository.TechnicianPrestationRepository;
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
 * prestations + prix. Toujours scopé (organisation courante via TenantContext,
 * utilisateur résolu depuis le JWT) — jamais partagé entre techniciens.
 */
@Service
public class TechnicianPrestationService {

    private final TechnicianPrestationRepository repository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;
    private final PricingConfigService pricingConfigService;

    public TechnicianPrestationService(TechnicianPrestationRepository repository,
                                       UserRepository userRepository,
                                       TenantContext tenantContext,
                                       PricingConfigService pricingConfigService) {
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
        return repository.findByOrganizationIdAndUserIdOrderByInterventionTypeAsc(orgId, userId).stream()
                .map(e -> new ServicePriceConfig(e.getInterventionType(), e.getBasePrice(), e.isEnabled()))
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
                if (item.getBasePrice() != null && (item.getBasePrice() < 0 || item.getBasePrice() > 1_000_000)) {
                    throw new IllegalArgumentException("basePrice hors limites (0-1000000)");
                }
                byType.put(item.getInterventionType(), item);
            }
        }

        repository.deleteByOrganizationIdAndUserId(orgId, userId);
        repository.flush();

        List<TechnicianPrestation> toSave = new ArrayList<>();
        for (ServicePriceConfig item : byType.values()) {
            TechnicianPrestation e = new TechnicianPrestation();
            e.setOrganizationId(orgId);
            e.setUserId(userId);
            e.setInterventionType(item.getInterventionType());
            e.setBasePrice(item.getBasePrice());
            e.setEnabled(item.isEnabled());
            toSave.add(e);
        }
        repository.saveAll(toSave);

        return getMine(keycloakId);
    }

    /** Ids des techniciens de l'org qui proposent au moins un des types donnés (P2). */
    @Transactional(readOnly = true)
    public List<Long> findUsersOffering(Collection<String> interventionTypes) {
        if (interventionTypes == null || interventionTypes.isEmpty()) {
            return List.of();
        }
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findUserIdsOffering(orgId, interventionTypes);
    }

    /** Prestations (actives) d'un technicien donné — pour appliquer ses tarifs (P3). */
    @Transactional(readOnly = true)
    public List<ServicePriceConfig> getForUser(Long userId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findByOrganizationIdAndUserIdOrderByInterventionTypeAsc(orgId, userId).stream()
                .filter(TechnicianPrestation::isEnabled)
                .map(e -> new ServicePriceConfig(e.getInterventionType(), e.getBasePrice(), e.isEnabled()))
                .toList();
    }

    private Long resolveUserId(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .map(User::getId)
                .orElseThrow(() -> new IllegalStateException("Utilisateur introuvable pour keycloakId " + keycloakId));
    }
}
