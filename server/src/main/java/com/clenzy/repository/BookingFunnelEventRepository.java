package com.clenzy.repository;

import com.clenzy.model.BookingFunnelEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BookingFunnelEventRepository extends JpaRepository<BookingFunnelEvent, Long> {

    /** Purge RGPD par tranche (rétention 13 mois) — le scheduler borne via {@code limit}. */
    @Modifying
    @Query(value = "DELETE FROM booking_funnel_events WHERE id IN "
            + "(SELECT id FROM booking_funnel_events WHERE occurred_at < :cutoff LIMIT :limit)",
            nativeQuery = true)
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff, @Param("limit") int limit);

    /** Compteurs par étape du funnel sur la période (org-scopé). */
    @Query("SELECT e.eventType AS eventType, COUNT(e) AS count FROM BookingFunnelEvent e "
            + "WHERE e.organizationId = :orgId AND e.occurredAt >= :from AND e.occurredAt < :to "
            + "GROUP BY e.eventType")
    List<TypeCount> countByTypeBetween(@Param("orgId") Long orgId,
                                       @Param("from") LocalDateTime from,
                                       @Param("to") LocalDateTime to);

    /** Série quotidienne par étape (graphique funnel dans le temps). */
    @Query(value = "SELECT CAST(occurred_at AS date) AS day, event_type AS eventType, COUNT(*) AS count "
            + "FROM booking_funnel_events "
            + "WHERE organization_id = :orgId AND occurred_at >= :from AND occurred_at < :to "
            + "GROUP BY 1, 2 ORDER BY 1", nativeQuery = true)
    List<DailyTypeCount> countDailyByTypeBetween(@Param("orgId") Long orgId,
                                                 @Param("from") LocalDateTime from,
                                                 @Param("to") LocalDateTime to);

    /**
     * Top des recherches SANS disponibilité (denied demand) : séjours demandés les
     * plus fréquents restés sans résultat — le signal « prix/min-stay à revoir ».
     */
    @Query(value = "SELECT payload->>'checkIn' AS checkIn, payload->>'checkOut' AS checkOut, "
            + "payload->>'guests' AS guests, COUNT(*) AS count "
            + "FROM booking_funnel_events "
            + "WHERE organization_id = :orgId AND event_type = 'SEARCH_NO_RESULT' "
            + "AND occurred_at >= :from AND occurred_at < :to AND payload->>'checkIn' IS NOT NULL "
            + "GROUP BY 1, 2, 3 ORDER BY count DESC, 1 LIMIT :limit", nativeQuery = true)
    List<DeniedSearch> topDeniedSearches(@Param("orgId") Long orgId,
                                         @Param("from") LocalDateTime from,
                                         @Param("to") LocalDateTime to,
                                         @Param("limit") int limit);

    interface TypeCount {
        String getEventType();
        long getCount();
    }

    interface DailyTypeCount {
        java.sql.Date getDay();
        String getEventType();
        long getCount();
    }

    interface DeniedSearch {
        String getCheckIn();
        String getCheckOut();
        String getGuests();
        long getCount();
    }
}
