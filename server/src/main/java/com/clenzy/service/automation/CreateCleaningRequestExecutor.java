package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Reservation;
import com.clenzy.service.ServiceRequestService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * Executeur {@code CREATE_CLEANING_REQUEST} du moteur AutomationRule (fiche 08,
 * F1a) : cree la demande de menage post-checkout d'une reservation confirmee
 * (trigger RESERVATION_BOOKED).
 *
 * <p>Sujet attendu : TYPE_RESERVATION. Le contexte privilegie
 * {@code ctx.reservation()} (resolue par le moteur — seule source sur le chemin
 * draine, ou {@code ctx.data()} est vide) et se replie sur les donnees du
 * declenchement posees par le capteur calendrier.</p>
 *
 * <p>Toute la logique metier (frequence menage AFTER_EACH_STAY de la propriete,
 * validation d'organisation, cle d'idempotence propriete x dates en filet sous
 * l'idempotence generique du moteur, auto-assignation, notification) vit dans
 * {@link ServiceRequestService#createAutomaticCleaningRequest}.</p>
 */
@Service
public class CreateCleaningRequestExecutor implements AutomationActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(CreateCleaningRequestExecutor.class);

    private final ServiceRequestService serviceRequestService;

    public CreateCleaningRequestExecutor(ServiceRequestService serviceRequestService) {
        this.serviceRequestService = serviceRequestService;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.CREATE_CLEANING_REQUEST;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        StayReference stay = StayReference.from(ctx);
        if (stay == null) {
            // Regle mal cablée ou contexte inexploitable : echec explicite.
            throw new IllegalStateException("CREATE_CLEANING_REQUEST attend un sujet "
                + AutomationSubject.TYPE_RESERVATION + " resoluble (recu : "
                + ctx.subjectType() + "#" + ctx.subjectId() + ")");
        }

        var outcome = serviceRequestService.createAutomaticCleaningRequest(
            ctx.orgId(), stay.propertyId(), stay.checkIn(), stay.checkOut(), stay.reservationId());
        if (outcome.executed()) {
            log.info("CREATE_CLEANING_REQUEST: demande {} creee (regle {}, reservation {})",
                outcome.request().getId(), rule.getId(), stay.reservationId());
            return ExecutionResult.executed();
        }
        return ExecutionResult.skipped(outcome.skipReason());
    }

    /**
     * Reference de sejour (propriete + dates + reservation) extraite du contexte :
     * reservation resolue par le moteur en priorite, donnees du capteur en repli.
     */
    record StayReference(Long propertyId, LocalDate checkIn, LocalDate checkOut, Long reservationId) {

        static StayReference from(AutomationActionContext ctx) {
            Reservation reservation = ctx.reservation();
            if (reservation != null && reservation.getProperty() != null
                    && reservation.getCheckOut() != null) {
                return new StayReference(reservation.getProperty().getId(),
                    reservation.getCheckIn(), reservation.getCheckOut(), reservation.getId());
            }
            Long propertyId = ctx.dataAsLong(AutomationSubject.DATA_PROPERTY_ID);
            LocalDate checkOut = parseDate(ctx.dataAsString(AutomationSubject.DATA_CHECK_OUT));
            if (propertyId == null || checkOut == null) {
                return null;
            }
            Long reservationId = ctx.dataAsLong(AutomationSubject.DATA_RESERVATION_ID);
            if (reservationId == null && AutomationSubject.TYPE_RESERVATION.equals(ctx.subjectType())) {
                reservationId = ctx.subjectId();
            }
            return new StayReference(propertyId,
                parseDate(ctx.dataAsString(AutomationSubject.DATA_CHECK_IN)), checkOut, reservationId);
        }

        private static LocalDate parseDate(String raw) {
            if (raw == null || raw.isBlank()) {
                return null;
            }
            try {
                return LocalDate.parse(raw.trim());
            } catch (DateTimeParseException e) {
                return null;
            }
        }
    }
}
