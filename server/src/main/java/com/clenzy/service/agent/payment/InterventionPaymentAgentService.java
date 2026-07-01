package com.clenzy.service.agent.payment;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.DeferredPaymentService;
import com.stripe.exception.StripeException;
import org.springframework.stereotype.Service;

/**
 * Pont agent → paiement des interventions impayées (ménages, maintenance).
 *
 * <p>Enveloppe {@link DeferredPaymentService} (flux Stripe Checkout groupé existant)
 * pour l'assistant : détecter les interventions non réglées et proposer leur règlement.</p>
 *
 * <p><b>Sécurité</b> : deux périmètres, tous deux org-scopés par le service sous-jacent.
 * (1) Par demandeur : le {@code hostId} est TOUJOURS résolu depuis le {@code keycloakId}
 * — jamais un paramètre — donc pas d'IDOR. (2) Par logement supervisé : le {@code propertyId}
 * vient du contexte UI de supervision (déjà borné à l'org de l'utilisateur).</p>
 */
@Service
public class InterventionPaymentAgentService {

    private final UserRepository userRepository;
    private final DeferredPaymentService deferredPaymentService;

    public InterventionPaymentAgentService(UserRepository userRepository,
                                           DeferredPaymentService deferredPaymentService) {
        this.userRepository = userRepository;
        this.deferredPaymentService = deferredPaymentService;
    }

    private Long requireUserId(String keycloakId) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalStateException("Utilisateur introuvable"));
        return user.getId();
    }

    /** Solde des interventions impayées du demandeur, groupé par logement (org-scopé). */
    public HostBalanceSummaryDto unpaidSummary(String keycloakId) {
        return deferredPaymentService.getHostBalance(requireUserId(keycloakId));
    }

    /**
     * Crée un lien Stripe Checkout groupé pour régler les interventions impayées du
     * demandeur. Lève {@link RuntimeException} s'il n'y en a aucune.
     */
    public String createPaymentLink(String keycloakId) throws StripeException {
        return deferredPaymentService.createGroupedPaymentSession(requireUserId(keycloakId));
    }

    /**
     * Solde des interventions impayées d'un LOGEMENT (scope « logement supervisé »),
     * quel que soit le demandeur. Org-scopé par le service sous-jacent.
     */
    public HostBalanceSummaryDto unpaidSummaryForProperty(Long propertyId) {
        return deferredPaymentService.getPropertyBalance(propertyId);
    }

    /**
     * Crée un lien Stripe Checkout groupé pour régler les interventions impayées d'un
     * LOGEMENT. Lève {@link RuntimeException} s'il n'y en a aucune.
     */
    public String createPaymentLinkForProperty(Long propertyId) throws StripeException {
        return deferredPaymentService.createPropertyPaymentSession(propertyId);
    }
}
