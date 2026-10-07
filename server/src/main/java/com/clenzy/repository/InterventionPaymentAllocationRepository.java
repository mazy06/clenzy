package com.clenzy.repository;

import com.clenzy.model.InterventionPaymentAllocation;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface InterventionPaymentAllocationRepository extends JpaRepository<InterventionPaymentAllocation, Long> {
    @Query("select a from InterventionPaymentAllocation a join fetch a.transaction t "
            + "where a.organizationId=:org and t.organizationId=:org and t.transactionRef=:ref order by a.interventionId")
    List<InterventionPaymentAllocation> findForTransaction(@Param("org") Long org, @Param("ref") String ref);

    @Query("select a from InterventionPaymentAllocation a join fetch a.transaction t "
            + "where a.organizationId=:org and t.organizationId=:org and a.interventionId=:mission order by a.id")
    List<InterventionPaymentAllocation> findForMission(@Param("org") Long org, @Param("mission") Long mission);
}
