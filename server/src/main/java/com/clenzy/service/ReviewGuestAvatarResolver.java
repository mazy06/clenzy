package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.GuestReview;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Photo du voyageur qui a laisse un avis.
 *
 * <p>L'avis ne porte qu'un NOM : la photo vit sur la fiche du voyageur, qu'on
 * rejoint par la reservation. Ce detour est la seule raison d'etre de ce
 * composant — {@link ReviewService} n'a pas a connaitre les reservations pour
 * servir un avis, et la fiche d'un avis n'a pas a savoir ou dort une photo.</p>
 *
 * <p>Un avis sans reservation rattachee, un voyageur sans photo : {@code null},
 * et l'interface retombe sur les initiales. C'est le cas le plus frequent, pas
 * une anomalie.</p>
 *
 * <p>Deux acces, un seul detour : {@link #forReview} pour un avis ouvert,
 * {@link #forReviews} pour une page entiere. Le second existe parce que le
 * premier, appele en boucle, ferait un N+1 — c'etait la raison pour laquelle
 * les listes se contentaient des initiales.</p>
 */
@Service
public class ReviewGuestAvatarResolver {

    private final ReservationRepository reservationRepository;
    private final GuestPhotoUrlResolver photoUrls;

    public ReviewGuestAvatarResolver(ReservationRepository reservationRepository,
                                     GuestPhotoUrlResolver photoUrls) {
        this.reservationRepository = reservationRepository;
        this.photoUrls = photoUrls;
    }

    /**
     * URL signee de la photo du voyageur, ou {@code null}.
     *
     * <p>{@code findById} ne passe pas par le filtre Hibernate : l'appartenance
     * a l'organisation de l'avis est verifiee ICI, explicitement (regle #3 de
     * l'audit 2026-06). Une reservation d'une autre organisation est traitee
     * comme absente — on ne confirme meme pas son existence.</p>
     */
    /**
     * Photos d'une PAGE d'avis, indexees par identifiant d'avis.
     *
     * <p>Une seule requete pour tout le lot, voyageur compris. Les avis sans
     * photo sont simplement absents de la table renvoyee — l'appelant lit alors
     * {@code null} et retombe sur les initiales.</p>
     *
     * <p>Meme controle d'appartenance qu'a l'unite : une reservation dont
     * l'organisation ne correspond pas a celle de l'avis est traitee comme
     * absente. Elle ne peut pas fuiter une photo d'une autre organisation.</p>
     */
    @Transactional(readOnly = true)
    public Map<Long, String> forReviews(Collection<GuestReview> reviews) {
        if (reviews == null || reviews.isEmpty()) return Map.of();

        Set<Long> reservationIds = reviews.stream()
            .map(GuestReview::getReservationId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        if (reservationIds.isEmpty()) return Map.of();

        List<Reservation> reservations = reservationRepository.findAllWithGuestByIdIn(reservationIds);
        Map<Long, Reservation> byId = reservations.stream()
            .collect(Collectors.toMap(Reservation::getId, reservation -> reservation, (a, b) -> a));

        Map<Long, String> photos = new HashMap<>();
        for (GuestReview review : reviews) {
            if (review.getReservationId() == null) continue;
            Reservation reservation = byId.get(review.getReservationId());
            if (reservation == null
                    || !Objects.equals(reservation.getOrganizationId(), review.getOrganizationId())) {
                continue;
            }
            Guest guest = reservation.getGuest();
            String url = guest != null ? photoUrls.publicUrl(guest.getId(), guest.getAvatarUrl()) : null;
            if (url != null) photos.put(review.getId(), url);
        }
        return photos;
    }

    @Transactional(readOnly = true)
    public String forReview(GuestReview review) {
        if (review == null || review.getReservationId() == null) {
            return null;
        }
        Reservation reservation = reservationRepository.findById(review.getReservationId()).orElse(null);
        if (reservation == null
                || !Objects.equals(reservation.getOrganizationId(), review.getOrganizationId())) {
            return null;
        }
        Guest guest = reservation.getGuest();
        return guest != null ? photoUrls.publicUrl(guest.getId(), guest.getAvatarUrl()) : null;
    }
}
