package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.ReservationService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Confirmer une réservation restée en attente.
 *
 * <p>Passe par le chemin qui réserve les jours au calendrier et refuse un
 * conflit. Poser le statut à la main aurait produit exactement la
 * surréservation que tout le reste du système s'emploie à éviter — seules les
 * réservations confirmées bloquent le calendrier.</p>
 */
@Component
public class ConfirmReservationHandler implements ActionGestureHandler {

    private final ReservationService reservationService;

    public ConfirmReservationHandler(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @Override
    public String action() {
        return "confirm";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.RESERVATION_PENDING);
    }

    @Override
    public void handle(GestureContext context) {
        reservationService.confirm(context.targetId(), context.actorId());
    }
}
