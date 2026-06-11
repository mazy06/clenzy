package com.clenzy.service.ical;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Detection des reservations orphelines : presentes en DB mais disparues du feed iCal.
 * Cas le plus courant : Airbnb supprime l'evenement du calendrier lors d'une annulation.
 */
@Component
public class ICalOrphanDetector {

    private static final Logger log = LoggerFactory.getLogger(ICalOrphanDetector.class);

    /**
     * Seuil d'avortement de la detection d'orphelins. Si la part des reservations
     * futures actives qui disparaitraient du feed depasse ce ratio, on n'annule
     * RIEN : un feed transitoirement tronque (HTTP 200 partiel, drop de parsing)
     * ne doit jamais declencher d'annulation en masse — l'annulation cascade
     * libere les jours (CalendarEngine -> sync sortante vers les autres canaux)
     * et n'est pas reversible automatiquement (pas de reactivation au retour de
     * l'UID). Valeur choisie : 20% — l'ancien seuil de 50% laissait s'annuler
     * jusqu'a la moitie du carnet de reservations sur un feed incomplet.
     */
    private static final double MAX_ORPHAN_RATIO = 0.20;

    private final ReservationRepository reservationRepository;
    private final ICalReservationCanceller reservationCanceller;

    public ICalOrphanDetector(ReservationRepository reservationRepository,
                              ICalReservationCanceller reservationCanceller) {
        this.reservationRepository = reservationRepository;
        this.reservationCanceller = reservationCanceller;
    }

    /**
     * Garde-fous (anti-fausse-annulation-massive) :
     *   1. Feed sans aucun UID (vide / erreur de parsing) -> aucune suppression + alerte
     *      si des reservations futures existent
     *   2. Feed sans aucun evenement futur alors que des reservations futures actives
     *      existent (feed tronque) -> aucune suppression + alerte
     *   3. Seules les reservations FUTURES sont candidates (les feeds OTA omettent le passe)
     *   4. Si plus de {@link #MAX_ORPHAN_RATIO} des futures actives deviendraient
     *      orphelines, on n'annule rien (feed incomplet)
     */
    public void detectAndCancelOrphans(ICalImportSession session, List<ICalEventPreview> feedEvents) {
        try {
            Set<String> feedUids = feedEvents.stream()
                    .map(ICalEventPreview::getUid)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toCollection(HashSet::new));
            // Z6-SECBUGS-05 : un UID present dans le feed mais dont l'evenement n'a pas pu
            // etre parse (date malformee) ne doit PAS rendre la reservation orpheline —
            // sinon une simple date non standard declenche une annulation cascade.
            feedUids.addAll(session.unparsableUids);

            LocalDate today = LocalDate.now();
            List<Reservation> futureActive = reservationRepository
                    .findActiveByICalFeedId(session.feed.getId(), session.orgId)
                    .stream()
                    .filter(r -> r.getCheckOut() != null && r.getCheckOut().isAfter(today))
                    .collect(Collectors.toList());

            List<Reservation> orphans = futureActive.stream()
                    .filter(r -> r.getExternalUid() != null && !feedUids.contains(r.getExternalUid()))
                    .collect(Collectors.toList());

            if (shouldAbortOrphanPass(session, feedUids, feedEvents, futureActive, orphans, today)) {
                return;
            }

            for (Reservation orphan : orphans) {
                reservationCanceller.cancelReservationWithCascade(orphan, session);
                session.cancelled++;
                log.info("iCal sync: reservation orpheline #{} (uid={}) annulee — absente du feed",
                        orphan.getId(), orphan.getExternalUid());
            }
        } catch (Exception e) {
            // Pas un swallow : l'erreur est comptee dans le resultat de sync (statut PARTIAL).
            log.warn("Erreur detection orphelins iCal feed #{}: {}", session.feed.getId(), e.getMessage());
            session.errors.add("Detection orphelins: " + e.getMessage());
        }
    }

    /**
     * Applique les garde-fous de la detection d'orphelins. Retourne true si la passe
     * doit etre abandonnee (et ajoute l'alerte correspondante a la session).
     */
    private boolean shouldAbortOrphanPass(ICalImportSession session, Set<String> feedUids,
                                          List<ICalEventPreview> feedEvents,
                                          List<Reservation> futureActive,
                                          List<Reservation> orphans, LocalDate today) {
        if (feedUids.isEmpty()) {
            log.warn("iCal sync feed #{}: aucun UID parse, detection des orphelins ignoree (securite)",
                    session.feed.getId());
            if (!futureActive.isEmpty()) {
                session.errors.add("Detection orphelins ignoree: le feed distant est vide alors que "
                        + futureActive.size() + " reservation(s) future(s) existe(nt) (feed potentiellement tronque)");
            }
            return true;
        }
        if (futureActive.isEmpty()) {
            return true;
        }
        boolean feedHasFutureEvents = feedEvents.stream().anyMatch(e -> isFutureEvent(e, today));
        if (!feedHasFutureEvents) {
            log.warn("iCal sync feed #{}: aucun evenement futur dans le feed alors que {} reservation(s) future(s) active(s) existe(nt) — abort (feed tronque ?)",
                    session.feed.getId(), futureActive.size());
            session.errors.add("Detection orphelins ignoree: aucun evenement futur dans le feed (feed potentiellement tronque)");
            return true;
        }
        if (!orphans.isEmpty() && orphans.size() > futureActive.size() * MAX_ORPHAN_RATIO) {
            log.warn("iCal sync feed #{}: {}/{} reservations futures seraient annulees (> {}%) — abort (feed incomplet ?)",
                    session.feed.getId(), orphans.size(), futureActive.size(), (int) (MAX_ORPHAN_RATIO * 100));
            session.errors.add("Detection orphelins ignoree: trop de reservations seraient annulees (feed potentiellement incomplet)");
            return true;
        }
        return false;
    }

    private static boolean isFutureEvent(ICalEventPreview event, LocalDate today) {
        LocalDate end = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart();
        return end != null && end.isAfter(today);
    }
}
