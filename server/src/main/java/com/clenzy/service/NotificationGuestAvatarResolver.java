package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.Notification;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
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
 * Photo du voyageur designe par une notification.
 *
 * <p>Une notification ne porte que le NOM du voyageur : la photo vit sur sa
 * fiche, qu'on rejoint par le sejour. On ne peut pas la figer a l'emission —
 * l'URL est signee par un ticket valable un quart d'heure, et une notification
 * se lit souvent bien plus tard. Elle est donc frappee a la LECTURE, et le
 * sejour, lui, voyage dans les faits ({@code reservationId}).</p>
 *
 * <p>Une seule requete pour toute la page, voyageur joint. La resolution une a
 * une ferait un N+1 sur un ecran qui se recharge en continu — c'est exactement
 * ce qui interdisait les photos dans la liste des avis avant
 * {@link ReviewGuestAvatarResolver}.</p>
 *
 * <p>Une notification sans sejour, un sejour sans voyageur, un voyageur sans
 * photo : rien dans la table renvoyee, et l'interface retombe sur les
 * initiales. C'est le cas le plus frequent, pas une anomalie.</p>
 */
@Service
public class NotificationGuestAvatarResolver {

    private final ReservationRepository reservationRepository;
    private final GuestPhotoUrlResolver photoUrls;
    private final ObjectMapper objectMapper;

    public NotificationGuestAvatarResolver(ReservationRepository reservationRepository,
                                           GuestPhotoUrlResolver photoUrls,
                                           ObjectMapper objectMapper) {
        this.reservationRepository = reservationRepository;
        this.photoUrls = photoUrls;
        this.objectMapper = objectMapper;
    }

    /**
     * Photos d'un lot de notifications, indexees par identifiant de notification.
     *
     * <p>{@code findAllWithGuestByIdIn} ne passe pas par le filtre Hibernate :
     * l'appartenance a l'organisation de la notification est verifiee ICI,
     * explicitement (regle #3 de l'audit 2026-06). Un sejour d'une autre
     * organisation est traite comme absent — on ne confirme meme pas son
     * existence.</p>
     */
    @Transactional(readOnly = true)
    public Map<Long, String> forNotifications(Collection<Notification> notifications) {
        if (notifications == null || notifications.isEmpty()) return Map.of();

        Map<Long, Long> stayByNotification = new HashMap<>();
        Set<Long> stayIds = new HashSet<>();
        for (Notification notification : notifications) {
            Long stayId = reservationIdOf(notification);
            if (stayId == null) continue;
            stayByNotification.put(notification.getId(), stayId);
            stayIds.add(stayId);
        }
        if (stayIds.isEmpty()) return Map.of();

        List<Reservation> stays = reservationRepository.findAllWithGuestByIdIn(stayIds);
        Map<Long, Reservation> byId = stays.stream()
                .collect(Collectors.toMap(Reservation::getId, stay -> stay, (a, b) -> a));

        Map<Long, String> photos = new HashMap<>();
        for (Notification notification : notifications) {
            Long stayId = stayByNotification.get(notification.getId());
            if (stayId == null) continue;
            Reservation stay = byId.get(stayId);
            if (stay == null || !sameOrganization(stay, notification)) continue;
            Guest guest = stay.getGuest();
            String url = guest != null ? photoUrls.publicUrl(guest.getId(), guest.getAvatarUrl()) : null;
            if (url != null) photos.put(notification.getId(), url);
        }
        return photos;
    }

    /**
     * Une notification sans organisation (evenement plateforme) ne sert de
     * laissez-passer vers aucun sejour : on exige l'egalite, pas l'absence de
     * contradiction.
     */
    private static boolean sameOrganization(Reservation stay, Notification notification) {
        return notification.getOrganizationId() != null
                && Objects.equals(stay.getOrganizationId(), notification.getOrganizationId());
    }

    /** Sejour porte par les faits, ou {@code null} si absent ou illisible. */
    private Long reservationIdOf(Notification notification) {
        String json = notification.getMetadata();
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode node = objectMapper.readTree(json).get(NotificationMetadata.RESERVATION_ID);
            return node != null && node.canConvertToLong() ? node.asLong() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
