package com.clenzy.service;

import com.clenzy.dto.UnpaidServiceRequestCardDto;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.ServiceType;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Cartes déterministes « demandes de service impayées » d'un logement, pour la
 * constellation du Superviseur (module Finance). Une carte par {@link ServiceRequest}
 * non réglée — calcul serveur, sans scan LLM.
 *
 * <p>Read-only + org-scopé (le filtre {@code organizationId} de la requête borne à
 * l'org du demandeur ; un logement d'une autre org renvoie une liste vide).</p>
 */
@Service
public class UnpaidServiceRequestCardService {

    private final ServiceRequestRepository serviceRequestRepository;
    private final TenantContext tenantContext;

    public UnpaidServiceRequestCardService(ServiceRequestRepository serviceRequestRepository,
                                           TenantContext tenantContext) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<UnpaidServiceRequestCardDto> forProperty(Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return serviceRequestRepository.findUnpaidByProperty(propertyId, orgId).stream()
                .map(this::toCard)
                .toList();
    }

    /**
     * Nb de cartes « demande de service impayée » PAR logement pour une org
     * (pastilles planning). Une seule requête agrégée, {@code [propertyId, count]}.
     */
    @Transactional(readOnly = true)
    public java.util.Map<Long, Long> pendingCountsByProperty(Long organizationId) {
        java.util.Map<Long, Long> byProperty = new java.util.LinkedHashMap<>();
        for (Object[] row : serviceRequestRepository.countUnpaidByPropertyForOrg(organizationId)) {
            byProperty.put((Long) row[0], (Long) row[1]);
        }
        return byProperty;
    }

    private UnpaidServiceRequestCardDto toCard(ServiceRequest sr) {
        String title = sr.getTitle() != null ? sr.getTitle().trim() : "";
        ServiceType type = sr.getServiceType();
        // Famille structurée (jamais de texte utilisateur ici) : le front en déduit
        // le préfixe traduit (« Maintenance … »/« Ménage … ») selon la langue.
        String category = (type != null && type.isCleaningService()) ? "cleaning" : "maintenance";
        return new UnpaidServiceRequestCardDto(
                "service-request-" + sr.getId(),
                sr.getId(),
                title,
                category,
                sr.getEstimatedCost());
    }
}
