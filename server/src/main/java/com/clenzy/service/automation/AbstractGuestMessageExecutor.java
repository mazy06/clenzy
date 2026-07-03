package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.Reservation;
import com.clenzy.service.messaging.GuestMessagingService;

import java.util.Map;

/**
 * Socle des executeurs d'actions messaging guest (SEND_MESSAGE, SEND_CHECKIN_LINK,
 * SEND_GUIDE, SEND_REVIEW_REQUEST) : sujet reservation requis, template requis,
 * envoi via le pipeline {@link GuestMessagingService} (interpolation, code d'acces
 * et gating anti-acces anticipe, traduction, canal + fallback email).
 */
abstract class AbstractGuestMessageExecutor implements AutomationActionExecutor {

    private final GuestMessagingService messagingService;

    protected AbstractGuestMessageExecutor(GuestMessagingService messagingService) {
        this.messagingService = messagingService;
    }

    @Override
    public final ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        Reservation reservation = ctx.reservation();
        if (reservation == null) {
            throw new IllegalStateException("L'action " + action() + " requiert un sujet "
                + AutomationSubject.TYPE_RESERVATION + " (regle " + rule.getId()
                + ", sujet " + ctx.subjectType() + "/" + ctx.subjectId() + ")");
        }

        ExecutionResult skip = shouldSkip(rule, reservation, ctx.orgId());
        if (skip != null) {
            return skip;
        }

        MessageTemplate template = rule.getTemplate();
        if (template == null) {
            // WHY : avant ce cablage, une regle sans template etait marquee EXECUTED sans rien
            // envoyer (no-op silencieux). Echec explicite → statut FAILED visible dans l'UI.
            throw new IllegalStateException("Aucun template configure pour la regle "
                + rule.getId() + " (action " + rule.getActionType() + ")");
        }

        MessageChannelType channel = rule.getDeliveryChannel() != null
            ? rule.getDeliveryChannel() : MessageChannelType.EMAIL;
        messagingService.sendForReservationViaChannel(
            reservation, template, ctx.orgId(), channel, extraVariables(reservation));
        return ExecutionResult.executed();
    }

    /** Hook pre-envoi : retourner un resultat SKIPPED pour sauter l'envoi, null pour continuer. */
    protected ExecutionResult shouldSkip(AutomationRule rule, Reservation reservation, Long orgId) {
        return null;
    }

    /** Variables supplementaires injectees dans le template ({guideLink}, {reviewLink}...). */
    protected Map<String, String> extraVariables(Reservation reservation) {
        return Map.of();
    }
}
