package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.repository.GuestMessageLogRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Renvoyer un message voyageur, sur le <b>même canal</b> — courriel, SMS ou
 * WhatsApp.
 *
 * <p>Aucun envoi n'est fait dans une transaction ouverte ici. Un envoi est un
 * appel réseau : le tenir dans une transaction la garde ouverte pendant toute
 * sa durée, et une lenteur du fournisseur devient une saturation du pool de
 * connexions.</p>
 */
@Component
public class RetryGuestMessageHandler implements ActionGestureHandler {

    private static final Logger log = LoggerFactory.getLogger(RetryGuestMessageHandler.class);

    private final GuestMessageLogRepository guestMessageLogRepository;
    private final GuestMessagingService guestMessagingService;

    public RetryGuestMessageHandler(GuestMessageLogRepository guestMessageLogRepository,
                                    GuestMessagingService guestMessagingService) {
        this.guestMessageLogRepository = guestMessageLogRepository;
        this.guestMessagingService = guestMessagingService;
    }

    @Override
    public String action() {
        return "retry";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.GUEST_MESSAGE_FAILED);
    }

    @Override
    public void handle(GestureContext context) {
        final Long orgId = context.orgId();
        final GuestMessageLog message = guestMessageLogRepository.findById(context.targetId())
                .filter(m -> orgId.equals(m.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Message introuvable"));

        if (message.getReservationId() == null || message.getTemplateId() == null) {
            throw new IllegalStateException(
                    "Ce message ne peut pas etre rejoue : reservation ou modele absent");
        }
        guestMessagingService.sendMessage(message.getReservationId(), message.getTemplateId(),
                orgId, message.getChannel());
        log.info("Message {} rejoue sur le canal {}", message.getId(), message.getChannel());
    }
}
