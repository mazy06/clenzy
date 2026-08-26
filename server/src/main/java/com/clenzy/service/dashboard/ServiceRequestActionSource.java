package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Les deux impasses d'une demande de service.
 *
 * <p><b>Impayée</b> — le travail est fait, la facture attend. <b>Sans
 * prestataire</b> — c'est l'urgence réelle : le ménage n'aura pas lieu. La
 * seconde n'apparaissait nulle part, parce que la liste des impayées ne montre
 * que les prestations facturables, or une prestation sans prestataire ne le
 * sera jamais.</p>
 */
@Component
public class ServiceRequestActionSource implements ActionItemSource {

    /**
     * Délai avant de considérer qu'une prestation ne trouvera pas preneur seule.
     *
     * <p>Un cycle du planificateur d'assignation ({@code AutoAssignScheduler},
     * toutes les 15 min) : au-delà, la recherche automatique a eu sa chance.</p>
     *
     * <p>Partagé avec la carte de constellation « demande sans prestataire »
     * ({@code OpsMaintenanceScanner}) : les deux surfaces montrent le MÊME
     * signal, elles ne peuvent donc pas diverger sur le seuil.</p>
     */
    public static final int ASSIGNMENT_GRACE_MINUTES = 15;

    private final ServiceRequestRepository serviceRequestRepository;

    public ServiceRequestActionSource(ServiceRequestRepository serviceRequestRepository) {
        this.serviceRequestRepository = serviceRequestRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.SERVICE_UNPAID, ActionItemKind.SERVICE_UNASSIGNED);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();

        serviceRequestRepository.findUnpaidForOrg(ctx.organizationId()).stream()
                .filter(request -> ctx.covers(request.getProperty()))
                .map(request -> item(request, ActionItemKind.SERVICE_UNPAID, "warning"))
                .forEach(items::add);

        serviceRequestRepository.findStuckUnassignedForOrg(
                        ctx.organizationId(),
                        ctx.nowDateTime().minusMinutes(ASSIGNMENT_GRACE_MINUTES))
                .stream()
                .filter(request -> ctx.covers(request.getProperty()))
                // Une date déjà passée ne se rattrape pas ; une recherche épuisée
                // attend un geste mais la date tient encore.
                .map(request -> item(request, ActionItemKind.SERVICE_UNASSIGNED,
                        request.getDesiredDate() != null
                                && request.getDesiredDate().isBefore(ctx.nowDateTime())
                                ? "critical" : "warning"))
                .forEach(items::add);

        return items;
    }

    private static ActionItemDto item(ServiceRequest request, ActionItemKind kind, String severity) {
        return new ActionItemDto(
                (kind == ActionItemKind.SERVICE_UNPAID ? "service:" : "unassigned:") + request.getId(),
                kind,
                severity,
                request.getTitle(),
                ActionItems.propertyName(request.getProperty()),
                null,
                request.getId(),
                ActionItems.propertyId(request.getProperty()),
                ActionItems.propertyName(request.getProperty()),
                // Le coût est déjà calculé (moteur ménage, devis) : le taire ferait
                // perdre l'ordre de grandeur de l'enjeu.
                request.getEstimatedCost(),
                null, null, null);
    }
}
