package com.clenzy.service.messaging;

import com.clenzy.model.Guest;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageStatus;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestMessageLogRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Le journal d'une tentative d'envoi, écrit <b>avant</b> l'envoi.
 *
 * <p>Jusqu'ici le journal était écrit après l'appel au fournisseur. Entre les
 * deux existait une fenêtre où le message était parti sans qu'il en reste la
 * moindre trace : le fournisseur avait accepté, l'écriture avait échoué. On ne
 * pouvait alors plus distinguer « rien n'est parti » de « on ne sait pas », et
 * un rejeu envoyait une seconde fois.</p>
 *
 * <p>Enregistrer l'<b>intention</b> avant, et l'<b>issue</b> après, rend cette
 * ambiguïté représentable : une ligne restée {@link MessageStatus#PENDING} est
 * exactement le « on ne sait pas ». Le doute n'est pas supprimé — aucun de nos
 * fournisseurs de messagerie n'accepte de clé d'idempotence — mais il cesse
 * d'être invisible, et c'est une personne qui tranche.</p>
 *
 * <p><b>Transaction propre</b> ({@code REQUIRES_NEW}) : sans elle, la trace
 * partirait avec le rollback qu'elle a précisément pour rôle de documenter.
 * Bean séparé et non méthode privée : une auto-invocation ne passe pas par le
 * proxy Spring, et l'annotation serait silencieusement sans effet.</p>
 */
@Component
public class GuestMessageAttemptLog {

    private final GuestMessageLogRepository repository;

    public GuestMessageAttemptLog(GuestMessageLogRepository repository) {
        this.repository = repository;
    }

    /**
     * Ouvre la trace juste avant l'appel au fournisseur.
     *
     * <p>Cette ligne active une garde qui existait déjà sans jamais pouvoir se
     * déclencher : {@code existsSentOrPendingByReservationAndType} cherche les
     * envois « en cours ou partis », or aucun {@code PENDING} n'était jamais
     * écrit.</p>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public GuestMessageLog begin(Reservation reservation, Guest guest, MessageTemplate template,
                                 Long orgId, MessageChannelType channelType,
                                 String recipient, String subject) {
        final GuestMessageLog entry = new GuestMessageLog();
        entry.setOrganizationId(orgId);
        entry.setReservation(reservation);
        entry.setGuest(guest);
        entry.setTemplate(template);
        entry.setChannel(channelType);
        entry.setRecipient(recipient);
        entry.setSubject(subject);
        entry.setStatus(MessageStatus.PENDING);
        return repository.save(entry);
    }

    /**
     * Referme la trace avec l'issue réelle.
     *
     * <p>Également en transaction propre : si le traitement appelant échoue
     * ensuite, l'issue constatée doit survivre — c'est elle qui évitera un
     * rejeu inutile.</p>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public GuestMessageLog complete(Long logId, MessageStatus status, String errorMessage) {
        final GuestMessageLog entry = repository.findById(logId).orElse(null);
        if (entry == null) return null;
        entry.setStatus(status);
        entry.setErrorMessage(errorMessage);
        if (status == MessageStatus.SENT || status == MessageStatus.DELIVERED) {
            entry.setSentAt(LocalDateTime.now());
        }
        return repository.save(entry);
    }
}
