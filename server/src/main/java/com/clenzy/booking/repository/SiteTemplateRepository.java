package com.clenzy.booking.repository;

import com.clenzy.booking.model.SiteTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SiteTemplateRepository extends JpaRepository<SiteTemplate, Long> {

    /**
     * Templates visibles par une org : le catalogue GLOBAL (organization_id NULL) + ses propres
     * templates privés. Globaux d'abord, puis du plus récent au plus ancien. {@code orgId} peut être
     * NULL (staff plateforme sans org) → seuls les globaux remontent.
     */
    @Query("""
        select t from SiteTemplate t
        where t.organizationId is null or t.organizationId = :orgId
        order by case when t.organizationId is null then 0 else 1 end, t.createdAt desc
        """)
    List<SiteTemplate> findVisibleTo(@Param("orgId") Long orgId);

    /**
     * Comme {@link #findVisibleTo} mais restreint aux templates PUBLISHED : vue des users org (le staff
     * plateforme, lui, voit aussi les brouillons via {@link #findVisibleTo}).
     */
    @Query("""
        select t from SiteTemplate t
        where (t.organizationId is null or t.organizationId = :orgId) and t.status = 'PUBLISHED'
        order by case when t.organizationId is null then 0 else 1 end, t.createdAt desc
        """)
    List<SiteTemplate> findVisiblePublishedTo(@Param("orgId") Long orgId);
}
