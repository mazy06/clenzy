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
 *   <li><b>Le sejour d'un evenement deja ecrit.</b> Le fait EXISTE depuis peu ;
 *       les notifications emises avant ne le portent pas, et rien ne les
 *       renotifie. Sans resolution a la lecture, ces fiches resteraient
 *       definitivement muettes. Le lien se refait par ce que la notification a
 *       toujours porte : la CARTE de supervision ({@code suggestionId}), ou la
 *       REFERENCE affichable du sejour ({@code reservationReference}) pour les
 *       evenements de messagerie.</li>
 * </ul>
 *
 * <p>Trois requetes pour toute la page, quelle que soit sa taille : les cartes
 * d'un coup, les references d'un coup (une par organisation representee), puis
 * les sejours d'un coup, voyageur joint. L'ecran des notifications se recharge
 * en continu — une resolution par ligne y ferait un N+1 franc, la meme raison
 * qui interdisait les photos dans la liste des avis avant
 * {@link ReviewGuestAvatarResolver}.</p>
 *
 * <p>Rien a resoudre, un sejour sans voyageur, un voyageur sans photo : les
 * faits ressortent tels quels et l'interface retombe sur ses initiales. C'est le
 * cas le plus frequent, pas une anomalie.</p>
 */
@Service
public class NotificationFactsResolver {

    /** Faits ajoutes a la lecture. {@code null} = rien a ajouter pour ce champ. */
    public record ReadFacts(Long reservationId, String guestAvatarUrl,
                            Long deviceId, Long reviewId) {
        boolean isEmpty() {
            return reservationId == null && guestAvatarUrl == null
                    && deviceId == null && reviewId == null;
        }
    }

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
        Map<Long, String> referenceByNotification = new HashMap<>();
        for (Notification notification : notifications) {
            JsonNode facts = parse(notification.getMetadata());
            if (facts == null) continue;
            Long stayId = longFact(facts, NotificationMetadata.RESERVATION_ID);
            if (stayId != null) {
                stayByNotification.put(notification.getId(), stayId);
                continue;
            }
            Long cardId = longFact(facts, NotificationMetadata.SUGGESTION_ID);
            if (cardId != null) {
                cardByNotification.put(notification.getId(), cardId);
                continue;
            }
            String reference = textFact(facts, NotificationMetadata.RESERVATION_REFERENCE);
            if (reference != null) referenceByNotification.put(notification.getId(), reference);
        }

        // La carte rend TOUT ce que ses parametres portent, pas seulement le
        // sejour : une alerte de batterie n'en designe aucun, elle designe une
        // serrure — et sa fiche restait muette pour cette seule raison.
        Map<Long, Long> deviceByNotification = new HashMap<>();
        Map<Long, Long> reviewByNotification = new HashMap<>();
        resolveFromCards(notifications, cardByNotification, stayByNotification,
                deviceByNotification, reviewByNotification);
        resolveStaysFromReferences(notifications, referenceByNotification, stayByNotification);

        Map<Long, Reservation> stays = stayByNotification.isEmpty() ? Map.of()
                : reservationRepository
                        .findAllWithGuestByIdIn(new HashSet<>(stayByNotification.values())).stream()
                        .collect(Collectors.toMap(Reservation::getId, stay -> stay, (a, b) -> a));

        Map<Long, ReadFacts> resolved = new HashMap<>();
        for (Notification notification : notifications) {
            Long stayId = stayByNotification.get(notification.getId());
            Reservation stay = stayId == null ? null : stays.get(stayId);
            if (stay != null && !belongsTo(stay.getOrganizationId(), notification)) stay = null;

            Guest guest = stay == null ? null : stay.getGuest();
            String photo = guest != null ? photoUrls.publicUrl(guest.getId(), guest.getAvatarUrl()) : null;
            // Le sejour n'est REPUBLIE que s'il a ete DEDUIT — d'une carte ou
            // d'une reference. Quand l'identifiant etait deja dans les faits, le
            // regreffer serait du bruit.
            Long published = stay != null
                    && (cardByNotification.containsKey(notification.getId())
                        || referenceByNotification.containsKey(notification.getId()))
                    ? stayId : null;

            ReadFacts facts = new ReadFacts(published, photo,
                    deviceByNotification.get(notification.getId()),
                    reviewByNotification.get(notification.getId()));
            if (!facts.isEmpty()) resolved.put(notification.getId(), facts);
        }
        return resolved;
    }

    /**
     * Ce que la CARTE designe, pour les notifications qui n'ont garde qu'elle.
     *
     * <p>Le sejour vient de la carte elle-meme ; la serrure et l'avis de ses
     * parametres d'action. Tous trois etaient absents des faits avant que
     * ceux-ci n'existent, et rien ne fera renotifier une carte en attente : sans
     * ce repli, une alerte de batterie d'hier resterait un paragraphe a vie.</p>
     */
    private void resolveFromCards(Collection<Notification> notifications,
                                  Map<Long, Long> cardByNotification,
                                  Map<Long, Long> stayByNotification,
                                  Map<Long, Long> deviceByNotification,
                                  Map<Long, Long> reviewByNotification) {
        if (cardByNotification.isEmpty()) return;

        Map<Long, SupervisionSuggestion> cards = suggestionRepository
                .findAllById(new HashSet<>(cardByNotification.values())).stream()
                .collect(Collectors.toMap(SupervisionSuggestion::getId, card -> card, (a, b) -> a));

        for (Notification notification : notifications) {
            Long cardId = cardByNotification.get(notification.getId());
            if (cardId == null) continue;
            SupervisionSuggestion card = cards.get(cardId);
            if (card == null || !belongsTo(card.getOrganizationId(), notification)) continue;

            if (card.getReservationId() != null) {
                stayByNotification.put(notification.getId(), card.getReservationId());
            }
            Long device = longParam(card.getActionParams(), NotificationMetadata.DEVICE_ID);
            if (device != null) deviceByNotification.put(notification.getId(), device);
            Long review = longParam(card.getActionParams(), NotificationMetadata.REVIEW_ID);
            if (review != null) reviewByNotification.put(notification.getId(), review);
        }
    }

    /** Entier porte par les parametres d'action d'une carte, ou {@code null}. */
    private Long longParam(String actionParams, String field) {
        JsonNode params = parse(actionParams);
        return params == null ? null : longFact(params, field);
    }

    /**
     * Sejour des notifications qui n'en ont garde que la REFERENCE.
     *
     * <p>Un evenement de messagerie emis avant que l'identifiant du sejour n'y
     * soit joint ne porte que son code de confirmation : « SD-76-0041 ». Il
     * suffit a refaire le lien, et donc a retrouver le visage du voyageur sur
     * une fiche qui n'affichait que des initiales. Sans ce repli, tout
     * l'historique deja ecrit resterait muet — seuls les evenements a venir
     * montreraient la photo.</p>
     *
     * <p>Une requete par organisation, pas une par ligne : un code n'est unique
     * qu'a l'interieur d'une organisation, et une page de notifications n'en
     * couvre qu'une poignee (une seule, sauf pour le staff plateforme).</p>
     */
    private void resolveStaysFromReferences(Collection<Notification> notifications,
                                            Map<Long, String> referenceByNotification,
                                            Map<Long, Long> stayByNotification) {
        if (referenceByNotification.isEmpty()) return;

        Map<Long, Set<String>> codesByOrg = new HashMap<>();
        for (Notification notification : notifications) {
            String code = referenceByNotification.get(notification.getId());
            if (code == null || notification.getOrganizationId() == null) continue;
            codesByOrg.computeIfAbsent(notification.getOrganizationId(), org -> new HashSet<>()).add(code);
        }

        Map<Long, Map<String, Long>> stayIdByOrgAndCode = new HashMap<>();
        codesByOrg.forEach((orgId, codes) -> stayIdByOrgAndCode.put(orgId,
                reservationRepository.findAllWithGuestByConfirmationCodeIn(orgId, codes).stream()
                        .collect(Collectors.toMap(Reservation::getConfirmationCode,
                                Reservation::getId, (a, b) -> a))));

        for (Notification notification : notifications) {
            String code = referenceByNotification.get(notification.getId());
            if (code == null || notification.getOrganizationId() == null) continue;
            Long stayId = stayIdByOrgAndCode
                    .getOrDefault(notification.getOrganizationId(), Map.of()).get(code);
            if (stayId != null) stayByNotification.put(notification.getId(), stayId);
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

    private static String textFact(JsonNode facts, String key) {
        JsonNode node = facts.get(key);
        if (node == null || !node.isTextual()) return null;
        String value = node.asText().trim();
        return value.isEmpty() ? null : value;
    }
}
