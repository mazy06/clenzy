package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/** Autorise le payeur avant toute lecture de statut ou création de session PSP. */
@Service
@Transactional(readOnly = true)
public class PaymentAccessService {
    private final UserService users;
    private final InterventionRepository interventions;
    private final ReservationRepository reservations;
    private final ServiceRequestRepository requests;
    private final InvoiceRepository invoices;
    private final TenantContext tenant;

    public PaymentAccessService(UserService users, InterventionRepository interventions,
            ReservationRepository reservations, ServiceRequestRepository requests,
            InvoiceRepository invoices, TenantContext tenant) {
        this.users = users;
        this.interventions = interventions;
        this.reservations = reservations;
        this.requests = requests;
        this.invoices = invoices;
        this.tenant = tenant;
    }

    public void requireInterventions(List<Long> ids, Jwt jwt) {
        User caller = caller(jwt);
        if (ids == null || ids.isEmpty() || !ids.stream().allMatch(id -> intervention(id, caller))) {
            throw new AccessDeniedException("Paiement inaccessible pour ce compte");
        }
    }

    public void requireServiceRequest(Long id, Jwt jwt) {
        User caller = caller(jwt);
        if (id == null || requests.findById(id).filter(r -> request(r, caller)).isEmpty()) {
            throw new AccessDeniedException("Paiement inaccessible pour ce compte");
        }
    }

    public void requireInvoice(Long id, Jwt jwt) {
        User caller = caller(jwt);
        if (id == null || invoices.findById(id).filter(i -> sameOrg(i.getOrganizationId())
                && (caller.getRole().isPlatformStaff() || invoice(i, caller))).isEmpty()) {
            throw new AccessDeniedException("Facture inaccessible pour ce compte");
        }
    }

    public boolean canReadSession(String sessionId, Jwt jwt) {
        User caller = caller(jwt);
        List<Intervention> missions = interventions.findAllByStripeSessionIdAndOrganizationId(
                sessionId, tenant.getRequiredOrganizationId());
        // Une session partagée n'est visible que si toutes ses lignes sont autorisées.
        if (!missions.isEmpty()) return missions.stream().allMatch(i -> intervention(i, caller));
        var reservation = reservations.findByStripeSessionId(sessionId);
        if (reservation.isPresent()) return reservation(reservation.get(), caller);
        return requests.findByStripeSessionId(sessionId).filter(r -> request(r, caller)).isPresent();
    }

    public boolean canReadTransaction(PaymentTransaction tx, Jwt jwt) {
        User caller = caller(jwt);
        if (!sameOrg(tx.getOrganizationId())) return false;
        if (caller.getRole().isPlatformStaff()) return true;
        if (tx.getSourceType() == null || tx.getSourceId() == null) return false;
        return switch (tx.getSourceType()) {
            case "INTERVENTION", "INTERVENTION_BATCH", "DEFERRED_INTERVENTIONS_HOST", "DEFERRED_INTERVENTIONS_PROPERTY" ->
                    interventionTransaction(tx, caller);
            case "RESERVATION", "BOOKING_CHECKOUT", "BOOKING_BALANCE" ->
                    reservations.findById(tx.getSourceId()).filter(r -> reservation(r, caller)).isPresent();
            case "SERVICE_REQUEST" ->
                    requests.findById(tx.getSourceId()).filter(r -> request(r, caller)).isPresent();
            case "INVOICE" -> invoices.findById(tx.getSourceId()).filter(i -> invoice(i, caller)).isPresent();
            default -> false;
        };
    }

    private boolean interventionTransaction(PaymentTransaction tx, User caller) {
        Object ids = tx.getMetadata() == null ? null : tx.getMetadata().get("interventionIds");
        if (ids == null && tx.getMetadata() != null) ids = tx.getMetadata().get("intervention_ids");
        if (ids == null) return "INTERVENTION".equals(tx.getSourceType()) && intervention(tx.getSourceId(), caller);
        try {
            String value = ids.toString();
            return !value.isBlank() && Arrays.stream(value.split(",", -1))
                    .map(String::trim).map(Long::valueOf).allMatch(id -> intervention(id, caller));
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean invoice(Invoice invoice, User caller) {
        if (!sameOrg(invoice.getOrganizationId())) return false;
        if (invoice.getInterventionId() != null) return intervention(invoice.getInterventionId(), caller);
        return invoice.getReservationId() != null && reservations.findById(invoice.getReservationId())
                .filter(r -> reservation(r, caller)).isPresent();
    }

    private boolean intervention(Long id, User caller) {
        return id != null && interventions.findById(id).filter(i -> intervention(i, caller)).isPresent();
    }

    private boolean intervention(Intervention mission, User caller) {
        return sameOrg(mission.getOrganizationId()) && (caller.getRole().isPlatformStaff()
                || owns(caller, mission.getRequestor()));
    }

    private boolean reservation(Reservation reservation, User caller) {
        return sameOrg(reservation.getOrganizationId()) && (caller.getRole().isPlatformStaff()
                || reservation.getProperty() != null && owns(caller, reservation.getProperty().getOwner()));
    }

    private boolean request(ServiceRequest request, User caller) {
        return sameOrg(request.getOrganizationId()) && (caller.getRole().isPlatformStaff()
                || owns(caller, request.getUser()));
    }

    private boolean owns(User caller, User payor) {
        return caller.getRole().isOwnerScoped() && payor != null
                && Objects.equals(caller.getId(), payor.getId());
    }

    private boolean sameOrg(Long organizationId) {
        return organizationId != null && organizationId.equals(tenant.getRequiredOrganizationId());
    }

    private User caller(Jwt jwt) {
        User user = jwt == null ? null : users.findByKeycloakId(jwt.getSubject());
        if (user == null || user.getId() == null || user.getRole() == null) {
            throw new AccessDeniedException("Compte de paiement non identifié");
        }
        return user;
    }
}
