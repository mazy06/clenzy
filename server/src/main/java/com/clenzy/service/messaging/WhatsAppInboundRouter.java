package com.clenzy.service.messaging;

import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.Guest;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Routage d'un message WhatsApp ENTRANT (relais — Lot B1).
 *
 * <p>Le numéro central reçoit le message du guest ; on identifie le guest par
 * son numéro (phone_hash), on rattache la conversation à sa réservation et on
 * l'assigne au HOST (propriétaire). Le webhook étant public, le filtre tenant
 * Hibernate n'est pas actif → les lookups sont cross-org (cohérent avec un
 * compte WhatsApp global).</p>
 *
 * <p>3 cas :</p>
 * <ol>
 *   <li>Guest + réservation → conversation rattachée (guest/property/reservation)
 *       + assignée au host.</li>
 *   <li>Guest connu sans réservation active → conversation dans son org, non assignée.</li>
 *   <li>Numéro inconnu → file « à trier » (org SYSTEM), non assignée.</li>
 * </ol>
 */
@Service
public class WhatsAppInboundRouter {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppInboundRouter.class);

    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;
    private final OrganizationRepository organizationRepository;
    private final ConversationService conversationService;

    public WhatsAppInboundRouter(GuestRepository guestRepository,
                                  ReservationRepository reservationRepository,
                                  OrganizationRepository organizationRepository,
                                  ConversationService conversationService) {
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.organizationRepository = organizationRepository;
        this.conversationService = conversationService;
    }

    /**
     * @param from              numéro de l'expéditeur (format Meta, ex "33612345678")
     * @param senderProfileName nom de profil WhatsApp (peut être vide)
     * @param text              contenu texte du message
     * @param messageId         ID Meta du message (dédup)
     */
    @Transactional
    public void route(String from, String senderProfileName, String text, String messageId) {
        String phoneHash = StringUtils.computePhoneHash(from, null);
        List<Guest> guests = (phoneHash != null)
            ? guestRepository.findByPhoneHash(phoneHash)
            : List.of();

        // 1. Guest AVEC une réservation (active ou la plus proche) → rattachement + assignation host.
        for (Guest g : guests) {
            Optional<Reservation> res = bestReservation(g.getId());
            if (res.isPresent()) {
                attachToReservation(g, res.get(), from, text, messageId);
                return;
            }
        }

        // 2. Guest connu mais sans réservation → conversation dans son org, non assignée.
        if (!guests.isEmpty()) {
            Guest g = guests.get(0);
            Conversation conv = conversationService.getOrCreate(
                g.getOrganizationId(), ConversationChannel.WHATSAPP, from,
                g, null, null, "WhatsApp: " + g.getFullName());
            conversationService.addInboundMessage(conv, g.getFullName(), from, text, null, messageId);
            return;
        }

        // 3. Numéro inconnu → file « à trier » (org SYSTEM).
        Optional<Organization> systemOrg = organizationRepository.findByType(OrganizationType.SYSTEM)
            .stream().findFirst();
        if (systemOrg.isEmpty()) {
            log.warn("Message WhatsApp d'un numero inconnu ({}) ignore : aucune organisation SYSTEM pour la file a trier", from);
            return;
        }
        String label = (senderProfileName != null && !senderProfileName.isBlank()) ? senderProfileName : from;
        Conversation conv = conversationService.getOrCreate(
            systemOrg.get().getId(), ConversationChannel.WHATSAPP, from,
            null, null, null, "À trier — " + label);
        conversationService.addInboundMessage(conv, label, from, text, null, messageId);
    }

    /** Réservation confirmée active aujourd'hui, sinon la plus proche dans le temps. */
    private Optional<Reservation> bestReservation(Long guestId) {
        LocalDate today = LocalDate.now();
        return reservationRepository.findByGuestId(guestId).stream()
            .filter(r -> "confirmed".equalsIgnoreCase(r.getStatus()))
            .min(Comparator.comparingLong(r -> distanceToStay(r, today)));
    }

    private long distanceToStay(Reservation r, LocalDate today) {
        if (r.getCheckIn() == null || r.getCheckOut() == null) return Long.MAX_VALUE;
        // Séjour en cours → distance 0 (prioritaire).
        if (!today.isBefore(r.getCheckIn()) && !today.isAfter(r.getCheckOut())) return 0;
        long toCheckIn = Math.abs(ChronoUnit.DAYS.between(today, r.getCheckIn()));
        long toCheckOut = Math.abs(ChronoUnit.DAYS.between(today, r.getCheckOut()));
        return Math.min(toCheckIn, toCheckOut);
    }

    private void attachToReservation(Guest g, Reservation res, String from, String text, String messageId) {
        Property property = res.getProperty();
        Long orgId = g.getOrganizationId();
        Conversation conv = conversationService.getOrCreateForReservation(
            orgId, res.getId(), ConversationChannel.WHATSAPP, g, property, res);

        // Assignation au HOST (propriétaire de la propriété), s'il a un compte Keycloak.
        if (property != null && property.getOwner() != null
                && property.getOwner().getKeycloakId() != null) {
            conversationService.assignConversation(conv.getId(), orgId, property.getOwner().getKeycloakId());
        }

        conversationService.addInboundMessage(conv, g.getFullName(), from, text, null, messageId);
    }
}
