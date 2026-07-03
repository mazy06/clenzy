package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.service.messaging.GuestMessagingService;
import org.springframework.stereotype.Service;

/**
 * F3c SEND_CHECKIN_LINK : instructions d'arrivee + code d'acces.
 *
 * <p>Le code d'acces (serrure connectee / echange de cles / manuel) et son gating
 * anti-acces anticipe (StayTimes + AccessCodeResolverService : avant l'heure de
 * check-in, les tags {accessCode} renvoient vers le livret au lieu des codes reels)
 * sont resolus par {@code GuestMessagingService} au moment de l'envoi — cet executeur
 * n'injecte volontairement RIEN qui contournerait ce gating. Le template reference
 * {accessCode} et les variables CheckInInstructions.</p>
 */
@Service
public class SendCheckinLinkExecutor extends AbstractGuestMessageExecutor {

    public SendCheckinLinkExecutor(GuestMessagingService messagingService) {
        super(messagingService);
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_CHECKIN_LINK;
    }
}
