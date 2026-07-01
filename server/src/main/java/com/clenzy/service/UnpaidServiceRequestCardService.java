package com.clenzy.service;

import com.clenzy.dto.UnpaidServiceRequestCardDto;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    private UnpaidServiceRequestCardDto toCard(ServiceRequest sr) {
        BigDecimal amount = sr.getEstimatedCost();
        String label = sr.getTitle() != null && !sr.getTitle().isBlank()
                ? sr.getTitle() : "Demande de service";
        String amountStr = amount != null ? amount.stripTrailingZeros().toPlainString() : "—";
        return new UnpaidServiceRequestCardDto(
                "service-request-" + sr.getId(),
                sr.getId(),
                label,
                "Montant à régler : " + amountStr + " €",
                "Cette demande de service (" + label + ") n'est pas réglée. « Régler » ouvre le "
                        + "paiement Stripe sécurisé — aucun débit sans ta validation sur la page Stripe.",
                amount);
    }
}
