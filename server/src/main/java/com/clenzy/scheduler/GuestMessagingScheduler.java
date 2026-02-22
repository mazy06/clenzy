package com.clenzy.scheduler;

import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.model.Reservation;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Tache planifiee pour l'envoi automatique des instructions
 * check-in/check-out aux voyageurs.
 *
 * Suit le pattern AirbnbSyncScheduler : groupe par organisation,
 * isolation d'erreurs par org.
 */
@Service
public class GuestMessagingScheduler {

    private static final Logger log = LoggerFactory.getLogger(GuestMessagingScheduler.class);

    private final MessagingAutomationConfigRepository configRepository;
    private final ReservationRepository reservationRepository;
    private final MessageTemplateRepository templateRepository;
    private final GuestMessagingService messagingService;

    public GuestMessagingScheduler(
            MessagingAutomationConfigRepository configRepository,
            ReservationRepository reservationRepository,
            MessageTemplateRepository templateRepository,
            GuestMessagingService messagingService
    ) {
        this.configRepository = configRepository;
        this.reservationRepository = reservationRepository;
        this.templateRepository = templateRepository;
        this.messagingService = messagingService;
    }

    /**
     * Execute toutes les heures. Cherche les reservations eligibles
     * et envoie les messages automatiques.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void processAutomatedMessages() {
        List<MessagingAutomationConfig> configs = configRepository
            .findByAutoSendCheckInTrueOrAutoSendCheckOutTrue();

        if (configs.isEmpty()) return;

        int totalSent = 0;
        int totalErrors = 0;

        for (MessagingAutomationConfig config : configs) {
            Long orgId = config.getOrganizationId();
            try {
                totalSent += processCheckIn(config, orgId);
                totalSent += processCheckOut(config, orgId);
            } catch (Exception e) {
                totalErrors++;
                log.error("Erreur messaging auto pour org={}: {}", orgId, e.getMessage());
            }
        }

        if (totalSent > 0 || totalErrors > 0) {
            log.info("GuestMessagingScheduler: {} messages envoyes, {} erreurs", totalSent, totalErrors);
        }
    }

    private int processCheckIn(MessagingAutomationConfig config, Long orgId) {
        if (!config.isAutoSendCheckIn() || config.getCheckInTemplateId() == null) return 0;

        MessageTemplate template = templateRepository
            .findByIdAndOrganizationId(config.getCheckInTemplateId(), orgId)
            .orElse(null);
        if (template == null || !template.isActive()) return 0;

        // Cherche les reservations avec check-in dans les N prochaines heures
        LocalDate today = LocalDate.now();
        int hoursAhead = config.getHoursBeforeCheckIn();
        // Couvre la fenetre : aujourd'hui + nombre de jours equivalent
        LocalDate maxDate = today.plusDays((hoursAhead / 24) + 1);

        List<Reservation> reservations = reservationRepository
            .findConfirmedByCheckInRange(today, maxDate, orgId);

        int sent = 0;
        for (Reservation reservation : reservations) {
            if (messagingService.alreadySent(reservation.getId(), MessageTemplateType.CHECK_IN)) {
                continue;
            }
            try {
                messagingService.sendForReservation(reservation, template, orgId);
                sent++;
            } catch (Exception e) {
                log.error("Erreur envoi check-in pour reservation={}: {}", reservation.getId(), e.getMessage());
            }
        }
        return sent;
    }

    private int processCheckOut(MessagingAutomationConfig config, Long orgId) {
        if (!config.isAutoSendCheckOut() || config.getCheckOutTemplateId() == null) return 0;

        MessageTemplate template = templateRepository
            .findByIdAndOrganizationId(config.getCheckOutTemplateId(), orgId)
            .orElse(null);
        if (template == null || !template.isActive()) return 0;

        LocalDate today = LocalDate.now();
        int hoursAhead = config.getHoursBeforeCheckOut();
        LocalDate maxDate = today.plusDays((hoursAhead / 24) + 1);

        List<Reservation> reservations = reservationRepository
            .findConfirmedByCheckOutRange(today, maxDate, orgId);

        int sent = 0;
        for (Reservation reservation : reservations) {
            if (messagingService.alreadySent(reservation.getId(), MessageTemplateType.CHECK_OUT)) {
                continue;
            }
            try {
                messagingService.sendForReservation(reservation, template, orgId);
                sent++;
            } catch (Exception e) {
                log.error("Erreur envoi check-out pour reservation={}: {}", reservation.getId(), e.getMessage());
            }
        }
        return sent;
    }
}
