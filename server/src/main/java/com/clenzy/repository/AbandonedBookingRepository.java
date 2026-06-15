package com.clenzy.repository;

import com.clenzy.model.AbandonedBooking;
import com.clenzy.model.AbandonedBookingStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AbandonedBookingRepository extends JpaRepository<AbandonedBooking, Long> {

    boolean existsByOrganizationIdAndReservationId(Long organizationId, Long reservationId);

    /** Paniers en attente de relance, suffisamment anciens — cross-org, pour le scheduler. */
    @Query("SELECT a FROM AbandonedBooking a WHERE a.status = com.clenzy.model.AbandonedBookingStatus.PENDING "
         + "AND a.createdAt <= :cutoff ORDER BY a.createdAt ASC")
    List<AbandonedBooking> findDueForRecovery(@Param("cutoff") Instant cutoff, Pageable pageable);

    long countByOrganizationIdAndStatus(Long organizationId, AbandonedBookingStatus status);
}
