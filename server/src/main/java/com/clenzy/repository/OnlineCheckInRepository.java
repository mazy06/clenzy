package com.clenzy.repository;

import com.clenzy.model.OnlineCheckIn;
import com.clenzy.model.OnlineCheckInStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;

@Repository
public interface OnlineCheckInRepository extends JpaRepository<OnlineCheckIn, Long> {

    Optional<OnlineCheckIn> findByToken(UUID token);

    Optional<OnlineCheckIn> findByReservationIdAndOrganizationId(Long reservationId, Long organizationId);

    Page<OnlineCheckIn> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId, Pageable pageable);

    List<OnlineCheckIn> findByStatusAndExpiresAtBefore(OnlineCheckInStatus status, LocalDateTime before);

    /**
     * Check-in en ligne jamais commencé alors que l'arrivée approche.
     *
     * <p>La jointure sur la réservation est indispensable : c'est la date
     * d'arrivée, et non celle du check-in, qui rend la situation urgente.</p>
     */
    @Query("""
            SELECT c FROM OnlineCheckIn c
            JOIN c.reservation r
            WHERE c.organizationId = :orgId
              AND c.status = com.clenzy.model.OnlineCheckInStatus.PENDING
              AND r.checkIn <= :horizon
              AND r.checkIn >= :from
            ORDER BY r.checkIn ASC
            """)
    List<OnlineCheckIn> findNotStartedBeforeArrival(@Param("orgId") Long orgId,
                                                    @Param("from") LocalDate from,
                                                    @Param("horizon") LocalDate horizon);
}
