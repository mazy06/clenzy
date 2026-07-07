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
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
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
    private final SupervisionActivityService supervisionActivityService;
    private final SupervisionSuggestionService supervisionSuggestionService;

    public CleaningBackfillScheduler(AutomationRuleRepository automationRuleRepository,
                                     ReservationRepository reservationRepository,
                                     ServiceRequestRepository serviceRequestRepository,
                                     ServiceRequestService serviceRequestService,
                                     MeterRegistry meterRegistry,
                                     SupervisionActivityService supervisionActivityService,
                                     SupervisionSuggestionService supervisionSuggestionService) {
        this.automationRuleRepository = automationRuleRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.serviceRequestService = serviceRequestService;
        this.meterRegistry = meterRegistry;
        this.supervisionActivityService = supervisionActivityService;
        this.supervisionSuggestionService = supervisionSuggestionService;
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
                    recordConstellationActivity(orgId, reservation);
                }
            } catch (Exception e) {
                log.error("Filet menage auto: echec pour la reservation {} (org {}): {}",
                    reservation.getId(), orgId, e.getMessage());
            }
        }
        return created;
    }

    /**
     * Regle de scan HITL (constellation, agent Operations « ops ») : pour chaque
     * reservation dont le check-out tombe DEMAIN (fuseau de la propriete) sans
     * menage planifie, propose une carte actionnable « Menage manquant » a
     * l'operateur — anticipation, la veille, des departs non couverts par une
     * demande de menage (le filet {@link #backfillTodaysCheckouts()} ne cree la
     * demande qu'au jour meme).
     *
     * <p>Meme perimetre d'opt-in que le filet (orgs ayant une regle
     * CREATE_CLEANING_REQUEST active) et memes primitives de detection
     * (plage de check-out, menage actif deja present). Dedup portee par
     * {@link SupervisionSuggestionService#record} (pas de doublon en attente sur
     * le meme intitule). Un echec sur une reservation est logue et n'empeche pas
     * les suivantes.</p>
     */
    @Scheduled(cron = "0 0 18 * * *") // La veille en soiree : laisse le temps de planifier le menage
    public void scanTomorrowCheckoutsMissingCleaning() {
        Set<Long> optedInOrgIds = automationRuleRepository.findByEnabledTrue().stream()
            .filter(rule -> rule.getActionType() == AutomationAction.CREATE_CLEANING_REQUEST)
            .map(AutomationRule::getOrganizationId)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        if (optedInOrgIds.isEmpty()) {
            return;
        }

        int totalFlagged = 0;
        for (Long orgId : optedInOrgIds) {
            try {
                totalFlagged += scanOrganizationTomorrow(orgId);
            } catch (Exception e) {
                log.error("Scan menage manquant demain: echec pour l'organisation {}: {}", orgId, e.getMessage());
            }
        }
        if (totalFlagged > 0) {
            log.info("Scan menage manquant demain: {} carte(s) HITL creee(s) pour {} organisation(s) opt-in",
                totalFlagged, optedInOrgIds.size());
        }
    }

    private int scanOrganizationTomorrow(Long orgId) {
        // Fenetre serveur +/- 2 jours autour de la date serveur : couvre « demain »
        // dans tous les fuseaux des proprietes, le filtre exact se fait par propriete.
        LocalDate serverToday = LocalDate.now();
        List<Reservation> checkouts = reservationRepository.findConfirmedByCheckOutRange(
            serverToday, serverToday.plusDays(2), orgId);

        int flagged = 0;
        for (Reservation reservation : checkouts) {
            try {
                if (!isCheckoutOn(reservation, 1)) {
                    continue; // le check-out ne tombe pas demain dans le fuseau de la propriete
                }
                if (hasActiveCleaningRequest(reservation, orgId)) {
                    continue; // un menage (auto ou manuel) couvre deja ce depart
                }
                if (flagTomorrowCleaningMissing(orgId, reservation)) {
                    flagged++;
                }
            } catch (Exception e) {
                log.error("Scan menage manquant demain: echec pour la reservation {} (org {}): {}",
                    reservation.getId(), orgId, e.getMessage());
            }
        }
        return flagged;
    }

    /**
     * Cree la carte HITL « Menage manquant » sur la CONSTELLATION du logement du
     * depart (per-occurrence : propertyId + orgId resolus depuis la reservation).
     * Best-effort ({@link SupervisionSuggestionService#record} avale et dedup) :
     * retourne false si le logement n'est pas resoluble (rien flagge).
     */
    private boolean flagTomorrowCleaningMissing(Long orgId, Reservation reservation) {
        Property property = reservation.getProperty();
        Long propertyId = property != null ? property.getId() : null;
        if (propertyId == null) {
            return false; // pas de logement unique → on ne force rien
        }
        String motif = "Depart du " + reservation.getCheckOut() + " (reservation " + reservation.getId()
            + ") sans demande de menage planifiee. Planifier un menage avant l'arrivee suivante.";
        supervisionSuggestionService.record(orgId, propertyId, "ops", "cleaning_missing",
            "Menage manquant pour le depart de demain", motif);
        return true;
    }

    /**
     * Fait remonter le menage auto-planifie dans le feed « En direct » de la CONSTELLATION du logement
     * (agent Operations « ops »). La propriete est celle de la reservation traitee (per-occurrence,
     * org-scopee). Best-effort : un echec ne doit jamais casser le filet menage.
     */
    private void recordConstellationActivity(Long orgId, Reservation reservation) {
        try {
            Property property = reservation.getProperty();
            Long propertyId = property != null ? property.getId() : null;
            if (propertyId == null) {
                return;
            }
            String summary = "Menage auto-planifie au depart de la reservation "
                + reservation.getId() + " (checkout du " + reservation.getCheckOut() + ")";
            supervisionActivityService.recordModuleAct(orgId, propertyId, "ops", "cleaning_scheduled", summary);
        } catch (Exception e) {
            log.debug("Filet menage auto: activite constellation non enregistree (reservation {}): {}",
                reservation.getId(), e.getMessage());
        }
    }

    /** « Checkout du jour » evalue dans le fuseau de la propriete (regle audit n°9). */
    private static boolean isCheckoutToday(Reservation reservation) {
        return isCheckoutOn(reservation, 0);
    }

    /**
     * Le check-out tombe-t-il {@code plusDays} apres « aujourd'hui » DANS le fuseau
     * de la propriete (regle audit n°9 — jamais la zone JVM) ? {@code plusDays=0}
     * = aujourd'hui, {@code plusDays=1} = demain.
     */
    private static boolean isCheckoutOn(Reservation reservation, int plusDays) {
        Property property = reservation.getProperty();
        if (property == null || reservation.getCheckOut() == null) {
            return false;
        }
        return LocalDate.now(StayTimes.zoneOf(property)).plusDays(plusDays).equals(reservation.getCheckOut());
    }

    /** Un menage (auto ou manuel) non annule existe-t-il deja pour ce sejour ? */
    private boolean hasActiveCleaningRequest(Reservation reservation, Long orgId) {
        return serviceRequestRepository.findByReservationId(reservation.getId(), orgId).stream()
            .anyMatch(sr -> sr.getServiceType() != null && sr.getServiceType().isCleaningService()
                && sr.getStatus() != RequestStatus.CANCELLED
                && sr.getStatus() != RequestStatus.REJECTED);
    }
}
