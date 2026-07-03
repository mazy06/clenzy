package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.service.messaging.GuestMessagingService;
import org.springframework.stereotype.Service;

/**
 * SEND_MESSAGE : envoi du template de la regle au voyageur, sans variable
 * supplementaire (F1b message de bienvenue, messages libres J-X/J+X).
 */
@Service
public class SendMessageExecutor extends AbstractGuestMessageExecutor {

    public SendMessageExecutor(GuestMessagingService messagingService) {
        super(messagingService);
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_MESSAGE;
    }
}
