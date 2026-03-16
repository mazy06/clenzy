package com.clenzy.repository;

import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageTemplateType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GuestMessageLogRepository extends JpaRepository<GuestMessageLog, Long> {

    @Query("SELECT gml FROM GuestMessageLog gml " +
           "LEFT JOIN FETCH gml.guest " +
           "LEFT JOIN FETCH gml.template " +
           "WHERE gml.organizationId = :orgId " +
           "ORDER BY gml.createdAt DESC")
    List<GuestMessageLog> findByOrganizationIdOrderByCreatedAtDesc(@Param("orgId") Long organizationId);

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
}
