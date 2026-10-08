package com.clenzy.repository;

import com.clenzy.model.OwnerPayoutReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface OwnerPayoutReservationRepository extends JpaRepository<OwnerPayoutReservation, Long> {
    List<OwnerPayoutReservation> findByPayoutIdAndOrganizationId(Long payoutId, Long organizationId);

    @Query("select r.reservationId from OwnerPayoutReservation r where r.reservationId in :ids")
    List<Long> findClaimedReservationIds(@Param("ids") List<Long> ids);
}
