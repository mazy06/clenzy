package com.clenzy.dto.smartlock;

import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCodeEvent;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Etat COMPLET des codes d'acces d'une serrure : le code en vigueur, les codes
 * passes, et le journal des evenements.
 *
 * <p><b>Pourquoi cette vue existe.</b> {@code GET /{id}/access-code} ne renvoie
 * que le code ACTIF, et 204 sinon. L'ecran n'avait donc qu'un seul mot pour
 * trois situations tres differentes : aucun sejour en cours (normal), generation
 * en echec (a corriger), code revoque au depart (trace). « Aucun code actif » se
 * lisait comme une panne alors qu'une notification annoncait un code au meme
 * instant — le journal existait deja en base, rien ne le lisait.</p>
 *
 * <p><b>Le PIN des codes passes n'est jamais renvoye.</b> Un code revoque,
 * expire ou en echec n'ouvre plus rien : sa valeur n'a plus d'usage, et la
 * transporter multiplierait les copies d'un secret d'acces physique. Seul le
 * code EN VIGUEUR porte sa valeur — les autres ne gardent que leur fenetre,
 * leur statut et leur sejour.</p>
 */
public record SmartLockAccessCodeHistoryDto(
        /** Code en vigueur, PIN compris. {@code null} si la serrure n'en a aucun. */
        SmartLockAccessCodeDto current,
        /** Codes passes, du plus recent au plus ancien. PIN toujours absent. */
        List<PastCode> past,
        /** Journal des evenements de cette serrure, du plus recent au plus ancien. */
        List<Event> events,
        /**
         * Sejour en cours sur le logement de cette serrure, ou {@code null}.
         *
         * <p>Regenerer un code revoque celui du voyageur present : l'ecran doit
         * pouvoir le dire AVANT, dans sa demande de confirmation.</p>
         */
        OngoingStay ongoingStay
) {

    /**
     * Le sejour en cours — ses dates, rien de plus. Ni nom ni contact : la carte
     * d'un objet connecte n'a pas besoin d'identifier le voyageur pour prevenir
     * qu'il y en a un.
     */
    public record OngoingStay(Long reservationId, LocalDate checkIn, LocalDate checkOut) {}

    /** Un code qui n'est plus en vigueur — sa trace, jamais sa valeur. */
    public record PastCode(
            Long id,
            Long reservationId,
            String name,
            LocalDateTime validFrom,
            LocalDateTime validUntil,
            String status,
            String source,
            LocalDateTime createdAt,
            LocalDateTime revokedAt
    ) {
        public static PastCode from(SmartLockAccessCode c) {
            return new PastCode(
                    c.getId(), c.getReservationId(), c.getName(),
                    c.getValidFrom(), c.getValidUntil(),
                    c.getStatus() != null ? c.getStatus().name() : null,
                    c.getSource() != null ? c.getSource().name() : null,
                    c.getCreatedAt(), c.getRevokedAt());
        }
    }

    /**
     * Un evenement du journal. {@code notes} ne contient JAMAIS de PIN — c'est
     * le contrat de {@code recordEvent} / {@code recordFailure} cote service,
     * et c'est ce qui rend ce champ affichable tel quel (il porte le motif d'un
     * echec, la raison d'une revocation).
     */
    public record Event(
            Long id,
            Long codeId,
            Long reservationId,
            String eventType,
            String source,
            String actorName,
            String notes,
            LocalDateTime createdAt
    ) {
        public static Event from(SmartLockAccessCodeEvent e) {
            return new Event(
                    e.getId(), e.getCodeId(), e.getReservationId(),
                    e.getEventType() != null ? e.getEventType().name() : null,
                    e.getSource() != null ? e.getSource().name() : null,
                    e.getActorName(), e.getNotes(), e.getCreatedAt());
        }
    }
}
