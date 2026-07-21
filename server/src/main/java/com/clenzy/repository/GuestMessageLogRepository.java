package com.clenzy.repository;

import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageTemplateType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface GuestMessageLogRepository extends JpaRepository<GuestMessageLog, Long> {

    /**
     * Historique org borne ({@code Pageable}) — la table est cumulative,
     * l'appelant limite aux N entrees les plus recentes (audit perf 2026-07-21).
     * guest/template sont des ManyToOne : le fetch join reste compatible
     * avec la pagination SQL (pas de collection fetch).
     */
    @Query("SELECT gml FROM GuestMessageLog gml " +
           "LEFT JOIN FETCH gml.guest " +
           "LEFT JOIN FETCH gml.template " +
           "WHERE gml.organizationId = :orgId " +
           "ORDER BY gml.createdAt DESC")
    List<GuestMessageLog> findByOrganizationIdOrderByCreatedAtDesc(
        @Param("orgId") Long organizationId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT gml FROM GuestMessageLog gml " +
           "LEFT JOIN FETCH gml.guest " +
           "LEFT JOIN FETCH gml.template " +
           "WHERE gml.reservationId = :reservationId " +
           "ORDER BY gml.createdAt DESC")
    List<GuestMessageLog> findByReservationIdOrderByCreatedAtDesc(@Param("reservationId") Long reservationId);

    /**
     * Verifie si un message de ce type a deja ete envoye, est en attente ou a echoue
     * pour cette reservation. Utilise par le scheduler pour eviter les doublons
     * et les boucles de retry infinies sur les echecs permanents.
     */
    @Query("SELECT COUNT(gml) > 0 FROM GuestMessageLog gml " +
           "WHERE gml.reservationId = :reservationId " +
           "AND gml.template.type = :type " +
           "AND gml.status IN (com.clenzy.model.MessageStatus.SENT, " +
           "com.clenzy.model.MessageStatus.DELIVERED, " +
           "com.clenzy.model.MessageStatus.PENDING, " +
           "com.clenzy.model.MessageStatus.FAILED)")
    boolean existsSentOrPendingByReservationAndType(
        @Param("reservationId") Long reservationId,
        @Param("type") MessageTemplateType type);

    /**
     * Echecs d'envoi recents d'un logement (scanner constellation « guest_message_failed »).
     * Reservation + template fetches pour eviter le N+1 dans le scan.
     */
    @Query("SELECT gml FROM GuestMessageLog gml " +
           "JOIN FETCH gml.reservation r " +
           "LEFT JOIN FETCH gml.template " +
           "WHERE gml.organizationId = :orgId " +
           "AND r.property.id = :propertyId " +
           "AND gml.status = com.clenzy.model.MessageStatus.FAILED " +
           "AND gml.createdAt >= :since " +
           "ORDER BY gml.createdAt DESC")
    List<GuestMessageLog> findRecentFailedByProperty(
        @Param("orgId") Long orgId,
        @Param("propertyId") Long propertyId,
        @Param("since") LocalDateTime since);

    /**
     * Vrai si un envoi du meme type a abouti APRES l'echec donne — l'echec est alors
     * considere resolu (renvoi manuel ou retry reussi).
     */
    @Query("SELECT COUNT(gml) > 0 FROM GuestMessageLog gml " +
           "WHERE gml.reservationId = :reservationId " +
           "AND gml.template.type = :type " +
           "AND gml.createdAt > :after " +
           "AND gml.status IN (com.clenzy.model.MessageStatus.SENT, " +
           "com.clenzy.model.MessageStatus.DELIVERED)")
    boolean existsDeliveredAfter(
        @Param("reservationId") Long reservationId,
        @Param("type") MessageTemplateType type,
        @Param("after") LocalDateTime after);

    /** Nombre d'echecs d'envoi recents de l'org (pastille du menu Documents). */
    @Query("SELECT COUNT(gml) FROM GuestMessageLog gml " +
           "WHERE gml.organizationId = :orgId " +
           "AND gml.status = com.clenzy.model.MessageStatus.FAILED " +
           "AND gml.createdAt >= :since")
    long countFailedByOrganizationSince(
        @Param("orgId") Long orgId,
        @Param("since") LocalDateTime since);
}
