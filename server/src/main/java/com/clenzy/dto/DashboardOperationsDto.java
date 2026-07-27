package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Blocs opérationnels de l'écran Dashboard : la journée en cours, les arrivées
 * à venir, et ce qui reste à traiter.
 *
 * <p>Complète {@link DashboardOverviewSummaryDto}, qui ne porte que des
 * compteurs et des KPI. Ici on renvoie des <b>listes bornées</b> — l'écran
 * affiche quelques lignes, pas des pages : le service tronque, le client
 * n'agrège rien.</p>
 *
 * <p>Aucune entité JPA n'est exposée : chaque enregistrement est un record plat,
 * mappé explicitement dans le service.</p>
 */
public record DashboardOperationsDto(
        List<ArrivalDto> arrivals,
        List<DepartureDto> departures,
        List<CleaningDto> cleanings) {

    /**
     * Arrivée du jour.
     *
     * @param checkInTime heure d'arrivée de la réservation, à défaut celle du
     *                    logement ; {@code null} si aucune n'est renseignée
     * @param note        demande particulière du voyageur, tronquée
     */
    public record ArrivalDto(
            Long reservationId,
            String guestName,
            Long propertyId,
            String propertyName,
            String checkInTime,
            String source,
            String sourceName,
            String note,
            int guestCount) {}

    /**
     * Départ du jour.
     *
     * @param depositToRelease montant de caution encore retenue, {@code null}
     *                         s'il n'y a rien à libérer
     */
    public record DepartureDto(
            Long reservationId,
            String guestName,
            Long propertyId,
            String propertyName,
            String checkOutTime,
            Long securityDepositId,
            BigDecimal depositToRelease) {}

    /**
     * Ménage planifié aujourd'hui.
     *
     * @param windowStart début de la fenêtre d'intervention ({@code HH:mm}), nullable
     * @param windowEnd   fin de la fenêtre ({@code HH:mm}), nullable
     */
    public record CleaningDto(
            Long interventionId,
            Long propertyId,
            String propertyName,
            String assigneeName,
            String windowStart,
            String windowEnd,
            String status) {}

    /** Arrivée à venir, pour le tableau « prochaines arrivées ». */
    public record UpcomingArrivalDto(
            Long reservationId,
            String guestName,
            Long propertyId,
            String propertyName,
            LocalDate checkIn,
            int nights,
            String source,
            String sourceName,
            String paymentStatus,
            BigDecimal totalPrice,
            BigDecimal amountDue) {}

    /**
     * Bloc « à traiter » — trois natures d'alerte agrégées en une seule liste
     * ordonnée, pour que l'écran n'ait pas à fusionner trois appels.
     */
    public record ActionItemsDto(
            List<BalanceDueDto> balancesDue,
            List<UnansweredReviewDto> unansweredReviews,
            List<StaleFeedDto> staleFeeds) {

        /** Total, tous types confondus — alimente le badge « N à traiter ». */
        public int total() {
            return balancesDue.size() + unansweredReviews.size() + staleFeeds.size();
        }
    }

    /** Solde de séjour restant dû avant l'arrivée. */
    public record BalanceDueDto(
            Long reservationId,
            String reference,
            String guestName,
            String propertyName,
            LocalDate checkIn,
            BigDecimal amountDue) {}

    /** Avis publié sans réponse de l'hôte. */
    public record UnansweredReviewDto(
            Long reviewId,
            String guestName,
            String propertyName,
            String channelName,
            Integer rating,
            String excerpt,
            LocalDate reviewDate) {}

    /**
     * Flux de calendrier en échec ou muet.
     *
     * @param hoursSinceLastSync {@code null} si le flux n'a jamais été synchronisé
     */
    public record StaleFeedDto(
            Long feedId,
            Long propertyId,
            String propertyName,
            String sourceName,
            String lastSyncStatus,
            Long hoursSinceLastSync) {}
}
