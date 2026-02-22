package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Orchestrateur principal de l'envoi de messages aux voyageurs.
 * Charge les donnees, interpole le template, envoie via le canal
 * et journalise le resultat.
 */
@Service
public class GuestMessagingService {

    private static final Logger log = LoggerFactory.getLogger(GuestMessagingService.class);

    private final EmailChannel emailChannel;
    private final TemplateInterpolationService interpolationService;
    private final GuestMessageLogRepository messageLogRepository;
    private final CheckInInstructionsRepository instructionsRepository;
    private final MessageTemplateRepository templateRepository;
    private final ReservationRepository reservationRepository;
    private final NotificationService notificationService;

    public GuestMessagingService(
            EmailChannel emailChannel,
            TemplateInterpolationService interpolationService,
            GuestMessageLogRepository messageLogRepository,
            CheckInInstructionsRepository instructionsRepository,
            MessageTemplateRepository templateRepository,
            ReservationRepository reservationRepository,
            NotificationService notificationService
    ) {
        this.emailChannel = emailChannel;
        this.interpolationService = interpolationService;
        this.messageLogRepository = messageLogRepository;
        this.instructionsRepository = instructionsRepository;
        this.templateRepository = templateRepository;
        this.reservationRepository = reservationRepository;
        this.notificationService = notificationService;
    }

    /**
     * Envoi manuel d'un message pour une reservation avec un template donne.
     */
    @Transactional
    public GuestMessageLog sendMessage(Long reservationId, Long templateId, Long orgId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable: " + reservationId));

        MessageTemplate template = templateRepository.findByIdAndOrganizationId(templateId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Template introuvable: " + templateId));

        return sendForReservation(reservation, template, orgId);
    }

    /**
     * Envoie un message pour une reservation chargee (utilise par le scheduler).
     */
    @Transactional
    public GuestMessageLog sendForReservation(Reservation reservation, MessageTemplate template, Long orgId) {
        Property property = reservation.getProperty();
        Guest guest = reservation.getGuest();

        // Charger les instructions check-in si disponibles
        CheckInInstructions instructions = instructionsRepository
            .findByPropertyIdAndOrganizationId(property.getId(), orgId)
            .orElse(null);

        // Interpoler le template
        TemplateInterpolationService.InterpolatedMessage interpolated =
            interpolationService.interpolate(template, reservation, guest, property, instructions);

        // Determiner le destinataire (email du guest, sinon pas d'envoi)
        String recipientEmail = guest != null ? guest.getEmail() : null;
        if (recipientEmail == null || recipientEmail.isBlank()) {
            log.warn("Pas d'email pour la reservation {} — envoi impossible", reservation.getId());
            return createLog(reservation, guest, template, orgId, "N/A",
                interpolated.subject(), MessageStatus.FAILED, "Pas d'email pour le voyageur");
        }

        // Construire la requete d'envoi
        MessageDeliveryRequest request = new MessageDeliveryRequest(
            recipientEmail,
            guest != null ? guest.getPhone() : null,
            guest != null ? guest.getFullName() : reservation.getGuestName(),
            interpolated.subject(),
            interpolated.htmlBody(),
            interpolated.plainBody(),
            guest != null ? guest.getLanguage() : "fr"
        );

        // Envoyer via email
        MessageDeliveryResult result = emailChannel.send(request);

        // Journaliser
        MessageStatus status = result.success() ? MessageStatus.SENT : MessageStatus.FAILED;
        GuestMessageLog logEntry = createLog(
            reservation, guest, template, orgId, recipientEmail,
            interpolated.subject(), status, result.errorMessage()
        );

        // Notification interne
        String notifTitle = result.success()
            ? "Message envoye a " + request.recipientName()
            : "Echec envoi message a " + request.recipientName();
        String notifMessage = result.success()
            ? "Template '" + template.getName() + "' envoye pour " + property.getName()
            : "Erreur: " + result.errorMessage();

        NotificationKey key = result.success()
            ? NotificationKey.GUEST_MESSAGE_SENT
            : NotificationKey.GUEST_MESSAGE_FAILED;

        if (property.getOwner() != null && property.getOwner().getKeycloakId() != null) {
            notificationService.send(
                property.getOwner().getKeycloakId(), key, notifTitle, notifMessage, null
            );
        }

        return logEntry;
    }

    /**
     * Verifie si un message de ce type a deja ete envoye pour cette reservation.
     */
    public boolean alreadySent(Long reservationId, MessageTemplateType type) {
        return messageLogRepository.existsSentOrPendingByReservationAndType(reservationId, type);
    }

    private GuestMessageLog createLog(
            Reservation reservation, Guest guest, MessageTemplate template,
            Long orgId, String recipient, String subject,
            MessageStatus status, String errorMessage
    ) {
        GuestMessageLog entry = new GuestMessageLog();
        entry.setOrganizationId(orgId);
        entry.setReservation(reservation);
        entry.setGuest(guest);
        entry.setTemplate(template);
        entry.setChannel(MessageChannelType.EMAIL);
        entry.setRecipient(recipient);
        entry.setSubject(subject);
        entry.setStatus(status);
        entry.setErrorMessage(errorMessage);
        if (status == MessageStatus.SENT || status == MessageStatus.DELIVERED) {
            entry.setSentAt(LocalDateTime.now());
        }
        return messageLogRepository.save(entry);
    }
}
