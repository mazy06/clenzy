package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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
     * Bloc « à traiter » — **une seule file**, toutes natures confondues.
     *
     * <p>Choix de conception : les cartes HITL des agents, les soldes dus, les avis
     * sans réponse, les calendriers en dérive et les demandes de service impayées
     * partagent la même forme. Des listes parallèles obligeaient l'écran à les
     * fusionner et à les ordonner lui-même — et laissaient la catégorie la plus
     * bavarde noyer les autres.</p>
     *
     * @param items        file ordonnée par urgence, déjà plafonnée par nature
     * @param total        nombre réel d'éléments en attente, avant plafonnement
     * @param totalsByKind décompte réel par nature — sans lui, l'écran ne pourrait
     *                     compter que les lignes reçues et afficherait « Avis (3) »
     *                     là où douze attendent
     */
    public record ActionItemsDto(
            List<ActionItemDto> items,
            int total,
            Map<ActionItemKind, Integer> totalsByKind) {}

    /**
     * Élément de la file « à traiter ».
     *
     * <p>Les champs sont volontairement <b>génériques</b> et non spécifiques à une
     * nature : {@code subject} porte la personne concernée quelle que soit
     * l'origine (le voyageur d'un avis comme celui d'un solde) et {@code badge}
     * la mention courte affichée en fin de ligne quand ce n'est pas un montant.
     * Un champ par nature aurait fait de ce record un fourre-tout.</p>
     *
     * @param id        identifiant stable, préfixé par la nature ({@code hitl:42})
     * @param kind      nature — voir {@link ActionItemKind}
     * @param severity  {@code critical} | {@code warning} | {@code info}
     * @param title     intitulé métier, lisible seul
     * @param detail    contexte court (voyageur, logement, ancienneté…)
     * @param subject      personne concernée, s'il y en a une — porte l'avatar
     * @param targetId     identifiant de l'objet visé, pour agir dessus
     * @param propertyId   logement concerné — l'écran doit pouvoir agir sans le
     *                     redemander au serveur
     * @param amount       montant en jeu quand la nature en porte un, sinon {@code null}
     * @param badge        mention courte de fin de ligne ({@code 4★}), sinon {@code null}
     * @param actionType   réservé : nature technique de l'action, {@code null} aujourd'hui
     * @param actionParams réservé : paramètres de cette action (JSON), {@code null} aujourd'hui
     */
    public record ActionItemDto(
            String id,
            ActionItemKind kind,
            String severity,
            String title,
            String detail,
            String subject,
            Long targetId,
            Long propertyId,
            String propertyName,
            BigDecimal amount,
            String badge,
            String actionType,
            String actionParams) {}

    /**
     * Natures d'action, par ordre de priorité d'affichage.
     *
     * <p>L'ordre de déclaration EST l'ordre de tri à sévérité égale : un solde
     * non encaissé passe avant un avis sans réponse.</p>
     */
    public enum ActionItemKind {
        /** Solde de séjour restant dû avant l'arrivée. */
        BALANCE_DUE,
        /** Demande de service réalisée et non réglée. */
        SERVICE_UNPAID,
        /** Prestation sans prestataire, que l'assignation automatique n'aboutira plus. */
        SERVICE_UNASSIGNED,
        /** Flux de calendrier en échec ou muet. */
        FEED_STALE,
        /** Avis publié sans réponse de l'hôte. */
        REVIEW_UNANSWERED,
    }
}
