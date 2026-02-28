package com.clenzy.repository;

import com.clenzy.model.IntegrationPartner;
import com.clenzy.model.IntegrationPartner.IntegrationCategory;
import com.clenzy.model.IntegrationPartner.IntegrationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IntegrationPartnerRepository extends JpaRepository<IntegrationPartner, Long> {

    @Query("SELECT p FROM IntegrationPartner p WHERE p.organizationId = :orgId")
    List<IntegrationPartner> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT p FROM IntegrationPartner p WHERE p.id = :id AND p.organizationId = :orgId")
    Optional<IntegrationPartner> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT p FROM IntegrationPartner p WHERE p.category = :category AND p.organizationId = :orgId")
    List<IntegrationPartner> findByCategory(@Param("category") IntegrationCategory category, @Param("orgId") Long orgId);

    @Query("SELECT p FROM IntegrationPartner p WHERE p.status = :status AND p.organizationId = :orgId")
    List<IntegrationPartner> findByStatus(@Param("status") IntegrationStatus status, @Param("orgId") Long orgId);

    @Query("SELECT p FROM IntegrationPartner p WHERE p.partnerSlug = :slug AND p.organizationId = :orgId")
    Optional<IntegrationPartner> findBySlugAndOrgId(@Param("slug") String slug, @Param("orgId") Long orgId);
}
