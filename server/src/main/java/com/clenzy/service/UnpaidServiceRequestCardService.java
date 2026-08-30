package com.clenzy.service;

import com.clenzy.dto.UnpaidServiceRequestCardDto;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.ServiceQuote;
import com.clenzy.model.ServiceType;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ServiceQuoteRepository;
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
    private final InterventionRepository interventionRepository;
    private final ServiceQuoteRepository serviceQuoteRepository;
    private final TenantContext tenantContext;

    public UnpaidServiceRequestCardService(ServiceRequestRepository serviceRequestRepository,
                                           InterventionRepository interventionRepository,
                                           ServiceQuoteRepository serviceQuoteRepository,
                                           TenantContext tenantContext) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.interventionRepository = interventionRepository;
        this.serviceQuoteRepository = serviceQuoteRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Les demandes qui appellent un paiement, à l'une ou l'autre échéance.
     *
     * <p><b>Une carte, deux moments.</b> L'acompte se règle AVANT les travaux —
     * l'intervenant bloque sa date à réception —, le solde APRÈS, quand la
     * prestation devient facturable. Les deux ne se recouvrent jamais : une même
     * demande ne peut donc produire qu'une carte à la fois.</p>
     */
    @Transactional(readOnly = true)
    public List<UnpaidServiceRequestCardDto> forProperty(Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        final List<UnpaidServiceRequestCardDto> cards = new java.util.ArrayList<>();
        for (ServiceRequest sr : serviceRequestRepository.findDepositDueByProperty(propertyId, orgId)) {
            cards.add(toDepositCard(sr));
        }
        for (ServiceRequest sr : serviceRequestRepository.findUnpaidByProperty(propertyId, orgId)) {
            cards.add(toCard(sr));
        }
        return cards;
    }

    /**
     * Carte d'échéance « acompte » : ce qu'il faut verser pour que le chantier
     * démarre, pas le total du devis.
     */
    private UnpaidServiceRequestCardDto toDepositCard(ServiceRequest sr) {
        final ServiceQuote quote = approvedQuoteWithDeposit(sr);
        final Long interventionId = interventionRepository.findIdByServiceRequestId(sr.getId());
        return new UnpaidServiceRequestCardDto(
                "service-request-" + sr.getId(),
                sr.getId(),
                sr.getTitle() != null ? sr.getTitle().trim() : "",
                categoryOf(sr),
                // Le montant APPELÉ est l'acompte : c'est lui qu'on demande de
                // verser maintenant. Le total viendra à l'échéance suivante.
                quote == null ? null : quote.getDepositAmount(),
                quote == null ? null : quote.getDepositAmount(),
                false,
                UnpaidServiceRequestCardDto.STAGE_DEPOSIT,
                interventionId);
    }

    /** Famille structurée (jamais de texte utilisateur) → préfixe i18n au rendu. */
    private static String categoryOf(ServiceRequest sr) {
        final ServiceType type = sr.getServiceType();
        return (type != null && type.isCleaningService()) ? "cleaning" : "maintenance";
    }

    /**
     * Nb de cartes « demande de service impayée » PAR logement pour une org
     * (pastilles planning). Une seule requête agrégée, {@code [propertyId, count]}.
     */
    @Transactional(readOnly = true)
    public java.util.Map<Long, Long> pendingCountsByProperty(Long organizationId) {
        java.util.Map<Long, Long> byProperty = new java.util.LinkedHashMap<>();
        // Les acomptes comptent aussi : sans eux, la pastille annoncerait moins de
        // cartes que la file n'en affiche — l'ecart le plus deroutant qui soit.
        for (Object[] row : serviceRequestRepository.countDepositDueByPropertyForOrg(organizationId)) {
            byProperty.merge((Long) row[0], (Long) row[1], Long::sum);
        }
        for (Object[] row : serviceRequestRepository.countUnpaidByPropertyForOrg(organizationId)) {
            byProperty.merge((Long) row[0], (Long) row[1], Long::sum);
        }
        return byProperty;
    }

    /** Carte d'échéance « solde » : le reste dû, une fois la prestation facturable. */
    private UnpaidServiceRequestCardDto toCard(ServiceRequest sr) {
        final ServiceQuote deposit = approvedQuoteWithDeposit(sr);
        return new UnpaidServiceRequestCardDto(
                "service-request-" + sr.getId(),
                sr.getId(),
                sr.getTitle() != null ? sr.getTitle().trim() : "",
                categoryOf(sr),
                sr.getEstimatedCost(),
                deposit == null ? null : deposit.getDepositAmount(),
                deposit != null && deposit.getDepositPaidAt() != null,
                UnpaidServiceRequestCardDto.STAGE_BALANCE,
                null);
    }

    /**
     * Acompte exigible sur le chantier de cette demande.
     *
     * <p>Il était porté par une carte SÉPARÉE, sur un autre agent : l'exploitant
     * voyait « Régler 220 € » d'un côté et « Acompte à régler 40 € » de l'autre,
     * pour le même chantier — sans que rien ne dise que les 40 font partie des
     * 220. Régler l'un laissait l'autre en place.</p>
     *
     * <p>L'acompte rejoint donc la carte de paiement, comme une étape de son
     * échéancier. {@code null} si le chantier n'en demande pas.</p>
     */
    private ServiceQuote approvedQuoteWithDeposit(ServiceRequest sr) {
        final Long interventionId = interventionRepository.findIdByServiceRequestId(sr.getId());
        if (interventionId == null) {
            return null;
        }
        return serviceQuoteRepository
                .findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                        interventionId, sr.getOrganizationId())
                .stream()
                .filter(q -> q.getStatus() == ServiceQuote.Status.APPROVED)
                .filter(q -> q.getDepositAmount() != null
                        && q.getDepositAmount().compareTo(java.math.BigDecimal.ZERO) > 0)
                .findFirst()
                .orElse(null);
    }
}
