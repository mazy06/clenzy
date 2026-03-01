package com.clenzy.repository;

import com.clenzy.model.MigrationJob;
import com.clenzy.model.MigrationJob.MigrationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MigrationJobRepository extends JpaRepository<MigrationJob, Long> {

    @Query("SELECT j FROM MigrationJob j WHERE j.organizationId = :orgId ORDER BY j.createdAt DESC")
    List<MigrationJob> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT j FROM MigrationJob j WHERE j.id = :id AND j.organizationId = :orgId")
    Optional<MigrationJob> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT j FROM MigrationJob j WHERE j.status = :status AND j.organizationId = :orgId")
    List<MigrationJob> findByStatus(@Param("status") MigrationStatus status, @Param("orgId") Long orgId);
}
