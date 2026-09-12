package com.clenzy.service.smartlock;

import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCode.CodeSource;
import com.clenzy.model.SmartLockAccessCodeEvent;
import com.clenzy.model.SmartLockAccessCodeEvent.EventType;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Faire parvenir un code de sejour a son voyageur.
 *
 * <p>Un code pose sur une serrure que personne ne recoit ne sert a rien : c'est
 * une arrivee qui va echouer, pas un message manque. D'ou la notification
 * d'echec, rangee avec les acces et non avec la messagerie.</p>
 *
 * <p><b>Le PIN ne transite pas par ici</b> : le resolver de template l'injecte
 * lui-meme depuis le code persiste, ce qui rend l'envoi idempotent et evite de
 * promener un secret dans des variables de message.</p>
 *
 * <p>Ne jette jamais : un envoi rate est trace et notifie, il ne fait pas
 * echouer la creation de la reservation qui l'a declenche.</p>
 */
@Service
public class SmartLockCodeDelivery {

    private static final Logger log = LoggerFactory.getLogger(SmartLockCodeDelivery.class);

    private final MessageTemplateRepository templateRepository;
    private final GuestMessagingService guestMessagingService;
    private final SmartLockAccessCodeJournal journal;

    public SmartLockCodeDelivery(MessageTemplateRepository templateRepository,
                                 GuestMessagingService guestMessagingService,
                                 SmartLockAccessCodeJournal journal) {
        this.templateRepository = templateRepository;
        this.guestMessagingService = guestMessagingService;
        this.journal = journal;
    }

    public void deliver(Reservation reservation, SmartLockAccessCode code, Long orgId, String propertyName) {
        SmartLockAccessCodeEvent.EventSource source = eventSource(code.getSource());

        // Prefere le template dedie ACCESS_CODE ; repli sur CHECK_IN (qui porte deja {accessCode}).
        List<MessageTemplate> templates = templateRepository
                .findByOrganizationIdAndTypeAndIsActiveTrue(orgId, MessageTemplateType.ACCESS_CODE);
        if (templates.isEmpty()) {
            templates = templateRepository
                    .findByOrganizationIdAndTypeAndIsActiveTrue(orgId, MessageTemplateType.CHECK_IN);
        }
        if (templates.isEmpty()) {
            log.info("Pas de template CHECK_IN actif (org={}) — code non envoye au voyageur (reservation={})",
                    orgId, reservation.getId());
            journal.record(code, EventType.DELIVERY_FAILED, source, "Aucun template CHECK_IN actif");
            journal.announceFailure(NotificationKey.SMART_LOCK_CODE_DELIVERY_FAILED, orgId,
                    code.getPropertyId(), propertyName,
                    "Code non transmis au voyageur",
                    "Le code est bien posé sur la serrure, mais aucun modèle de message « Code d'accès » "
                            + "ou « Check-in » n'est actif : le voyageur ne l'a pas reçu.");
            return;
        }
        try {
            // extraVars vide : le resolver injecte {accessCode} depuis le code persiste (idempotent).
            guestMessagingService.sendForReservationViaChannel(
                    reservation, templates.get(0), orgId, MessageChannelType.EMAIL, Map.of());
            journal.record(code, EventType.CODE_DELIVERED, source, "Code envoye au voyageur (EMAIL)");
        } catch (Exception e) {
            log.warn("Envoi du code au voyageur echoue (reservation={}): {}", reservation.getId(), e.getMessage());
            journal.record(code, EventType.DELIVERY_FAILED, source, "Echec envoi: " + e.getMessage());
            journal.announceFailure(NotificationKey.SMART_LOCK_CODE_DELIVERY_FAILED, orgId,
                    code.getPropertyId(), propertyName,
                    "Code non transmis au voyageur",
                    "Le code est bien posé sur la serrure, mais son envoi au voyageur a échoué : "
                            + e.getMessage());
        }
    }

    /** Un geste manuel reste manuel jusque dans son journal de livraison. */
    static SmartLockAccessCodeEvent.EventSource eventSource(CodeSource source) {
        return source == CodeSource.MANUAL
                ? SmartLockAccessCodeEvent.EventSource.MANUAL
                : SmartLockAccessCodeEvent.EventSource.AUTO_RESERVATION;
    }
}
