package com.clenzy.scheduler;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Property;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.access.StayTimes;
import com.clenzy.service.automation.AutomationEngine;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Filet quotidien du menage auto post-checkout (fiche 08, F4d) : pour les
 * organisations ayant une regle CREATE_CLEANING_REQUEST active, cree la demande
 * de menage manquante pour les checkouts DU JOUR (fuseau de la propriete) —
 * reservations legacy anterieures a l'activation de la regle, imports iCal sans
 * event BOOKED exploitable (reservationId absent du payload), ou event Kafka
 * perdu.
 *
 * <p><b>Choix assume</b> : le filet appelle directement
 * {@link ServiceRequestService#createAutomaticCleaningRequest} (la logique de
 * l'executeur CREATE_CLEANING_REQUEST) au lieu de re-tirer le trigger
 * RESERVATION_BOOKED — l'idempotence generique du moteur (regle x sujet) aurait
 * deja consomme le sujet pour les reservations passees par le listener, et le
 * filet vise justement les reservations qui n'ont PAS de sujet exploitable.
 * L'idempotence reste garantie par la cle metier unique propriete x dates
 * ({@code service_requests.auto_flow_key}) : moteur et filet ne peuvent pas
 * creer de doublon.</p>
 *
 * <p>L'opt-in par organisation = l'existence d'une regle active (pas de flag
 * dedie). Un echec sur une reservation est logue et n'empeche pas les suivantes.</p>
 */
@Component
public class CleaningBackfillScheduler {

    private static final Logger log = LoggerFactory.getLogger(CleaningBackfillScheduler.class);

    private final AutomationRuleRepository automationRuleRepository;
    private final ReservationRepository reservationRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final ServiceRequestService serviceRequestService;
    private final MeterRegistry meterRegistry;

    public CleaningBackfillScheduler(AutomationRuleRepository automationRuleRepository,
                                     ReservationRepository reservationRepository,
                                     ServiceRequestRepository serviceRequestRepository,
                                     ServiceRequestService serviceRequestService,
                                     MeterRegistry meterRegistry) {
        this.automationRuleRepository = automationRuleRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.serviceRequestService = serviceRequestService;
        this.meterRegistry = meterRegistry;
    }

    @Scheduled(cron = "0 30 6 * * *") // Tous les jours a 6h30, avant la journee de menage
    public void backfillTodaysCheckouts() {
        Set<Long> optedInOrgIds = automationRuleRepository.findByEnabledTrue().stream()
            .filter(rule -> rule.getActionType() == AutomationAction.CREATE_CLEANING_REQUEST)
            .map(AutomationRule::getOrganizationId)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        if (optedInOrgIds.isEmpty()) {
            return;
        }

        int totalCreated = 0;
        for (Long orgId : optedInOrgIds) {
            try {
                totalCreated += backfillOrganization(orgId);
            } catch (Exception e) {
                log.error("Filet menage auto: echec pour l'organisation {}: {}", orgId, e.getMessage());
            }
        }
        if (totalCreated > 0) {
            log.info("Filet menage auto: {} demande(s) creee(s) pour {} organisation(s) opt-in",
                totalCreated, optedInOrgIds.size());
        }
    }

    private int backfillOrganization(Long orgId) {
        // Fenetre +/- 1 jour autour de la date serveur : couvre tous les fuseaux
        // des proprietes, le filtre exact « aujourd'hui » se fait par propriete.
        LocalDate serverToday = LocalDate.now();
        List<Reservation> checkouts = reservationRepository.findConfirmedByCheckOutRange(
            serverToday.minusDays(1), serverToday.plusDays(1), orgId);

        int created = 0;
        for (Reservation reservation : checkouts) {
            try {
                if (!isCheckoutToday(reservation)) {
                    continue;
                }
                if (hasActiveCleaningRequest(reservation, orgId)) {
                    continue;
                }
                var outcome = serviceRequestService.createAutomaticCleaningRequest(
                    orgId,
                    reservation.getProperty().getId(),
                    reservation.getCheckIn(),
                    reservation.getCheckOut(),
                    reservation.getId());
                if (outcome.executed()) {
                    created++;
                    meterRegistry.counter(AutomationEngine.EXECUTED_METRIC,
                        "action", AutomationAction.CREATE_CLEANING_REQUEST.name()).increment();
                    log.info("Filet menage auto: demande {} creee pour la reservation {} (org {})",
                        outcome.request().getId(), reservation.getId(), orgId);
                }
            } catch (Exception e) {
                log.error("Filet menage auto: echec pour la reservation {} (org {}): {}",
                    reservation.getId(), orgId, e.getMessage());
            }
        }
        return created;
    }

    /** « Checkout du jour » evalue dans le fuseau de la propriete (regle audit n°9). */
    private static boolean isCheckoutToday(Reservation reservation) {
        Property property = reservation.getProperty();
        if (property == null || reservation.getCheckOut() == null) {
            return false;
        }
        return LocalDate.now(StayTimes.zoneOf(property)).equals(reservation.getCheckOut());
    }

    /** Un menage (auto ou manuel) non annule existe-t-il deja pour ce sejour ? */
    private boolean hasActiveCleaningRequest(Reservation reservation, Long orgId) {
        return serviceRequestRepository.findByReservationId(reservation.getId(), orgId).stream()
            .anyMatch(sr -> sr.getServiceType() != null && sr.getServiceType().isCleaningService()
                && sr.getStatus() != RequestStatus.CANCELLED
                && sr.getStatus() != RequestStatus.REJECTED);
    }
}
