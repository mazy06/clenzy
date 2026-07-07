package com.clenzy.booking.repository;

import com.clenzy.booking.model.DesignSystem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DesignSystemRepository extends JpaRepository<DesignSystem, Long> {

    /** Systèmes visibles par une org : catalogue GLOBAL (org NULL) + ses propres systèmes privés. */
    @Query("""
        select d from DesignSystem d
        where d.organizationId is null or d.organizationId = :orgId
        order by case when d.organizationId is null then 0 else 1 end, d.createdAt desc
        """)
    List<DesignSystem> findVisibleTo(@Param("orgId") Long orgId);

    /** Comme {@link #findVisibleTo} mais restreint aux systèmes PUBLISHED (vue des users org). */
    @Query("""
        select d from DesignSystem d
        where (d.organizationId is null or d.organizationId = :orgId) and d.status = 'PUBLISHED'
        order by case when d.organizationId is null then 0 else 1 end, d.createdAt desc
        """)
    List<DesignSystem> findVisiblePublishedTo(@Param("orgId") Long orgId);
}
