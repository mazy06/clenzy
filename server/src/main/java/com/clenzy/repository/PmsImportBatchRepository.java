package com.clenzy.repository;

import com.clenzy.model.PmsImportBatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface PmsImportBatchRepository extends JpaRepository<PmsImportBatch, UUID> {
    boolean existsByOrganizationIdAndCreatedByAndStatus(Long organizationId, String createdBy, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from PmsImportBatch b where b.id = :id and b.organizationId = :org")
    Optional<PmsImportBatch> lockByIdAndOrg(@Param("id") UUID id, @Param("org") Long org);

    interface Summary {
        UUID getId(); String getSource(); String getSourceAccount(); String getStatus(); java.time.Instant getCreatedAt();
    }
    @Query("select b.id as id, b.source as source, b.sourceAccount as sourceAccount, b.status as status, b.createdAt as createdAt "
        + "from PmsImportBatch b where b.organizationId = :org and b.createdBy = :actor order by b.createdAt desc")
    List<Summary> findRecent(@Param("org") Long org, @Param("actor") String actor,
                                   org.springframework.data.domain.Pageable page);
}
