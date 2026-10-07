package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Contexte Baitly des confirmations Stripe historiques, avant leur transaction.
 * Le tenant vient de la ressource liée à la session en base, jamais de metadata.orgId.
 * Le scope reste actif jusqu'au commit (ledger, répartition, documents, notifications).
 */
@Component
public class StripeWebhookTenantScope {
    private final InterventionRepository interventions;
    private final ReservationRepository reservations;
    private final ServiceRequestRepository requests;
    private final TenantScopedExecutor tenants;

    public StripeWebhookTenantScope(InterventionRepository interventions,
            ReservationRepository reservations, ServiceRequestRepository requests,
            TenantScopedExecutor tenants) {
        this.interventions = interventions;
        this.reservations = reservations;
        this.requests = requests;
        this.tenants = tenants;
    }

    public void forIntervention(String sessionId, Runnable action) {
        var mission = interventions.findByStripeSessionId(sessionId)
                .orElseThrow(() -> new NotFoundException("Session d'intervention introuvable"));
        tenants.runAsOrganization(mission.getOrganizationId(), action);
    }

    public void forReservation(String sessionId, Runnable action) {
        var reservation = reservations.findByStripeSessionId(sessionId)
                .orElseThrow(() -> new NotFoundException("Session de réservation introuvable"));
        tenants.runAsOrganization(reservation.getOrganizationId(), action);
    }

    public void forServiceRequest(String sessionId, Runnable action) {
        var request = requests.findByStripeSessionId(sessionId)
                .orElseThrow(() -> new NotFoundException("Session de demande de service introuvable"));
        tenants.runAsOrganization(request.getOrganizationId(), action);
    }

    public void forGroupedInterventions(String sessionId, String interventionIds, Runnable action) {
        if (sessionId == null || sessionId.isBlank() || interventionIds == null || interventionIds.isBlank()) {
            throw new IllegalArgumentException("Session et interventions requises pour le paiement groupé");
        }
        Long organizationId = null;
        for (String value : interventionIds.split(",", -1)) {
            long id = Long.parseLong(value.trim());
            if (id <= 0) throw new IllegalArgumentException("Identifiant d'intervention invalide");
            var mission = interventions.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention du paiement groupé introuvable"));
            if (!sessionId.equals(mission.getStripeSessionId()) || mission.getOrganizationId() == null
                    || (organizationId != null && !Objects.equals(organizationId, mission.getOrganizationId()))) {
                throw new IllegalStateException("Le paiement groupé ne correspond pas à une seule organisation");
            }
            organizationId = mission.getOrganizationId();
        }
        tenants.runAsOrganization(organizationId, action);
    }
}
