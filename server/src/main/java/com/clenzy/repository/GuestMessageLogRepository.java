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

    List<GuestMessageLog> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    List<GuestMessageLog> findByReservationIdOrderByCreatedAtDesc(Long reservationId);

    /**
     * Verifie si un message de ce type a deja ete envoye (ou est en attente)
     * pour cette reservation. Utilise par le scheduler pour eviter les doublons.
     */
    @Query("SELECT COUNT(gml) > 0 FROM GuestMessageLog gml " +
           "WHERE gml.reservationId = :reservationId " +
           "AND gml.template.type = :type " +
           "AND gml.status IN (com.clenzy.model.MessageStatus.SENT, " +
           "com.clenzy.model.MessageStatus.DELIVERED, " +
           "com.clenzy.model.MessageStatus.PENDING)")
    boolean existsSentOrPendingByReservationAndType(
        @Param("reservationId") Long reservationId,
        @Param("type") MessageTemplateType type);
}
