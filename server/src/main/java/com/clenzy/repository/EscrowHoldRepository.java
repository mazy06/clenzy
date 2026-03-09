package com.clenzy.repository;

import com.clenzy.model.EscrowHold;
import com.clenzy.model.EscrowStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EscrowHoldRepository extends JpaRepository<EscrowHold, Long> {

    Optional<EscrowHold> findByReservationIdAndStatus(Long reservationId, EscrowStatus status);

    List<EscrowHold> findByOrganizationIdAndStatus(Long organizationId, EscrowStatus status);

    List<EscrowHold> findByStatus(EscrowStatus status);

    @Query("SELECT e FROM EscrowHold e WHERE e.status = :status AND e.releaseAt <= :now")
    List<EscrowHold> findReleasable(@Param("status") EscrowStatus status,
                                     @Param("now") LocalDateTime now);

    List<EscrowHold> findByOrganizationId(Long organizationId);
}
