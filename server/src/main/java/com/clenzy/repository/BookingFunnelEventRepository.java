package com.clenzy.repository;

import com.clenzy.model.BookingFunnelEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface BookingFunnelEventRepository extends JpaRepository<BookingFunnelEvent, Long> {

    /** Purge RGPD par tranche (rétention 13 mois) — le scheduler borne via {@code limit}. */
    @Modifying
    @Query(value = "DELETE FROM booking_funnel_events WHERE id IN "
            + "(SELECT id FROM booking_funnel_events WHERE occurred_at < :cutoff LIMIT :limit)",
            nativeQuery = true)
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff, @Param("limit") int limit);
}
