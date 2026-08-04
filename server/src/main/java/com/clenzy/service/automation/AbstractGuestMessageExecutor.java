package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.Reservation;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.service.messaging.QuietHoursService;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

/**
 * Socle des executeurs d'actions messaging guest (SEND_MESSAGE, SEND_CHECKIN_LINK,
 * SEND_GUIDE, SEND_REVIEW_REQUEST) : sujet reservation requis, template requis,
 * envoi via le pipeline {@link GuestMessagingService} (interpolation, code d'acces
 * et gating anti-acces anticipe, traduction, canal + fallback email).
 *
 * <p>Heures calmes (M10) : un envoi NON urgent tombant dans la fenetre calme du
 * logement est reporte a la fin de fenetre via {@code ExecutionResult.rescheduled}
 * (l'execution repart en PENDING, re-drainee au tick suivant) + entree feed taguee
 * DEFERRED. Ne sont JAMAIS differes : codes d'acces / instructions d'arrivee
 * ({@link #deferrableInQuietHours} surchargee a false), et par ceinture-bretelles
 * les templates ACCESS_CODE / CHECK_IN / NOISE_ALERT / PAYMENT_LINK.</p>
 */
abstract class AbstractGuestMessageExecutor implements AutomationActionExecutor {

    /** Types de template toujours urgents, quel que soit l'executeur porteur. */
    private static final Set<MessageTemplateType> URGENT_TEMPLATE_TYPES = Set.of(
            MessageTemplateType.ACCESS_CODE, MessageTemplateType.CHECK_IN,
            MessageTemplateType.NOISE_ALERT, MessageTemplateType.PAYMENT_LINK);

    private final GuestMessagingService messagingService;
    private final QuietHoursService quietHoursService;

    protected AbstractGuestMessageExecutor(GuestMessagingService messagingService,
                                           QuietHoursService quietHoursService) {
        this.messagingService = messagingService;
        this.quietHoursService = quietHoursService;
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

        // Heures calmes (M10) : report AVANT l'envoi, jamais pour l'urgent.
        if (deferrableInQuietHours()
                && (template.getType() == null || !URGENT_TEMPLATE_TYPES.contains(template.getType()))) {
            LocalDateTime resumeAt = quietHoursService.deferUntilIfQuiet(ctx.orgId(), reservation);
            if (resumeAt != null) {
                quietHoursService.recordDeferred(ctx.orgId(), reservation,
                        feedModuleKey(), rule.getName(), resumeAt);
                return ExecutionResult.rescheduled(resumeAt,
                    "Heures calmes du logement — envoi reporte a " + resumeAt);
            }
        }

        MessageChannelType channel = rule.getDeliveryChannel() != null
            ? rule.getDeliveryChannel() : MessageChannelType.EMAIL;
        // On conserve l'id du log d'envoi cree : le moteur le rattache au journal de la
        // constellation, ce qui permet ensuite de previsualiser le message envoye a la
        // demande (cf. AutomationEvaluationService.recordConstellationActivity + endpoint
        // /guest-messaging/preview/{logId}).
        GuestMessageLog sent = messagingService.sendForReservationViaChannel(
            reservation, template, ctx.orgId(), channel, extraVariables(reservation));
        return ExecutionResult.executed(sent != null ? sent.getId() : null);
    }

    /** Hook pre-envoi : retourner un resultat SKIPPED pour sauter l'envoi, null pour continuer. */
    protected ExecutionResult shouldSkip(AutomationRule rule, Reservation reservation, Long orgId) {
        return null;
    }

    /** Variables supplementaires injectees dans le template ({guideLink}, {reviewLink}...). */
    protected Map<String, String> extraVariables(Reservation reservation) {
        return Map.of();
    }

    /** Surcharger a {@code false} pour un envoi qui ne doit JAMAIS attendre (codes d'acces). */
    protected boolean deferrableInQuietHours() {
        return true;
    }

    /** Module du feed pour l'entree DEFERRED (mapping ACTION_MODULE de l'evaluateur). */
    private String feedModuleKey() {
        return action() == AutomationAction.SEND_REVIEW_REQUEST ? "rep" : "com";
    }
}
