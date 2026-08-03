package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.Reservation;
import com.clenzy.service.WelcomeGuideService;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.service.messaging.QuietHoursService;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * F3a SEND_GUIDE : envoi du lien du livret d'accueil (token borne a la reservation)
 * via {guideLink}, declenchable J-X (CHECK_IN_APPROACHING) ou jour J (CHECK_IN_DAY).
 */
@Service
public class SendGuideExecutor extends AbstractGuestMessageExecutor {

    private final WelcomeGuideService welcomeGuideService;

    public SendGuideExecutor(GuestMessagingService messagingService,
                             QuietHoursService quietHoursService,
                             WelcomeGuideService welcomeGuideService) {
        super(messagingService, quietHoursService);
        this.welcomeGuideService = welcomeGuideService;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_GUIDE;
    }

    @Override
    protected Map<String, String> extraVariables(Reservation reservation) {
        String guideLink = welcomeGuideService.linkForReservation(reservation)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun livret d'accueil publié pour le logement de la réservation "
                    + reservation.getId()));
        return Map.of("guideLink", guideLink);
    }
}
