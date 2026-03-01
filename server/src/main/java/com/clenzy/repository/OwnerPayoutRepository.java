package com.clenzy.repository;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface OwnerPayoutRepository extends JpaRepository<OwnerPayout, Long> {

    @Query("SELECT p FROM OwnerPayout p WHERE p.ownerId = :ownerId AND p.organizationId = :orgId ORDER BY p.periodStart DESC")
    List<OwnerPayout> findByOwnerId(@Param("ownerId") Long ownerId, @Param("orgId") Long orgId);

    @Query("SELECT p FROM OwnerPayout p WHERE p.status = :status AND p.organizationId = :orgId ORDER BY p.periodStart DESC")
    List<OwnerPayout> findByStatus(@Param("status") PayoutStatus status, @Param("orgId") Long orgId);

    @Query("SELECT p FROM OwnerPayout p WHERE p.id = :id AND p.organizationId = :orgId")
    Optional<OwnerPayout> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT p FROM OwnerPayout p WHERE p.organizationId = :orgId ORDER BY p.periodStart DESC")
    List<OwnerPayout> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT p FROM OwnerPayout p WHERE p.ownerId = :ownerId AND p.periodStart = :start AND p.periodEnd = :end AND p.organizationId = :orgId")
    Optional<OwnerPayout> findByOwnerAndPeriod(@Param("ownerId") Long ownerId,
        @Param("start") LocalDate start, @Param("end") LocalDate end, @Param("orgId") Long orgId);
}
