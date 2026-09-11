package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.Notification;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Les faits qu'une notification ne pouvait pas emporter, resolus a la LECTURE.
 *
 * <p>La regle d'emission veut qu'un fait soit ecrit au moment de l'evenement.
 * Deux d'entre eux s'y refusent :</p>
 *
 * <ul>
 *   <li><b>La photo du voyageur.</b> Son URL est signee par un ticket valable
 *       un quart d'heure — fige a l'emission, il serait mort avant d'etre lu.</li>
 *   <li><b>Le sejour d'une carte de supervision.</b> Le fait EXISTE depuis peu ;
 *       les notifications emises avant ne le portent pas, et leur carte ne
 *       renotifie pas (une carte en attente est dedupliquee). Sans resolution a
 *       la lecture, ces fiches resteraient definitivement muettes. Le lien se
 *       refait par la CARTE ({@code suggestionId}), que ces notifications ont
 *       toujours porte.</li>
 * </ul>
 *
 * <p>Deux requetes pour toute la page, quelle que soit sa taille : les cartes
 * d'un coup, puis les sejours d'un coup, voyageur joint. L'ecran des
 * notifications se recharge en continu — une resolution par ligne y ferait un
 * N+1 franc, la meme raison qui interdisait les photos dans la liste des avis
 * avant {@link ReviewGuestAvatarResolver}.</p>
 *
 * <p>Rien a resoudre, un sejour sans voyageur, un voyageur sans photo : les
 * faits ressortent tels quels et l'interface retombe sur ses initiales. C'est le
 * cas le plus frequent, pas une anomalie.</p>
 */
@Service
public class NotificationFactsResolver {

    /** Faits ajoutes a la lecture. {@code null} = rien a ajouter pour ce champ. */
    public record ReadFacts(Long reservationId, String guestAvatarUrl) {}

    private final ReservationRepository reservationRepository;
    private final SupervisionSuggestionRepository suggestionRepository;
    private final GuestPhotoUrlResolver photoUrls;
    private final ObjectMapper objectMapper;

    public NotificationFactsResolver(ReservationRepository reservationRepository,
                                     SupervisionSuggestionRepository suggestionRepository,
                                     GuestPhotoUrlResolver photoUrls,
                                     ObjectMapper objectMapper) {
        this.reservationRepository = reservationRepository;
        this.suggestionRepository = suggestionRepository;
        this.photoUrls = photoUrls;
        this.objectMapper = objectMapper;
    }

    /**
     * Faits de lecture d'un lot de notifications, indexes par identifiant.
     *
     * <p>Ni {@code findAllById} ni {@code findAllWithGuestByIdIn} ne passent par
     * le filtre Hibernate : l'appartenance a l'organisation de la notification
     * est verifiee ICI, explicitement, a chaque saut — la carte, puis le sejour
     * (regle #3 de l'audit 2026-06). Un objet d'une autre organisation est
     * traite comme absent : on ne confirme meme pas son existence.</p>
     */
    @Transactional(readOnly = true)
    public Map<Long, ReadFacts> forNotifications(Collection<Notification> notifications) {
        if (notifications == null || notifications.isEmpty()) return Map.of();

        Map<Long, Long> stayByNotification = new HashMap<>();
        Map<Long, Long> cardByNotification = new HashMap<>();
        for (Notification notification : notifications) {
            JsonNode facts = parse(notification.getMetadata());
            if (facts == null) continue;
            Long stayId = longFact(facts, NotificationMetadata.RESERVATION_ID);
            if (stayId != null) {
                stayByNotification.put(notification.getId(), stayId);
                continue;
            }
            Long cardId = longFact(facts, NotificationMetadata.SUGGESTION_ID);
            if (cardId != null) cardByNotification.put(notification.getId(), cardId);
        }

        resolveStaysFromCards(notifications, cardByNotification, stayByNotification);
        if (stayByNotification.isEmpty()) return Map.of();

        Map<Long, Reservation> stays = reservationRepository
                .findAllWithGuestByIdIn(new HashSet<>(stayByNotification.values())).stream()
                .collect(Collectors.toMap(Reservation::getId, stay -> stay, (a, b) -> a));

        Map<Long, ReadFacts> resolved = new HashMap<>();
        for (Notification notification : notifications) {
            Long stayId = stayByNotification.get(notification.getId());
            if (stayId == null) continue;
            Reservation stay = stays.get(stayId);
            if (stay == null || !belongsTo(stay.getOrganizationId(), notification)) continue;
            Guest guest = stay.getGuest();
            String photo = guest != null ? photoUrls.publicUrl(guest.getId(), guest.getAvatarUrl()) : null;
            // Le sejour n'est REPUBLIE que s'il a ete deduit de la carte : sinon
            // il est deja dans les faits, et le regreffer serait du bruit.
            Long published = cardByNotification.containsKey(notification.getId()) ? stayId : null;
            if (published != null || photo != null) {
                resolved.put(notification.getId(), new ReadFacts(published, photo));
            }
        }
        return resolved;
    }

    /** Sejour des notifications qui ne connaissent que leur carte de supervision. */
    private void resolveStaysFromCards(Collection<Notification> notifications,
                                       Map<Long, Long> cardByNotification,
                                       Map<Long, Long> stayByNotification) {
        if (cardByNotification.isEmpty()) return;

        Map<Long, SupervisionSuggestion> cards = suggestionRepository
                .findAllById(new HashSet<>(cardByNotification.values())).stream()
                .collect(Collectors.toMap(SupervisionSuggestion::getId, card -> card, (a, b) -> a));

        for (Notification notification : notifications) {
            Long cardId = cardByNotification.get(notification.getId());
            if (cardId == null) continue;
            SupervisionSuggestion card = cards.get(cardId);
            if (card == null || card.getReservationId() == null
                    || !belongsTo(card.getOrganizationId(), notification)) {
                continue;
            }
            stayByNotification.put(notification.getId(), card.getReservationId());
        }
    }

    /**
     * Une notification sans organisation (evenement plateforme) ne sert de
     * laissez-passer vers rien : on exige l'egalite, pas l'absence de
     * contradiction.
     */
    private static boolean belongsTo(Long organizationId, Notification notification) {
        return notification.getOrganizationId() != null
                && Objects.equals(organizationId, notification.getOrganizationId());
    }

    /** Des faits illisibles n'empechent pas de lire la notification. */
    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static Long longFact(JsonNode facts, String key) {
        JsonNode node = facts.get(key);
        return node != null && node.canConvertToLong() ? node.asLong() : null;
    }
}
