package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.Reservation;
import com.clenzy.repository.OnlineCheckInRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Voyageurs qui arrivent demain sans avoir commencé leur check-in.
 *
 * <p>Le lien est envoyé, puis plus rien : ni relance, ni signal. On le découvre
 * à l'arrivée, quand il faut saisir les pièces d'identité à la main et que
 * l'obligation déclarative n'est plus tenable dans les délais.</p>
 *
 * <p>L'urgence vient de la date d'<b>arrivée</b>, pas de celle du check-in :
 * c'est pourquoi la requête joint la réservation.</p>
 */
@Component
public class OnlineCheckInActionSource implements ActionItemSource {

    /** Au-delà, il reste du temps ; en deçà, l'arrivée se prépare aujourd'hui. */
    private static final int ARRIVAL_HORIZON_DAYS = 2;

    private final OnlineCheckInRepository onlineCheckInRepository;

    public OnlineCheckInActionSource(OnlineCheckInRepository onlineCheckInRepository) {
        this.onlineCheckInRepository = onlineCheckInRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.CHECKIN_NOT_STARTED);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return onlineCheckInRepository.findNotStartedBeforeArrival(
                        ctx.organizationId(),
                        ctx.today(),
                        ctx.today().plusDays(ARRIVAL_HORIZON_DAYS))
                .stream()
                .filter(checkIn -> ctx.covers(checkIn.getReservation().getProperty()))
                .map(checkIn -> {
                    final Reservation reservation = checkIn.getReservation();
                    return new ActionItemDto(
                            "checkin:" + checkIn.getId(),
                            ActionItemKind.CHECKIN_NOT_STARTED,
                            "warning",
                            ActionItems.firstNonBlank(reservation.getGuestName(),
                                    "RES-" + reservation.getId()),
                            "Arrivée le " + reservation.getCheckIn(),
                            reservation.getGuestName(),
                            reservation.getId(),
                            ActionItems.propertyId(reservation.getProperty()),
                            ActionItems.propertyName(reservation.getProperty()),
                            null,
                            null,
                            null,
                            null);
                })
                .toList();
    }


}
