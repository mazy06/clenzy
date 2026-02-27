package com.clenzy.repository;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.ContractStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ManagementContractRepository extends JpaRepository<ManagementContract, Long> {

    @Query("SELECT c FROM ManagementContract c WHERE c.organizationId = :orgId")
    List<ManagementContract> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT c FROM ManagementContract c WHERE c.propertyId = :propertyId AND c.organizationId = :orgId")
    List<ManagementContract> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ManagementContract c WHERE c.ownerId = :ownerId AND c.organizationId = :orgId")
    List<ManagementContract> findByOwnerId(@Param("ownerId") Long ownerId, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ManagementContract c WHERE c.status = :status AND c.organizationId = :orgId")
    List<ManagementContract> findByStatus(@Param("status") ContractStatus status, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ManagementContract c WHERE c.id = :id AND c.organizationId = :orgId")
    Optional<ManagementContract> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ManagementContract c WHERE c.propertyId = :propertyId AND c.organizationId = :orgId AND c.status = 'ACTIVE'")
    Optional<ManagementContract> findActiveByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ManagementContract c WHERE c.status = 'ACTIVE' AND c.endDate IS NOT NULL AND c.endDate < :today AND c.organizationId = :orgId")
    List<ManagementContract> findExpiredContracts(@Param("today") LocalDate today, @Param("orgId") Long orgId);
}
